import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  QUERY_CATEGORIES,
  applyComputedOp,
  type ConditionRule,
  type SortRule,
  type ComputedField,
} from "@/utils/smart-query-schema";
import { withTenant } from "@/utils/tenant-auth";

const MAX_ROWS = 50000;

const USER_FIELDS = new Set([
  "cr_user",
  "md_user",
  "created_by",
  "modified_by",
  "updated_by",
  "approved_by",
  "reviewed_by",
  "closed_by",
  "rectified_by",
  "amended_by",
]);

async function getUserMap(supabase: any): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name");

    if (profiles && Array.isArray(profiles)) {
      for (const p of profiles) {
        const name = (p.full_name && p.full_name.trim()) || (p.email ? p.email.split("@")[0] : "");
        if (!name) continue;

        if (p.id) {
          map.set(String(p.id), name);
          map.set(String(p.id).toLowerCase(), name);
        }
        if (p.email) {
          map.set(String(p.email), name);
          map.set(String(p.email).toLowerCase(), name);
          const prefix = p.email.split("@")[0];
          map.set(prefix, name);
          map.set(prefix.toLowerCase(), name);
        }
      }
    }
  } catch (err) {
    console.error("[SmartQuery] Error loading user profiles:", err);
  }
  return map;
}

export const POST = withTenant(async (request, { companyId }) => {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      category,
      fields,
      computedFields,
      sorting,
      conditions,
    }: {
      category: string;
      fields: string[];
      computedFields?: ComputedField[];
      sorting?: SortRule[];
      conditions?: ConditionRule[];
    } = body;

    const catDef = QUERY_CATEGORIES.find(c => c.id === category);
    if (!catDef) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const validFieldKeys = new Set(catDef.fields.map(f => f.key));
    const selectFields = fields.filter(f => validFieldKeys.has(f));

    if (selectFields.length === 0) {
      return NextResponse.json({ error: "No valid fields selected" }, { status: 400 });
    }

    // Structures view might not have md_user/md_date in all schema versions; query safely
    const dbSelectFields = (category === "structures")
      ? selectFields.filter(f => f !== "md_user" && f !== "md_date")
      : selectFields;
    const finalDbFields = dbSelectFields.length > 0 ? dbSelectFields : ["id"];

    // For inspection records and incomplete categories, select all columns including JSON inspection_data
    const selectQueryStr = (category === "inspection_records" || category === "incomplete")
      ? "*"
      : finalDbFields.join(",");

    let query = (supabase as any)
      .from(catDef.table)
      .select(selectQueryStr, { count: "exact" });

    // Apply company scoping safely depending on the view schema
    if (companyId) {
      const [{ data: structRes }, { data: platRes }, { data: pipeRes }] = await Promise.all([
        (supabase as any).from("structure").select("str_id").eq("company_id", companyId),
        (supabase as any).from("platform").select("plat_id").eq("company_id", companyId),
        (supabase as any).from("u_pipeline").select("pipe_id").eq("company_id", companyId),
      ]);
      const strIds = Array.from(new Set([
        ...(structRes?.map((s: any) => s.str_id) || []),
        ...(platRes?.map((p: any) => p.plat_id) || []),
        ...(pipeRes?.map((pl: any) => pl.pipe_id) || [])
      ])).filter(Boolean);

      if (category === "structures") {
        if (strIds.length > 0) {
          query = query.in("id", strIds);
        }
      } else if (category === "components" || category === "sow" || category === "inspection_records" || category === "incomplete") {
        if (strIds.length > 0) {
          query = query.in("structure_id", strIds);
        }
      } else if (category === "jobpacks") {
        const { data: tenantJobpacks } = await (supabase as any)
          .from("jobpack")
          .select("id")
          .eq("company_id", companyId);
        const jpIds = tenantJobpacks?.map((j: any) => j.id) || [];
        if (jpIds.length > 0) {
          query = query.in("id", jpIds);
        }
      } else if (category === "anomalies" || category === "findings") {
        const { data: tenantAnoms } = await (supabase as any)
          .from("insp_anomalies")
          .select("anomaly_id")
          .eq("company_id", companyId);
        const anomIds = new Set<number>(tenantAnoms?.map((a: any) => a.anomaly_id) || []);

        if (strIds.length > 0) {
          const { data: recAnoms } = await (supabase as any)
            .from("insp_records")
            .select("insp_id")
            .in("structure_id", strIds);
          const inspIds = recAnoms?.map((r: any) => r.insp_id) || [];
          if (inspIds.length > 0) {
            const { data: linkedAnoms } = await (supabase as any)
              .from("insp_anomalies")
              .select("anomaly_id")
              .in("inspection_id", inspIds);
            linkedAnoms?.forEach((a: any) => anomIds.add(a.anomaly_id));
          }
        }

        const finalAnomIds = Array.from(anomIds);
        if (finalAnomIds.length > 0) {
          query = query.in("anomaly_id", finalAnomIds);
        }
      }
    }

    if (category === "findings") {
      query = query.or("record_category.ilike.Finding,record_category.eq.Finding,record_category.eq.FINDING");
    } else if (category === "anomalies") {
      query = query.or("record_category.ilike.Anomaly,record_category.eq.ANOMALY,record_category.eq.Anomaly,record_category.is.null");
    } else if (category === "incomplete") {
      query = query.eq("status", "INCOMPLETE");
    }

    if (conditions && conditions.length > 0) {
      for (const cond of conditions) {
        if (!validFieldKeys.has(cond.field)) continue;

        const fieldType = catDef.fields.find(f => f.key === cond.field)?.dataType;
        let finalField = cond.field;
        let finalValue = cond.value;
        let finalValue2 = cond.value2;
        let finalOperator = cond.operator;

        const TOP_LEVEL_INSP_COLS = new Set([
          "insp_id", "structure_id", "component_id", "jobpack_id", "inspection_type_id",
          "inspection_type_code", "status", "inspection_date", "inspection_time", "sow_report_no",
          "workunit", "dive_job_id", "rov_job_id", "dive_no", "elevation", "fp_kp",
          "structure_name", "structure_field", "structure_spec_type",
          "component_id_str", "component_id_no", "component_qid", "component_description",
          "start_node", "end_node", "elevation1", "elevation2", "jobpack_name",
          "marine_growth", "coating_condition", "component_condition", "nominal_thickness",
          "verification_depth", "ut_12_o_clock", "ut_3_o_clock", "ut_6_o_clock", "ut_9_o_clock",
          "cp_reading", "pre_dive_cp_rdg", "post_dive_cp_rdg", "scour_depth", "scour_location",
          "finding_type", "debris_info", "distance_info", "anode_depletion", "anode_type",
          "seepage_intensity", "mgi_profile", "mgi_thickness_at", "mgi_hard_thickness",
          "mgi_soft_thickness", "calib_block", "serial_number", "calib_equipment_type",
          "cr_user", "cr_date", "md_user", "md_date"
        ]);

        if ((category === "inspection_records" || category === "incomplete") && !TOP_LEVEL_INSP_COLS.has(cond.field)) {
          finalField = `inspection_data->>${cond.field}`;
        }

        if (cond.transform === "year" && fieldType === "date" && cond.value) {
          const year = parseInt(cond.value);
          if (!isNaN(year)) {
            const start = `${year}-01-01`;
            const end = `${year}-12-31`;

            switch (cond.operator) {
              case "eq":
                query = query.gte(finalField, start).lte(finalField, end);
                continue;
              case "neq":
                query = query.or(`${finalField}.lt.${start},${finalField}.gt.${end}`);
                continue;
              case "gt":
                query = query.gt(finalField, end);
                continue;
              case "lt":
                query = query.lt(finalField, start);
                continue;
              case "gte":
                query = query.gte(finalField, start);
                continue;
              case "lte":
                query = query.lte(finalField, end);
                continue;
            }
          }
        }

        switch (finalOperator) {
          case "eq":
            if (fieldType === "text") {
              query = query.ilike(finalField, finalValue);
            } else {
              query = query.eq(finalField, finalValue);
            }
            break;
          case "neq":
            if (fieldType === "text") {
              query = query.not(finalField, "ilike", finalValue);
            } else {
              query = query.neq(finalField, finalValue);
            }
            break;
          case "gt":
            query = query.gt(finalField, finalValue);
            break;
          case "lt":
            query = query.lt(finalField, finalValue);
            break;
          case "gte":
            query = query.gte(finalField, finalValue);
            break;
          case "lte":
            query = query.lte(finalField, finalValue);
            break;
          case "contains":
            query = query.ilike(finalField, `%${finalValue}%`);
            break;
          case "starts_with":
            query = query.ilike(finalField, `${finalValue}%`);
            break;
          case "ends_with":
            query = query.ilike(finalField, `%${finalValue}`);
            break;
          case "is_empty":
            query = query.is(finalField, null);
            break;
          case "is_not_empty":
            query = query.not(finalField, "is", null);
            break;
          case "is_true":
            query = query.eq(finalField, true);
            break;
          case "is_false":
            query = query.eq(finalField, false);
            break;
          case "between":
            if (finalValue && finalValue2) {
              query = query.gte(finalField, finalValue).lte(finalField, finalValue2);
            }
            break;
        }
      }
    }

    if (sorting && sorting.length > 0) {
      for (const sort of sorting) {
        if (validFieldKeys.has(sort.field)) {
          query = query.order(sort.field, { ascending: sort.direction === "asc" });
        }
      }
    }

    // Fetch all matching rows in paginated chunks to bypass PostgREST's 1000-row limit
    const BATCH_SIZE = 1000;
    let allRows: any[] = [];
    let totalCount = 0;

    // 1. First batch with exact count
    const { data: firstBatch, error: firstErr, count: exactCount } = await query.range(0, BATCH_SIZE - 1);

    if (firstErr) {
      console.error("[SmartQuery] Execute error:", firstErr);
      return NextResponse.json({ error: firstErr.message }, { status: 400 });
    }

    allRows = firstBatch || [];
    totalCount = exactCount !== null && exactCount !== undefined ? exactCount : allRows.length;

    // 2. Subsequent batches if totalCount > 1000
    if (totalCount > BATCH_SIZE && allRows.length < MAX_ROWS) {
      let currentOffset = BATCH_SIZE;
      while (currentOffset < totalCount && currentOffset < MAX_ROWS) {
        const to = Math.min(currentOffset + BATCH_SIZE - 1, totalCount - 1, MAX_ROWS - 1);
        const { data: nextBatch, error: nextErr } = await query.range(currentOffset, to);
        if (nextErr || !nextBatch || nextBatch.length === 0) {
          break;
        }
        allRows.push(...nextBatch);
        if (nextBatch.length < BATCH_SIZE) {
          break;
        }
        currentOffset += BATCH_SIZE;
      }
    }

    const data = allRows;
    const count = totalCount;

    let results: Record<string, any>[] = (data || []).map((row: any) => {
      const item = { ...row };
      if (category === "structures") {
        if (selectFields.includes("md_user") && item.md_user === undefined) item.md_user = null;
        if (selectFields.includes("md_date") && item.md_date === undefined) item.md_date = null;
      }
      if (category === "inspection_records" || category === "incomplete") {
        let idata = item.inspection_data || item.inspection_dat || {};
        if (typeof idata === "string") {
          try { idata = JSON.parse(idata); } catch (e) { idata = {}; }
        }
        selectFields.forEach((f) => {
          if ((item[f] === undefined || item[f] === null) && idata[f] !== undefined) {
            item[f] = idata[f];
          }
        });
      }
      return item;
    });

    // Enrich component fields (start_node, end_node, elevation1, elevation2, component_description)
    const COMPONENT_COLS = new Set(["start_node", "end_node", "elevation1", "elevation2", "component_description", "description"]);
    const hasComponentCols = selectFields.some(f => COMPONENT_COLS.has(f));

    if (hasComponentCols && results.length > 0) {
      if (category === "components") {
        // Enrich directly from row.metadata
        for (const item of results) {
          let meta = item.metadata;
          if (typeof meta === "string") {
            try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
          }
          if (meta && typeof meta === "object") {
            if (!item.start_node) item.start_node = meta.startNode || meta.s_node || meta.start_node || meta.sNode || meta.s_leg || meta.startLeg || null;
            if (!item.end_node) item.end_node = meta.endNode || meta.f_node || meta.e_node || meta.end_node || meta.fNode || meta.eNode || meta.f_leg || meta.endLeg || null;
            if (item.elevation1 === undefined || item.elevation1 === null) item.elevation1 = meta.elevation1 ?? meta.elv_1 ?? meta.elev_1 ?? meta.elevation_1 ?? meta.start_elevation ?? meta.elev1 ?? null;
            if (item.elevation2 === undefined || item.elevation2 === null) item.elevation2 = meta.elevation2 ?? meta.elv_2 ?? meta.elev_2 ?? meta.elevation_2 ?? meta.end_elevation ?? meta.elev2 ?? null;
            if (!item.description) item.description = meta.description || meta.desc || meta.component_description || item.comp_id || item.id_no || null;
          }

          // Fallback parsing from component string/code if start_node / end_node still missing
          if (!item.start_node || !item.end_node) {
            const compStr = String(item.comp_id || item.id_no || item.code || item.description || "");
            const spanMatch = compStr.match(/\b([A-Z]*\d+)\s*[-/]\s*([A-Z]*\d+)\b/i);
            const singleMatch = compStr.match(/\b(?:WN|NODE|LEG)\s+([A-Z]*\d+)\b/i);
            if (spanMatch) {
              if (!item.start_node) item.start_node = spanMatch[1];
              if (!item.end_node) item.end_node = spanMatch[2];
            } else if (singleMatch && !item.start_node) {
              item.start_node = singleMatch[1];
            }
          }
        }
      } else if (category === "inspection_records" || category === "incomplete" || category === "anomalies" || category === "findings") {
        // Collect component_ids from inspection records
        const compIdsToFetch = new Set<number>();
        for (const item of results) {
          const cId = Number(item.component_id);
          if (cId && (!item.start_node || !item.end_node || item.elevation1 === undefined || item.elevation1 === null || item.elevation2 === undefined || item.elevation2 === null || !item.component_description)) {
            compIdsToFetch.add(cId);
          }
        }

        let compMap = new Map<number, any>();
        if (compIdsToFetch.size > 0) {
          const idList = Array.from(compIdsToFetch);
          const chunkSize = 500;
          for (let i = 0; i < idList.length; i += chunkSize) {
            const chunk = idList.slice(i, i + chunkSize);
            const { data: compRows } = await supabase
              .from("structure_components")
              .select("id, q_id, comp_id, id_no, code, metadata")
              .in("id", chunk);
            compRows?.forEach((c: any) => compMap.set(Number(c.id), c));
          }
        }

        for (const item of results) {
          const cId = Number(item.component_id);
          const comp = cId ? compMap.get(cId) : null;
          let meta = comp?.metadata || item.metadata;
          if (typeof meta === "string") {
            try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
          }
          let idata = item.inspection_data || item.inspection_dat;
          if (typeof idata === "string") {
            try { idata = JSON.parse(idata); } catch (e) { idata = {}; }
          }

          if (meta && typeof meta === "object") {
            if (!item.start_node) item.start_node = meta.startNode || meta.s_node || meta.start_node || meta.sNode || meta.s_leg || meta.startLeg || idata?.start_node || idata?.s_node || null;
            if (!item.end_node) item.end_node = meta.endNode || meta.f_node || meta.e_node || meta.end_node || meta.fNode || meta.eNode || meta.f_leg || meta.endLeg || idata?.end_node || idata?.f_node || null;
            if (item.elevation1 === undefined || item.elevation1 === null) item.elevation1 = meta.elevation1 ?? meta.elv_1 ?? meta.elev_1 ?? meta.elevation_1 ?? meta.start_elevation ?? meta.elev1 ?? idata?.elevation1 ?? idata?.elv_1 ?? null;
            if (item.elevation2 === undefined || item.elevation2 === null) item.elevation2 = meta.elevation2 ?? meta.elv_2 ?? meta.elev_2 ?? meta.elevation_2 ?? meta.end_elevation ?? meta.elev2 ?? idata?.elevation2 ?? idata?.elv_2 ?? null;
            if (!item.component_description) item.component_description = meta.description || meta.desc || meta.component_description || comp?.id_no || comp?.comp_id || item.component_id_str || item.component_id_no || null;
          }

          // Fallback parsing from component string/code if start_node / end_node still missing
          if (!item.start_node || !item.end_node) {
            const compStr = String(item.component_id_str || item.component_id_no || comp?.comp_id || comp?.id_no || comp?.code || item.component_description || "");
            const spanMatch = compStr.match(/\b([A-Z]*\d+)\s*[-/]\s*([A-Z]*\d+)\b/i);
            const singleMatch = compStr.match(/\b(?:WN|NODE|LEG)\s+([A-Z]*\d+)\b/i);
            if (spanMatch) {
              if (!item.start_node) item.start_node = spanMatch[1];
              if (!item.end_node) item.end_node = spanMatch[2];
            } else if (singleMatch && !item.start_node) {
              item.start_node = singleMatch[1];
            }
          }
        }
      }
    }

    // Resolve user IDs / usernames / emails to User Full Names for display
    const activeUserCols = selectFields.filter(f => USER_FIELDS.has(f));
    if (activeUserCols.length > 0 && results.length > 0) {
      const userMap = await getUserMap(supabase);
      for (const row of results) {
        for (const col of activeUserCols) {
          const rawVal = row[col];
          if (rawVal && typeof rawVal === "string") {
            const trimmed = rawVal.trim();
            const resolved = userMap.get(trimmed) || userMap.get(trimmed.toLowerCase());
            if (resolved) {
              row[col] = resolved;
            }
          }
        }
      }
    }

    if (computedFields && computedFields.length > 0) {
      results = results.map((row: any) => {
        const enriched = { ...row };
        for (const cf of computedFields) {
          if (cf.sourceField && cf.operation && cf.name) {
            enriched[cf.name] = applyComputedOp(
              row[cf.sourceField],
              cf.operation,
              cf.params || {}
            );
          }
        }
        return enriched;
      });
    }

    return NextResponse.json({
      data: results,
      count: results.length === 0 ? 0 : (count || results.length),
      truncated: (count || 0) > MAX_ROWS,
    });
  } catch (error: any) {
    console.error("[SmartQuery] Critical error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
});
