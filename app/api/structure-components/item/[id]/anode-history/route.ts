import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, isServiceRoleConfigured } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

function extractCpReadingsFromRecord(rec: any): Array<{ val: number; type: "primary" | "additional" }> {
  const d = rec?.inspection_data || {};
  const readings: Array<{ val: number; type: "primary" | "additional" }> = [];
  const primaryRaw = d.cp_rdg ?? d.cp_reading_mv ?? d.anode_cp ?? d.member_cp ?? "";
  const primary = parseFloat(primaryRaw);
  if (!isNaN(primary) && isFinite(primary)) {
    readings.push({ val: primary, type: "primary" });
  }
  if (Array.isArray(d.cp_rdg_additional)) {
    for (const a of d.cp_rdg_additional) {
      const addVal = parseFloat(a?.reading ?? a?.cp_rdg ?? "");
      if (!isNaN(addVal) && isFinite(addVal)) {
        readings.push({ val: addVal, type: "additional" });
      }
    }
  }
  return readings;
}

function extractDepletionFromRecord(rec: any): number | null {
  const d = rec?.inspection_data || {};
  const raw = d.anode_depletion ?? d.anode_depletion_percent ?? d.depletion ?? null;
  if (raw === null || raw === undefined || raw === "") return null;
  const num = parseFloat(String(raw).replace("%", "").trim());
  return !isNaN(num) && isFinite(num) ? num : null;
}

function summarizeReadings(records: any[]) {
  const cpVals: number[] = [];
  let latestDepletion: number | null = null;
  let latestDepletionDate: string | null = null;

  const sorted = [...records].sort((a, b) => {
    const da = a.inspection_date || a.cr_date || "";
    const db = b.inspection_date || b.cr_date || "";
    return String(da).localeCompare(String(db));
  });

  const detailedReadings: Array<{
    insp_id: number;
    inspection_date: string | null;
    inspection_type_code: string | null;
    jobpack_id: number | null;
    cp_values: number[];
    depletion: number | null;
    description: string | null;
  }> = [];

  for (const r of sorted) {
    const cps = extractCpReadingsFromRecord(r).map((x) => x.val);
    cpVals.push(...cps);
    const dep = extractDepletionFromRecord(r);
    if (dep !== null) {
      latestDepletion = dep;
      latestDepletionDate = r.inspection_date || r.cr_date || null;
    }
    if (cps.length > 0 || dep !== null || (r.inspection_type_code || "").toUpperCase() === "ANMAIN") {
      detailedReadings.push({
        insp_id: r.insp_id,
        inspection_date: r.inspection_date || null,
        inspection_type_code: r.inspection_type_code || null,
        jobpack_id: r.jobpack_id || null,
        cp_values: cps,
        depletion: dep,
        description: r.description || null,
      });
    }
  }

  return {
    totalRecords: records.length,
    cpCount: cpVals.length,
    cpMin: cpVals.length > 0 ? Math.min(...cpVals) : null,
    cpMax: cpVals.length > 0 ? Math.max(...cpVals) : null,
    cpAvg:
      cpVals.length > 0
        ? Math.round((cpVals.reduce((a, b) => a + b, 0) / cpVals.length) * 10) / 10
        : null,
    latestDepletion,
    latestDepletionDate,
    readings: detailedReadings.reverse(),
  };
}

/**
 * GET /api/structure-components/item/[id]/anode-history
 * Returns current anode spec, replacement count, archived historical specs,
 * and CP/depletion reading summaries isolated per anode generation.
 * Strictly for Anode (code = 'AN') components.
 */
