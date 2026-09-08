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

const MAX_ROWS = 10000;

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

    let query = (supabase as any)
      .from(catDef.table)
      .select(selectFields.join(","), { count: "exact" });

    // Apply company scoping safely depending on the view schema
    if (companyId) {
      if (category === "structures") {
        // v_smart_query_structures does not have company_id column; filter by structure IDs
        const { data: tenantStructures } = await (supabase as any)
          .from("structure")
          .select("str_id")
          .eq("company_id", companyId);
        const strIds = tenantStructures?.map((s: any) => s.str_id) || [];
        if (strIds.length > 0) {
          query = query.in("id", strIds);
        } else {
          query = query.eq("id", -999999);
        }
      } else if (category === "components") {
        // v_smart_query_components has structure_id, not company_id column
        const { data: tenantStructures } = await (supabase as any)
          .from("structure")
          .select("str_id")
          .eq("company_id", companyId);
        const strIds = tenantStructures?.map((s: any) => s.str_id) || [];
        if (strIds.length > 0) {
          query = query.in("structure_id", strIds);
        } else {
          query = query.eq("structure_id", -999999);
        }
      } else if (category === "jobpacks") {
        // v_smart_query_jobpacks has id, not company_id column
        const { data: tenantJobpacks } = await (supabase as any)
          .from("jobpack")
          .select("id")
          .eq("company_id", companyId);
        const jpIds = tenantJobpacks?.map((j: any) => j.id) || [];
        if (jpIds.length > 0) {
          query = query.in("id", jpIds);
        } else {
          query = query.eq("id", -999999);
        }
      } else if (category === "sow") {
        // v_smart_query_sow has structure_id, not company_id column
        const { data: tenantStructures } = await (supabase as any)
          .from("structure")
          .select("str_id")
          .eq("company_id", companyId);
        const strIds = tenantStructures?.map((s: any) => s.str_id) || [];
        if (strIds.length > 0) {
          query = query.in("structure_id", strIds);
        } else {
          query = query.eq("structure_id", -999999);
        }
      } else if (category === "inspection_records" || category === "incomplete") {
        // v_smart_query_inspection_records / v_smart_query_incomplete have structure_id, not company_id column
        const { data: tenantStructures } = await (supabase as any)
          .from("structure")
          .select("str_id")
          .eq("company_id", companyId);
        const strIds = tenantStructures?.map((s: any) => s.str_id) || [];
        if (strIds.length > 0) {
          query = query.in("structure_id", strIds);
        } else {
          query = query.eq("structure_id", -999999);
        }
      } else if (category === "anomalies" || category === "findings") {
        // Find anomalies belonging to company directly or via tenant structures
        const { data: tenantStructures } = await (supabase as any)
          .from("structure")
          .select("str_id")
          .eq("company_id", companyId);
        const strIds = tenantStructures?.map((s: any) => s.str_id) || [];

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
        } else {
          query = query.eq("anomaly_id", -999999);
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

        if (cond.transform === "year" && fieldType === "date" && cond.value) {
          const year = parseInt(cond.value);
          if (!isNaN(year)) {
            const start = `${year}-01-01`;
            const end = `${year}-12-31`;

            switch (cond.operator) {
              case "eq":
                query = query.gte(cond.field, start).lte(cond.field, end);
                continue;
              case "neq":
                query = query.or(`${cond.field}.lt.${start},${cond.field}.gt.${end}`);
                continue;
              case "gt":
                query = query.gt(cond.field, end);
                continue;
              case "lt":
                query = query.lt(cond.field, start);
                continue;
              case "gte":
                query = query.gte(cond.field, start);
                continue;
              case "lte":
                query = query.lte(cond.field, end);
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

    query = query.limit(MAX_ROWS);

    const { data, error, count } = await query;

    if (error) {
      console.error("[SmartQuery] Execute error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    let results = data || [];
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
