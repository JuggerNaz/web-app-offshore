export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";
import { syncWebapp3D } from "@/utils/platform-3d-math";

/**
 * GET /api/structure-components/[structure_id]
 * Fetch structure components by structure_id and optional code filter
 * Query params: ?code=ANODE (optional), ?archived=true, ?show_all=true, ?view_filter=default|show_all|findings|anomaly
 */
export const GET = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ structure_id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const { structure_id } = await params;
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const archived = searchParams.get("archived");
    const showAll = searchParams.get("show_all") === "true";
    const viewFilter = searchParams.get("view_filter") || "default"; // default, show_all, findings, anomaly

    const structureIdNumber = Number(structure_id);

    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("structure_components")
        .select("*")
        .eq("structure_id", structureIdNumber)
        .order("q_id")
        .range(from, to);

      // Filter by archived / active / all
      if (archived === "true") {
        query = query.eq("is_deleted", true);
      } else if (viewFilter === "show_all" || showAll) {
        // Don't filter is_deleted
      } else {
        // Default: show only active components
        query = query.eq("is_deleted", false);
      }

      // Apply code filter if provided and not "ALL COMPONENTS"
      if (code && code !== "ALL COMPONENTS") {
        query = query.eq("code", code);
      }

      const { data: pageData, error } = await query;

      if (error) {
        return handleSupabaseError(error, "Failed to fetch structure components");
      }

      if (!pageData || pageData.length === 0) {
        hasMore = false;
      } else {
        allData.push(...pageData);
        if (pageData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    const data = allData;

    if (data.length === 0) {
      return apiSuccess([]);
    }

    // --- Attachment Enrichment ---
    const componentIds = data.map((c: any) => c.id);

    // Fetch direct component attachments
    const { data: directAtts } = await supabase
      .from("attachment")
      .select("source_id")
      .in("source_id", componentIds)
      .in("source_type", ["component", "COMPONENT", "structure_component"]);

    // Fetch ALL inspection records for this structure (paginated loop to guarantee >1000 records are fetched)
    let inspRecords: any[] = [];
    let inspPage = 0;
    const inspPageSize = 1000;
    let hasMoreInsp = true;

    while (hasMoreInsp) {
      const { data: pRecs, error: pErr } = await supabase
        .from("insp_records")
        .select(
          `
          insp_id, component_id, has_anomaly, status, inspection_date, inspection_time, inspection_type_code, description, sow_report_no, fp_kp, elevation, inspection_data,
          jobpack:jobpack_id(id, name)
        `
        )
        .eq("structure_id", structureIdNumber)
        .order("insp_id", { ascending: true })
        .range(inspPage * inspPageSize, (inspPage + 1) * inspPageSize - 1);

      if (pErr || !pRecs || pRecs.length === 0) {
        hasMoreInsp = false;
      } else {
        inspRecords = inspRecords.concat(pRecs);
        if (pRecs.length < inspPageSize) {
          hasMoreInsp = false;
        } else {
          inspPage++;
        }
      }
    }

    // Fetch ALL anomalies for this structure via the view
    let componentAnomalies: any[] = [];
    let anomPage = 0;
    const anomPageSize = 1000;
    let hasMoreAnom = true;

    while (hasMoreAnom) {
      const { data: aRecs, error: aErr } = await (supabase as any)
        .from("v_anomaly_details")
        .select(
          "anomaly_id, component_id, component_qid, priority, status, defect_type, category, description, display_ref_no, jobpack_name"
        )
        .eq("structure_id", structureIdNumber)
        .range(anomPage * anomPageSize, (anomPage + 1) * anomPageSize - 1);

      if (aErr || !aRecs || aRecs.length === 0) {
        hasMoreAnom = false;
      } else {
        componentAnomalies = componentAnomalies.concat(aRecs);
        if (aRecs.length < anomPageSize) {
          hasMoreAnom = false;
        } else {
          anomPage++;
        }
      }
    }

    let inspAtts: any[] = [];
    if (inspRecords && inspRecords.length > 0) {
      const inspIds = inspRecords.map((r: any) => r.insp_id);
      const { data: iAtts } = await supabase
        .from("attachment")
        .select("source_id")
        .in("source_id", inspIds)
        .in("source_type", ["inspection", "INSPECTION"]);
      inspAtts = iAtts || [];
    }

    const compsWithAtts = new Set();

    if (directAtts) {
      directAtts.forEach((att: any) => compsWithAtts.add(att.source_id));
    }

    if (inspRecords && inspAtts) {
      const inspAttsSet = new Set(inspAtts.map((a: any) => a.source_id));
      inspRecords.forEach((r: any) => {
        if (inspAttsSet.has(r.insp_id)) {
          if (r.component_id) {
            compsWithAtts.add(r.component_id);
          }
        }
      });
    }

    // Apply has_attachment flag and enrich with inspections/anomalies
    // (matching by component_id OR component QID so legacy records link correctly)
    data.forEach((item: any) => {
      item.has_attachment = compsWithAtts.has(item.id);

      const qidUpper = item.q_id ? item.q_id.toUpperCase() : "";

      item.inspections = (inspRecords || []).filter((r: any) => {
        if (r.component_id && r.component_id === item.id) return true;
        if (qidUpper) {
          if (r.component_qid && String(r.component_qid).toUpperCase() === qidUpper) return true;
          if (r.inspection_data?.component && String(r.inspection_data.component).toUpperCase() === qidUpper) return true;
          if (r.inspection_data?.component_qid && String(r.inspection_data.component_qid).toUpperCase() === qidUpper) return true;
          if (r.inspection_data?.qid && String(r.inspection_data.qid).toUpperCase() === qidUpper) return true;
        }
        return false;
      }) || [];

      const seenAnomKeys = new Set<string>();
      item.anomalies = (componentAnomalies || []).filter((a: any) => {
        let isMatch = false;
        if (a.component_id && a.component_id === item.id) isMatch = true;
        else if (qidUpper) {
          if (a.component_qid && String(a.component_qid).toUpperCase() === qidUpper) isMatch = true;
          if (a.q_id && String(a.q_id).toUpperCase() === qidUpper) isMatch = true;
        }

        if (isMatch) {
          const anomKey = a.anomaly_id ? String(a.anomaly_id) : `${a.display_ref_no || ''}_${a.description || ''}`;
          if (seenAnomKeys.has(anomKey)) return false;
          seenAnomKeys.add(anomKey);
          return true;
        }
        return false;
      }) || [];

      const hasAnom =
        item.anomalies.length > 0 ||
        item.inspections.some(
          (r: any) => r.has_anomaly || String(r.status).toUpperCase() === "ANOMALY"
        );
      item.has_anomaly = hasAnom;
      item.hasAnomaly = hasAnom;
    });

    // Apply view_filter for findings/anomaly
    let finalData = data;
    if (viewFilter === "findings") {
      finalData = data.filter((item: any) => item.inspections && item.inspections.length > 0);
    } else if (viewFilter === "anomaly") {
      finalData = data.filter(
        (item: any) =>
          (item.anomalies && item.anomalies.length > 0) ||
          item.has_anomaly === true
      );
    }
    // -----------------------------

    // Enrich created_by / modified_by with user names via get_user_info RPC (same pattern as comments API)
    try {
      const userIds = Array.from(
        new Set(
          finalData.flatMap((item: any) => [item.created_by, item.modified_by]).filter(Boolean)
        )
      );

      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await (supabase.rpc as any)(
          "get_user_info",
          {
            user_ids: userIds,
          }
        );

        if (!usersError && Array.isArray(usersData)) {
          const userMap = new Map<string, string>();
          usersData.forEach((user: any) => {
            const userName = user.full_name || user.email || "Unknown User";
            userMap.set(user.id, userName);
          });

          const enrichedData = finalData.map((item: any) => ({
            ...item,
            created_by_name: item.created_by
              ? userMap.get(item.created_by) || item.created_by
              : null,
            modified_by_name: item.modified_by
              ? userMap.get(item.modified_by) || item.modified_by
              : null,
          }));

          return apiSuccess(enrichedData);
        }
      }
    } catch (rpcError) {
      console.error("[Structure Components API] Failed to enrich user names", rpcError);
      // Fallback to returning raw data below
    }

    return apiSuccess(finalData);
  }
);

export const POST = withAuth(
  async (
    request: NextRequest,
    { params, user }: { params: Promise<{ structure_id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const { structure_id } = await params;
    const body = await request.json();

    const createdAt = new Date().toISOString();
    const structureIdNumber = Number(structure_id);

    const { data, error } = await supabase
      .from("structure_components")
      .insert({
        ...body,
        structure_id: structureIdNumber,
        created_at: createdAt,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return handleSupabaseError(error, "Failed to create structure component");
    }

    // Trigger asynchronous 3D coordinates recalculation for this structure
    syncWebapp3D(supabase, structureIdNumber).catch((err) => {
      console.error("[3D Sync Error]", err);
    });

    return apiSuccess(data);
  }
);
