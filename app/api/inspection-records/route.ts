import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/utils/tenant-auth";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        
        const jobpackIdRaw = searchParams.get("jobpack_id");
        const structureIdRaw = searchParams.get("structure_id");
        let sow_report_no = searchParams.get("sow_report_no");
        if (sow_report_no) sow_report_no = decodeURIComponent(sow_report_no).trim();

        if (!jobpackIdRaw || !structureIdRaw) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
        }

        const jobpack_id = parseInt(String(jobpackIdRaw).replace(/^(jobpack)-/, ""), 10);
        const structure_id = parseInt(String(structureIdRaw).replace(/^(platform|pipeline)-/, ""), 10);

        if (isNaN(jobpack_id) || isNaN(structure_id)) {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }

        let query = (supabase as any)
            .from("insp_records")
            .select(`
                insp_id,
                status,
                has_anomaly,
                elevation,
                description,
                inspection_date,
                inspection_data,
                sow_report_no,
                structure_id,
                jobpack_id,
                tape_id,
                rov_job_id,
                dive_job_id,
                inspection_type:inspection_type_id!left(id, code, name),
                structure_components:component_id!left(id, q_id, code),
                insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
                insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
                insp_video_tapes:tape_id!left(tape_no),
                insp_anomalies(*)
            `)
            .eq("jobpack_id", jobpack_id)
            .eq("structure_id", structure_id);

        if (companyId) {
            query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }

        const { data, error } = await query
            .order("inspection_date", { ascending: false })
            .order("insp_id", { ascending: false });

        if (error) throw error;

        let filteredData = data || [];
        if (sow_report_no && sow_report_no !== "all" && sow_report_no !== "N/A" && sow_report_no.trim() !== "") {
            const filterRep = String(sow_report_no).replace(/\s+/g, "").toLowerCase();
            const matches = filteredData.filter((r: any) => {
                const recRep = String(r.sow_report_no || r.inspection_data?.sow_report_no || r.inspection_data?.sowReportNo || "").replace(/\s+/g, "").toLowerCase();
                return recRep === filterRep;
            });
            filteredData = matches;
        }

        return NextResponse.json({ data: filteredData });
    } catch (error: any) {
        console.error("[InspectionRecords API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