export const GET = withAuth(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const db = isServiceRoleConfigured() ? createAdminClient() : supabase;
    const { id } = await params;
    const componentId = Number(id);

    if (Number.isNaN(componentId)) {
      return NextResponse.json({ error: "Invalid component id" }, { status: 400 });
    }

    const { data: comp, error: compErr } = await db
      .from("structure_components")
      .select("id, comp_id, structure_id, q_id, id_no, code, metadata, is_deleted, created_at, updated_at")
      .eq("id", componentId)
      .maybeSingle();

    if (compErr) {
      return handleSupabaseError(compErr, "Failed to fetch component");
    }
    if (!comp) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }
    if ((comp.code || "").toUpperCase() !== "AN") {
      return NextResponse.json(
        { error: "Anode history is only available for Anode (AN) components." },
        { status: 400 }
      );
    }

    // Fetch history rows, inspection records, jobpacks, and library labels in parallel
    const [histRes, inspRes, jpRes, libRes] = await Promise.all([
      (db as any)
        .from("anode_spec_history")
        .select("*")
        .eq("component_id", componentId)
        .order("generation_no", { ascending: false }),
      (db as any)
        .from("insp_records")
        .select("insp_id, jobpack_id, inspection_type_code, inspection_date, cr_date, inspection_data, description, anode_history_id")
        .eq("component_id", componentId)
        .order("inspection_date", { ascending: false }),
      db
        .from("jobpack")
        .select("id, name, status, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      db
        .from("u_lib_list")
        .select("lib_code, lib_id, lib_desc")
        .in("lib_code", ["ANOD_TYP", "ANOD_MAT", "FITTING", "POSITION"]),
    ]);

    if (histRes.error) {
      // Gracefully handle case where migration has not yet been applied
      if (histRes.error.code === "42P01" || histRes.error.message?.includes("anode_spec_history")) {
        return apiSuccess({
          component: comp,
          currentSpec: (comp.metadata as any)?.additionalInfo || {},
          activeGeneration: 1,
          replacementCount: 0,
          currentReadings: summarizeReadings(inspRes.data || []),
          history: [],
          jobpacks: jpRes.data || [],
          libraryMap: {},
          migrationPending: true,
        });
      }
      return handleSupabaseError(histRes.error, "Failed to fetch anode history");
    }

    const historyRows: any[] = histRes.data || [];
    const allInspRecords: any[] = inspRes.data || [];
    const jobpacks: any[] = jpRes.data || [];

    // Build library lookup map: { ANOD_TYP: { id: desc }, ... }
    const libraryMap: Record<string, Record<string, string>> = {};
    for (const row of (libRes.data || []) as any[]) {
      const code = row.lib_code;
      if (!libraryMap[code]) libraryMap[code] = {};
      libraryMap[code][String(row.lib_id)] = row.lib_desc || String(row.lib_id);
    }

    // Group inspection records by anode_history_id (null = current active anode)
    const activeRecords: any[] = [];
    const recordsByHistId: Record<number, any[]> = {};

    for (const r of allInspRecords) {
      if (r.anode_history_id == null) {
        activeRecords.push(r);
      } else {
        const hid = Number(r.anode_history_id);
        if (!recordsByHistId[hid]) recordsByHistId[hid] = [];
        recordsByHistId[hid].push(r);
      }
    }

    const jpNameMap = new Map<number, string>();
    for (const jp of jobpacks) {
      jpNameMap.set(Number(jp.id), jp.name);
    }

    const enrichedHistory = historyRows.map((h) => ({
      ...h,
      replaced_by_jobpack_name:
        h.replaced_by_jobpack_name ||
        (h.replaced_by_jobpack_id ? jpNameMap.get(Number(h.replaced_by_jobpack_id)) || `Jobpack #${h.replaced_by_jobpack_id}` : null),
      readingsSummary: summarizeReadings(recordsByHistId[Number(h.id)] || []),
    }));

    const maxGen = historyRows.reduce((m, h) => Math.max(m, Number(h.generation_no) || 0), 0);
    const currentAddInfo = (comp.metadata as any)?.additionalInfo || {};

    return apiSuccess({
      component: comp,
      currentSpec: currentAddInfo,
      activeGeneration: maxGen + 1,
      replacementCount: historyRows.length,
      currentReadings: summarizeReadings(activeRecords),
      history: enrichedHistory,
      jobpacks,
      libraryMap,
      migrationPending: false,
    });
  }
);

/**
 * POST /api/structure-components/item/[id]/anode-history
 * Archives the current Anode spec into anode_spec_history, tags prior readings,
 * and updates structure_components.metadata.additionalInfo with the new spec.
 * Supports both ANMAIN and MANUAL replacements.
 */
