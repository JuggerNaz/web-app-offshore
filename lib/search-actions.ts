"use server";

import { createClient } from "@/utils/supabase/server";

export type SearchResult = {
  id: string | number;
  title: string;
  subtitle?: string;
  type: "platform" | "pipeline" | "jobpack" | "sow" | "inspection" | "anomaly" | "media";
  url: string;
  score: number;
};

export async function searchGlobal(query: string): Promise<SearchResult[]> {
  if (!query || query.length < 2) return [];

  const supabase = createClient();
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  // NLP: Intent Detection Patterns
  const legsMatch = query.match(/(\d+)\s*legs?/i);
  const qidMatch = query.match(/qid\s*:?\s*(\d+)/i) || query.match(/^(\d{4,})$/); // Direct digits or "qid: 123"
  const priorityMatch = query.match(/p\s*(\d)/i) || query.match(/priority\s*(\d)/i);

  // 1. Search Platforms
  let platformQuery = supabase.from("platform").select("plat_id, title, plegs, ptype");
  
  if (legsMatch) {
    platformQuery = platformQuery.eq("plegs", parseInt(legsMatch[1]));
  } else if (qidMatch) {
    platformQuery = platformQuery.eq("plat_id", parseInt(qidMatch[1]));
  } else {
    platformQuery = platformQuery.ilike("title", `%${query}%`);
  }

  const { data: platforms } = await platformQuery.limit(5);
  (platforms || []).forEach(p => {
    results.push({
      id: p.plat_id,
      title: p.title,
      subtitle: `${p.ptype || "Platform"} • ${p.plegs || 0} Legs`,
      type: "platform",
      url: `/dashboard/field/platform/${p.plat_id}`,
      score: 100
    });
  });

  // 2. Search Pipelines
  const { data: pipelines } = await supabase
    .from("u_pipeline")
    .select("pipe_id, title, ptype")
    .ilike("title", `%${query}%`)
    .limit(5);

  (pipelines || []).forEach(p => {
    results.push({
      id: p.pipe_id,
      title: p.title,
      subtitle: `Pipeline • ${p.ptype || "Standard"}`,
      type: "pipeline",
      url: `/dashboard/field/pipeline/${p.pipe_id}`,
      score: 90
    });
  });

  // 3. Search Jobpacks
  const { data: jobpacks } = await supabase
    .from("jobpack")
    .select("id, name, metadata")
    .or(`name.ilike.%${query}%, metadata->>job_no.ilike.%${query}%`)
    .limit(5);

  (jobpacks || []).forEach(j => {
    const metadata = j.metadata as any;
    results.push({
      id: j.id,
      title: j.name || "Untitled Jobpack",
      subtitle: `Jobpack • ${metadata?.job_no || "No Reference"}`,
      type: "jobpack",
      url: `/dashboard/jobpack/${j.id}`,
      score: 85
    });
  });

  // 4. Search Inspections (By ID or Type Code)
  const { data: inspections } = await (supabase as any)
    .from("insp_records")
    .select("insp_id, inspection_type_code, status, inspection_date")
    .or(`inspection_type_code.ilike.%${query}%, status.ilike.%${query}%`)
    .limit(5);

  (inspections || []).forEach((i: any) => {
    results.push({
      id: i.insp_id,
      title: `Inspection: ${i.inspection_type_code}`,
      subtitle: `Report #${i.insp_id} • ${i.status} • ${i.inspection_date}`,
      type: "inspection",
      url: `/dashboard/inspection/workspace?id=${i.insp_id}`,
      score: 70
    });
  });

  // 5. Search Anomalies
  let anomalyQuery = (supabase as any).from("insp_anomalies").select("anomaly_id, anomaly_ref_no, defect_description, priority_code");
  
  if (priorityMatch) {
    anomalyQuery = anomalyQuery.eq("priority_code", `P${priorityMatch[1]}`);
  } else {
    anomalyQuery = anomalyQuery.or(`anomaly_ref_no.ilike.%${query}%, defect_description.ilike.%${query}%`);
  }

  const { data: anomalies } = await anomalyQuery.limit(5);
  (anomalies || []).forEach((a: any) => {
    results.push({
      id: a.anomaly_id,
      title: a.anomaly_ref_no,
      subtitle: `Anomaly • ${a.priority_code} • ${a.defect_description?.substring(0, 40)}...`,
      type: "anomaly",
      url: `/dashboard/inspection/anomalies/${a.anomaly_id}`,
      score: 80
    });
  });

  return results.sort((a, b) => b.score - a.score);
}
