import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/structure-components/[structure_id]
 * Fetch structure components by structure_id and optional code filter
 * Query params: ?code=ANODE (optional)
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

    // Build query
    let query = supabase
      .from("structure_components")
      .select("*")
      .eq("structure_id", structureIdNumber)
      .order("q_id");

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

    const { data, error } = await query;

    if (error) {
      return handleSupabaseError(error, "Failed to fetch structure components");
    }

    if (!data || data.length === 0) {
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

    // Fetch inspection records with jobpack — inspection type name resolved client-side from JSON
    const { data: inspRecords } = await supabase
      .from("insp_records")
      .select(
        `
        insp_id, component_id, has_anomaly, status, inspection_date, inspection_type_code, description, sow_report_no,
        jobpack:jobpack_id(id, name)
      `
      )
      .in("component_id", componentIds);

    // Fetch anomalies directly linked to the components via the view
    const { data: componentAnomalies } = await (supabase as any)
      .from("v_anomaly_details")
      .select(
        "anomaly_id, component_id, priority, status, defect_type, category, description, display_ref_no, jobpack_name"
      )
      .in("component_id", componentIds);

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
          compsWithAtts.add(r.component_id);
        }
      });
    }

    // Apply has_attachment flag and enrich with inspections/anomalies
    data.forEach((item: any) => {
      item.has_attachment = compsWithAtts.has(item.id);

      if (inspRecords) {
        item.inspections = inspRecords.filter((r: any) => r.component_id === item.id);
      } else {
        item.inspections = [];
      }
      if (componentAnomalies) {
        item.anomalies = componentAnomalies.filter((a: any) => a.component_id === item.id);
      } else {
        item.anomalies = [];
      }
    });

    // Apply view_filter for findings/anomaly
    let finalData = data;
    if (viewFilter === "findings") {
      finalData = data.filter((item: any) => item.inspections && item.inspections.length > 0);
    } else if (viewFilter === "anomaly") {
      finalData = data.filter((item: any) => item.anomalies && item.anomalies.length > 0);
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

    return apiSuccess(data);
  }
);
