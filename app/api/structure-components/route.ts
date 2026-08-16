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
        let allData: any[] = [];
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

        // Map data: match inspection records & anomalies by component_id OR component QID
        const mappedData = (data || []).map((item: any) => {
            const metadata = item.metadata || {};
            const qidUpper = item.q_id ? item.q_id.toUpperCase() : "";

            const compInsps = (inspRecords || []).filter((r: any) => {
                if (r.component_id && r.component_id === item.id) return true;
                if (qidUpper) {
                    if (r.component_qid && String(r.component_qid).toUpperCase() === qidUpper) return true;
                    if (r.inspection_data?.component && String(r.inspection_data.component).toUpperCase() === qidUpper) return true;
                    if (r.inspection_data?.component_qid && String(r.inspection_data.component_qid).toUpperCase() === qidUpper) return true;
                    if (r.inspection_data?.qid && String(r.inspection_data.qid).toUpperCase() === qidUpper) return true;
                }
                return false;
            });

            const compAnoms = (componentAnomalies || []).filter((a: any) => {
                if (a.component_id && a.component_id === item.id) return true;
                if (qidUpper) {
                    if (a.component_qid && String(a.component_qid).toUpperCase() === qidUpper) return true;
                    if (a.component_name && String(a.component_name).toUpperCase() === qidUpper) return true;
                    if (a.q_id && String(a.q_id).toUpperCase() === qidUpper) return true;
                    if (a.description && String(a.description).toUpperCase().includes(qidUpper)) return true;
                }
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
