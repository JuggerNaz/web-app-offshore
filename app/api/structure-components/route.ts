import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET: Fetch components for a structure (including active and archived/deleted components)
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const structureId = searchParams.get("structure_id");
        const structureType = searchParams.get("structure_type");

        if (!structureId) {
            return NextResponse.json(
                { error: "structure_id is required" },
                { status: 400 }
            );
        }

        console.log("Fetching components for structure_id:", structureId);

        // Fetch all components (including archived/deleted ones so historical SOW inspection data is complete)
        // Paginated fetch to work around the default 1000-record limit
        const allData: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            const { data: pageData, error } = await supabase
                .from("structure_components")
                .select("*")
                .eq("structure_id", parseInt(structureId))
                .order("q_id", { ascending: true })
                .range(from, to);

            if (error) {
                console.error("Error fetching components from structure_components:", error);
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            if (!pageData || pageData.length === 0) {
                hasMore = false;
            } else {
                allData.push(...pageData);
                if (pageData.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        }

        const data = allData;

        // Fetch ALL inspection records for this structure
        const { data: inspRecords } = await supabase
            .from("insp_records")
            .select("insp_id, component_id, has_anomaly, status, inspection_date, inspection_type_code, description, sow_report_no, jobpack_id, inspection_data")
            .eq("structure_id", parseInt(structureId));

        // Fetch ALL anomalies for this structure
        const { data: componentAnomalies } = await (supabase as any)
            .from("v_anomaly_details")
            .select("anomaly_id, component_id, component_qid, priority, status, defect_type, category, description, display_ref_no, jobpack_name, structure_id")
            .eq("structure_id", parseInt(structureId));

        // Map data: match inspection records & anomalies strictly by component_id
        const mappedData = (data || []).map((item: any) => {
            const metadata = item.metadata || {};

            const compInsps = (inspRecords || []).filter((r: any) => {
                if (r.component_id) return r.component_id === item.id;
                return false;
            });

            const compAnoms = (componentAnomalies || []).filter((a: any) => {
                if (a.component_id) return a.component_id === item.id;
                return false;
            });

            const hasAnom = compAnoms.length > 0 || compInsps.some((r: any) => r.has_anomaly || String(r.status).toUpperCase() === 'ANOMALY');

            return {
                ...metadata,
                ...item,
                qid: item.q_id,
                type: item.code,
                inspections: compInsps,
                anomalies: compAnoms,
                has_anomaly: hasAnom,
                hasAnomaly: hasAnom,
                is_deleted: Boolean(item.is_deleted || item.is_archived || item.archived),
            };
        });

        console.log(`Fetched ${mappedData.length} components (including archived) from structure_components for structure ${structureId}`);
        return NextResponse.json({ data: mappedData });
    } catch (error: any) {
        console.error("Exception in structure-components API:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
