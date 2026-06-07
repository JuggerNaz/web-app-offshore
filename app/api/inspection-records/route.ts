import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        
        const jobpack_id = searchParams.get("jobpack_id");
        const structure_id = searchParams.get("structure_id");
        const sow_report_no = searchParams.get("sow_report_no");

        if (!jobpack_id || !structure_id) {
            return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
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
                inspection_type:inspection_type_id!left(id, code, name),
                structure_components:component_id!left(id, q_id, code)
            `)
            .eq("jobpack_id", Number(jobpack_id))
            .eq("structure_id", Number(structure_id));

        if (sow_report_no && sow_report_no !== "all") {
            query = query.eq("sow_report_no", sow_report_no);
        }

        const { data, error } = await query.order("inspection_date", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error("[InspectionRecords API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
