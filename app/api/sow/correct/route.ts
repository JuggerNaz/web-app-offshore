import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const POST = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { sow_id, structure_id } = body;

        if (!sow_id || !structure_id) {
            return NextResponse.json({ error: "sow_id and structure_id are required" }, { status: 400 });
        }

        const structId = parseInt(structure_id);

        // 1. Fetch SOW parent details to get jobpack_id
        const { data: sowData, error: sowParentError } = await (supabase as any)
            .from("u_sow")
            .select("id, jobpack_id, structure_id, name")
            .eq("id", sow_id)
            .single();

        const currentJobpackId = sowData?.jobpack_id;

        // Helper to match report numbers (e.g. '2026-01' vs '2026-01A')
        const isReportMatch = (r1: string | null, r2: string | null) => {
            if (!r1 && !r2) return true;
            if (!r1 || !r2) return false;
            if (r1 === r2) return true;
            const c1 = r1.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const c2 = r2.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return c1 === c2 || c1.startsWith(c2) || c2.startsWith(c1);
        };

        // 1b. Fetch all SOW items for this sow_id
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

        // 4. Fetch inspection records for this structure and jobpack
        let recordsQuery = (supabase as any)
            .from("insp_records")
            .select("insp_id, component_id, inspection_type_id, inspection_type_code, status, elevation, sow_report_no, has_anomaly, jobpack_id, inspection_data")
            .eq("structure_id", structId);

        if (currentJobpackId) {
            recordsQuery = recordsQuery.eq("jobpack_id", currentJobpackId);
        }

        const { data: records, error: recError } = await recordsQuery;

        if (recError) throw recError;

        // 5. Fetch anomalies for this structure matching current jobpack/report
        const { data: anomalies } = await (supabase as any)
            .from("v_anomaly_details")
            .select("anomaly_id, component_id, component_qid, priority, status, defect_type, category, description, display_ref_no, jobpack_name, structure_id, sow_report_no")
            .eq("structure_id", structId);

        const updates: any[] = [];

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

                const matchesRpt = isReportMatch(item.report_number, r.sow_report_no);
                return matchesComp && matchesType && matchesRpt;
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

            if (item.elevation_required && Array.isArray(item.elevation_data) && item.elevation_data.length > 0) {
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
                const hasComp = updatedElevData.some((e: any) => e.status === 'completed');
                const allDone = updatedElevData.every((e: any) => e.status === 'completed' || e.status === 'anomaly');
                const allPending = updatedElevData.every((e: any) => e.status === 'pending');
                
                if (hasAnom) newStatus = 'anomaly';
                else if (allDone && hasComp) newStatus = 'completed';
                else if (allPending) newStatus = 'pending';
                else newStatus = 'incomplete';
            } else {
                if (itemRecords.length > 0) {
                    const hasAnom = itemRecords.some((r: any) => r.has_anomaly || String(r.status).toUpperCase() === 'ANOMALY') || itemAnomalies.length > 0;
                    const hasIncomplete = itemRecords.some((r: any) => String(r.status).toUpperCase() === 'INCOMPLETE');
                    newStatus = hasAnom ? 'anomaly' : (hasIncomplete ? 'incomplete' : 'completed');
                } else if (itemAnomalies.length > 0) {
                    newStatus = 'anomaly';
                } else {
                    newStatus = 'pending';
                }
            }

            if (newStatus !== item.status) statusChanged = true;

            // Align report_number with actual inspection records or anomalies if null or suffix mismatched
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

        // 7. Recalculate parent SOW totals
        const { data: allRefreshedItems } = await (supabase as any)
            .from("u_sow_items")
            .select("status")
            .eq("sow_id", sow_id);

        const totalItems = allRefreshedItems?.length || 0;
        const completedItems = (allRefreshedItems || []).filter((i: any) => i.status === 'completed').length;
        const incompleteItems = (allRefreshedItems || []).filter((i: any) => i.status === 'incomplete').length;
        const pendingItems = (allRefreshedItems || []).filter((i: any) => i.status === 'pending').length;

        await (supabase as any)
            .from("u_sow")
            .update({
                total_items: totalItems,
                completed_items: completedItems,
                incomplete_items: incompleteItems,
                pending_items: pendingItems,
                updated_at: new Date().toISOString()
            })
            .eq("id", sow_id);

        return NextResponse.json({ 
            success: true, 
            total_checked: sowItems.length, 
            updated_count: updates.length,
            inserted_count: 0
        });

    } catch (error: any) {
        console.error("[SOW Correction API] Error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
});
