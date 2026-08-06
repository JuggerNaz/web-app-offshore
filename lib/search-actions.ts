"use server";

import { createClient } from "@/utils/supabase/server";

export type SearchResult = {
  id: string | number;
  title: string;
  subtitle?: string;
  type: "platform" | "pipeline" | "jobpack" | "sow" | "inspection" | "anomaly" | "media" | "component";
  url: string;
  score: number;
  year?: string;
  // Fields for print-from-search:
  inspId?: number;
  inspectionTypeCode?: string;
  jobpackId?: number;
  structureId?: number;
  sowReportNo?: string;
  inspMode?: "DIVING" | "ROV";
  componentQId?: string;
  recordCount?: number;
  componentCount?: number;
  anomalyCount?: number;
  incompleteCount?: number;
};

export async function searchGlobal(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const supabase = createClient();
  const lowerQuery = query.toLowerCase();

  // NLP: Intent Detection Patterns
  const legsMatch = query.match(/(\d+)\s*legs?/i);
  const qidMatch = query.match(/qid\s*:?\s*(\d+)/i) || query.match(/^(\d{4,})$/); // Direct digits or "qid: 123"
  const priorityMatch = query.match(/p\s*(\d)/i) || query.match(/priority\s*(\d)/i);

  // Fetch structures for mapping component URLs and names
  const { data: structures } = await (supabase as any).from("structure").select("str_id, str_type");
  const { data: platformsInfo } = await (supabase as any).from("platform").select("plat_id, title");
  const { data: pipelinesInfo } = await (supabase as any).from("u_pipeline").select("pipe_id, title");

  const structureTypeMap = new Map<number, string>();
  const structureTitleMap = new Map<number, string>();

  structures?.forEach((s: any) => {
    structureTypeMap.set(s.str_id, s.str_type?.toLowerCase() || "platform");
  });

  platformsInfo?.forEach((p: any) => {
    structureTitleMap.set(p.plat_id, p.title);
  });

  pipelinesInfo?.forEach((p: any) => {
    structureTitleMap.set(p.pipe_id, p.title);
  });

  // 1. Platform Search
  const platformPromise = (async () => {
    try {
      let platformQuery = (supabase as any).from("platform").select("plat_id, title, plegs, ptype");
      
      if (legsMatch) {
        platformQuery = platformQuery.eq("plegs", parseInt(legsMatch[1]));
      } else if (qidMatch) {
        platformQuery = platformQuery.eq("plat_id", parseInt(qidMatch[1]));
      } else {
        platformQuery = platformQuery.ilike("title", `%${query}%`);
      }

      const { data: platforms } = await platformQuery.limit(5);
      return (platforms || []).map((p: any) => ({
        id: p.plat_id,
        title: p.title,
        subtitle: `${p.ptype || "Platform"} • ${p.plegs || 0} Legs`,
        type: "platform" as const,
        url: `/dashboard/field/platform/${p.plat_id}`,
        score: 100
      }));
    } catch (err) {
      console.error("Platform search error:", err);
      return [];
    }
  })();

  // 2. Pipeline Search
  const pipelinePromise = (async () => {
    try {
      const { data: pipelines } = await (supabase as any)
        .from("u_pipeline")
        .select("pipe_id, title, ptype")
        .ilike("title", `%${query}%`)
        .limit(5);

      return (pipelines || []).map((p: any) => ({
        id: p.pipe_id,
        title: p.title,
        subtitle: `Pipeline • ${p.ptype || "Standard"}`,
        type: "pipeline" as const,
        url: `/dashboard/field/pipeline/${p.pipe_id}`,
        score: 90
      }));
    } catch (err) {
      console.error("Pipeline search error:", err);
      return [];
    }
  })();

  // 3. Jobpack Search
  const jobpackPromise = (async () => {
    try {
      const { data: jobpacks } = await (supabase as any)
        .from("jobpack")
        .select("id, name, metadata")
        .or(`name.ilike.%${query}%, metadata->>job_no.ilike.%${query}%`)
        .limit(5);

      return (jobpacks || []).map((j: any) => {
        const metadata = j.metadata as any;
        return {
          id: j.id,
          title: j.name || "Untitled Jobpack",
          subtitle: `Jobpack • ${metadata?.job_no || "No Reference"}`,
          type: "jobpack" as const,
          url: `/dashboard/jobpack/${j.id}`,
          score: 85
        };
      });
    } catch (err) {
      console.error("Jobpack search error:", err);
      return [];
    }
  })();

  // 4. Structure Component Search
  const componentPromise = (async () => {
    try {
      const { data: components } = await (supabase as any)
        .from("structure_components")
        .select("id, q_id, id_no, code, structure_id")
        .or(`q_id.ilike.%${query}%, id_no.ilike.%${query}%, code.ilike.%${query}%`)
        .limit(5);

      return (components || []).map((c: any) => {
        const type = structureTypeMap.get(c.structure_id) || "platform";
        const structureTitle = structureTitleMap.get(c.structure_id) || `ID: ${c.structure_id}`;
        return {
          id: c.id,
          title: c.q_id || c.id_no || `Comp #${c.id}`,
          subtitle: `Component • Code: ${c.code || "N/A"} • ${structureTitle}`,
          type: "component" as const,
          url: `/dashboard/field/${type}/${c.structure_id}?tab=components&compId=${c.id}`,
          score: 95
        };
      });
    } catch (err) {
      console.error("Component search error:", err);
      return [];
    }
  })();

  // 5. Inspection Records Search
  const inspectionPromise = (async () => {
    try {
      // Find matching inspection type codes
      const typeQuery = (supabase as any).from("inspection_type").select("code").or(`code.ilike.%${query}%,name.ilike.%${query}%`);
      // Find matching platform/pipeline IDs
      const platQuery = (supabase as any).from("platform").select("plat_id").ilike("title", `%${query}%`);
      const pipeQuery = (supabase as any).from("u_pipeline").select("pipe_id").ilike("title", `%${query}%`);
      // Find matching jobpacks
      const jpQuery = (supabase as any).from("jobpack").select("id").ilike("name", `%${query}%`);
      // Find matching component QIDs
      const compQuery = (supabase as any).from("structure_components").select("id").ilike("q_id", `%${query}%`);

      const [typesRes, platRes, pipeRes, jpRes, compRes] = await Promise.all([
        typeQuery,
        platQuery,
        pipeQuery,
        jpQuery,
        compQuery
      ]);

      const matchedCodes = typesRes.data?.map((t: any) => t.code) || [];
      const matchedStructureIds = [
        ...(platRes.data?.map((p: any) => p.plat_id) || []),
        ...(pipeRes.data?.map((p: any) => p.pipe_id) || [])
      ];
      const matchedJobpackIds = jpRes.data?.map((j: any) => j.id) || [];
      const matchedComponentIds = compRes.data?.map((c: any) => c.id) || [];

      const conditions = [];
      conditions.push(`inspection_type_code.ilike.%${query}%`);
      conditions.push(`description.ilike.%${query}%`);
      conditions.push(`status.ilike.%${query}%`);
      conditions.push(`sow_report_no.ilike.%${query}%`);
      
      if (/^\d+$/.test(query)) {
        conditions.push(`insp_id.eq.${query}`);
      }
      if (matchedCodes.length > 0) {
        conditions.push(`inspection_type_code.in.(${matchedCodes.join(",")})`);
      }
      if (matchedStructureIds.length > 0) {
        conditions.push(`structure_id.in.(${matchedStructureIds.join(",")})`);
      }
      if (matchedJobpackIds.length > 0) {
        conditions.push(`jobpack_id.in.(${matchedJobpackIds.join(",")})`);
      }
      if (matchedComponentIds.length > 0) {
        conditions.push(`component_id.in.(${matchedComponentIds.join(",")})`);
      }

      const orFilter = conditions.join(",");

      const { data: inspections } = await (supabase as any)
        .from("insp_records")
        .select(`
          insp_id, 
          inspection_type_code, 
          status, 
          inspection_date, 
          description, 
          jobpack_id, 
          structure_id, 
          sow_report_no, 
          rov_job_id, 
          dive_job_id,
          has_anomaly,
          component_id,
          jobpack(name),
          structure_components:component_id!left(q_id)
        `)
        .or(orFilter)
        .order("inspection_date", { ascending: false })
        .limit(200);

      if (!inspections || inspections.length === 0) return [];

      // Group inspection records into Task items by Jobpack, Structure, SOW Report, and Type Code
      const taskMap = new Map<string, {
        firstInspId: number;
        jobpackId: number;
        structureId: number;
        sowReportNo: string;
        inspectionTypeCode: string;
        jobpackName: string;
        mode: "DIVING" | "ROV";
        recordsCount: number;
        uniqueComponents: Set<any>;
        anomalyCount: number;
        incompleteCount: number;
        latestDate: string;
      }>();

      inspections.forEach((i: any) => {
        const typeCode = (i.inspection_type_code || "GENERAL").toUpperCase();
        const sowNo = i.sow_report_no || "";
        const key = `${i.jobpack_id}_${i.structure_id}_${sowNo || "nosow"}_${typeCode}`;

        if (!taskMap.has(key)) {
          const mode = i.rov_job_id ? "ROV" : "DIVING";
          const jobpackName = i.jobpack?.name || `Jobpack #${i.jobpack_id}`;
          taskMap.set(key, {
            firstInspId: Number(i.insp_id) || 0,
            jobpackId: i.jobpack_id,
            structureId: i.structure_id,
            sowReportNo: sowNo,
            inspectionTypeCode: typeCode,
            jobpackName,
            mode,
            recordsCount: 0,
            uniqueComponents: new Set(),
            anomalyCount: 0,
            incompleteCount: 0,
            latestDate: i.inspection_date || "",
          });
        }

        const task = taskMap.get(key)!;
        task.recordsCount++;
        if (i.component_id) task.uniqueComponents.add(i.component_id);
        const hasAno = i.has_anomaly === true || String(i.has_anomaly).toUpperCase() === "YES" || String(i.has_anomaly).toUpperCase() === "TRUE";
        if (hasAno) task.anomalyCount++;
        const isCompleted = i.status && String(i.status).toUpperCase() === "COMPLETED";
        if (!isCompleted) task.incompleteCount++;
        if (i.inspection_date && i.inspection_date > task.latestDate) task.latestDate = i.inspection_date;
      });

      const results: SearchResult[] = [];
      taskMap.forEach((task, key) => {
        const structureTitle = structureTitleMap.get(task.structureId) || `Structure #${task.structureId}`;
        const year = task.latestDate ? task.latestDate.substring(0, 4) : "Unknown Year";
        const sowStr = task.sowReportNo ? ` • Report #${task.sowReportNo}` : "";
        const recStr = `${task.recordsCount} Rec${task.recordsCount > 1 ? "s" : ""}`;
        const compStr = task.uniqueComponents.size > 0 ? ` (${task.uniqueComponents.size} Comp${task.uniqueComponents.size > 1 ? "s" : ""})` : "";
        const anomalyStr = task.anomalyCount > 0 ? ` • ⚠️ ${task.anomalyCount} Anomaly` : "";
        const incompleteStr = task.incompleteCount > 0 ? ` • ⏳ ${task.incompleteCount} Incomplete` : "";

        results.push({
          id: key,
          inspId: task.firstInspId,
          title: `INSPECTION: ${task.inspectionTypeCode}`,
          subtitle: `${task.jobpackName} • ${structureTitle}${sowStr} • ${recStr}${compStr}${anomalyStr}${incompleteStr}`,
          type: "inspection" as const,
          url: `/dashboard/inspection-v2/workspace?jobpack=${task.jobpackId}&structure=${task.structureId}&sowReport=${task.sowReportNo}&mode=${task.mode}`,
          score: 75,
          year,
          inspectionTypeCode: task.inspectionTypeCode,
          jobpackId: task.jobpackId,
          structureId: task.structureId,
          sowReportNo: task.sowReportNo || undefined,
          inspMode: task.mode,
          recordCount: task.recordsCount,
          componentCount: task.uniqueComponents.size,
          anomalyCount: task.anomalyCount,
          incompleteCount: task.incompleteCount,
        });
      });

      return results;
    } catch (err) {
      console.error("Inspection search error:", err);
      // Fallback to simpler query if columns don't exist
      try {
        const { data: inspections } = await (supabase as any)
          .from("insp_records")
          .select("insp_id, inspection_type_code, status, inspection_date, jobpack_id, structure_id, sow_report_no, rov_job_id, dive_job_id, has_anomaly, component_id")
          .or(`inspection_type_code.ilike.%${query}%,status.ilike.%${query}%`)
          .order("inspection_date", { ascending: false })
          .limit(200);

        if (!inspections || inspections.length === 0) return [];

        const taskMap = new Map<string, {
          firstInspId: number;
          jobpackId: number;
          structureId: number;
          sowReportNo: string;
          inspectionTypeCode: string;
          mode: "DIVING" | "ROV";
          recordsCount: number;
          uniqueComponents: Set<any>;
          anomalyCount: number;
          incompleteCount: number;
          latestDate: string;
        }>();

        inspections.forEach((i: any) => {
          const typeCode = (i.inspection_type_code || "GENERAL").toUpperCase();
          const sowNo = i.sow_report_no || "";
          const key = `${i.jobpack_id}_${i.structure_id}_${sowNo || "nosow"}_${typeCode}`;

          if (!taskMap.has(key)) {
            const mode = i.rov_job_id ? "ROV" : "DIVING";
            taskMap.set(key, {
              firstInspId: Number(i.insp_id) || 0,
              jobpackId: i.jobpack_id,
              structureId: i.structure_id,
              sowReportNo: sowNo,
              inspectionTypeCode: typeCode,
              mode,
              recordsCount: 0,
              uniqueComponents: new Set(),
              anomalyCount: 0,
              incompleteCount: 0,
              latestDate: i.inspection_date || "",
            });
          }

          const task = taskMap.get(key)!;
          task.recordsCount++;
          if (i.component_id) task.uniqueComponents.add(i.component_id);
          const hasAno = i.has_anomaly === true || String(i.has_anomaly).toUpperCase() === "YES" || String(i.has_anomaly).toUpperCase() === "TRUE";
          if (hasAno) task.anomalyCount++;
          const isCompleted = i.status && String(i.status).toUpperCase() === "COMPLETED";
          if (!isCompleted) task.incompleteCount++;
          if (i.inspection_date && i.inspection_date > task.latestDate) task.latestDate = i.inspection_date;
        });

        const results: SearchResult[] = [];
        taskMap.forEach((task, key) => {
          const structureTitle = structureTitleMap.get(task.structureId) || `Structure #${task.structureId}`;
          const year = task.latestDate ? task.latestDate.substring(0, 4) : "Unknown Year";
          const sowStr = task.sowReportNo ? ` • Report #${task.sowReportNo}` : "";
          const recStr = `${task.recordsCount} Recs`;
          const compStr = task.uniqueComponents.size > 0 ? ` (${task.uniqueComponents.size} Comps)` : "";
          const anomalyStr = task.anomalyCount > 0 ? ` • ⚠️ ${task.anomalyCount} Anomaly` : "";
          const incompleteStr = task.incompleteCount > 0 ? ` • ⏳ ${task.incompleteCount} Incomplete` : "";

          results.push({
            id: key,
            inspId: task.firstInspId,
            title: `INSPECTION: ${task.inspectionTypeCode}`,
            subtitle: `${structureTitle}${sowStr} • ${recStr}${compStr}${anomalyStr}${incompleteStr}`,
            type: "inspection" as const,
            url: `/dashboard/inspection-v2/workspace?jobpack=${task.jobpackId}&structure=${task.structureId}&sowReport=${task.sowReportNo}&mode=${task.mode}`,
            score: 75,
            year,
            inspectionTypeCode: task.inspectionTypeCode,
            jobpackId: task.jobpackId,
            structureId: task.structureId,
            sowReportNo: task.sowReportNo || undefined,
            inspMode: task.mode,
            recordCount: task.recordsCount,
            componentCount: task.uniqueComponents.size,
            anomalyCount: task.anomalyCount,
            incompleteCount: task.incompleteCount,
          });
        });

        return results;
      } catch (fallbackErr) {
        console.error("Inspection fallback search error:", fallbackErr);
        return [];
      }
    }
  })();

  // 6. Anomaly Search
  const anomalyPromise = (async () => {
    try {
      let anomalyQuery = (supabase as any)
        .from("insp_anomalies")
        .select(`
          anomaly_id, 
          anomaly_ref_no, 
          defect_description, 
          priority_code,
          inspection_id,
          insp_records:inspection_id(jobpack_id, structure_id, sow_report_no, inspection_type_code, rov_job_id)
        `);
      
      if (priorityMatch) {
        anomalyQuery = anomalyQuery.eq("priority_code", `PRIORITY ${priorityMatch[1]}`);
      } else {
        anomalyQuery = anomalyQuery.or(`anomaly_ref_no.ilike.%${query}%, defect_description.ilike.%${query}%`);
      }

      const { data: anomalies } = await anomalyQuery.limit(10);
      return (anomalies || []).map((a: any) => {
        const rec = a.insp_records || {};
        const mode = rec.rov_job_id ? "ROV" : "DIVING";
        return {
          id: a.anomaly_id,
          inspId: a.inspection_id || 0,
          inspectionTypeCode: "ANOMALY",
          jobpackId: rec.jobpack_id || 0,
          structureId: rec.structure_id || 0,
          sowReportNo: rec.sow_report_no || undefined,
          inspMode: mode as "DIVING" | "ROV",
          title: a.anomaly_ref_no || `Anomaly #${a.anomaly_id}`,
          subtitle: `Anomaly • ${a.priority_code || "N/A"} • ${a.defect_description?.substring(0, 50) || "No description"}...`,
          type: "anomaly" as const,
          url: `/dashboard/utilities/anomalies-findings?id=${a.anomaly_id}`,
          score: 90
        };
      });
    } catch (err) {
      console.error("Anomaly search error:", err);
      return [];
    }
  })();

  // Execute all searches in parallel
  const promiseResults = await Promise.all([
    platformPromise,
    pipelinePromise,
    jobpackPromise,
    componentPromise,
    inspectionPromise,
    anomalyPromise
  ]);

  // Flatten and sort results
  const allResults = promiseResults.flat();
  return allResults.sort((a, b) => b.score - a.score);
}
