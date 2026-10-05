
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        let jobpackId = searchParams.get("jobpack_id");
        let structureId = searchParams.get("structure_id");
        let sowReportNo = searchParams.get("sow_report_no");

        if (jobpackId === "undefined" || jobpackId === "null" || jobpackId === "") jobpackId = null;
        if (structureId === "undefined" || structureId === "null" || structureId === "") structureId = null;
        if (sowReportNo === "undefined" || sowReportNo === "null" || sowReportNo === "all" || sowReportNo === "N/A" || sowReportNo === "") sowReportNo = null;

        if (!jobpackId) {
            return NextResponse.json({ error: "JobPack ID is required" }, { status: 400 });
        }

        console.log(`[VideoLog] Req: JobPack=${jobpackId}, Structure=${structureId}, Report=${sowReportNo}`);

        // 1. Fetch tapes for this jobpack via dive jobs
        let jobsQuery = (supabase as any)
            .from("insp_dive_jobs")
            .select("dive_job_id, dive_no")
            .eq("jobpack_id", jobpackId);

        if (structureId) jobsQuery = jobsQuery.eq("structure_id", structureId);
        if (sowReportNo) jobsQuery = jobsQuery.eq("sow_report_no", sowReportNo);

        const { data: diveJobsData, error: jobsError } = await jobsQuery;
        let diveJobs = diveJobsData;
        if (jobsError) throw jobsError;

        // 1b. Fetch tapes for this jobpack via ROV jobs
        let rovJobsQuery = (supabase as any)
            .from("insp_rov_jobs")
            .select("rov_job_id, deployment_no")
            .eq("jobpack_id", jobpackId);

        if (structureId) rovJobsQuery = rovJobsQuery.eq("structure_id", structureId);
        if (sowReportNo) rovJobsQuery = rovJobsQuery.eq("sow_report_no", sowReportNo);

        const { data: rovJobsData, error: rovJobsError } = await rovJobsQuery;
        let rovJobs = rovJobsData;
        if (rovJobsError) throw rovJobsError;

        // Fallback: if sowReportNo was provided but returned no jobs, fetch all jobs for structure/jobpack
        if ((!diveJobs || diveJobs.length === 0) && (!rovJobs || rovJobs.length === 0) && sowReportNo) {
            let fbDive = (supabase as any).from("insp_dive_jobs").select("dive_job_id, dive_no").eq("jobpack_id", jobpackId);
            if (structureId) fbDive = fbDive.eq("structure_id", structureId);
            const { data: fbDData } = await fbDive;
            if (fbDData && fbDData.length > 0) diveJobs = fbDData;

            let fbRov = (supabase as any).from("insp_rov_jobs").select("rov_job_id, deployment_no").eq("jobpack_id", jobpackId);
            if (structureId) fbRov = fbRov.eq("structure_id", structureId);
            const { data: fbRData } = await fbRov;
            if (fbRData && fbRData.length > 0) rovJobs = fbRData;
        }

        const diveJobIds = (diveJobs || []).map((j: any) => j.dive_job_id);
        const rovJobIds = (rovJobs || []).map((j: any) => j.rov_job_id);

        if (diveJobIds.length === 0 && rovJobIds.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const diveNoMap: Record<number, string> = {};
        (diveJobs || []).forEach((j: any) => { diveNoMap[j.dive_job_id] = j.dive_no; });
        (rovJobs || []).forEach((j: any) => { diveNoMap[j.rov_job_id] = j.deployment_no; });

        // 2. Fetch all tapes for these dive or rov jobs
        let tapesQuery = (supabase as any)
            .from("insp_video_tapes")
            .select("tape_id, tape_no, dive_job_id, rov_job_id, status, chapter_no, remarks")
            .order("tape_no", { ascending: true });

        if (diveJobIds.length > 0 && rovJobIds.length > 0) {
            tapesQuery = tapesQuery.or(`dive_job_id.in.(${diveJobIds.join(",")}),rov_job_id.in.(${rovJobIds.join(",")})`);
        } else if (diveJobIds.length > 0) {
            tapesQuery = tapesQuery.in("dive_job_id", diveJobIds);
        } else {
            tapesQuery = tapesQuery.in("rov_job_id", rovJobIds);
        }

        const { data: tapes, error: tapesError } = await tapesQuery;

        if (tapesError) throw tapesError;

        if (!tapes || tapes.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const tapeIds = tapes.map((t: any) => t.tape_id);

        // 3. Fetch all video logs for these tapes, ordered by event_time ascending (chronological)
        const { data: logs, error: logsError } = await (supabase as any)
            .from("insp_video_logs")
            .select("video_log_id, tape_id, event_type, event_time, timecode_start, tape_counter_start, remarks, inspection_id")
            .in("tape_id", tapeIds)
            .order("event_time", { ascending: true });

        if (logsError) throw logsError;

        // Fetch linked inspection records safely if any
        const inspIds = Array.from(new Set((logs || []).map((l: any) => l.inspection_id).filter(Boolean)));
        const inspRecordMap: Record<number, any> = {};
        if (inspIds.length > 0) {
            try {
                const { data: inspRecords } = await (supabase as any)
                    .from("insp_records")
                    .select("insp_id, description, inspection_data")
                    .in("insp_id", inspIds);
                (inspRecords || []).forEach((r: any) => {
                    inspRecordMap[r.insp_id] = r;
                });
            } catch (e) {
                console.warn("[VideoLog] Could not fetch linked inspection records:", e);
            }
        }

        (logs || []).forEach((l: any) => {
            if (l.inspection_id && inspRecordMap[l.inspection_id]) {
                l.insp_records = inspRecordMap[l.inspection_id];
            }
        });

        // 4. Group logs by tape_id, then deduplicate:
        //    - Same event is identified by: event_type + timecode_start (a modified record shares these)
        //    - Keep the EARLIEST event_time (first time it was recorded)
        //    - Keep the LATEST remarks/content (most recent version after edits)
        const logsByTape: Record<number, any[]> = {};
        (logs || []).forEach((log: any) => {
            if (!logsByTape[log.tape_id]) logsByTape[log.tape_id] = [];
            logsByTape[log.tape_id].push(log);
        });

        // Deduplicate each tape's logs
        for (const tapeId of Object.keys(logsByTape)) {
            const tapeLogs = logsByTape[Number(tapeId)];

            // Sort ascending by event_time so earliest comes first
            tapeLogs.sort((a: any, b: any) =>
                new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
            );

            // Build a map keyed by "event_type|timecode_start" to deduplicate
            const deduped = new Map<string, any>();
            for (const log of tapeLogs) {
                const key = `${log.event_type}|${log.timecode_start ?? ""}`;
                if (!deduped.has(key)) {
                    // First occurrence — use this as the base (earliest event_time)
                    deduped.set(key, { ...log });
                } else {
                    // Later occurrence — update only the content fields (latest remarks/content)
                    const existing = deduped.get(key);
                    existing.remarks = log.remarks || existing.remarks;
                    if (log.insp_records) existing.insp_records = log.insp_records;
                    if (log.inspection_id) existing.inspection_id = log.inspection_id;
                    // Keep existing (earliest) event_time intact
                }
            }

            // Replace with deduplicated list, sorted by event_time ascending
            logsByTape[Number(tapeId)] = Array.from(deduped.values()).sort(
                (a: any, b: any) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
            );
        }

        // 5. Assemble result grouped by tape
        const result = tapes.map((tape: any) => ({
            ...tape,
            dive_no: diveNoMap[tape.dive_job_id] || diveNoMap[tape.rov_job_id] || null,
            logs: logsByTape[tape.tape_id] || []
        })).filter((t: any) => t.logs.length > 0); // Only include tapes with logs

        console.log(`[VideoLog] Found ${result.length} tapes with logs`);
        return NextResponse.json({ data: result });

    } catch (error: any) {
        console.error("Error fetching video log data:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
