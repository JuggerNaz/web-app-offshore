import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

function extractComponentQidFromFilename(fileName: string): string | null {
  if (!fileName) return null;
  const base = fileName.split(/[/\\]/).pop() || fileName;
  const withoutExt = base.replace(/\.[^/.]+$/, "");

  // Split on underscore (e.g. "26_BODP-A_CGF006-49M" or "26_BODP-A_A-008-3")
  const parts = withoutExt.split("_");
  for (const part of parts) {
    // Matches offshore component patterns:
    // e.g. CGF006, CGF004-12M, AN001, ML01, BL02, R01, CA01, etc.
    const m = part.match(/^([A-Za-z]{2,6}\d{1,5})(?:-[0-9]+[a-zA-Z]*|\b|$)/);
    if (m) {
      return m[1].toUpperCase();
    }
  }

  // Also check if any standalone token matches component code pattern
  const tokenMatch = withoutExt.match(/\b([A-Za-z]{2,6}\d{2,5})\b/);
  if (tokenMatch) {
    return tokenMatch[1].toUpperCase();
  }

  return null;
}

/**
 * GET /api/attachment/inspection?platform_id=123
 * Fetch all inspection attachments (source_type = 'inspection') for a given platform.
 * Enriches each attachment with inspection record data:
 *   - inspection date, type code/name, status, has_anomaly
 *   - component q_id (from structure_components, inspection_data, or filename)
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
    .select("id, q_id, code, id_no, metadata, structure_id")
    .eq("structure_id", structureId)
    .limit(10000);

  if (compError) {
    return handleSupabaseError(compError, "Failed to fetch structure components");
  }

  const componentIds = (components || []).map((c: any) => c.id);
  const componentMap = new Map<string | number, any>();
  const componentByQidMap = new Map<string, any>();

  (components || []).forEach((c: any) => {
    componentMap.set(c.id, c);
    componentMap.set(String(c.id), c);
    componentMap.set(Number(c.id), c);
    if (c.q_id) componentByQidMap.set(String(c.q_id).trim().toUpperCase(), c);
    if (c.code) componentByQidMap.set(String(c.code).trim().toUpperCase(), c);
  });

  // 2. Get all insp_records directly by structure_id
  const allInspRecordMap = new Map<number, any>();

  const inspSelectCols = `
    insp_id,
    component_id,
    component_type,
    description,
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
    inspection_data,
    inspection_type!left(id, code, name),
    structure_components!left(id, q_id, code, id_no, metadata)
  `;

  const { data: directInsps, error: inspError } = await (supabase as any)
    .from("insp_records")
    .select(inspSelectCols)
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
        .select(inspSelectCols)
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

  // Ensure any component_id present in allInspRecords that isn't in componentMap gets fetched
  const missingCompIds = Array.from(
    new Set(
      allInspRecords
        .map((r: any) => r.component_id)
        .filter((cid: any) => cid != null && !componentMap.has(Number(cid)) && !componentMap.has(String(cid)))
    )
  );

  if (missingCompIds.length > 0) {
    for (const chunk of chunkArray(missingCompIds)) {
      const { data: missingComps } = await (supabase as any)
        .from("structure_components")
        .select("id, q_id, code, id_no, metadata, structure_id")
        .in("id", chunk);

      (missingComps || []).forEach((c: any) => {
        componentMap.set(c.id, c);
        componentMap.set(String(c.id), c);
        componentMap.set(Number(c.id), c);
        if (c.q_id) componentByQidMap.set(String(c.q_id).trim().toUpperCase(), c);
        if (c.code) componentByQidMap.set(String(c.code).trim().toUpperCase(), c);
      });
    }
  }

  const inspIds = allInspRecords.map((r) => r.insp_id);
  const inspMap = new Map<number, any>(allInspRecords.map((r) => [r.insp_id, r]));

  // 3. Get all anomalies for these inspection records in chunks
  const anomalyIds: number[] = [];
  const anomalyToInspMap = new Map<number, any>();
  const anomalyRefMap = new Map<number, string>();
  const anomalyCompQidMap = new Map<number, string>();
  const anomalyCompDescMap = new Map<number, string>();

  for (const chunk of chunkArray(inspIds)) {
    // Note: Column is inspection_id on insp_anomalies
    const { data: anomalies, error: anomErr } = await (supabase as any)
      .from("insp_anomalies")
      .select("anomaly_id, inspection_id, anomaly_ref_no, defect_description")
      .in("inspection_id", chunk)
      .limit(10000);

    if (anomErr) {
      console.error("Failed to fetch insp_anomalies:", anomErr);
    } else {
      (anomalies || []).forEach((a: any) => {
        if (a.anomaly_id) {
          anomalyIds.push(a.anomaly_id);
          const relatedInsp = inspMap.get(Number(a.inspection_id));
          if (relatedInsp) {
            anomalyToInspMap.set(a.anomaly_id, relatedInsp);
          }
          if (a.anomaly_ref_no) anomalyRefMap.set(a.anomaly_id, a.anomaly_ref_no);
        }
      });
    }

    // Try enrich from v_smart_query_anomalies for exact component_qid
    try {
      const { data: smartAnoms } = await (supabase as any)
        .from("v_smart_query_anomalies")
        .select("anomaly_id, inspection_id, anomaly_ref_no, component_qid, component_description")
        .in("inspection_id", chunk)
        .limit(10000);

      (smartAnoms || []).forEach((sa: any) => {
        if (sa.anomaly_id) {
          if (!anomalyIds.includes(sa.anomaly_id)) anomalyIds.push(sa.anomaly_id);
          if (sa.anomaly_ref_no) anomalyRefMap.set(sa.anomaly_id, sa.anomaly_ref_no);
          if (sa.component_qid) anomalyCompQidMap.set(sa.anomaly_id, sa.component_qid);
          if (sa.component_description) anomalyCompDescMap.set(sa.anomaly_id, sa.component_description);
          if (sa.inspection_id && inspMap.has(Number(sa.inspection_id))) {
            anomalyToInspMap.set(sa.anomaly_id, inspMap.get(Number(sa.inspection_id)));
          }
        }
      });
    } catch (_) {
      // ignore view error if not available
    }
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

  // 5. Also fetch from insp_media in chunks (by inspection_id and anomaly_id)
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

  if (anomalyIds.length > 0) {
    for (const chunk of chunkArray(anomalyIds)) {
      const { data: anomMedia, error: anomMediaError } = await (supabase as any)
        .from("insp_media")
        .select("*")
        .in("anomaly_id", chunk)
        .limit(10000);

      if (!anomMediaError && anomMedia) {
        anomMedia.forEach((m: any) => {
          if (!inspMediaList.some((existing) => existing.media_id === m.media_id)) {
            inspMediaList.push(m);
          }
        });
      }
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
      inspection_id: m.inspection_id,
    },
  }));

  const combinedAttachments = [...combinedAttList, ...normalizedMedia];

  if (combinedAttachments.length === 0) {
    return apiSuccess([]);
  }

  // 6. Fetch jobpack names for relevant jobpack_ids
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

  // 7. Enrich attachments with inspection + component info
  const enriched = combinedAttachments.map((att: any) => {
    const isAnomalyAtt = att.source_type?.toLowerCase() === "anomaly";
    const sourceId = Number(att.source_id);
    let insp = isAnomalyAtt ? anomalyToInspMap.get(sourceId) : inspMap.get(sourceId);

    // Resilient fallback lookup if source_type was misclassified or media had alternate id
    if (!insp && att.meta?.inspection_id) {
      insp = inspMap.get(Number(att.meta.inspection_id));
    }
    if (!insp && isAnomalyAtt) {
      insp = inspMap.get(sourceId);
    }
    if (!insp && !isAnomalyAtt) {
      insp = anomalyToInspMap.get(sourceId);
    }

    const anomalyRef = isAnomalyAtt
      ? anomalyRefMap.get(sourceId) || att.meta?.anomaly_ref_no || null
      : (att.meta?.anomaly_id ? anomalyRefMap.get(Number(att.meta.anomaly_id)) : null);

    const fileName = att.name || att.path || "";
    const parsedQidFromFilename = extractComponentQidFromFilename(fileName);

    const sanitizeDesc = (desc: string | null, qid: string | null, code: string | null): string | null => {
      if (!desc) return null;
      const d = desc.trim();
      const q = (qid || "").trim();
      const c = (code || "").trim();
      if (!d || d.toUpperCase() === q.toUpperCase() || d.toUpperCase() === c.toUpperCase() || d.toUpperCase() === "N/A") {
        return null;
      }
      return d;
    };

    if (!insp) {
      // Even if inspection is unlinked, resolve component from filename / structure component mapping
      const matchedComp = parsedQidFromFilename ? componentByQidMap.get(parsedQidFromFilename.toUpperCase()) : null;
      const resolvedQid = parsedQidFromFilename || matchedComp?.q_id || (isAnomalyAtt && anomalyRef ? `Anomaly ${anomalyRef}` : null);
      const rawDesc = matchedComp?.metadata?.description || matchedComp?.metadata?.comp_desc || null;

      return {
        ...att,
        inspection_id: att.source_type?.toUpperCase() === "INSPECTION" ? sourceId : null,
        inspection_date: att.cr_date || null,
        inspection_time: null,
        inspection_type_code: att.meta?.type || null,
        inspection_type_name: att.meta?.type || null,
        inspection_status: "COMPLETED",
        has_anomaly: isAnomalyAtt,
        sow_report_no: null,
        component_id: matchedComp?.id || null,
        component_q_id: resolvedQid,
        component_description: sanitizeDesc(rawDesc, resolvedQid, matchedComp?.code || null),
        component_code: matchedComp?.code || null,
        anomaly_ref_no: anomalyRef,
        jobpack_id: null,
        jobpack_name: null,
        rov_job_id: null,
        dive_job_id: null,
      };
    }

    // 1. Resolve component record
    let comp = null;
    if (insp.component_id) {
      comp =
        componentMap.get(insp.component_id) ||
        componentMap.get(Number(insp.component_id)) ||
        componentMap.get(String(insp.component_id));
    }
    if (!comp && insp.structure_components) {
      comp = insp.structure_components;
    }

    // 2. Resolve Component QID through tiered fallback
    let componentQid: string | null = comp?.q_id || null;
    let componentDesc: string | null = comp?.metadata?.description || comp?.metadata?.comp_desc || null;
    let componentCode: string | null = comp?.code || insp.component_type || null;

    // Fallback A: From anomaly view
    if (!componentQid && isAnomalyAtt && anomalyCompQidMap.has(sourceId)) {
      componentQid = anomalyCompQidMap.get(sourceId)!;
      if (!componentDesc && anomalyCompDescMap.has(sourceId)) {
        componentDesc = anomalyCompDescMap.get(sourceId)!;
      }
    }

    // Fallback B: From insp.inspection_data
    if (!componentQid && insp.inspection_data) {
      const data = insp.inspection_data as any;
      componentQid = data.component_qid || data.q_id || data.component || data.component_name || null;
      if (!componentDesc) {
        componentDesc = data.component_description || data.comp_desc || null;
      }
    }

    // Fallback C: From filename parsing (e.g. 26_BODP-A_CGF006-49M.png -> CGF006)
    if (!componentQid && parsedQidFromFilename) {
      componentQid = parsedQidFromFilename;
      const matchedComp = componentByQidMap.get(parsedQidFromFilename.toUpperCase());
      if (matchedComp) {
        comp = matchedComp;
        componentDesc =
          componentDesc ||
          matchedComp.metadata?.description ||
          matchedComp.metadata?.comp_desc ||
          null;
        componentCode = componentCode || matchedComp.code || null;
      }
    }

    // If still null and it's an anomaly without component, group by anomaly ref
    if (!componentQid && isAnomalyAtt && anomalyRef) {
      componentQid = `Anomaly ${anomalyRef}`;
    }

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
      component_id: insp.component_id || comp?.id || null,
      component_q_id: componentQid,
      component_description: sanitizeDesc(componentDesc, componentQid, componentCode),
      component_code: componentCode,
      // Jobpack info
      anomaly_ref_no: anomalyRef,
      jobpack_id: insp.jobpack_id,
      jobpack_name: insp.jobpack_id ? jobpackMap.get(insp.jobpack_id) || null : null,
      rov_job_id: insp.rov_job_id,
      dive_job_id: insp.dive_job_id,
    };
  });

  return apiSuccess(enriched);
}