export const POST = withAuth(
  async (
    request: NextRequest,
    { params, user }: { params: Promise<{ id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const db = isServiceRoleConfigured() ? createAdminClient() : supabase;
    const { id } = await params;
    const componentId = Number(id);

    if (Number.isNaN(componentId)) {
      return NextResponse.json({ error: "Invalid component id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      newSpec = {},
      replacedDate,
      jobpackId = null,
      jobpackName = null,
      inspId = null,
      source = "MANUAL",
      remarks = null,
      clientLocalDate = null,
      clientTimestamp = null,
      clientLocalTime = null,
      clientTimezone = null,
    } = body;

    const cleanDate =
      replacedDate && /^\d{4}-\d{2}-\d{2}/.test(String(replacedDate))
        ? String(replacedDate).slice(0, 10)
        : clientLocalDate && /^\d{4}-\d{2}-\d{2}/.test(String(clientLocalDate))
        ? String(clientLocalDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const { data, error } = await (db as any).rpc("fn_replace_anode_spec", {
      p_component_id: componentId,
      p_new_spec: newSpec,
      p_replaced_date: cleanDate,
      p_jobpack_id: jobpackId ? Number(jobpackId) : null,
      p_jobpack_name: jobpackName || null,
      p_insp_id: inspId ? Number(inspId) : null,
      p_source: source === "ANMAIN" ? "ANMAIN" : "MANUAL",
      p_remarks: remarks || null,
      p_user: user?.email || user?.id || null,
      p_client_timestamp: clientTimestamp || null,
      p_client_local_time: clientLocalTime || null,
      p_client_timezone: clientTimezone || null,
    });

    if (error) {
      return handleSupabaseError(error, "Failed to archive and replace anode spec");
    }

    // Fetch updated component to return to caller
    const { data: updatedComponent } = await db
      .from("structure_components")
      .select("*")
      .eq("id", componentId)
      .maybeSingle();

    return apiSuccess({
      ...(data || {}),
      updatedComponent,
    });
  }
);

/**
 * DELETE /api/structure-components/item/[id]/anode-history?historyId=...&inspId=...
 * Losslessly rolls back the latest anode replacement on this component:
 * restores old spec metadata and restores prior insp_records to active anode.
 */
export const DELETE = withAuth(
  async (
    request: NextRequest,
    { params, user }: { params: Promise<{ id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const db = isServiceRoleConfigured() ? createAdminClient() : supabase;
    const { id } = await params;
    const componentId = Number(id);

    if (Number.isNaN(componentId)) {
      return NextResponse.json({ error: "Invalid component id" }, { status: 400 });
    }

    const url = new URL(request.url);
    const historyIdParam = url.searchParams.get("historyId");
    const inspIdParam = url.searchParams.get("inspId");
    const clientTimestampParam = url.searchParams.get("clientTimestamp");

    // When deleting directly from Anode History UI (no inspId), enforce that ONLY
    // the latest MANUAL replacement entry can be deleted/rolled back.
    if (!inspIdParam) {
      const { data: latestHist, error: latestErr } = await (db as any)
        .from("anode_spec_history")
        .select("id, generation_no, replacement_source")
        .eq("component_id", componentId)
        .order("generation_no", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestErr) {
        return handleSupabaseError(latestErr, "Failed to validate latest anode replacement");
      }
      if (!latestHist) {
        return NextResponse.json(
          { error: "No replacement history found to delete." },
          { status: 404 }
        );
      }
      if (historyIdParam && Number(historyIdParam) !== Number(latestHist.id)) {
        return NextResponse.json(
          { error: "Only the latest replacement entry can be deleted." },
          { status: 403 }
        );
      }
      if (String(latestHist.replacement_source || "").toUpperCase() !== "MANUAL") {
        return NextResponse.json(
          {
            error:
              "Only manual replacement entries can be deleted here. ANMAIN replacements must be edited or reassigned from the inspection record.",
          },
          { status: 403 }
        );
      }
    }

    const { data, error } = await (db as any).rpc("fn_rollback_anode_replacement", {
      p_component_id: componentId,
      p_history_id: historyIdParam ? Number(historyIdParam) : null,
      p_insp_id: inspIdParam ? Number(inspIdParam) : null,
      p_user: user?.email || user?.id || null,
      p_client_timestamp: clientTimestampParam || null,
    });

    if (error) {
      return handleSupabaseError(error, "Failed to roll back anode replacement");
    }

    const { data: updatedComponent } = await db
      .from("structure_components")
      .select("*")
      .eq("id", componentId)
      .maybeSingle();

    return apiSuccess({
      ...(data || {}),
      updatedComponent,
    });
  }
);
