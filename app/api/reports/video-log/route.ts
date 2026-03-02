
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        let jobpackId = searchParams.get("jobpack_id");
        let structureId = searchParams.get("structure_id");
        let sowReportNo = searchParams.get("sow_report_no");

        if (jobpackId === "undefined" || jobpackId === "null") jobpackId = null;
        if (structureId === "undefined" || structureId === "null") structureId = null;
        if (sowReportNo === "undefined" || sowReportNo === "null") sowReportNo = null;

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

        const { data: diveJobs, error: jobsError } = await jobsQuery;

        if (jobsError) throw jobsError;

        if (!diveJobs || diveJobs.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const jobIds = diveJobs.map((j: any) => j.dive_job_id);
        const diveNoMap: Record<number, string> = {};
        diveJobs.forEach((j: any) => { diveNoMap[j.dive_job_id] = j.dive_no; });

        // 2. Fetch all tapes for these dive jobs
        const { data: tapes, error: tapesError } = await (supabase as any)
            .from("insp_video_tapes")
            .select("tape_id, tape_no, dive_job_id, status, chapter_no, remarks")
            .in("dive_job_id", jobIds)
            .order("tape_no", { ascending: true });

        if (tapesError) throw tapesError;

        if (!tapes || tapes.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const tapeIds = tapes.map((t: any) => t.tape_id);

        // 3. Fetch all video logs for these tapes, ordered by event_time ascending (chronological)
        const { data: logs, error: logsError } = await (supabase as any)
            .from("insp_video_logs")
            .select("video_log_id, tape_id, event_type, event_time, timecode_start, tape_counter_start, remarks")
            .in("tape_id", tapeIds)
            .order("event_time", { ascending: true });

        if (logsError) throw logsError;

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
                    existing.remarks = log.remarks;
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
            dive_no: diveNoMap[tape.dive_job_id] || null,
            logs: logsByTape[tape.tape_id] || []
        })).filter((t: any) => t.logs.length > 0); // Only include tapes with logs

        console.log(`[VideoLog] Found ${result.length} tapes with logs`);
        return NextResponse.json({ data: result });

    } catch (error: any) {
        console.error("Error fetching video log data:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
