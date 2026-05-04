import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * GET /api/attachment/inspection?platform_id=123
 * Fetch all inspection attachments (source_type = 'inspection') for a given platform.
 * Enriches each attachment with inspection record data:
 *   - inspection date, type code/name, status, has_anomaly
 *   - component q_id (from structure_components)
 *   - jobpack name (from insp_records.jobpack_id -> jobpack.name)
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const platform_id = searchParams.get("platform_id");

  if (!platform_id) {
    return apiSuccess([]);
  }

  const structureId = Number(platform_id);

  // 1. Get all component IDs belonging to this platform/structure
  const { data: components, error: compError } = await supabase
    .from("structure_components")
    .select("id, q_id, code")
    .eq("structure_id", structureId);

  if (compError) {
    return handleSupabaseError(compError, "Failed to fetch structure components");
  }

  const componentIds = (components || []).map((c: any) => c.id);
  const componentMap = new Map<number, any>(
    (components || []).map((c: any) => [c.id, c])
  );

  // 2. Get all insp_records for these components (or directly by structure_id)
  const { data: inspRecords, error: inspError } = await (supabase as any)
    .from("insp_records")
    .select(`
      insp_id,
      component_id,
      structure_id,
      inspection_date,
      inspection_time,
      inspection_type_code,
      status,
      has_anomaly,
      sow_report_no,
      jobpack_id,
      rov_job_id,
      dive_job_id,
      inspection_type!left(id, code, name)
    `)
    .eq("structure_id", structureId)
    .order("inspection_date", { ascending: false });

  if (inspError) {
    console.error("Failed to fetch inspection records:", inspError);
    // Fall back to component-based lookup if structure_id column doesn't exist
  }

  // Also try component-based lookup in case structure_id isn't set
  let componentInspRecords: any[] = [];
  if (componentIds.length > 0) {
    const { data: compRecords } = await (supabase as any)
      .from("insp_records")
      .select(`
        insp_id,
        component_id,
        structure_id,
        inspection_date,
        inspection_time,
        inspection_type_code,
        status,
        has_anomaly,
        sow_report_no,
        jobpack_id,
        rov_job_id,
        dive_job_id,
        inspection_type!left(id, code, name)
      `)
      .in("component_id", componentIds)
      .order("inspection_date", { ascending: false });

    componentInspRecords = compRecords || [];
  }

  // Merge and deduplicate inspection records
  const allInspRecordMap = new Map<number, any>();
  [...(inspRecords || []), ...componentInspRecords].forEach((r) => {
    if (!allInspRecordMap.has(r.insp_id)) {
      allInspRecordMap.set(r.insp_id, r);
    }
  });
  const allInspRecords = Array.from(allInspRecordMap.values());

  if (allInspRecords.length === 0) {
    return apiSuccess([]);
  }

  const inspIds = allInspRecords.map((r) => r.insp_id);

  // 3. Get all attachments for these inspection records
  const { data: attachments, error: attError } = await supabase
    .from("attachment")
    .select("*")
    .in("source_type", ["inspection", "INSPECTION"])
    .in("source_id", inspIds);

  if (attError) {
    return handleSupabaseError(attError, "Failed to fetch inspection attachments");
  }

  if (!attachments || attachments.length === 0) {
    return apiSuccess([]);
  }

  // 4. Fetch jobpack names for relevant jobpack_ids
  const jobpackIds = Array.from(new Set(
    allInspRecords
      .map((r) => r.jobpack_id)
      .filter(Boolean)
  ));

  const jobpackMap = new Map<number, string>();
  if (jobpackIds.length > 0) {
    const { data: jobpacks } = await supabase
      .from("jobpack")
      .select("id, name")
      .in("id", jobpackIds);

    (jobpacks || []).forEach((jp: any) => {
      jobpackMap.set(jp.id, jp.name);
    });
  }

  // 5. Build inspection record lookup map
  const inspMap = new Map<number, any>(
    allInspRecords.map((r) => [r.insp_id, r])
  );

  // 6. Enrich attachments with inspection + component info
  const enriched = attachments.map((att: any) => {
    const insp = inspMap.get(att.source_id);
    if (!insp) return { ...att };

    const comp = insp.component_id ? componentMap.get(insp.component_id) : null;

    return {
      ...att,
      // Inspection info
      inspection_id: insp.insp_id,
      inspection_date: insp.inspection_date,
      inspection_time: insp.inspection_time,
      inspection_type_code: insp.inspection_type_code || insp.inspection_type?.code,
      inspection_type_name: insp.inspection_type?.name,
      inspection_status: insp.status,
      has_anomaly: insp.has_anomaly,
      sow_report_no: insp.sow_report_no,
      // Component info
      component_id: insp.component_id,
      component_q_id: comp?.q_id || null,
      component_description: null,
      component_code: comp?.code || null,
      // Jobpack info
      jobpack_id: insp.jobpack_id,
      jobpack_name: insp.jobpack_id ? jobpackMap.get(insp.jobpack_id) || null : null,
    };
  });

  return apiSuccess(enriched);
}
