import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { sow_id, structure_id } = body;

        if (!sow_id || !structure_id) {
            return NextResponse.json({ error: "sow_id and structure_id are required" }, { status: 400 });
        }

        const structId = parseInt(structure_id);

        // Helper to match report numbers (e.g. '2026-01' vs '2026-01A')
        const isReportMatch = (r1: string | null, r2: string | null) => {
            if (!r1 || !r2) return true;
            if (r1 === r2) return true;
            const c1 = r1.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const c2 = r2.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return c1 === c2 || c1.startsWith(c2) || c2.startsWith(c1);
        };

        // 1. Fetch all SOW items for this sow_id
        const { data: sowItems, error: sowError } = await (supabase as any)
            .from("u_sow_items")
            .select("*")
            .eq("sow_id", sow_id);

        if (sowError) throw sowError;

        // 2. Fetch all master inspection types for code/ID mapping
        const { data: allTypes } = await supabase
            .from("inspection_type")
            .select("id, code, name");

        // 3. Fetch all structure components for QID resolution
        const { data: allComps } = await supabase
            .from("structure_components")
            .select("id, q_id, code")
            .eq("structure_id", structId)
            .eq("is_deleted", false);

        // 4. Fetch ALL inspection records for this structure
        const { data: records, error: recError } = await (supabase as any)
            .from("insp_records")
            .select("insp_id, component_id, inspection_type_id, inspection_type_code, status, elevation, sow_report_no, has_anomaly, jobpack_id, inspection_data")
            .eq("structure_id", structId);

        if (recError) throw recError;

        // 5. Fetch ALL anomalies for this structure
        const { data: anomalies } = await (supabase as any)
            .from("v_anomaly_details")
            .select("anomaly_id, component_id, component_qid, priority, status, defect_type, category, description, display_ref_no, jobpack_name, structure_id, sow_report_no")
            .eq("structure_id", structId);

        const updates = [];

        // 6. Process each existing SOW item to align status & report_number with inspection records & anomalies
        for (const item of sowItems) {
            const itemType = (allTypes || []).find((t: any) => t.id === item.inspection_type_id);
            const typeCode = itemType?.code || item.inspection_code;
            const qidUpper = item.component_qid ? item.component_qid.toUpperCase() : "";

            const itemRecords = (records || []).filter((r: any) => {
                const matchesComp = (r.component_id && r.component_id === item.component_id) ||
                    (qidUpper && (
                        (r.component_qid && String(r.component_qid).toUpperCase() === qidUpper) ||
                        (r.inspection_data?.component && String(r.inspection_data.component).toUpperCase() === qidUpper) ||
                        (r.inspection_data?.component_qid && String(r.inspection_data.component_qid).toUpperCase() === qidUpper) ||
                        (r.inspection_data?.qid && String(r.inspection_data.qid).toUpperCase() === qidUpper)
                    ));
                
                const matchesType = 
                    r.inspection_type_id === item.inspection_type_id ||
                    (r.inspection_type_code && typeCode && (
                        r.inspection_type_code.toUpperCase() === typeCode.toUpperCase() ||
                        typeCode.toUpperCase().includes(r.inspection_type_code.toUpperCase()) ||
                        r.inspection_type_code.toUpperCase().includes(typeCode.toUpperCase())
                    ));

                return matchesComp && matchesType;
            });

            const itemAnomalies = (anomalies || []).filter((a: any) => {
                const matchesComp = (a.component_id && a.component_id === item.component_id) ||
                    (qidUpper && (
                        (a.component_qid && String(a.component_qid).toUpperCase() === qidUpper) ||
                        (a.component_name && String(a.component_name).toUpperCase() === qidUpper) ||
                        (a.q_id && String(a.q_id).toUpperCase() === qidUpper)
                    ));

                const matchesRpt = isReportMatch(item.report_number, a.sow_report_no);
                return matchesComp && matchesRpt;
            });

            let newStatus = "pending";
            let newElevationData = item.elevation_data || [];
            let statusChanged = false;

            if (item.elevation_required && Array.isArray(item.elevation_data)) {
                const updatedElevData = item.elevation_data.map((elev: any) => {
                    const start = parseFloat(elev.start);
                    const end = parseFloat(elev.end);
                    const minE = Math.min(start, end);
                    const maxE = Math.max(start, end);

                    const rangeRecords = itemRecords.filter((r: any) => 
                        r.elevation !== null && 
                        r.elevation >= minE && 
                        r.elevation <= maxE
                    );

                    let rangeStatus = "pending";
                    if (rangeRecords.length > 0) {
                        const hasAnom = rangeRecords.some((r: any) => r.has_anomaly || String(r.status).toUpperCase() === 'ANOMALY');
                        const hasIncomplete = rangeRecords.some((r: any) => String(r.status).toUpperCase() === 'INCOMPLETE');
                        rangeStatus = hasAnom ? 'anomaly' : (hasIncomplete ? 'incomplete' : 'completed');
                    } else if (itemAnomalies.length > 0) {
                        rangeStatus = 'anomaly';
                    }

                    if (rangeStatus !== elev.status) statusChanged = true;
                    return { ...elev, status: rangeStatus };
                });

                newElevationData = updatedElevData;

                const hasAnom = updatedElevData.some((e: any) => e.status === 'anomaly');
                const allDone = updatedElevData.every((e: any) => e.status === 'completed' || e.status === 'anomaly');
                const allPending = updatedElevData.every((e: any) => e.status === 'pending');
                
                if (hasAnom) newStatus = 'anomaly';
                else if (allDone) newStatus = 'completed';
                else if (allPending) newStatus = 'pending';
                else newStatus = 'incomplete';
            } else {
                if (itemRecords.length > 0) {
                    const hasAnom = itemRecords.some((r: any) => r.has_anomaly || String(r.status).toUpperCase() === 'ANOMALY') || itemAnomalies.length > 0;
                    const hasIncomplete = itemRecords.some((r: any) => String(r.status).toUpperCase() === 'INCOMPLETE');
                    newStatus = hasAnom ? 'anomaly' : (hasIncomplete ? 'incomplete' : 'completed');
                } else if (itemAnomalies.length > 0) {
                    newStatus = 'anomaly';
                }
            }

            if (newStatus !== item.status) statusChanged = true;

            // Align report_number with actual inspection records or anomalies if null or suffix mismatched (e.g. '2026-01' -> '2026-01A')
            let newReportNumber = item.report_number;
            const actualReportNo = itemAnomalies[0]?.sow_report_no || itemRecords[0]?.sow_report_no;
            if (actualReportNo && actualReportNo !== item.report_number && isReportMatch(item.report_number, actualReportNo)) {
                newReportNumber = actualReportNo;
                statusChanged = true;
            }

            if (statusChanged) {
                updates.push({
                    id: item.id,
                    status: newStatus,
                    elevation_data: newElevationData,
                    report_number: newReportNumber,
                    updated_at: new Date().toISOString()
                });
            }
        }

        // Perform bulk update if there are changes
        if (updates.length > 0) {
            for (const up of updates) {
                await (supabase as any)
                    .from("u_sow_items")
                    .update({ 
                        status: up.status, 
                        elevation_data: up.elevation_data, 
                        report_number: up.report_number,
                        updated_at: up.updated_at 
                    })
                    .eq("id", up.id);
            }
        }

        // 7. Identify missing SOW items (inspection records or anomalies without a SOW item)
        const missingItems = [];
        const existingKeys = new Set((sowItems || []).map((item: any) => `${item.component_id}:${item.inspection_type_id}`));

        const recordGroups: Record<string, any[]> = {};

        const addRecordToGroup = (compId: number, typeId: number, rec: any) => {
            const key = `${compId}:${typeId}`;
            if (!existingKeys.has(key)) {
                if (!recordGroups[key]) recordGroups[key] = [];
                recordGroups[key].push(rec);
            }
        };

        for (const rec of (records || [])) {
            let compId = rec.component_id;
            if (!compId) {
                const recQid = rec.component_qid || rec.inspection_data?.component || rec.inspection_data?.component_qid || rec.inspection_data?.qid;
                if (recQid) {
                    const matchComp = (allComps || []).find((c: any) => String(c.q_id).toUpperCase() === String(recQid).toUpperCase());
                    if (matchComp) compId = matchComp.id;
                }
            }

            let typeId = rec.inspection_type_id;
            if (!typeId && rec.inspection_type_code) {
                const foundType = (allTypes || []).find((t: any) => 
                    t.code.toUpperCase() === rec.inspection_type_code.toUpperCase() ||
                    t.code.toUpperCase().includes(rec.inspection_type_code.toUpperCase()) ||
                    rec.inspection_type_code.toUpperCase().includes(t.code.toUpperCase())
                );
                if (foundType) typeId = foundType.id;
            }

            if (compId && typeId) {
                addRecordToGroup(compId, typeId, rec);
            }
        }

        // Also check anomalies for missing items
        for (const anom of (anomalies || [])) {
            let compId = anom.component_id;
            if (!compId && (anom.component_qid || anom.component_name)) {
                const q = (anom.component_qid || anom.component_name).toUpperCase();
                const matchComp = (allComps || []).find((c: any) => String(c.q_id).toUpperCase() === q);
                if (matchComp) compId = matchComp.id;
            }

            let typeId = null;
            if (anom.category || anom.defect_type) {
                const catStr = (anom.category || anom.defect_type || "").toUpperCase();
                const matchType = (allTypes || []).find((t: any) => 
                    catStr.includes(t.code.toUpperCase()) || t.name.toUpperCase().includes(catStr) || catStr.includes(t.name.toUpperCase())
                );
                if (matchType) typeId = matchType.id;
            }

            if (compId && typeId) {
                addRecordToGroup(compId, typeId, { ...anom, has_anomaly: true, status: 'ANOMALY' });
            }
        }

        if (Object.keys(recordGroups).length > 0) {
            for (const [key, group] of Object.entries(recordGroups)) {
                const [compIdStr, typeIdStr] = key.split(':');
                const compId = parseInt(compIdStr);
                const typeId = parseInt(typeIdStr);
                const comp = (allComps || []).find((c: any) => c.id === compId);
                const type = (allTypes || []).find((t: any) => t.id === typeId);

                if (comp && type) {
                    const hasAnom = (group || []).some((r: any) => r.has_anomaly || String(r.status).toUpperCase() === 'ANOMALY' || String(r.status).toLowerCase() === 'anomaly');
                    const hasIncomplete = (group || []).some((r: any) => String(r.status).toUpperCase() === 'INCOMPLETE');
                    const status = hasAnom ? 'anomaly' : (hasIncomplete ? 'incomplete' : 'completed');
                    const recordReportNo = group[0]?.sow_report_no || '2026-01A';

                    missingItems.push({
                        sow_id,
                        component_id: compId,
                        component_qid: comp.q_id,
                        component_type: comp.code,
                        inspection_type_id: typeId,
                        inspection_code: type.code,
                        inspection_name: type.name,
                        status,
                        report_number: recordReportNo,
                        created_by: 'Correction Tool',
                        updated_at: new Date().toISOString()
                    });
                }
            }

            if (missingItems.length > 0) {
                await (supabase as any).from("u_sow_items").insert(missingItems);
            }
        }

        return NextResponse.json({ 
            success: true, 
            total_checked: sowItems.length, 
            updated_count: updates.length,
            inserted_count: missingItems.length
        });

    } catch (error: any) {
        console.error("[SOW Correction API] Error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
