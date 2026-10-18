import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { sow_id, structure_id } = body;

        if (!sow_id || !structure_id) {
            return NextResponse.json({ error: "sow_id and structure_id are required" }, { status: 400 });
        }

        const structId = parseInt(structure_id);

        // 1. Fetch SOW parent details to get jobpack_id and report_numbers
        const { data: sowData, error: sowParentError } = await (supabase as any)
            .from("u_sow")
            .select("id, jobpack_id, structure_id, structure_title, report_numbers")
            .eq("id", sow_id)
            .single();

        if (sowParentError) throw sowParentError;

        const currentJobpackId = sowData?.jobpack_id;
        const primaryReportNo = sowData?.report_numbers?.[0]?.number || null;

        // Helper to match report numbers (e.g. '2026-01' vs '2026-01A')
        const isReportMatch = (r1: string | null, r2: string | null) => {
            if (!r1 && !r2) return true;
            if (!r1 || !r2) return true; // Flexible: allow match within same jobpack/structure scope
            if (r1 === r2) return true;
            const c1 = r1.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            const c2 = r2.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            return c1 === c2 || c1.startsWith(c2) || c2.startsWith(c1);
        };

        // 1b. Fetch all SOW items for this sow_id using pagination to bypass 1000 limit
        const sowItems: any[] = [];
        let fromSow = 0;
        const PAGE_SIZE = 1000;
        while (true) {
            const { data: pageSowItems, error: sowError } = await (supabase as any)
                .from("u_sow_items")
                .select("*")
                .eq("sow_id", sow_id)
                .range(fromSow, fromSow + PAGE_SIZE - 1);

            if (sowError) throw sowError;
            if (pageSowItems && pageSowItems.length > 0) {
                sowItems.push(...pageSowItems);
                if (pageSowItems.length < PAGE_SIZE) break;
                fromSow += PAGE_SIZE;
            } else {
                break;
            }
        }

        // 2. Fetch all master inspection types for code/ID mapping
        const { data: allTypes } = await supabase
            .from("inspection_type")
            .select("id, code, name");

        // 3. Fetch all structure components for QID resolution
        const { data: allComps } = await (supabase as any)
            .from("structure_components")
            .select("id, q_id, code")
            .eq("structure_id", structId)
            .eq("is_deleted", false);

        const compIdToQid = new Map<number, string>();
        const qidToCompMap = new Map<string, any>();
        (allComps || []).forEach((c: any) => {
            if (c.id && c.q_id) {
                const q = String(c.q_id).trim().toUpperCase();
                compIdToQid.set(c.id, q);
                qidToCompMap.set(q, c);
            }
        });

        // 4. Fetch inspection records for this structure and jobpack using pagination
        const records: any[] = [];
        let fromRec = 0;
        while (true) {
            let recordsQuery = (supabase as any)
                .from("insp_records")
                .select("insp_id, component_id, inspection_type_id, inspection_type_code, status, elevation, sow_report_no, has_anomaly, jobpack_id, inspection_data, inspection_date")
                .eq("structure_id", structId)
                .order("insp_id", { ascending: false });

            if (currentJobpackId) {
                recordsQuery = recordsQuery.eq("jobpack_id", currentJobpackId);
            }

            const { data: pageRecs, error: recError } = await recordsQuery.range(fromRec, fromRec + PAGE_SIZE - 1);
            if (recError) throw recError;

            if (pageRecs && pageRecs.length > 0) {
                records.push(...pageRecs);
                if (pageRecs.length < PAGE_SIZE) break;
                fromRec += PAGE_SIZE;
            } else {
                break;
            }
        }

        // 5. Fetch anomalies for this structure matching current jobpack/report
        const { data: anomalies } = await (supabase as any)
            .from("v_anomaly_details")
            .select("anomaly_id, component_id, component_qid, priority, status, defect_type, category, description, display_ref_no, jobpack_name, structure_id, sow_report_no")
            .eq("structure_id", structId);

        const updates: any[] = [];
        const matchedItemKeys = new Set<string>();

        // 6. Process each existing SOW item to align status & report_number with inspection records & anomalies
        for (const item of sowItems) {
            const itemType = (allTypes || []).find((t: any) => t.id === item.inspection_type_id);
            const typeCode = (itemType?.code || item.inspection_code || "").toUpperCase();
            const itemQidUpper = (item.component_qid || (item.component_id ? compIdToQid.get(item.component_id) : "") || "").trim().toUpperCase();

            const itemRecords = records.filter((r: any) => {
                // Component matching: by ID or resolved QID
                let matchesComp = Boolean(item.component_id && r.component_id && r.component_id === item.component_id);
                if (!matchesComp && itemQidUpper) {
                    const rQid = (r.component_id ? compIdToQid.get(r.component_id) : "") || 
                                 (r.inspection_data?.q_id ? String(r.inspection_data.q_id).trim().toUpperCase() : "") ||
                                 (r.inspection_data?.comp_id ? compIdToQid.get(Number(r.inspection_data.comp_id)) : "");
                    if (rQid && rQid === itemQidUpper) matchesComp = true;
                }
                if (!matchesComp) return false;

                // Inspection type matching
                const rTypeCode = (r.inspection_type_code || "").toUpperCase();
                const matchesType = 
                    r.inspection_type_id === item.inspection_type_id ||
                    (rTypeCode && typeCode && (
                        rTypeCode === typeCode ||
                        typeCode.includes(rTypeCode) ||
                        rTypeCode.includes(typeCode)
                    ));
                if (!matchesType) return false;

                const matchesRpt = isReportMatch(item.report_number, r.sow_report_no);
                return matchesRpt;
            });

            // Mark key as covered in SOW
            if (item.component_id && typeCode) {
                matchedItemKeys.add(`${item.component_id}_${typeCode}`);
            }
            if (itemQidUpper && typeCode) {
                matchedItemKeys.add(`${itemQidUpper}_${typeCode}`);
            }

            const itemAnomalies = (anomalies || []).filter((a: any) => {
                const aQidUpper = (a.component_qid || (a.component_id ? compIdToQid.get(a.component_id) : "") || "").trim().toUpperCase();
                const matchesComp = Boolean(item.component_id && a.component_id && a.component_id === item.component_id) ||
                                    Boolean(itemQidUpper && aQidUpper && itemQidUpper === aQidUpper);
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

            // Sync latest inspection date and inspection count
            const latestDate = itemRecords[0]?.inspection_date || item.last_inspection_date;
            const inspCount = itemRecords.length;
            if (item.inspection_count !== inspCount || item.last_inspection_date !== latestDate) {
                statusChanged = true;
            }

            if (statusChanged) {
                updates.push({
                    id: item.id,
                    status: newStatus,
                    elevation_data: newElevationData,
                    report_number: newReportNumber,
                    last_inspection_date: latestDate,
                    inspection_count: inspCount,
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
                        last_inspection_date: up.last_inspection_date,
                        inspection_count: up.inspection_count,
                        updated_at: up.updated_at 
                    })
                    .eq("id", up.id);
            }
        }

        // 7. Auto-insert missing components from captured inspection records
        const inserts: any[] = [];
        const seenInsertKeys = new Set<string>();

        for (const r of records) {
            const compId = r.component_id;
            const typeCode = (r.inspection_type_code || "").toUpperCase();
            if (!compId || !typeCode) continue;

            const key1 = `${compId}_${typeCode}`;
            const compQid = compIdToQid.get(compId) || "";
            const key2 = compQid ? `${compQid}_${typeCode}` : "";

            if (!matchedItemKeys.has(key1) && (!key2 || !matchedItemKeys.has(key2)) && !seenInsertKeys.has(key1)) {
                seenInsertKeys.add(key1);

                const compObj = (allComps || []).find((c: any) => c.id === compId);
                const itemType = (allTypes || []).find((t: any) => 
                    (t.code && t.code.toUpperCase() === typeCode) || t.id === r.inspection_type_id
                );

                const recStatus = String(r.status || "").toUpperCase();
                const newStatus = (r.has_anomaly || recStatus === 'ANOMALY') ? 'anomaly' : (recStatus === 'INCOMPLETE' ? 'incomplete' : 'completed');

                inserts.push({
                    company_id: companyId || null,
                    sow_id: sow_id,
                    component_id: compId,
                    component_qid: compObj?.q_id || compQid || `COMP-${compId}`,
                    component_type: compObj?.code || null,
                    inspection_type_id: itemType?.id || r.inspection_type_id || null,
                    inspection_code: itemType?.code || typeCode,
                    inspection_name: itemType?.name || typeCode,
                    status: newStatus,
                    report_number: r.sow_report_no || primaryReportNo || "AM26-016-02",
                    elevation_required: false,
                    last_inspection_date: r.inspection_date || null,
                    inspection_count: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
            }
        }

        if (inserts.length > 0) {
            await (supabase as any)
                .from("u_sow_items")
                .insert(inserts);
        }

        // 8. Recalculate parent SOW totals
        const allRefreshedItems: any[] = [];
        let fromRef = 0;
        while (true) {
            const { data: pageRefreshed } = await (supabase as any)
                .from("u_sow_items")
                .select("status")
                .eq("sow_id", sow_id)
                .range(fromRef, fromRef + PAGE_SIZE - 1);

            if (pageRefreshed && pageRefreshed.length > 0) {
                allRefreshedItems.push(...pageRefreshed);
                if (pageRefreshed.length < PAGE_SIZE) break;
                fromRef += PAGE_SIZE;
            } else {
                break;
            }
        }

        const totalItems = allRefreshedItems.length;
        const completedItems = allRefreshedItems.filter((i: any) => i.status === 'completed' || i.status === 'anomaly').length;
        const incompleteItems = allRefreshedItems.filter((i: any) => i.status === 'incomplete').length;
        const pendingItems = allRefreshedItems.filter((i: any) => i.status === 'pending').length;

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
            inserted_count: inserts.length
        });

    } catch (error: any) {
        console.error("[SOW Correction API] Error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
});
