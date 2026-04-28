"use server";

import { createClient } from "@/utils/supabase/server";

export type SearchResult = {
  id: string | number;
  title: string;
  subtitle?: string;
  type: "platform" | "pipeline" | "jobpack" | "sow" | "inspection" | "anomaly" | "media" | "component";
  url: string;
  score: number;
};

export async function searchGlobal(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const supabase = createClient();
  const lowerQuery = query.toLowerCase();

  // NLP: Intent Detection Patterns
  const legsMatch = query.match(/(\d+)\s*legs?/i);
  const qidMatch = query.match(/qid\s*:?\s*(\d+)/i) || query.match(/^(\d{4,})$/); // Direct digits or "qid: 123"
  const priorityMatch = query.match(/p\s*(\d)/i) || query.match(/priority\s*(\d)/i);

  // Fetch structures for mapping component URLs
  const { data: structures } = await supabase.from("structure").select("str_id, str_type");
  const structureTypeMap = new Map<number, string>();
  structures?.forEach((s: any) => {
    structureTypeMap.set(s.str_id, s.str_type?.toLowerCase() || "platform");
  });

  // 1. Platform Search
  const platformPromise = (async () => {
    try {
      let platformQuery = supabase.from("platform").select("plat_id, title, plegs, ptype");
      
      if (legsMatch) {
        platformQuery = platformQuery.eq("plegs", parseInt(legsMatch[1]));
      } else if (qidMatch) {
        platformQuery = platformQuery.eq("plat_id", parseInt(qidMatch[1]));
      } else {
        platformQuery = platformQuery.ilike("title", `%${query}%`);
      }

      const { data: platforms } = await platformQuery.limit(5);
      return (platforms || []).map(p => ({
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
      const { data: pipelines } = await supabase
        .from("u_pipeline")
        .select("pipe_id, title, ptype")
        .ilike("title", `%${query}%`)
        .limit(5);

      return (pipelines || []).map(p => ({
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
      const { data: jobpacks } = await supabase
        .from("jobpack")
        .select("id, name, metadata")
        .or(`name.ilike.%${query}%, metadata->>job_no.ilike.%${query}%`)
        .limit(5);

      return (jobpacks || []).map(j => {
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
      const { data: components } = await supabase
        .from("structure_components")
        .select("id, q_id, id_no, code, structure_id")
        .or(`q_id.ilike.%${query}%, id_no.ilike.%${query}%, code.ilike.%${query}%`)
        .limit(5);

      return (components || []).map(c => {
        const type = structureTypeMap.get(c.structure_id) || "platform";
        return {
          id: c.id,
          title: c.q_id || c.id_no || `Comp #${c.id}`,
          subtitle: `Component • Code: ${c.code || "N/A"} • Structure ID: ${c.structure_id}`,
          type: "component" as const,
          url: `/dashboard/field/${type}/${c.structure_id}`,
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
      let orFilter = `inspection_type_code.ilike.%${query}%,status.ilike.%${query}%`;
      
      // Add description/observation if we can safely assume they exist
      orFilter += `,description.ilike.%${query}%,observation.ilike.%${query}%`;

      if (/^\d+$/.test(query)) {
        orFilter += `,insp_id.eq.${query}`;
      }

      const { data: inspections } = await (supabase as any)
        .from("insp_records")
        .select("insp_id, inspection_type_code, status, inspection_date, description")
        .or(orFilter)
        .limit(5);

      return (inspections || []).map((i: any) => ({
        id: i.insp_id,
        title: `Inspection: ${i.inspection_type_code}`,
        subtitle: `Report #${i.insp_id} • ${i.status} • ${i.inspection_date} ${i.description ? `• ${i.description.substring(0, 30)}...` : ""}`,
        type: "inspection" as const,
        url: `/dashboard/inspection/workspace?id=${i.insp_id}`,
        score: 75
      }));
    } catch (err) {
      console.error("Inspection search error:", err);
      // Fallback to simpler query if columns don't exist
      try {
        const { data: inspections } = await (supabase as any)
          .from("insp_records")
          .select("insp_id, inspection_type_code, status, inspection_date")
          .or(`inspection_type_code.ilike.%${query}%,status.ilike.%${query}%`)
          .limit(5);

        return (inspections || []).map((i: any) => ({
          id: i.insp_id,
          title: `Inspection: ${i.inspection_type_code}`,
          subtitle: `Report #${i.insp_id} • ${i.status} • ${i.inspection_date}`,
          type: "inspection" as const,
          url: `/dashboard/inspection/workspace?id=${i.insp_id}`,
          score: 75
        }));
      } catch (fallbackErr) {
        console.error("Inspection fallback search error:", fallbackErr);
        return [];
      }
    }
  })();

  // 6. Anomaly Search
  const anomalyPromise = (async () => {
    try {
      let anomalyQuery = (supabase as any).from("insp_anomalies").select("anomaly_id, anomaly_ref_no, defect_description, priority_code");
      
      if (priorityMatch) {
        anomalyQuery = anomalyQuery.eq("priority_code", `P${priorityMatch[1]}`);
      } else {
        anomalyQuery = anomalyQuery.or(`anomaly_ref_no.ilike.%${query}%, defect_description.ilike.%${query}%`);
      }

      const { data: anomalies } = await anomalyQuery.limit(5);
      return (anomalies || []).map((a: any) => ({
        id: a.anomaly_id,
        title: a.anomaly_ref_no,
        subtitle: `Anomaly • ${a.priority_code} • ${a.defect_description?.substring(0, 40)}...`,
        type: "anomaly" as const,
        url: `/dashboard/inspection/anomalies/${a.anomaly_id}`,
        score: 80
      }));
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
