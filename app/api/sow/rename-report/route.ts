import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();

        const { jobpack_id, structure_id, sow_id, old_report_no, new_report_no } = body;

        if (!jobpack_id || !structure_id || !old_report_no || !new_report_no) {
            return NextResponse.json(
                { error: "jobpack_id, structure_id, old_report_no, and new_report_no are required" },
                { status: 400 }
            );
        }

        const jobpackIdNum = Number(jobpack_id);
        const structureIdNum = Number(structure_id);
        const sowIdNum = sow_id ? Number(sow_id) : null;

        if (old_report_no === new_report_no) {
            return NextResponse.json({ success: true, message: "No change needed", counts: {} });
        }

        // Clean base strings for prefix matching (e.g. '2026-01' matching '2026-01A')
        const cleanOld = old_report_no.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

        const isReportMatch = (r: string | null | undefined) => {
            if (!r || r === 'null') return false;
            if (r === old_report_no) return true;
            const cleanR = r.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return cleanR === cleanOld || cleanR.startsWith(cleanOld) || cleanOld.startsWith(cleanR);
        };

        const counts: Record<string, number> = {};

        // 1. Update u_sow_items (handling unique index conflicts gracefully)
        let sowQueryId = sowIdNum;
        if (!sowQueryId) {
            const { data: sowData } = await (supabase as any)
                .from("u_sow")
                .select("id")
                .eq("jobpack_id", jobpackIdNum)
                .eq("structure_id", structureIdNum)
                .maybeSingle();
            if (sowData?.id) sowQueryId = sowData.id;
        }

        const { data: allSowItems } = sowQueryId
            ? await (supabase as any).from("u_sow_items").select("id, report_number").eq("sow_id", sowQueryId)
            : await (supabase as any).from("u_sow_items").select("id, report_number");

        const targetItems = (allSowItems || []).filter((item: any) => isReportMatch(item.report_number));

        let updatedSowCount = 0;
        let deletedDupCount = 0;

        for (const item of targetItems) {
            const { error } = await (supabase as any)
                .from("u_sow_items")
                .update({ report_number: new_report_no, updated_at: new Date().toISOString() })
                .eq("id", item.id);

            if (error && error.code === '23505') {
                // Unique constraint violation: duplicate item with new_report_no already exists! Clean up duplicate old row
                await (supabase as any).from("u_sow_items").delete().eq("id", item.id);
                deletedDupCount++;
            } else if (!error) {
                updatedSowCount++;
            }
        }

        counts.u_sow_items = updatedSowCount;
        counts.u_sow_items_duplicates_cleaned = deletedDupCount;

        // 2. Update insp_records (sow_report_no column)
        const { data: recsToUpdate } = await (supabase as any)
            .from("insp_records")
            .select("insp_id, sow_report_no")
            .eq("jobpack_id", jobpackIdNum)
            .eq("structure_id", structureIdNum);

        const recIds = (recsToUpdate || []).filter((r: any) => isReportMatch(r.sow_report_no)).map((r: any) => r.insp_id);

        if (recIds.length > 0) {
            const { data: updatedRecords, error: recErr } = await (supabase as any)
                .from("insp_records")
                .update({ sow_report_no: new_report_no })
                .in("insp_id", recIds)
                .select("insp_id");
            if (recErr) console.error("[rename-report] insp_records error:", recErr);
            else counts.insp_records = updatedRecords?.length || 0;
        }

        // 3. Update insp_dive_jobs & insp_rov_jobs
        const { data: diveJobs } = await (supabase as any)
            .from("insp_dive_jobs")
            .select("dive_job_id, sow_report_no")
            .eq("jobpack_id", jobpackIdNum)
            .eq("structure_id", structureIdNum);

        const diveIds = (diveJobs || []).filter((d: any) => isReportMatch(d.sow_report_no)).map((d: any) => d.dive_job_id);
        if (diveIds.length > 0) {
            const { data: updatedDive } = await (supabase as any)
                .from("insp_dive_jobs")
                .update({ sow_report_no: new_report_no })
                .in("dive_job_id", diveIds)
                .select("dive_job_id");
            counts.insp_dive_jobs = updatedDive?.length || 0;
        }

        const { data: rovJobs } = await (supabase as any)
            .from("insp_rov_jobs")
            .select("rov_job_id, sow_report_no")
            .eq("jobpack_id", jobpackIdNum)
            .eq("structure_id", structureIdNum);

        const rovIds = (rovJobs || []).filter((r: any) => isReportMatch(r.sow_report_no)).map((r: any) => r.rov_job_id);
        if (rovIds.length > 0) {
            const { data: updatedRov } = await (supabase as any)
                .from("insp_rov_jobs")
                .update({ sow_report_no: new_report_no })
                .in("rov_job_id", rovIds)
                .select("rov_job_id");
            counts.insp_rov_jobs = updatedRov?.length || 0;
        }

        // 4. Update u_sow report_numbers JSON array
        if (sowQueryId) {
            const { data: sowData } = await (supabase as any)
                .from("u_sow")
                .select("id, report_numbers")
                .eq("id", sowQueryId)
                .single();

            if (sowData?.report_numbers) {
                const updatedReportNumbers = (sowData.report_numbers as any[]).map((rn: any) => {
                    if (rn.number === old_report_no || isReportMatch(rn.number)) {
                        return { ...rn, number: new_report_no };
                    }
                    return rn;
                });

                await (supabase as any)
                    .from("u_sow")
                    .update({
                        report_numbers: updatedReportNumbers,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", sowQueryId);
                counts.u_sow = 1;
            }
        }

        console.log(`[rename-report] Successfully renamed "${old_report_no}" → "${new_report_no}" | counts:`, counts);

        return NextResponse.json({
            success: true,
            message: `Report number renamed from "${old_report_no}" to "${new_report_no}"`,
            counts,
        });
    } catch (error: any) {
        console.error("[rename-report] Unexpected error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
