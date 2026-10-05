import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        
        const jobpackIdRaw = searchParams.get("jobpack_id");
        const structureIdRaw = searchParams.get("structure_id");
        const sow_report_no = searchParams.get("sow_report_no");

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
                inspection_type:inspection_type_id!left(id, code, name),
                structure_components:component_id!left(id, q_id, code)
            `)
            .eq("jobpack_id", jobpack_id)
            .eq("structure_id", structure_id);

        if (companyId) {
            query = query.or(`company_id.eq.${companyId},company_id.is.null`);
        }

        const { data, error } = await query.order("inspection_date", { ascending: false });

        if (error) throw error;

        let filteredData = data || [];
        if (sow_report_no && sow_report_no !== "all" && sow_report_no !== "N/A" && sow_report_no.trim() !== "") {
            const matches = filteredData.filter((r: any) => {
                const recRep = String(r.sow_report_no || r.inspection_data?.sow_report_no || r.inspection_data?.sowReportNo || "").replace(/\s+/g, "").toLowerCase();
                const filterRep = String(sow_report_no).replace(/\s+/g, "").toLowerCase();
                return recRep === filterRep;
            });
            if (matches.length > 0) {
                filteredData = matches;
            }
        }

        return NextResponse.json({ data: filteredData });
    } catch (error: any) {
        console.error("[InspectionRecords API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
