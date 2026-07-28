import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

/**
 * POST /api/sow/rename-report
 *
 * Cascade-renames a SOW report number across ALL related tables:
 *   - insp_records        (sow_report_no)
 *   - insp_dive_jobs      (sow_report_no)
 *   - insp_rov_jobs       (sow_report_no)
 *   - u_sow_items         (report_number)
 *   - u_sow               (report_numbers JSON array)
 *
 * Body:
 *   { jobpack_id, structure_id, sow_id?, old_report_no, new_report_no }
 */
export const POST = withTenant(async (request, { companyId }) => {
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

        const counts: Record<string, number> = {};

        // ── 1. Update insp_records ──
        const { data: updatedRecords, error: recErr } = await (supabase as any)
            .from("insp_records")
            .update({ sow_report_no: new_report_no })
            .eq("company_id", companyId)
            .eq("jobpack_id", jobpackIdNum)
            .eq("structure_id", structureIdNum)
            .eq("sow_report_no", old_report_no)
            .select("insp_id");

        if (recErr) {
            console.error("[rename-report] insp_records error:", recErr);
            return NextResponse.json({ error: `insp_records update failed: ${recErr.message}` }, { status: 400 });
        }
        counts.insp_records = updatedRecords?.length || 0;

        // ── 2. Update insp_dive_jobs ──
        const { data: updatedDive, error: diveErr } = await (supabase as any)
            .from("insp_dive_jobs")
            .update({ sow_report_no: new_report_no })
            .eq("company_id", companyId)
            .eq("jobpack_id", jobpackIdNum)
            .eq("structure_id", structureIdNum)
            .eq("sow_report_no", old_report_no)
            .select("dive_job_id");

        if (diveErr) {
            console.error("[rename-report] insp_dive_jobs error:", diveErr);
            return NextResponse.json({ error: `insp_dive_jobs update failed: ${diveErr.message}` }, { status: 400 });
        }
        counts.insp_dive_jobs = updatedDive?.length || 0;

        // ── 3. Update insp_rov_jobs ──
        const { data: updatedRov, error: rovErr } = await (supabase as any)
            .from("insp_rov_jobs")
            .update({ sow_report_no: new_report_no })
            .eq("company_id", companyId)
            .eq("jobpack_id", jobpackIdNum)
            .eq("structure_id", structureIdNum)
            .eq("sow_report_no", old_report_no)
            .select("rov_job_id");

        if (rovErr) {
            console.error("[rename-report] insp_rov_jobs error:", rovErr);
            return NextResponse.json({ error: `insp_rov_jobs update failed: ${rovErr.message}` }, { status: 400 });
        }
        counts.insp_rov_jobs = updatedRov?.length || 0;

        // ── 4. Update u_sow_items (report_number column) ──
        if (sowIdNum) {
            const { data: updatedItems, error: itemErr } = await (supabase as any)
                .from("u_sow_items")
                .update({ report_number: new_report_no })
                .eq("company_id", companyId)
                .eq("sow_id", sowIdNum)
                .eq("report_number", old_report_no)
                .select("id");

            if (itemErr) {
                console.error("[rename-report] u_sow_items error:", itemErr);
                return NextResponse.json({ error: `u_sow_items update failed: ${itemErr.message}` }, { status: 400 });
            }
            counts.u_sow_items = updatedItems?.length || 0;

            // ── 5. Update u_sow report_numbers JSON array ──
            const { data: sowData, error: sowFetchErr } = await (supabase as any)
                .from("u_sow")
                .select("id, report_numbers")
                .eq("id", sowIdNum)
                .eq("company_id", companyId)
                .single();

            if (!sowFetchErr && sowData?.report_numbers) {
                const updatedReportNumbers = (sowData.report_numbers as any[]).map((rn: any) => {
                    if (rn.number === old_report_no) {
                        return { ...rn, number: new_report_no };
                    }
                    return rn;
                });

                const { error: sowUpdateErr } = await (supabase as any)
                    .from("u_sow")
                    .update({
                        report_numbers: updatedReportNumbers,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", sowIdNum)
                    .eq("company_id", companyId);

                if (sowUpdateErr) {
                    console.error("[rename-report] u_sow error:", sowUpdateErr);
                    return NextResponse.json({ error: `u_sow update failed: ${sowUpdateErr.message}` }, { status: 400 });
                }
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
});
