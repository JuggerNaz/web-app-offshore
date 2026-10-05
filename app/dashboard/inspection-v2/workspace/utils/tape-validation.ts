import { SupabaseClient } from "@supabase/supabase-js";

export interface CheckTapeDuplicateOptions {
  tapeNo: string;
  chapterNo: number | string;
  currentTapeId?: number | null;
  jobPackId?: string | number | null;
  structureId?: string | number | null;
  activeDepId?: string | number | null;
  inspMethod?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  message?: string;
  existingTapeId?: number;
}

/**
 * Validates that no duplicate (tape_no, chapter_no) exists under the same structure and jobpack,
 * across all dive and ROV deployments.
 */
export async function checkTapeDuplicate(
  supabase: SupabaseClient | any,
  options: CheckTapeDuplicateOptions
): Promise<DuplicateCheckResult> {
  const {
    tapeNo,
    chapterNo,
    currentTapeId,
    jobPackId,
    structureId,
  } = options;

  const cleanTapeNo = String(tapeNo || "").replace(/\s+/g, "").toUpperCase();
  const cleanChapter = parseInt(String(chapterNo), 10) || 1;

  if (!cleanTapeNo) {
    return { isDuplicate: false };
  }

  const numJp = jobPackId && !isNaN(Number(jobPackId)) ? Number(jobPackId) : null;
  const numStruct = structureId && !isNaN(Number(structureId)) ? Number(structureId) : null;

  try {
    // 1. Fetch relevant dive & rov job IDs for this structure / jobpack
    const diveJobMap = new Map<number, string>();
    const rovJobMap = new Map<number, string>();

    const queries: Promise<any>[] = [];

    // Query Dive Jobs
    let diveQ = supabase
      .from("insp_dive_jobs")
      .select("dive_job_id, dive_no, jobpack_id, structure_id");
    if (numJp) diveQ = diveQ.eq("jobpack_id", numJp);
    if (numStruct) diveQ = diveQ.eq("structure_id", numStruct);
    queries.push(diveQ);

    // Query ROV Jobs
    let rovQ = supabase
      .from("insp_rov_jobs")
      .select("rov_job_id, deployment_no, jobpack_id, structure_id");
    if (numJp) rovQ = rovQ.eq("jobpack_id", numJp);
    if (numStruct) rovQ = rovQ.eq("structure_id", numStruct);
    queries.push(rovQ);

    const [diveRes, rovRes] = await Promise.all(queries);

    (diveRes?.data || []).forEach((j: any) => {
      if (j.dive_job_id) {
        diveJobMap.set(Number(j.dive_job_id), j.dive_no ? `Dive: ${j.dive_no}` : `Dive #${j.dive_job_id}`);
      }
    });

    (rovRes?.data || []).forEach((j: any) => {
      if (j.rov_job_id) {
        rovJobMap.set(Number(j.rov_job_id), j.deployment_no ? `Deployment: ${j.deployment_no}` : `ROV #${j.rov_job_id}`);
      }
    });

    const diveJobIds = Array.from(diveJobMap.keys());
    const rovJobIds = Array.from(rovJobMap.keys());

    // 2. Query all tapes with matching tape_no
    const { data: tapes, error } = await supabase
      .from("insp_video_tapes")
      .select("tape_id, tape_no, chapter_no, dive_job_id, rov_job_id")
      .ilike("tape_no", cleanTapeNo);

    if (error) {
      console.warn("[checkTapeDuplicate] Supabase query error:", error);
      return { isDuplicate: false };
    }

    if (!tapes || tapes.length === 0) {
      return { isDuplicate: false };
    }

    // 3. Find if any tape has identical chapter_no under the same structure/jobpack
    for (const t of tapes) {
      if (currentTapeId && Number(t.tape_id) === Number(currentTapeId)) {
        continue;
      }

      const existingTapeNo = String(t.tape_no || "").replace(/\s+/g, "").toUpperCase();
      const existingCh = parseInt(String(t.chapter_no), 10) || 1;

      if (existingTapeNo === cleanTapeNo && existingCh === cleanChapter) {
        const matchesDive = t.dive_job_id && diveJobIds.includes(Number(t.dive_job_id));
        const matchesRov = t.rov_job_id && rovJobIds.includes(Number(t.rov_job_id));

        // If structure/jobpack dive/rov jobs were found, ensure the duplicate is in the same scope
        if (diveJobIds.length > 0 || rovJobIds.length > 0) {
          if (!matchesDive && !matchesRov) {
            continue;
          }
        }

        let depLabel = "";
        if (t.dive_job_id && diveJobMap.has(Number(t.dive_job_id))) {
          depLabel = ` (${diveJobMap.get(Number(t.dive_job_id))})`;
        } else if (t.rov_job_id && rovJobMap.has(Number(t.rov_job_id))) {
          depLabel = ` (${rovJobMap.get(Number(t.rov_job_id))})`;
        }

        return {
          isDuplicate: true,
          existingTapeId: t.tape_id,
          message: `Tape "${cleanTapeNo}" with Chapter ${cleanChapter} already exists in this Structure / Job Pack${depLabel}. Duplicate Tape No & Chapter is not allowed.`,
        };
      }
    }

    return { isDuplicate: false };
  } catch (err: any) {
    console.error("[checkTapeDuplicate] Error:", err);
    return { isDuplicate: false };
  }
}
