
import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = useAdmin ? createAdminClient() : createClient();
        const { searchParams } = new URL(request.url);

        let rawJobpack = searchParams.get("jobpack_id");
        let rawStructure = searchParams.get("structure_id");
        let rawSow = searchParams.get("sow_report_no");

        let jobpackId: number | null = null;
        if (rawJobpack && rawJobpack !== "undefined" && rawJobpack !== "null" && rawJobpack !== "") {
            const parsed = parseInt(String(rawJobpack).trim(), 10);
            if (!isNaN(parsed)) jobpackId = parsed;
        }

        let structureId: number | null = null;
        if (rawStructure && rawStructure !== "undefined" && rawStructure !== "null" && rawStructure !== "all" && rawStructure !== "") {
            const cleaned = String(rawStructure).replace(/^(platform|pipeline)-/, "").trim();
            const parsed = parseInt(cleaned, 10);
            if (!isNaN(parsed)) structureId = parsed;
        }

        let sowReportNo: string | null = null;
        if (rawSow && rawSow !== "undefined" && rawSow !== "null" && rawSow !== "all" && rawSow !== "N/A" && rawSow !== "") {
            sowReportNo = String(rawSow).trim();
        }

        if (!jobpackId) {
            return NextResponse.json({ error: "JobPack ID is required" }, { status: 400 });
        }

        console.log(`[DiverLog] Req: JobPack=${jobpackId}, Structure=${structureId}, SOW=${sowReportNo}`);

        // 1. Fetch dive jobs
        // Actual columns written by DiveJobSetupDialog:
        //   dive_job_id, dive_no, diver_name, standby_diver, dive_supervisor,
        //   report_coordinator, dive_type, dive_date (DATE), start_time (TIME),
        //   structure_id, jobpack_id, sow_report_no, status, cr_date
        //
        // IMPORTANT: We intentionally do NOT filter by sow_report_no here because:
        // - dive jobs may not have sow_report_no set consistently
        // - the live dive page itself skips this filter (see page.tsx line 406)
        // - We filter by jobpack_id + structure_id which is sufficient
        let jobsQuery = (supabase as any)
            .from("insp_dive_jobs")
            .select(`
                dive_job_id,
                dive_no,
                jobpack_id,
                structure_id,
                sow_report_no,
                diver_name,
                standby_diver,
                dive_supervisor,
                report_coordinator,
                dive_type,
                dive_date,
                start_time,
                status
            `)
            .eq("jobpack_id", jobpackId)
            .order("cr_date", { ascending: true });

        if (structureId) jobsQuery = jobsQuery.eq("structure_id", structureId);
        // NOTE: sow_report_no filter is intentionally skipped to match live page behaviour

        const { data: diveJobs, error: jobsError } = await jobsQuery;

        if (jobsError) {
            console.error("[DiverLog] Jobs Error:", jobsError);
            throw jobsError;
        }

        console.log(`[DiverLog] Jobs query returned: ${diveJobs?.length ?? 0} row(s)`);

        if (!diveJobs || diveJobs.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const jobIds = diveJobs.map((j: any) => j.dive_job_id);

        // 2. Fetch movement logs
        // Actual columns (from DiveLiveDataDialog.tsx and dive/page.tsx):
        //   movement_id (PK), dive_job_id, movement_type, movement_time, depth_meters, remarks
        const { data: movements, error: movError } = await (supabase as any)
            .from("insp_dive_movements")
            .select("movement_id, dive_job_id, movement_type, movement_time, depth_meters, remarks")
            .in("dive_job_id", jobIds)
            .order("movement_time", { ascending: true });

        if (movError) {
            console.error("[DiverLog] Movements Error:", movError);
            // Don't throw — still return jobs with empty movements
        }

        console.log(`[DiverLog] Movements query returned: ${movements?.length ?? 0} row(s)`);

        // 3. Group movements by dive_job_id
        const movementMap: Record<number, any[]> = {};
        (movements || []).forEach((mov: any) => {
            const jid = mov.dive_job_id;
            if (!movementMap[jid]) movementMap[jid] = [];
            movementMap[jid].push(mov);
        });

        // 4. Return all dive jobs (with their movements)
        const result = diveJobs.map((job: any) => ({
            ...job,
            movements: movementMap[job.dive_job_id] || []
        }));

        console.log(`[DiverLog] Returning ${result.length} dive job(s), total movements: ${movements?.length ?? 0}`);
        return NextResponse.json({ data: result });

    } catch (error: any) {
        console.error("[DiverLog] Fatal error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
