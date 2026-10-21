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
                .order("id", { ascending: true })
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

        // Fetch ALL inspection records for this structure with pagination
        const allInspRecords: any[] = [];
        let inspPage = 0;
        while (true) {
            const { data: pageInsps, error: inspError } = await supabase
                .from("insp_records")
                .select("insp_id, component_id, has_anomaly, status, inspection_date, inspection_type_code, description, sow_report_no, jobpack_id")
                .eq("structure_id", parseInt(structureId))
                .range(inspPage * pageSize, (inspPage + 1) * pageSize - 1);

            if (inspError) {
                console.error("Error fetching insp_records:", inspError);
                break;
            }
            if (pageInsps && pageInsps.length > 0) {
                allInspRecords.push(...pageInsps);
                if (pageInsps.length < pageSize) break;
                inspPage++;
            } else {
                break;
            }
        }
        const inspRecords = allInspRecords;

        // Fetch ALL anomalies for this structure with pagination
        const allComponentAnomalies: any[] = [];
        let anomPage = 0;
        while (true) {
            const { data: pageAnoms, error: anomError } = await (supabase as any)
                .from("v_anomaly_details")
                .select("anomaly_id, component_id, component_qid, priority, status, defect_type, category, description, display_ref_no, jobpack_name, structure_id, sow_report_no")
                .eq("structure_id", parseInt(structureId))
                .range(anomPage * pageSize, (anomPage + 1) * pageSize - 1);

            if (anomError) {
                console.error("Error fetching anomalies:", anomError);
                break;
            }
            if (pageAnoms && pageAnoms.length > 0) {
                allComponentAnomalies.push(...pageAnoms);
                if (pageAnoms.length < pageSize) break;
                anomPage++;
            } else {
                break;
            }
        }
        const componentAnomalies = allComponentAnomalies;

        // Group inspections and anomalies into Maps for O(1) matching instead of O(N*M) nested loops
        const inspMap = new Map<number, any[]>();
        for (const r of inspRecords) {
            if (r.component_id) {
                let list = inspMap.get(r.component_id);
                if (!list) {
                    list = [];
                    inspMap.set(r.component_id, list);
                }
                list.push(r);
            }
        }

        const anomMap = new Map<number, any[]>();
        for (const a of componentAnomalies) {
            if (a.component_id) {
                let list = anomMap.get(a.component_id);
                if (!list) {
                    list = [];
                    anomMap.set(a.component_id, list);
                }
                list.push(a);
            }
        }

        // Map data: match inspection records & anomalies in O(1)
        const mappedData = (data || []).map((item: any) => {
            const metadata = item.metadata || {};
            const compInsps = inspMap.get(item.id) || [];
            const compAnoms = anomMap.get(item.id) || [];
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
