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

  const chunkArray = <T>(arr: T[], size = 300): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  // 1. Get all component IDs belonging to this platform/structure
  const { data: components, error: compError } = await supabase
    .from("structure_components")
    .select("id, q_id, code")
    .eq("structure_id", structureId)
    .limit(10000);

  if (compError) {
    return handleSupabaseError(compError, "Failed to fetch structure components");
  }

  const componentIds = (components || []).map((c: any) => c.id);
  const componentMap = new Map<number, any>((components || []).map((c: any) => [c.id, c]));

  // 2. Get all insp_records directly by structure_id
  const allInspRecordMap = new Map<number, any>();

  const { data: directInsps, error: inspError } = await (supabase as any)
    .from("insp_records")
    .select(
      `
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
    `
    )
    .eq("structure_id", structureId)
    .order("inspection_date", { ascending: false })
    .limit(10000);

  if (inspError) {
    console.error("Failed to fetch direct inspection records:", inspError);
  } else {
    (directInsps || []).forEach((r: any) => allInspRecordMap.set(r.insp_id, r));
  }

  // Also fetch component-linked insp_records in chunks
  if (componentIds.length > 0) {
    for (const chunk of chunkArray(componentIds)) {
      const { data: compRecords } = await (supabase as any)
        .from("insp_records")
        .select(
          `
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
        `
        )
        .in("component_id", chunk)
        .order("inspection_date", { ascending: false })
        .limit(10000);

      (compRecords || []).forEach((r: any) => {
        if (!allInspRecordMap.has(r.insp_id)) {
          allInspRecordMap.set(r.insp_id, r);
        }
      });
    }
  }

  const allInspRecords = Array.from(allInspRecordMap.values());

  if (allInspRecords.length === 0) {
    return apiSuccess([]);
  }

  const inspIds = allInspRecords.map((r) => r.insp_id);
  const inspMap = new Map<number, any>(allInspRecords.map((r) => [r.insp_id, r]));

  // 3. Get all anomalies for these inspection records in chunks
  const anomalyIds: number[] = [];
  const anomalyToInspMap = new Map<number, any>();
  const anomalyRefMap = new Map<number, string>();

  for (const chunk of chunkArray(inspIds)) {
    const { data: anomalies } = await (supabase as any)
      .from("insp_anomalies")
      .select("anomaly_id, insp_id, anomaly_ref_no")
      .in("insp_id", chunk)
      .limit(10000);

    (anomalies || []).forEach((a: any) => {
      if (a.anomaly_id) {
        anomalyIds.push(a.anomaly_id);
        anomalyToInspMap.set(a.anomaly_id, inspMap.get(a.insp_id));
        if (a.anomaly_ref_no) anomalyRefMap.set(a.anomaly_id, a.anomaly_ref_no);
      }
    });
  }

  // 4. Fetch attachments in chunks
  const combinedAttList: any[] = [];
  const fetchedAttIds = new Set<string | number>();

  const allSourceIds = [...inspIds, ...anomalyIds];
  for (const chunk of chunkArray(allSourceIds)) {
    const { data: attachments, error: attError } = await supabase
      .from("attachment")
      .select("*")
      .in("source_id", chunk)
      .limit(10000);

    if (!attError && attachments) {
      attachments.forEach((a: any) => {
        if (!fetchedAttIds.has(a.id)) {
          fetchedAttIds.add(a.id);
          combinedAttList.push(a);
        }
      });
    }
  }

  // 5. Also fetch from insp_media in chunks
  const inspMediaList: any[] = [];
  for (const chunk of chunkArray(inspIds)) {
    const { data: inspMedia, error: mediaError } = await (supabase as any)
      .from("insp_media")
      .select("*")
      .in("inspection_id", chunk)
      .limit(10000);

    if (!mediaError && inspMedia) {
      inspMedia.forEach((m: any) => inspMediaList.push(m));
    }
  }

  const normalizedMedia = inspMediaList.map((m: any) => ({
    id: `m-${m.media_id}`,
    name: m.file_name || `Snapshot ${m.media_id}`,
    path: m.file_path,
    source_id: m.anomaly_id || m.inspection_id,
    source_type: m.anomaly_id ? "ANOMALY" : "INSPECTION",
    user_id: m.cr_user || null,
    cr_date: m.captured_at || m.cr_date,
    meta: {
      type: m.media_type,
      size: 0,
      mime: m.media_type?.toLowerCase().includes("video") ? "video/mp4" : "image/jpeg",
      bucket: "inspection-media",
      is_insp_media: true,
      anomaly_id: m.anomaly_id,
    },
  }));

  const combinedAttachments = [...combinedAttList, ...normalizedMedia];

  if (combinedAttachments.length === 0) {
    return apiSuccess([]);
  }

  // 4. Fetch jobpack names for relevant jobpack_ids
  const jobpackIds = Array.from(new Set(allInspRecords.map((r) => r.jobpack_id).filter(Boolean)));

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

  // 5. Build lookup maps...

  // 7. Enrich attachments with inspection + component info
  const enriched = combinedAttachments.map((att: any) => {
    const isAnomalyAtt = att.source_type?.toLowerCase() === "anomaly";
    const sourceId = Number(att.source_id);
    const insp = isAnomalyAtt ? anomalyToInspMap.get(sourceId) : inspMap.get(sourceId);
    if (!insp) {
      console.warn(
        `No inspection found for attachment ${att.id} (source_id: ${att.source_id}, source_type: ${att.source_type})`
      );
      return { ...att };
    }

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
      anomaly_ref_no: isAnomalyAtt ? anomalyRefMap.get(sourceId) : null,
      jobpack_id: insp.jobpack_id,
      jobpack_name: insp.jobpack_id ? jobpackMap.get(insp.jobpack_id) || null : null,
      rov_job_id: insp.rov_job_id,
      dive_job_id: insp.dive_job_id,
    };
  });

  return apiSuccess(enriched);
}
