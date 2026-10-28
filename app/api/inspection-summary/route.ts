import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";
import { formatInspectionTypeName } from "@/utils/inspection-utils";
import { getMGIProfileForJobpack, calculateInterpolatedMgiThreshold } from "@/utils/mgi-profile-helper";

const ATTACHMENT_GROUPS: Record<string, string[]> = {
    "Riser":        ["RS", "RIS", "RISER"],
    "Conductor":    ["CD", "COND", "CONDUCTOR"],
    "Caisson":      ["CA", "CAIS", "CAISSON"],
    "Riser Guard":  ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD"],
    "Boat Landing": ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD"],
};

const getInspectionFindings = (r: any, anomaly: any): string => {
    const data = r.inspection_data || {};
    const fields = [
        "findings", "finding", "findings_comments", "finding_comments", 
        "comments", "COMMENTS", "comment", "observation", "observations", 
        "defect_description", "description", "defectDescription"
    ];
    for (const field of fields) {
        if (data[field] !== undefined && data[field] !== null && String(data[field]).trim() !== "" && String(data[field]).trim().toUpperCase() !== "N/A") {
            return String(data[field]).trim();
        }
    }
    if (r.description !== undefined && r.description !== null && String(r.description).trim() !== "" && String(r.description).trim().toUpperCase() !== "N/A") {
        return String(r.description).trim();
    }
    if (anomaly?.defect_description && String(anomaly.defect_description).trim() !== "" && String(anomaly.defect_description).trim().toUpperCase() !== "N/A") {
        return String(anomaly.defect_description).trim();
    }
    if (anomaly?.description && String(anomaly.description).trim() !== "" && String(anomaly.description).trim().toUpperCase() !== "N/A") {
        return String(anomaly.description).trim();
    }
    return "N/A";
};

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const sowIdRaw = searchParams.get("sow_id");
        const sowId = sowIdRaw ? String(sowIdRaw).replace(/^(sow|platform|pipeline)-/, "") : null;
        const structureIdRaw = searchParams.get("structure_id");
        const structureId = structureIdRaw ? String(structureIdRaw).replace(/^(platform|pipeline)-/, "") : null;
        const jobpackIdRaw = searchParams.get("jobpack_id");
        const jobpackId = jobpackIdRaw ? String(jobpackIdRaw).replace(/^(jobpack)-/, "") : null;
        const sowReportNo = searchParams.get("sow_report_no");
        const jpNum = parseInt(String(jobpackId), 10);
        const strNum = parseInt(String(structureId), 10);

        let structureInfo: any = null;
        let pipelineSpec: any = null;
        let jobpackInfo: any = null;

        if (!isNaN(strNum) || !isNaN(jpNum)) {
            const [platRes, pipeRes, jpRes] = await Promise.all([
                !isNaN(strNum)
                    ? (supabase as any)
                        .from("platform")
                        .select("plat_id, title, pfield, pdesc, depth, an_qty, an_type")
                        .eq("plat_id", strNum)
                        .maybeSingle()
                    : Promise.resolve({ data: null }),
                !isNaN(strNum)
                    ? (supabase as any)
                        .from("u_pipeline")
                        .select("*")
                        .eq("pipe_id", strNum)
                        .maybeSingle()
                    : Promise.resolve({ data: null }),
                !isNaN(jpNum)
                    ? (supabase as any)
                        .from("jobpack")
                        .select("id, name, metadata, status")
                        .eq("id", jpNum)
                        .maybeSingle()
                    : Promise.resolve({ data: null }),
            ]);

            if (platRes?.data) {
                structureInfo = {
                    id: platRes.data.plat_id,
                    name: platRes.data.title,
                    title: platRes.data.title,
                    field: platRes.data.pfield,
                    fieldName: platRes.data.pfield,
                    depth: platRes.data.depth,
                    waterDepth: platRes.data.depth,
                    metadata: {
                        water_depth: platRes.data.depth,
                        anode_count: platRes.data.an_qty,
                        anode_type: platRes.data.an_type,
                    }
                };
            }
            if (pipeRes?.data) pipelineSpec = pipeRes.data;
            if (jpRes?.data) jobpackInfo = jpRes.data;
        }

        const isPipelineStructure =
            !!pipelineSpec ||
            (structureInfo?.type || "").toUpperCase() === "PIPELINE" ||
            (structureInfo?.code || "").toUpperCase().startsWith("PL") ||
            (structureInfo?.name || "").toUpperCase().includes("PIPELINE");

        // Merge pipeline spec fields into structureInfo.metadata
        if (pipelineSpec) {
            structureInfo = {
                ...structureInfo,
                name: structureInfo?.name || pipelineSpec.title || pipelineSpec.name,
                code: structureInfo?.code || pipelineSpec.code || "PL",
                type: "PIPELINE",
                metadata: {
                    ...(structureInfo?.metadata || {}),
                    st_loc: pipelineSpec.st_loc || pipelineSpec.from_location,
                    end_loc: pipelineSpec.end_loc || pipelineSpec.to_location,
                    plength: pipelineSpec.plength || pipelineSpec.total_length || pipelineSpec.length,
                    ...pipelineSpec,
                },
            };
        }

        // ─── 1B. RESOLVE SOW ID ───────────────────────────────────────────────
        let resolvedSowId = sowId;

        console.log(`[Summary API] sowId=${sowId}, jp=${jpNum}, str=${strNum}, isPipeline=${isPipelineStructure}`);

        if (!resolvedSowId && !isNaN(jpNum)) {
            let sowQuery = (supabase as any)
                .from("u_sow")
                .select("id, report_numbers, structure_id")
                .eq("jobpack_id", jpNum);

            if (!isNaN(strNum)) {
                sowQuery = sowQuery.eq("structure_id", strNum);
            }
            if (companyId) {
                sowQuery = sowQuery.or(`company_id.eq.${companyId},company_id.is.null`);
            }
            let { data: sowRecs } = await sowQuery;

            // Fallback: if no row matches both jobpack_id and structure_id, try fetching by jobpack_id alone
            if (!sowRecs || sowRecs.length === 0) {
                let fbQuery = (supabase as any)
                    .from("u_sow")
                    .select("id, report_numbers, structure_id")
                    .eq("jobpack_id", jpNum);
                if (companyId) {
                    fbQuery = fbQuery.or(`company_id.eq.${companyId},company_id.is.null`);
                }
                const { data: fbData } = await fbQuery;
                if (fbData && fbData.length > 0) {
                    sowRecs = fbData;
                }
            }

            if (sowRecs && sowRecs.length > 0) {
                if (sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "all") {
                    const matchByRep = sowRecs.find((s: any) => {
                        if (Array.isArray(s.report_numbers)) {
                            return s.report_numbers.some((rn: any) => {
                                const num = String(rn?.number || rn || "").trim().toLowerCase();
                                return num === String(sowReportNo).trim().toLowerCase();
                            });
                        }
                        return false;
                    });
                    resolvedSowId = String(matchByRep ? matchByRep.id : sowRecs[0].id);
                } else {
                    resolvedSowId = String(sowRecs[0].id);
                }
                console.log(`[Summary API] Resolved SOW ID to ${resolvedSowId}`);
            }
        }

        if (!jobpackInfo && resolvedSowId) {
            try {
                const { data: sRow } = await (supabase as any)
                    .from("u_sow")
                    .select("jobpack_id")
                    .eq("id", Number(resolvedSowId))
                    .maybeSingle();
                if (sRow?.jobpack_id) {
                    const { data: jpRow } = await (supabase as any)
                        .from("jobpack")
                        .select("id, name, metadata, status")
                        .eq("id", sRow.jobpack_id)
                        .maybeSingle();
                    if (jpRow) jobpackInfo = jpRow;
                }
            } catch (_) {}
        }

        // ─── 2. SOW ITEMS ─────────────────────────────────────────────────────
        let allSowItems: any[] = [];
        let itemsErr: any = null;
        if (resolvedSowId) {
            let fromSow = 0;
            const PAGE_SIZE = 1000;
            while (true) {
                let sowItemsQuery = (supabase as any)
                    .from("u_sow_items")
                    .select(`
                        status, 
                        component_id, 
                        component_qid,
                        component_type, 
                        inspection_code,
                        inspection_name,
                        elevation_required,
                        elevation_data,
                        notes,
                        report_number
                    `)
                    .eq("sow_id", Number(resolvedSowId))
                    .range(fromSow, fromSow + PAGE_SIZE - 1);

                if (companyId) {
                    sowItemsQuery = sowItemsQuery.or(`company_id.eq.${companyId},company_id.is.null`);
                }
                const { data: itemsData, error: err } = await sowItemsQuery;
                if (err) {
                    console.error("[Summary API] SOW Items fetch error:", err);
                    itemsErr = err;
                    break;
                }
                if (itemsData && itemsData.length > 0) {
                    allSowItems.push(...itemsData);
                    if (itemsData.length < PAGE_SIZE) break;
                    fromSow += PAGE_SIZE;
                } else {
                    break;
                }
            }
        }

        const isReportSpecific = sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null" && sowReportNo !== "all" && sowReportNo !== "undefined" && String(sowReportNo).trim() !== "";
        let sowItemsToProcess = allSowItems;
        if (isReportSpecific && allSowItems.length > 0) {
            const matchingItems = allSowItems.filter((i: any) => {
                if (!i.report_number) return false;
                const itemRep = String(i.report_number || "").replace(/\s+/g, "").toLowerCase();
                const filterRep = String(sowReportNo).replace(/\s+/g, "").toLowerCase();
                return itemRep === filterRep;
            });
            if (matchingItems.length > 0) {
                sowItemsToProcess = matchingItems;
            }
        }

        // Extract active component IDs strictly by component_id
        // Coerce componentIds strictly to numbers to prevent "operator does not exist: integer = text" SQL errors
        const compIdSet = new Set<number>();
        allSowItems.forEach((i: any) => {
            const val = parseInt(String(i.component_id));
            if (!isNaN(val) && val > 0) compIdSet.add(val);
        });
        const componentIds = Array.from(compIdSet);

        let compList: any[] = [];
        if (!isNaN(strNum) && componentIds.length > 0) {
            const chunkSize = 500;
            for (let i = 0; i < componentIds.length; i += chunkSize) {
                const chunk = componentIds.slice(i, i + chunkSize);
                const { data: chunkComps } = await (supabase as any)
                    .from("structure_components")
                    .select("id, q_id, code, metadata, is_deleted")
                    .eq("structure_id", strNum)
                    .in("id", chunk);
                if (chunkComps && chunkComps.length > 0) {
                    compList.push(...chunkComps);
                }
            }
        }

        console.log(`[Summary API] Fetched ${compList.length} targeted components strictly by component_id`);

        const compMap = new Map();
        if (compList) {
            compList.forEach((c: any) => {
                compMap.set(String(c.id), c);
                compMap.set(Number(c.id), c);
            });
        }



        const selectCols = `
            insp_id,
            status,
            has_anomaly,
            inspection_type_id,
            inspection_type_code,
            description,
            component_type,
            component_id,
            dive_job_id,
            rov_job_id,
            sow_report_no,
            jobpack_id,
            fp_kp,
            elevation,
            inspection_date,
            inspection_time,
            inspection_data
        `;

        const allRecordsData: any[] = [];
        let inspPage = 0;
        const inspPageSize = 1000;
        let hasMoreInsp = true;

        while (hasMoreInsp) {
            let pageQuery = (supabase as any)
                .from("insp_records")
                .select(selectCols)
                .range(inspPage * inspPageSize, (inspPage + 1) * inspPageSize - 1);

            if (!isNaN(strNum)) pageQuery = pageQuery.eq("structure_id", strNum);
            if (!isNaN(jpNum)) pageQuery = pageQuery.eq("jobpack_id", jpNum);

            const { data: pageData, error: pageErr } = await pageQuery;
            if (pageErr) {
                console.error("[Summary] Records fetch error on page", inspPage, pageErr);
                if (inspPage === 0) {
                    return NextResponse.json({ error: pageErr.message }, { status: 500 });
                }
                hasMoreInsp = false;
            } else if (!pageData || pageData.length === 0) {
                hasMoreInsp = false;
            } else {
                allRecordsData.push(...pageData);
                if (pageData.length < inspPageSize) {
                    hasMoreInsp = false;
                } else {
                    inspPage++;
                }
            }
        }

        if (!jobpackInfo && allRecordsData.length > 0) {
            try {
                const recWithJp = allRecordsData.find((r: any) => r.jobpack_id != null);
                if (recWithJp?.jobpack_id) {
                    const { data: jpRow } = await (supabase as any)
                        .from("jobpack")
                        .select("id, name, metadata, status")
                        .eq("id", recWithJp.jobpack_id)
                        .maybeSingle();
                    if (jpRow) jobpackInfo = jpRow;
                }
            } catch (_) {}
        }

        // Fetch anomalies in a fast targeted query scoped strictly to matching inspection records
        const allRecordInspIds = allRecordsData.map((r: any) => r.insp_id).filter(Boolean);
        const allAnomalies: any[] = [];
        if (allRecordInspIds.length > 0) {
            // Fetch in chunks of 500 if large
            const chunkSize = 500;
            for (let i = 0; i < allRecordInspIds.length; i += chunkSize) {
                const chunk = allRecordInspIds.slice(i, i + chunkSize);
                const { data: chunkAnoms } = await (supabase as any)
                    .from("insp_anomalies")
                    .select("anomaly_id, anomaly_ref_no, status, defect_type_code, defect_category_code, priority_code, record_category, defect_description, follow_up_notes, is_rectified, inspection_id")
                    .in("inspection_id", chunk);
                if (chunkAnoms && chunkAnoms.length > 0) {
                    allAnomalies.push(...chunkAnoms);
                }
            }
        }
        const anomMap = new Map<number, any[]>();
        (allAnomalies || []).forEach((a: any) => {
            if (a.inspection_id) {
                if (!anomMap.has(a.inspection_id)) anomMap.set(a.inspection_id, []);
                anomMap.get(a.inspection_id)!.push(a);
            }
        });

        // Ensure any component_id in allRecordsData not yet in compMap is fetched strictly by ID
        const missingRecordCompIds = Array.from(new Set(
            allRecordsData
                .map((r: any) => parseInt(String(r.component_id)))
                .filter((cid: number) => !isNaN(cid) && cid > 0 && !compMap.has(String(cid)))
        ));
        if (!isNaN(strNum) && missingRecordCompIds.length > 0) {
            const chunkSize = 500;
            for (let i = 0; i < missingRecordCompIds.length; i += chunkSize) {
                const chunk = missingRecordCompIds.slice(i, i + chunkSize);
                const { data: chunkComps } = await (supabase as any)
                    .from("structure_components")
                    .select("id, q_id, code, metadata, is_deleted")
                    .eq("structure_id", strNum)
                    .in("id", chunk);
                if (chunkComps && chunkComps.length > 0) {
                    chunkComps.forEach((c: any) => {
                        compMap.set(String(c.id), c);
                        compMap.set(Number(c.id), c);
                    });
                }
            }
        }

        // Fast in-memory link for structure_components, inspection_types, and insp_anomalies
        allRecordsData.forEach((r: any) => {
            r.insp_anomalies = anomMap.get(r.insp_id) || [];
            if (r.insp_anomalies.length > 0) r.has_anomaly = true;
            if (r.component_id && compMap.has(String(r.component_id))) {
                const c = compMap.get(String(r.component_id));
                r.structure_components = { id: c.id, q_id: c.q_id, code: c.code, metadata: c.metadata };
            }
        });

        // For anomaly records and findings, fetch rich inspection_data in one targeted fast query (<50ms)
        const anomInspIds = allRecordsData.filter(r => r.has_anomaly || (r.insp_anomalies && r.insp_anomalies.length > 0)).map(r => r.insp_id);
        if (anomInspIds.length > 0) {
            const { data: anomInspData } = await (supabase as any)
                .from("insp_records")
                .select("insp_id, inspection_data")
                .in("insp_id", anomInspIds);

            const inspDataMap = new Map<number, any>();
            (anomInspData || []).forEach((row: any) => {
                if (row.insp_id) inspDataMap.set(row.insp_id, row.inspection_data);
            });

            allRecordsData.forEach((r: any) => {
                if (inspDataMap.has(r.insp_id)) {
                    r.inspection_data = inspDataMap.get(r.insp_id);
                }
            });
        }

        const sowReportNumbers = new Set(
            allSowItems
                .map((item: any) => (item.report_number || "").trim())
                .filter((r: string) => r !== "")
        );

        const dbRecords = allRecordsData || [];
        const rawRecords = dbRecords;
        
        // Determine if we should filter the overview by the current report
        // isReportSpecific already declared and evaluated above

        // Filter records by report locally if requested
        let records = rawRecords;
        if (isReportSpecific && rawRecords.length > 0) {
            const filteredRecords = rawRecords.filter((r: any) => {
                const recRep = String(r.sow_report_no || r.inspection_data?.sow_report_no || r.inspection_data?.sowReportNo || "").replace(/\s+/g, "").toLowerCase();
                const filterRep = String(sowReportNo).replace(/\s+/g, "").toLowerCase();
                return recRep === filterRep;
            });
            if (filteredRecords.length > 0) {
                records = filteredRecords;
            }
        }

        const isRovSowItem = (item: any) => {
            const code = String(item.inspection_code || "").trim().toUpperCase();
            const name = String(item.inspection_name || "").toUpperCase();
            if (code.startsWith("R") && code !== "RISER" && code !== "RB") return true;
            if (name.includes("ROV")) return true;
            return false;
        };

        const isDivingSowItem = (item: any) => {
            const code = String(item.inspection_code || "").trim().toUpperCase();
            const name = String(item.inspection_name || "").toUpperCase();
            if (code.startsWith("D") && code !== "DEBRIS" && code !== "DK") return true;
            if (["BSINS", "CVINS", "ACFMC", "MPINS", "SZONE", "SANI", "ANMAIN"].includes(code)) return true;
            if (name.includes("DIVING") || name.includes("DIVE")) return true;
            return false;
        };

        // Determine target scope items based on whether user selected a specific report or All
        const targetSowItems = isReportSpecific ? sowItemsToProcess : allSowItems;
        const targetRecords = isReportSpecific ? records : rawRecords;

        // Map actual records to resolve SOW item completion accurately
        const availableRecords: Array<{
            compId: string;
            qid: string;
            inspCode: string;
            status: string;
            hasAnomaly: boolean;
            used: boolean;
        }> = targetRecords.map((r: any) => {
            const comp = r.structure_components || {};
            const qid = (comp.q_id || r.inspection_data?.q_id || "").trim().toUpperCase();
            const compId = r.component_id ? String(r.component_id) : "";
            const inspCode = (r.inspection_type_code || r.inspection_type?.code || "").trim().toUpperCase();
            const status = (r.status || "").toUpperCase();
            const hasAnomaly = !!r.has_anomaly;
            return { compId, qid, inspCode, status, hasAnomaly, used: false };
        });

        // Determine effective status for each SOW item
        const resolvedSowItems = targetSowItems.map((item: any) => {
            const itemQid = String(item.component_qid || "").trim().toUpperCase();
            const itemCompId = item.component_id ? String(item.component_id) : "";
            const itemInspCode = String(item.inspection_code || "").trim().toUpperCase();

            // Find matching available inspection record
            const match = availableRecords.find(rec => {
                if (rec.used) return false;
                const matchesCode = !itemInspCode || !rec.inspCode || rec.inspCode === itemInspCode;
                if (!matchesCode) return false;

                const matchesQid = itemQid && rec.qid && (itemQid === rec.qid);
                const matchesCompId = itemCompId && rec.compId && (itemCompId === rec.compId);
                return matchesQid || matchesCompId;
            });

            let effectiveStatus = String(item.status || "pending").toLowerCase();
            if (match) {
                match.used = true;
                if (match.status === "INCOMPLETE") {
                    effectiveStatus = "incomplete";
                } else {
                    effectiveStatus = "completed";
                }
            }

            return {
                ...item,
                effectiveStatus
            };
        });

        const totalSow = resolvedSowItems.length;
        const completedSow = resolvedSowItems.filter((i: any) => i.effectiveStatus === "completed").length;
        const incompleteSow = resolvedSowItems.filter((i: any) => i.effectiveStatus === "incomplete").length;
        const pendingSow = resolvedSowItems.filter((i: any) => i.effectiveStatus === "pending").length;

        const completedPct = totalSow > 0 ? Math.round((completedSow / totalSow) * 100) : (targetRecords.length > 0 ? 100 : 0);
        const completionPct = completedPct;
        const incompletePct = totalSow > 0 ? Math.round((incompleteSow / totalSow) * 100) : 0;
        const pendingPct = totalSow > 0 ? Math.round((pendingSow / totalSow) * 100) : 0;

        // ROV SOW Breakdown
        const rovSowItems = resolvedSowItems.filter(isRovSowItem);
        const rovSowTotal = rovSowItems.length;
        const rovSowCompleted = rovSowItems.filter((i: any) => i.effectiveStatus === "completed").length;
        const rovSowIncomplete = rovSowItems.filter((i: any) => i.effectiveStatus === "incomplete").length;
        const rovSowPending = rovSowItems.filter((i: any) => i.effectiveStatus === "pending").length;
        const rovSowCompletionPct = rovSowTotal > 0 ? Math.round((rovSowCompleted / rovSowTotal) * 100) : 0;

        // Diving SOW Breakdown
        const diveSowItems = resolvedSowItems.filter(isDivingSowItem);
        const diveSowTotal = diveSowItems.length;
        const diveSowCompleted = diveSowItems.filter((i: any) => i.effectiveStatus === "completed").length;
        const diveSowIncomplete = diveSowItems.filter((i: any) => i.effectiveStatus === "incomplete").length;
        const diveSowPending = diveSowItems.filter((i: any) => i.effectiveStatus === "pending").length;
        const diveSowCompletionPct = diveSowTotal > 0 ? Math.round((diveSowCompleted / diveSowTotal) * 100) : 0;

        const outstandingTasks: any[] = [];
        resolvedSowItems.forEach((item: any) => {
            const statusStr = item.effectiveStatus;
            if (statusStr === "incomplete" || statusStr === "pending") {
                let comp = item.component_id != null ? compMap.get(String(item.component_id)) : null;
                const compMeta = comp?.metadata || {};
                const elv1 = compMeta.elv_1 !== undefined && compMeta.elv_1 !== null ? compMeta.elv_1 : null;
                const elv2 = compMeta.elv_2 !== undefined && compMeta.elv_2 !== null ? compMeta.elv_2 : null;

                // Prefer negative elevation if either is negative (e.g. spans sea level)
                let compElv: any = null;
                if (elv1 !== null && parseFloat(String(elv1)) < 0) {
                    compElv = elv1;
                } else if (elv2 !== null && parseFloat(String(elv2)) < 0) {
                    compElv = elv2;
                } else {
                    compElv = elv1 !== null ? elv1 : elv2;
                }
                
                const formatElevation = (val: any) => {
                    if (val === undefined || val === null || String(val).trim() === "" || String(val).trim() === "-") return "-";
                    const num = parseFloat(String(val));
                    if (isNaN(num)) return String(val);
                    if (num < 0) return `(-)${Math.abs(num)}`;
                    return String(val);
                };

                if (item.elevation_required && Array.isArray(item.elevation_data) && item.elevation_data.length > 0) {
                    item.elevation_data.forEach((elev: any) => {
                        const elevStatus = String(elev.status || "").toLowerCase().trim();
                        if (elevStatus === "incomplete" || elevStatus === "pending") {
                            const hasStart = elev.start !== undefined && elev.start !== null && String(elev.start).trim() !== "" && String(elev.start).trim() !== "-";
                            outstandingTasks.push({
                                qid: item.component_qid || "N/A",
                                elevation: formatElevation(hasStart ? elev.start : compElv),
                                comments: elev.comments || elev.notes || item.notes || `Unable to inspect due to access/visibility constraint`,
                                inspectionType: item.inspection_name || item.inspection_code || "General Inspection"
                            });
                        }
                    });
                } else {
                    outstandingTasks.push({
                        qid: item.component_qid || "N/A",
                        elevation: formatElevation(compElv),
                        comments: item.notes || `Unable to inspect due to access/visibility constraint`,
                        inspectionType: item.inspection_name || item.inspection_code || "General Inspection"
                    });
                }
            }
        });

        outstandingTasks.sort((a, b) => {
            const parseElevationForSort = (elvStr: string) => {
                if (!elvStr || elvStr === "-") return null;
                const cleaned = elvStr.replace(/\(-\)/g, "-").replace(/[^\d.-]/g, "");
                const num = parseFloat(cleaned);
                return isNaN(num) ? null : num;
            };

            const valA = parseElevationForSort(a.elevation);
            const valB = parseElevationForSort(b.elevation);

            if (valA === null && valB === null) return 0;
            if (valA === null) return 1;
            if (valB === null) return -1;

            return valB - valA;
        });

        // ─── 3. INSPECTIONS BY MODE ────────────────────────────────────────────
        let minDate: string | null = null;
        let maxDate: string | null = null;
        records.forEach((r: any) => {
            const d = r.inspection_data || {};
            const dateStr = d.date || d.date_time || r.updated_at;
            if (dateStr) {
                const time = Date.parse(dateStr);
                if (!isNaN(time)) {
                    const parsed = new Date(time);
                    if (!minDate || parsed < new Date(minDate)) minDate = parsed.toISOString();
                    if (!maxDate || parsed > new Date(maxDate)) maxDate = parsed.toISOString();
                }
            }
        });

        const isRovRecord = (r: any) => {
            if (r.rov_job_id) return true;
            const code = String(r.inspection_type_code || r.inspection_type?.code || r.inspection_data?.insp_type || r.inspection_data?.INSP_TYPE || "").toUpperCase();
            if (code === "NAVIG" || code === "ROVCLB" || (code.startsWith("R") && code !== "RISER" && code !== "RB")) return true;
            const diveNo = String(r.inspection_data?.dive_no || r.inspection_data?.DIVE_NO || "").toUpperCase();
            if (diveNo.startsWith("R")) return true;
            if (isPipelineStructure) return true;
            return false;
        };
        const isDiveRecord = (r: any) => !isRovRecord(r) && (!!r.dive_job_id || !isPipelineStructure);

        // Analysis sections use rawRecords to show the full history of the structure
        const rovRecords = rawRecords.filter(isRovRecord);
        const diveRecords = rawRecords.filter(isDiveRecord);
        const hasBothModes = rovRecords.length > 0 && diveRecords.length > 0;

        // ─── 4. FMD ANALYSIS ──────────────────────────────────────────────────
        // Field: inspection_data.member_status
        // Values (from inspection-types.json): "Flooded" | "Dry" | "Grouted" | "Inconclusive"
        const fmdRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "RFMD" || code === "FMD";
        });

        const fmdTotal = fmdRecords.length;
        const fmdRov = fmdRecords.filter(isRovRecord).length;
        const fmdDive = fmdRecords.filter(isDiveRecord).length;

        // Use the correct field: member_status
        const fmdConditions: Record<string, number> = {
            dry: 0,
            flooded: 0,
            grouted: 0,
            inconclusive: 0,
            incomplete: 0,
        };

        fmdRecords.forEach((r: any) => {
            const d = r.inspection_data || {};
            // The RFMD type uses field: member_status with options: Flooded, Dry, Grouted, Inconclusive
            const memberStatus = (d.member_status || "").toLowerCase().trim();

            if (memberStatus === "dry") {
                fmdConditions.dry++;
            } else if (memberStatus === "flooded") {
                fmdConditions.flooded++;
            } else if (memberStatus === "grouted") {
                fmdConditions.grouted++;
            } else if (memberStatus === "inconclusive") {
                fmdConditions.inconclusive++;
            } else {
                // No member_status set → treat as incomplete
                fmdConditions.incomplete++;
            }
        });

        // ─── 5. ANODE (GVI / RGVI / SANI) ANALYSIS ─────────────────────────────
        const isAnodeRecord = (r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const compType = (
                r.component_type ||
                r.structure_components?.code ||
                r.structure_components?.metadata?.type ||
                r.inspection_data?.component_type ||
                ""
            ).toUpperCase();
            const qid = (r.structure_components?.q_id || r.inspection_data?.q_id || "").toUpperCase();
            const d = r.inspection_data || {};
            return (
                code === "RSANI" || code === "SANI" ||
                compType === "AN" || compType === "ANODE" || compType.startsWith("AN") ||
                qid.startsWith("BAN") || qid.startsWith("AN") ||
                !!d.anode_type || !!d.anode_depletion || !!d.anode_depletion_percent
            );
        };

        const anodeTargetRecords = (isReportSpecific && records.length > 0 ? records : rawRecords).filter(isAnodeRecord);
        const anodeGviRecords = anodeTargetRecords.length > 0 ? anodeTargetRecords : rawRecords.filter(isAnodeRecord);

        // Depletion bucketing helper
        const parseDepletionBucket = (raw: any): "0-25%" | "26-50%" | "50-75%" | "76-100%" | null => {
            if (raw === undefined || raw === null || raw === "" || raw === "NONE" || raw === "N/A" || raw === "NULL") return null;
            if (typeof raw === "number") {
                if (raw <= 25) return "0-25%";
                if (raw <= 50) return "26-50%";
                if (raw <= 75) return "50-75%";
                return "76-100%";
            }
            const s = String(raw).toLowerCase().replace(/\s+/g, "");
            if (s === "notevaluated" || s === "notrecorded" || s === "incomplete" || s === "cannotreach" || s === "unreachable") return null;
            const matches = s.match(/\d+(\.\d+)?/g);
            if (matches && matches.length >= 2) {
                const low = parseFloat(matches[0]);
                const high = parseFloat(matches[1]);
                const avg = (low + high) / 2;
                if (high <= 25 || avg <= 25) return "0-25%";
                if (high <= 50 || avg <= 50) return "26-50%";
                if (high <= 75 || avg <= 75) return "50-75%";
                return "76-100%";
            } else if (matches && matches.length === 1) {
                const val = parseFloat(matches[0]);
                if (val <= 25) return "0-25%";
                if (val <= 50) return "26-50%";
                if (val <= 75) return "50-75%";
                return "76-100%";
            }
            if (s.includes("0-25") || s.includes("0–25") || s.includes("<25")) return "0-25%";
            if (s.includes("25-50") || s.includes("26-50") || s.includes("25–50")) return "26-50%";
            if (s.includes("50-75") || s.includes("50–75")) return "50-75%";
            if (s.includes("75-100") || s.includes("76-100") || s.includes("75–100") || s.includes(">75")) return "76-100%";
            return null;
        };

        // Helper to uniquely identify each physical anode
        const getAnodeKey = (r: any): string => {
            const qid = (r.structure_components?.q_id || r.inspection_data?.q_id || "").toString().trim().toUpperCase();
            if (qid && qid !== "N/A" && qid !== "NONE" && qid !== "NULL" && qid !== "-") {
                return `qid_${qid}`;
            }
            if (r.component_id !== undefined && r.component_id !== null && r.component_id !== "" && String(r.component_id) !== "0") {
                return `comp_${String(r.component_id).trim()}`;
            }
            const compName = (r.structure_components?.name || r.inspection_data?.component_name || "").toString().trim().toUpperCase();
            if (compName && compName !== "N/A" && compName !== "NONE" && compName !== "NULL" && compName !== "-") {
                return `name_${compName}`;
            }
            return `insp_${r.insp_id || Math.random()}`;
        };

        // Timestamp helper for determining newest inspection
        const getRecordTime = (r: any): number => {
            let t = 0;
            if (r.inspection_date) {
                const dStr = r.inspection_time ? `${r.inspection_date}T${r.inspection_time}` : r.inspection_date;
                const parsed = Date.parse(dStr);
                if (!isNaN(parsed)) t = parsed;
            }
            if (!t && r.created_at) {
                const parsed = Date.parse(r.created_at);
                if (!isNaN(parsed)) t = parsed;
            }
            return t;
        };

        // Helper to check if a record indicates an incomplete inspection or inability to reach the component
        const isRecordIncompleteOrCannotReach = (r: any): boolean => {
            const status = String(r.status || "").toUpperCase();
            if (status.includes("INCOMPL") || status === "CANNOT REACH" || status === "UNREACHABLE") {
                return true;
            }
            const d = r.inspection_data || {};
            const cond = String(d.anode_condition || d.anodeCondition || "").toUpperCase();
            if (cond.includes("INCOMPL") || cond.includes("CANNOT REACH") || cond.includes("CAN'T REACH") || cond.includes("UNREACHABLE") || cond.includes("NOT EVAL")) {
                return true;
            }
            const remarks = String(d.remarks || d.finding || d.findings || r.description || "").toUpperCase();
            if (remarks.includes("CANNOT REACH") || remarks.includes("CAN'T REACH") || remarks.includes("UNABLE TO REACH") || remarks.includes("COULD NOT REACH") || remarks.includes("NOT EVALUATED")) {
                return true;
            }
            return false;
        };

        // Extract raw depletion from a record
        const extractRawDepletion = (r: any) => {
            const d = r.inspection_data || {};
            return d.anode_depletion ?? d.anode_depletion_percent ?? d.depletion ?? r.anode_depletion ?? r.anode_depletion_percent;
        };

        // Group anode records by unique anode key to avoid duplicate counts
        const anodeGroups = new Map<string, any[]>();
        anodeGviRecords.forEach((r: any) => {
            const key = getAnodeKey(r);
            if (!anodeGroups.has(key)) {
                anodeGroups.set(key, []);
            }
            anodeGroups.get(key)!.push(r);
        });

        // Deduplicate anodes: if same anode was inspected more than once, take the latest depletion value
        interface UniqueAnodeItem {
            key: string;
            primaryRecord: any;
            latestRecord: any;
            finalBucket: "0-25%" | "26-50%" | "50-75%" | "76-100%" | "Not Evaluated";
            anodeType: string;
            condition: string;
        }

        const uniqueAnodes: UniqueAnodeItem[] = [];

        anodeGroups.forEach((recs, key) => {
            // Sort chronologically (oldest to newest)
            recs.sort((a, b) => {
                const diff = getRecordTime(a) - getRecordTime(b);
                if (diff !== 0) return diff;
                const idA = Number(a.insp_id || a.id || 0);
                const idB = Number(b.insp_id || b.id || 0);
                return idA - idB;
            });

            const latestRec = recs[recs.length - 1];
            const latestIsIncomplete = isRecordIncompleteOrCannotReach(latestRec);

            // Find the latest valid depletion value (searching newest to oldest)
            let foundBucket: "0-25%" | "26-50%" | "50-75%" | "76-100%" | null = null;
            let primaryRecord = latestRec;

            for (let i = recs.length - 1; i >= 0; i--) {
                const r = recs[i];
                const raw = extractRawDepletion(r);
                const b = parseDepletionBucket(raw);
                if (b) {
                    foundBucket = b;
                    primaryRecord = r;
                    break;
                }
            }

            let finalBucket: "0-25%" | "26-50%" | "50-75%" | "76-100%" | "Not Evaluated" = "Not Evaluated";
            if (latestIsIncomplete && !extractRawDepletion(latestRec)) {
                finalBucket = "Not Evaluated";
                primaryRecord = latestRec;
            } else if (foundBucket) {
                finalBucket = foundBucket;
            } else {
                finalBucket = "Not Evaluated";
            }

            // Extract anode type from newest record that has it
            let anodeType = "";
            for (let i = recs.length - 1; i >= 0; i--) {
                const d = recs[i].inspection_data || {};
                const at = d.anode_type || d.anodeType || d.type;
                if (at && String(at).trim() !== "" && String(at).toUpperCase() !== "N/A" && String(at).toUpperCase() !== "NULL") {
                    anodeType = String(at).trim();
                    break;
                }
            }

            // Extract condition
            let condition = "";
            for (let i = recs.length - 1; i >= 0; i--) {
                const d = recs[i].inspection_data || {};
                const c = d.anode_condition || d.anodeCondition || "";
                if (c && String(c).trim() !== "") {
                    condition = String(c).trim();
                    break;
                }
            }
            if (!condition && finalBucket === "Not Evaluated") {
                condition = "Not Evaluated";
            }

            uniqueAnodes.push({
                key,
                primaryRecord,
                latestRecord: latestRec,
                finalBucket,
                anodeType,
                condition,
            });
        });

        const anodeGviTotal = uniqueAnodes.length;
        const anodeGviRov = uniqueAnodes.filter(u => isRovRecord(u.primaryRecord) || isRovRecord(u.latestRecord)).length;
        const anodeGviDive = uniqueAnodes.filter(u => isDiveRecord(u.primaryRecord) || isDiveRecord(u.latestRecord)).length;

        // Collect distinct anode types from unique anodes & structure components
        const anodeTypesSet = new Set<string>();
        uniqueAnodes.forEach(u => {
            if (u.anodeType) anodeTypesSet.add(u.anodeType);
        });

        if (anodeTypesSet.size === 0 && Array.isArray(compList)) {
            compList.forEach((c: any) => {
                const isAnComp = (c.code || "").toUpperCase() === "AN" || (c.q_id || "").toUpperCase().startsWith("BAN") || (c.q_id || "").toUpperCase().startsWith("AN");
                if (isAnComp) {
                    const m = c.metadata || {};
                    const t = m.anode_type || m.type || m.thetype;
                    if (t && String(t).trim() !== "" && String(t).toUpperCase() !== "N/A" && String(t).toUpperCase() !== "NULL") {
                        anodeTypesSet.add(String(t).trim());
                    }
                }
            });
        }

        const anodeTypesList = Array.from(anodeTypesSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const cleanAnodeTypesList = anodeTypesList.map(t => t.replace(/^ANODE\s+/i, ""));
        const anodeTypeSummaryStr = cleanAnodeTypesList.join(", ");

        const anodeDepletionBuckets: Record<string, number> = {
            "0-25%": 0,
            "26-50%": 0,
            "50-75%": 0,
            "76-100%": 0,
            "0–25%": 0,
            "25–50%": 0,
            "50–75%": 0,
            "75–100%": 0,
            "Not Evaluated": 0,
            "Not Recorded": 0,
        };
        const anodeConditionCounts: Record<string, number> = {};

        uniqueAnodes.forEach(u => {
            if (u.finalBucket === "0-25%") {
                anodeDepletionBuckets["0-25%"]++;
                anodeDepletionBuckets["0–25%"]++;
            } else if (u.finalBucket === "26-50%") {
                anodeDepletionBuckets["26-50%"]++;
                anodeDepletionBuckets["25–50%"]++;
            } else if (u.finalBucket === "50-75%") {
                anodeDepletionBuckets["50-75%"]++;
                anodeDepletionBuckets["50–75%"]++;
            } else if (u.finalBucket === "76-100%") {
                anodeDepletionBuckets["76-100%"]++;
                anodeDepletionBuckets["75–100%"]++;
            } else {
                anodeDepletionBuckets["Not Evaluated"]++;
                anodeDepletionBuckets["Not Recorded"]++;
            }

            if (u.condition) {
                anodeConditionCounts[u.condition] = (anodeConditionCounts[u.condition] || 0) + 1;
            }
        });

        const cleanDepletionBuckets = Object.fromEntries(
            Object.entries(anodeDepletionBuckets).filter(([, v]) => v > 0)
        );

        // ─── 6. SELECTED ANODE INSPECTION (SANI/RSANI) & MAINTENANCE (ANMAIN) ─
        const saniRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "SANI" || code === "RSANI";
        });
        const saniTotal = saniRecords.length;
        const saniRov = saniRecords.filter(isRovRecord).length;
        const saniDive = saniRecords.filter(isDiveRecord).length;

        // Anode Maintenance (ANMAIN) Analysis
        const anmainRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "ANMAIN" || code === "ANODE_MAINT";
        });
        const anmainTotal = anmainRecords.length;
        let anmainReplaced = 0;
        const anmainInstalled = 0;
        let anmainMaintenanceCount = 0;

        anmainRecords.forEach((r: any) => {
            const d = r.inspection_data || {};
            const repVal = d.replaced;
            const repInstalled = d.replaced_installed;
            
            const isReplaced = 
                repVal === true || 
                repVal === "true" ||
                repVal === "1" ||
                repVal === 1 ||
                String(repVal || "").toLowerCase() === "yes font-bold" ||
                String(repVal || "").toLowerCase() === "yes" ||
                String(repVal || "").toLowerCase() === "replaced" ||
                String(repInstalled || "").toLowerCase().includes("replace");

            if (isReplaced) {
                anmainReplaced++;
            } else {
                anmainMaintenanceCount++;
            }
        });

        // ─── 7. CP READINGS ───────────────────────────────────────────────────
        // Scan ALL inspection records for cp readings — every inspection type that
        // embeds cp_rdg (RGVI, RRISI, RSZCI, RCOND, RCASN, RSWNI, RSANI, etc.)
        // or cp_reading_mv (CP dedicated type) is included.
        let cpPrimaryCount = 0;       // records that have a valid primary CP value
        let cpPrimaryRov = 0;
        let cpPrimaryDive = 0;
        let cpAdditionalCount = 0;    // sum of all valid entries in cp_rdg_additional arrays
        let cpAdditionalRov = 0;
        let cpAdditionalDive = 0;
        let cpMinVal: number | null = null;
        let cpMaxVal: number | null = null;
        const cpDetails: Record<string, Record<string, Array<{ val: number; type: "primary" | "additional"; mode: string }>>> = {};

        const trackCp = (val: number) => {
            if (!isNaN(val) && isFinite(val)) {
                if (cpMinVal === null || val < cpMinVal) cpMinVal = val;
                if (cpMaxVal === null || val > cpMaxVal) cpMaxVal = val;
            }
        };

        rawRecords.forEach((r: any) => {
            const d = r.inspection_data || {};
            const isRov  = isRovRecord(r);
            const isDive = isDiveRecord(r);
            const mode = isRov ? "ROV" : "DIVE";
            const comp = r.structure_components || {};
            const qid = comp.q_id || r.inspection_data?.q_id || `ID: ${r.component_id || "Unknown"}`;
            const inspCode = r.inspection_type_code || r.inspection_type?.code || "UNKNOWN";
            const typeName = r.inspection_type?.name || inspCode;

            const readings: Array<{ val: number; type: "primary" | "additional"; mode: string }> = [];

            // --- Primary CP reading ---
            const primaryRaw = d.cp_rdg ?? d.cp_reading_mv ?? "";
            const primary = parseFloat(primaryRaw);
            if (!isNaN(primary) && isFinite(primary)) {
                cpPrimaryCount++;
                if (isRov)  cpPrimaryRov++;
                if (isDive) cpPrimaryDive++;
                trackCp(primary);
                readings.push({ val: primary, type: "primary", mode });
            }

            // --- Additional CP readings ---
            (Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : []).forEach((a: any) => {
                const addVal = parseFloat(a.reading ?? a.cp_rdg ?? "");
                if (!isNaN(addVal) && isFinite(addVal)) {
                    cpAdditionalCount++;
                    if (isRov)  cpAdditionalRov++;
                    if (isDive) cpAdditionalDive++;
                    trackCp(addVal);
                    readings.push({ val: addVal, type: "additional", mode });
                }
            });

            if (readings.length > 0) {
                const formattedName = formatInspectionTypeName(typeName);
                if (!cpDetails[formattedName]) {
                    cpDetails[formattedName] = {};
                }
                if (!cpDetails[formattedName][qid]) {
                    cpDetails[formattedName][qid] = [];
                }
                cpDetails[formattedName][qid].push(...readings);
            }
        });

        // --- 8. MGI ANALYSIS ---
        const mgiRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "RMGI" || code === "MGROW" || code === "MGI" || code === "DMGI";
        });
        
        let mgiMax = 0;
        let mgiMaxComp = "N/A";
        let mgiMin = 999999;
        let mgiMinComp = "N/A";
        let mgiSum = 0;
        let mgiCount = 0;

        const cleanCovVal = (v: any) => {
            if (v === null || v === undefined || v === "") return NaN;
            return parseFloat(String(v).replace('%', '').trim());
        };

        const parseMGI_Coverage = (mg: string) => {
            if (!mg || typeof mg !== 'string') return { h: NaN, s: NaN };
            const lower = mg.toLowerCase();
            const rawVal = mg.split(':').pop()?.replace(/coverage/i, '').trim() || '';
            let val = parseFloat(rawVal.replace('%', ''));
            if (isNaN(val) && rawVal.toLowerCase() === 'all over') val = 100;
            
            const getHighestVal = (vStr: string) => {
                if (vStr.includes('-')) {
                    const parts = vStr.split('-');
                    return parseFloat(parts[parts.length - 1].trim());
                }
                return parseFloat(vStr);
            };

            if (lower.startsWith('hard:')) return { h: getHighestVal(rawVal), s: NaN };
            if (lower.startsWith('soft:')) return { h: NaN, s: getHighestVal(rawVal) };
            if (lower.startsWith('hard and soft:') || lower.startsWith('mgi:')) {
                if (rawVal.includes('-')) {
                    const parts = rawVal.split('-');
                    if (parts.length === 2) {
                        return { h: parseFloat(parts[0].trim()), s: parseFloat(parts[1].trim()) };
                    }
                }
                const fv = parseFloat(rawVal);
                return { h: fv, s: fv };
            }
            return { h: NaN, s: NaN };
        };

        const getCoverageBand = (val: any): string | null => {
            if (val === undefined || val === null || val === "" || String(val).toUpperCase() === "N/A" || String(val).toUpperCase() === "NONE") return null;
            const s = String(val).trim();
            if (s.includes("0-20") || s.includes("0–20") || s.includes("<20")) return "0-20%";
            if (s.includes("20-40") || s.includes("20–40")) return "20-40%";
            if (s.includes("40-60") || s.includes("40–60")) return "40-60%";
            if (s.includes("60-80") || s.includes("60–80") || s.includes("60-70")) return "60-80%";
            if (s.includes("80-100") || s.includes("80–100") || s.includes("80-90") || s.includes(">80")) return "80-100%";
            const num = parseFloat(s.replace("%", "").trim());
            if (!isNaN(num)) {
                if (num <= 20) return "0-20%";
                if (num <= 40) return "20-40%";
                if (num <= 60) return "40-60%";
                if (num <= 80) return "60-80%";
                return "80-100%";
            }
            return null;
        };

        const hardCoverageBands: Record<string, number> = {
            "0-20%": 0,
            "20-40%": 0,
            "40-60%": 0,
            "60-80%": 0,
            "80-100%": 0,
        };
        const softCoverageBands: Record<string, number> = {
            "0-20%": 0,
            "20-40%": 0,
            "40-60%": 0,
            "60-80%": 0,
            "80-100%": 0,
        };

        let totalHardReadings = 0;
        let totalSoftReadings = 0;

        const allThicknessReadings: number[] = [];
        const hardThicknessReadings: number[] = [];
        const softThicknessReadings: number[] = [];

        // Scan all target/records for coverage bands and thickness data
        const recordsToScanForMgi = records.length > 0 ? records : rawRecords;
        recordsToScanForMgi.forEach((r: any) => {
            const d = r.inspection_data || {};
            const mgData = parseMGI_Coverage(d.marine_growth || d.marine_growth_coverage || "");
            const hVal = d.marine_growth_hard ?? d.mgi_hard_coverage ?? d.hard_coverage ?? (isNaN(mgData.h) ? null : mgData.h);
            const sVal = d.marine_growth_soft ?? d.mgi_soft_coverage ?? d.soft_coverage ?? (isNaN(mgData.s) ? null : mgData.s);

            const hBand = getCoverageBand(hVal);
            if (hBand && hardCoverageBands[hBand] !== undefined) {
                hardCoverageBands[hBand]++;
                totalHardReadings++;
            }

            const sBand = getCoverageBand(sVal);
            if (sBand && softCoverageBands[sBand] !== undefined) {
                softCoverageBands[sBand]++;
                totalSoftReadings++;
            }

            // Extract thickness readings if present
            const hThkKeys = ['mgi_hard_thickness_at_12', 'mgi_hard_thickness_at_3', 'mgi_hard_thickness_at_6', 'mgi_hard_thickness_at_9', 'mgi_hard_thickness', 'hard_thickness'];
            const sThkKeys = ['mgi_soft_thickness_at_12', 'mgi_soft_thickness_at_3', 'mgi_soft_thickness_at_6', 'mgi_soft_thickness_at_9', 'mgi_soft_thickness', 'soft_thickness'];

            hThkKeys.forEach(k => {
                const val = parseFloat(String(d[k] || ''));
                if (!isNaN(val) && val > 0 && val < 1000) {
                    hardThicknessReadings.push(val);
                    allThicknessReadings.push(val);
                }
            });

            sThkKeys.forEach(k => {
                const val = parseFloat(String(d[k] || ''));
                if (!isNaN(val) && val > 0 && val < 1000) {
                    softThicknessReadings.push(val);
                    allThicknessReadings.push(val);
                }
            });

            if (d.mgi_profile) {
                const profNum = parseFloat(String(d.mgi_profile).replace(/[^\d.]/g, ''));
                if (!isNaN(profNum) && profNum > 0 && profNum < 1000) {
                    allThicknessReadings.push(profNum);
                }
            }
            if (d.avg_thickness || d.thickness || d.thickness_mm) {
                const genThk = parseFloat(String(d.avg_thickness || d.thickness || d.thickness_mm));
                if (!isNaN(genThk) && genThk > 0 && genThk < 1000) {
                    allThicknessReadings.push(genThk);
                }
            }
        });

        // Thickness calculations (RMGI/MGROW/MGI)
        mgiRecords.forEach((r: any) => {
            const d = r.inspection_data || {};
            const qid = r.structure_components?.q_id || d.q_id || "Unknown Component";
            
            const hList = ['mgi_hard_thickness_at_12','mgi_hard_thickness_at_3','mgi_hard_thickness_at_6','mgi_hard_thickness_at_9'];
            const sList = ['mgi_soft_thickness_at_12','mgi_soft_thickness_at_3','mgi_soft_thickness_at_6','mgi_soft_thickness_at_9'];
            const hVals = hList.map(v => parseFloat(d[v]) || (v === 'mgi_hard_thickness_at_12' ? parseFloat(d.mgi_hard_thickness) : 0) || 0);
            const sVals = sList.map(v => parseFloat(d[v]) || (v === 'mgi_soft_thickness_at_12' ? parseFloat(d.mgi_soft_thickness) : 0) || 0);
            const recordMaxThickness = Math.max(...hVals, ...sVals, parseFloat(d.avg_thickness || d.thickness || '0'));
            const recordMinThickness = Math.min(...hVals.filter(v => v > 0), ...sVals.filter(v => v > 0), parseFloat(d.avg_thickness || d.thickness || '999999'));

            if (recordMaxThickness > 0) {
                mgiSum += recordMaxThickness;
                mgiCount++;
                if (recordMaxThickness > mgiMax) {
                    mgiMax = recordMaxThickness;
                    mgiMaxComp = qid;
                }
                if (recordMinThickness < mgiMin && recordMinThickness > 0 && recordMinThickness !== 999999) {
                    mgiMin = recordMinThickness;
                    mgiMinComp = qid;
                }
            }
        });

        if (mgiMin === 999999) mgiMin = 0;
        const mgiAvg = mgiCount > 0 ? mgiSum / mgiCount : 0;
        const mgiAnomaliesCount = mgiRecords.filter((r: any) => !!r.has_anomaly).length;

        const thkCount = allThicknessReadings.length;
        const thkMin = thkCount > 0 ? Math.min(...allThicknessReadings) : (mgiMin > 0 ? mgiMin : 0);
        const thkMax = thkCount > 0 ? Math.max(...allThicknessReadings) : (mgiMax > 0 ? mgiMax : 0);
        const thkAvg = thkCount > 0 ? Number((allThicknessReadings.reduce((a, b) => a + b, 0) / thkCount).toFixed(1)) : (mgiAvg > 0 ? Number(mgiAvg.toFixed(1)) : 0);
        const thkHardAvg = hardThicknessReadings.length > 0 ? Number((hardThicknessReadings.reduce((a, b) => a + b, 0) / hardThicknessReadings.length).toFixed(1)) : 0;
        const thkHardMax = hardThicknessReadings.length > 0 ? Math.max(...hardThicknessReadings) : 0;
        const thkSoftAvg = softThicknessReadings.length > 0 ? Number((softThicknessReadings.reduce((a, b) => a + b, 0) / softThicknessReadings.length).toFixed(1)) : 0;
        const thkSoftMax = softThicknessReadings.length > 0 ? Math.max(...softThicknessReadings) : 0;

        // Coverage calculations (split Hard and Soft from ALL inspection records)
        let mgiHardMaxPct = 0;
        let mgiHardMaxPctComp = "N/A";
        let mgiHardMinPct = 9999;
        let mgiHardMinPctComp = "N/A";
        let hasMgiHardPct = false;

        let mgiSoftMaxPct = 0;
        let mgiSoftMaxPctComp = "N/A";
        let mgiSoftMinPct = 9999;
        let mgiSoftMinPctComp = "N/A";
        let hasMgiSoftPct = false;

        rawRecords.forEach((r: any) => {
            const d = r.inspection_data || {};
            const qid = r.structure_components?.q_id || d.q_id || "Unknown Component";

            const mgData = parseMGI_Coverage(d.marine_growth || d.marine_growth_coverage || "");
            const hc = cleanCovVal(d.marine_growth_hard) ?? cleanCovVal(d.mgi_hard_coverage) ?? cleanCovVal(d.hard_coverage) ?? mgData.h;
            const sc = cleanCovVal(d.marine_growth_soft) ?? cleanCovVal(d.mgi_soft_coverage) ?? cleanCovVal(d.soft_coverage) ?? mgData.s;

            if (!isNaN(hc) && hc >= 0 && hc <= 100) {
                hasMgiHardPct = true;
                if (hc > mgiHardMaxPct) {
                    mgiHardMaxPct = hc;
                    mgiHardMaxPctComp = qid;
                }
                if (hc < mgiHardMinPct) {
                    mgiHardMinPct = hc;
                    mgiHardMinPctComp = qid;
                }
            }

            if (!isNaN(sc) && sc >= 0 && sc <= 100) {
                hasMgiSoftPct = true;
                if (sc > mgiSoftMaxPct) {
                    mgiSoftMaxPct = sc;
                    mgiSoftMaxPctComp = qid;
                }
                if (sc < mgiSoftMinPct) {
                    mgiSoftMinPct = sc;
                    mgiSoftMinPctComp = qid;
                }
            }
        });

        if (mgiHardMinPct === 9999) mgiHardMinPct = 0;
        if (mgiSoftMinPct === 9999) mgiSoftMinPct = 0;

        // Thickness readings exceeding effective thickness and reported as Anomaly
        const mgiExceeded: Array<{
            qid: string;
            thickness: number;
            effectiveThickness: number;
            elevation: string;
            date: string;
        }> = [];

        mgiRecords.forEach((r: any) => {
            const d = r.inspection_data || {};
            const qid = r.structure_components?.q_id || d.q_id || "Unknown Component";
            
            const hList = ['mgi_hard_thickness_at_12','mgi_hard_thickness_at_3','mgi_hard_thickness_at_6','mgi_hard_thickness_at_9'];
            const sList = ['mgi_soft_thickness_at_12','mgi_soft_thickness_at_3','mgi_soft_thickness_at_6','mgi_soft_thickness_at_9'];
            const hVals = hList.map(v => parseFloat(d[v]) || (v === 'mgi_hard_thickness_at_12' ? parseFloat(d.mgi_hard_thickness) : 0) || 0);
            const sVals = sList.map(v => parseFloat(d[v]) || (v === 'mgi_soft_thickness_at_12' ? parseFloat(d.mgi_soft_thickness) : 0) || 0);
            const recordMaxThickness = Math.max(...hVals, ...sVals, parseFloat(d.avg_thickness || d.thickness || '0'));
            
            const effThickness = parseFloat(d.effective_thickness || d.eff_thk);
            if (!isNaN(effThickness) && recordMaxThickness > effThickness && !!r.has_anomaly) {
                const elevation = r.structure_components?.metadata?.elevation || d.elevation || d.depth || d.elevation_m || "N/A";
                const date = d.date || r.inspection_data?.date || new Date(r.created_at || Date.now()).toLocaleDateString("en-GB");
                mgiExceeded.push({
                    qid,
                    thickness: recordMaxThickness,
                    effectiveThickness: effThickness,
                    elevation,
                    date
                });
            }
        });

        // ─── 8B. MGI EFFECTIVE THICKNESS & ELEVATION PROFILE RESOLUTION ───────
        let recordMgiProfId: any = null;
        for (const r of mgiRecords) {
            const d = r.inspection_data || {};
            if (d._mgi_profile_id || d.mgi_profile_id || d.profile_id) {
                recordMgiProfId = d._mgi_profile_id || d.mgi_profile_id || d.profile_id;
                break;
            }
        }

        let resolvedMgiProfile: any = null;
        try {
            resolvedMgiProfile = await getMGIProfileForJobpack(
                supabase,
                jpNum || jobpackId,
                recordMgiProfId
            );
        } catch (err) {
            console.warn("[Summary API] Failed to resolve MGI Profile:", err);
        }

        const mgiWaterDepth = Math.abs(parseFloat(String(structureInfo?.depth ?? structureInfo?.waterDepth ?? 50)) || 50);

        // Standard profile thresholds fallback if profile not configured in DB
        const profileThresholds = (resolvedMgiProfile?.thresholds && resolvedMgiProfile.thresholds.length > 0)
            ? resolvedMgiProfile.thresholds
            : [
                { from_elevation: "MSL", max_thickness: 127 },
                { from_elevation: "1/4 WD", max_thickness: 100 },
                { from_elevation: "1/2 WD", max_thickness: 75 },
                { from_elevation: "Mudline", max_thickness: 25 },
            ];

        const mgiProfilePoints = profileThresholds.map((t: any) => {
            const fromStr = String(t.from_elevation || "").toUpperCase().trim();
            let elev = 0;
            if (fromStr === "MSL" || fromStr === "0") {
                elev = 0;
            } else if (fromStr === "MUDLINE") {
                elev = -mgiWaterDepth;
            } else if (fromStr.includes("WD")) {
                const m = fromStr.match(/(\d+)\/(\d+)\s*WD/i);
                if (m && parseInt(m[2], 10) !== 0) {
                    elev = -(parseInt(m[1], 10) / parseInt(m[2], 10)) * mgiWaterDepth;
                } else {
                    elev = -mgiWaterDepth;
                }
            } else {
                const val = parseFloat(fromStr.replace(/[^\d.-]/g, ""));
                elev = isNaN(val) ? 0 : (val <= 0 ? val : -val);
            }
            return {
                elevation: Math.round(elev * 10) / 10,
                maxThickness: Number(t.max_thickness) || 0,
                label: String(t.from_elevation)
            };
        }).sort((a: any, b: any) => b.elevation - a.elevation);

        const mgiByQid: Record<string, Array<{
            elevation: number;
            effectiveThickness: number;
            limit: number;
            mode: "ROV" | "Diving";
            isAnomaly: boolean;
            clockReadings?: { hard: number[]; soft: number[] };
        }>> = {};

        const isRovInspection = (r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            if (code === "RMGI" || code === "ROV" || code.startsWith("R")) return true;
            if (code === "MGROW" || code === "DMGI" || code === "DIVE" || code.startsWith("D")) return false;
            return Boolean(r.rov_job_id || r.insp_rov_jobs);
        };

        mgiRecords.forEach((r: any) => {
            const d = r.inspection_data || {};
            const comp = r.structure_components || {};
            const qid = (comp.q_id || d.q_id || `ID: ${r.component_id || "MGI-MEMBER"}`).trim().toUpperCase();

            // Resolve Elevation
            const rawElev = d.elevation ?? d.depth ?? r.elevation ?? comp.metadata?.elv_1 ?? comp.metadata?.elevation;
            let elev = 0;
            if (rawElev !== undefined && rawElev !== null && String(rawElev).trim() !== "" && String(rawElev) !== "-") {
                const str = String(rawElev).toUpperCase().trim();
                if (str === "MSL" || str === "0") {
                    elev = 0;
                } else if (str === "MUDLINE") {
                    elev = -mgiWaterDepth;
                } else {
                    const num = parseFloat(str.replace(/[^\d.-]/g, ""));
                    if (!isNaN(num)) {
                        elev = num <= 0 ? num : -num;
                    }
                }
            }

            const isRov = isRovInspection(r);
            let et = 0;
            let hReadings: number[] = [];
            let sReadings: number[] = [];

            if (isRov) {
                // ROV: Effective thickness is the Max thickness observed at the same elevation across different clock positions
                const clockPositions = ['12', '3', '6', '9'];
                clockPositions.forEach(pos => {
                    const h = parseFloat(d[`mgi_hard_thickness_at_${pos}`] ?? d[`hard_thickness_at_${pos}`] ?? d[`hard_thk${pos}`]);
                    if (!isNaN(h) && h > 0) hReadings.push(h);
                    const s = parseFloat(d[`mgi_soft_thickness_at_${pos}`] ?? d[`soft_thickness_at_${pos}`] ?? d[`soft_thk${pos}`]);
                    if (!isNaN(s) && s > 0) sReadings.push(s);
                });
                if (d.mgi_hard_thickness) {
                    const h = parseFloat(d.mgi_hard_thickness);
                    if (!isNaN(h) && h > 0) hReadings.push(h);
                }
                if (d.mgi_soft_thickness) {
                    const s = parseFloat(d.mgi_soft_thickness);
                    if (!isNaN(s) && s > 0) sReadings.push(s);
                }

                const allClockReadings = [...hReadings, ...sReadings];
                if (allClockReadings.length > 0) {
                    et = Math.max(...allClockReadings);
                } else {
                    et = parseFloat(d.effective_thickness ?? d.max_thickness ?? d.avg_thickness ?? d.thickness ?? 0) || 0;
                }
            } else {
                // Diving job: directly get value from the effective thickness value
                if (d.effective_thickness !== undefined && d.effective_thickness !== null && String(d.effective_thickness).trim() !== "") {
                    et = parseFloat(String(d.effective_thickness)) || 0;
                } else if (d.effective_thk !== undefined && d.effective_thk !== null && String(d.effective_thk).trim() !== "") {
                    et = parseFloat(String(d.effective_thk)) || 0;
                } else if (d.eff_thickness !== undefined && d.eff_thickness !== null && String(d.eff_thickness).trim() !== "") {
                    et = parseFloat(String(d.eff_thickness)) || 0;
                } else {
                    // Fallback to circumference measurement if effective_thickness not explicitly filled
                    const cAbove = parseFloat(d.circumferential_measurement_5m_above) || 0;
                    const c0m = parseFloat(d.circumferential_measurement_0m) || 0;
                    const cBelow = parseFloat(d.circumferential_measurement_5m_below) || 0;
                    const circs = [cAbove, c0m, cBelow].filter(v => v > 0);
                    const nomDia = parseFloat(d.nominal_diameter) || 0;
                    if (circs.length > 0 && nomDia > 0) {
                        const cAvg = circs.reduce((a, b) => a + b, 0) / circs.length;
                        et = Math.max(0, 0.5 * ((cAvg / Math.PI) - nomDia));
                    } else {
                        et = parseFloat(d.thickness ?? d.avg_thickness ?? 0) || 0;
                    }
                }
            }

            // Allowable Limit from MGI Profile
            let limit = 0;
            if (profileThresholds.length > 0) {
                const interpolated = calculateInterpolatedMgiThreshold(Math.abs(elev), mgiWaterDepth, profileThresholds);
                if (interpolated !== null) limit = Math.round(interpolated * 10) / 10;
            }
            if (limit === 0) {
                const rawLimit = d.max_allowable_thickness ?? d.max_allow ?? d.mgi_max_allowable_thickness ?? d.allowable_thickness;
                if (rawLimit != null) limit = parseFloat(String(rawLimit).replace(/[^\d.]/g, "")) || 0;
            }

            const roundedElev = Math.round(elev * 10) / 10;
            const roundedEt = Math.round(et * 10) / 10;

            if (!mgiByQid[qid]) mgiByQid[qid] = [];
            const existingEntry = mgiByQid[qid].find(p => p.elevation === roundedElev);
            if (existingEntry) {
                // If already has reading at this elevation, take the max thickness observed at this elevation
                existingEntry.effectiveThickness = Math.max(existingEntry.effectiveThickness, roundedEt);
                if ((limit > 0 && existingEntry.effectiveThickness > limit) || !!r.has_anomaly) {
                    existingEntry.isAnomaly = true;
                }
            } else {
                mgiByQid[qid].push({
                    elevation: roundedElev,
                    effectiveThickness: roundedEt,
                    limit,
                    mode: isRov ? "ROV" : "Diving",
                    isAnomaly: (limit > 0 && et > limit) || !!r.has_anomaly,
                    clockReadings: (hReadings.length > 0 || sReadings.length > 0) ? { hard: hReadings, soft: sReadings } : undefined
                });
            }
        });

        Object.keys(mgiByQid).forEach(qid => {
            mgiByQid[qid].sort((a, b) => b.elevation - a.elevation);
        });

        // --- 9. SCOUR ANALYSIS ---
        const isScourRecord = (r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "RSCOR" || code === "SCOUR" || code === "DSCOR";
        };
        const scourTargetRecords = (isReportSpecific && records.length > 0 ? records : rawRecords).filter(isScourRecord);
        const scourRecords = scourTargetRecords.length > 0 ? scourTargetRecords : rawRecords.filter(isScourRecord);

        const scourExposedRecords = scourRecords.filter((r: any) => {
            const d = r.inspection_data || {};
            const ep = d.Exposed_pile ?? d.exposed_pile ?? d.Exposed ?? d.exposed;
            return ep === "Yes" || ep === true || ep === "YES" || ep === "yes" || ep === 1 || ep === "1";
        });
        const scourExposedCount = scourExposedRecords.length;
        const scourExposedComponents = scourExposedRecords.map((r: any) => {
            const d = r.inspection_data || {};
            const qid = r.structure_components?.q_id || d.q_id || "N/A";
            const loc = d.scour_location || r.structure_components?.metadata?.location || r.structure_components?.metadata?.leg || d.location || d.leg || "N/A";
            return { qid, location: loc };
        });
        const scourExposedLocationsStr = scourExposedComponents.map((c: any) => `${c.qid} (${c.location})`).join(", ") || "None";

        const scourBurials = scourRecords.map((r: any) => parseFloat(r.inspection_data?.Burial_percent || '0')).filter((v: number) => !isNaN(v));
        const scourMinBurial = scourBurials.length > 0 ? Math.min(...scourBurials) : 100;

        const distinctFacesSet = new Set<string>();
        const distinctPilesSet = new Set<string>();
        const pilesWithFindingsSet = new Set<string>();
        let maxScourDepth = 0;
        let maxScourDepthMm = 0;
        let maxScourDepthMeters = 0;
        let maxScourLocation = "N/A";
        let maxScourFace = "N/A";
        let maxScourQid = "N/A";

        let minScourDepth = Infinity;
        let minScourDepthMm = Infinity;
        let minScourLocation = "N/A";
        let minScourFace = "N/A";
        let minScourQid = "N/A";

        let fallbackMinDepth = Infinity;
        let fallbackMinDepthMm = Infinity;
        let fallbackMinLocation = "N/A";
        let fallbackMinFace = "N/A";
        let fallbackMinQid = "N/A";

        const scourQidMap = new Map<string, {
            qid: string;
            location: string;
            face: string;
            depthMm: number;
            depthM: number;
            burialPct?: number;
            isBuried?: boolean;
            isExposed?: boolean;
        }>();

        scourRecords.forEach((r: any) => {
            const d = r.inspection_data || {};
            const face = d.platform_face || d.face || r.structure_components?.metadata?.face || "";
            if (face) {
                face.split(",").forEach((f: string) => {
                    const trimmed = f.trim();
                    if (trimmed) distinctFacesSet.add(trimmed);
                });
            }

            const loc = String(d.scour_location || r.structure_components?.metadata?.location || r.structure_components?.metadata?.leg || d.location || d.leg || "").trim();
            // A pile is an actual leg/pile (e.g. 'Leg : A1', 'At Leg: B2', 'Pile 1'), NOT an intermediate seabed midpoint ('At Midpoint')
            const isMidpoint = /midpoint|mid-point|center|centre/i.test(loc);
            const isPileOrLeg = loc !== "" && !isMidpoint && (/leg|pile|column/i.test(loc) || /^[A-D]\d?$/i.test(loc));

            if (isPileOrLeg) {
                distinctPilesSet.add(loc);
            }

            const rawDepth = parseFloat(String(d.scour_depth || '0'));
            const unit = String(d.scour_depth_unit || 'mm').toLowerCase();
            const inMm = (!isNaN(rawDepth) && rawDepth > 0)
                ? ((unit === 'm' || (rawDepth <= 10 && unit !== 'mm')) ? rawDepth * 1000 : rawDepth)
                : 0;
            const inM = (!isNaN(rawDepth) && rawDepth > 0)
                ? ((unit === 'mm' || rawDepth > 10) ? rawDepth / 1000 : rawDepth)
                : 0;

            if (!isNaN(rawDepth)) {
                const meta = r.structure_components?.metadata || {};
                const sNode = meta.start_node || meta.f_node || meta.Node_1 || meta.startNode || meta.StNode || d.start_node || d.f_node || "";
                const eNode = meta.end_node || meta.s_node || meta.Node_2 || meta.endNode || meta.EndNode || d.end_node || d.s_node || "";
                const sLeg = meta.start_leg || meta.startLeg || meta.s_leg || d.start_leg || "";
                const eLeg = meta.end_leg || meta.endLeg || meta.f_leg || d.end_leg || "";

                let nodesOrLegs = "";
                if (sLeg && eLeg) {
                    nodesOrLegs = `Legs: ${sLeg} - ${eLeg}`;
                } else if (sNode && eNode) {
                    nodesOrLegs = `Nodes: ${sNode} - ${eNode}`;
                } else if (sNode) {
                    nodesOrLegs = `Node: ${sNode}`;
                } else if (sLeg) {
                    nodesOrLegs = `Leg: ${sLeg}`;
                }

                let effectiveFace = face;
                if (face && nodesOrLegs) {
                    effectiveFace = `${face} (${nodesOrLegs})`;
                } else if (nodesOrLegs) {
                    effectiveFace = nodesOrLegs;
                } else {
                    effectiveFace = face || "N/A";
                }

                const compQid = r.structure_components?.q_id || d.q_id || (loc ? `QID-${loc}` : "N/A");

                if (rawDepth > maxScourDepth || (rawDepth === 0 && maxScourDepth === 0 && maxScourQid === "N/A")) {
                    maxScourDepth = rawDepth;
                    maxScourQid = compQid;
                    maxScourLocation = loc || "N/A";
                    maxScourFace = effectiveFace;
                }

                if (inMm > maxScourDepthMm) maxScourDepthMm = inMm;
                if (inM > maxScourDepthMeters) maxScourDepthMeters = inM;

                const rawBurial = d.Burial_percent ?? d.burial_percent ?? d.burial ?? '0';
                const burialPct = parseFloat(String(rawBurial).replace(/[^0-9.-]/g, '')) || 0;
                const isBuried = burialPct > 0 || String(d.status || "").toLowerCase().includes("buried") || d.buried === true || d.buried === "Yes";
                const isZeroOrNegative = inMm <= 0 || rawDepth <= 0;
                const isBuriedOrZero = isBuried || isZeroOrNegative;

                // For the minimum scour depth reading: filter out the buried or 0 depth readings
                if (!isBuriedOrZero && inMm < minScourDepthMm) {
                    minScourDepthMm = inMm;
                    minScourDepth = rawDepth;
                    minScourLocation = loc || "N/A";
                    minScourQid = compQid;
                    minScourFace = effectiveFace;
                }

                // Fallback tracker in case all readings are 0 or buried
                if (inMm < fallbackMinDepthMm) {
                    fallbackMinDepthMm = inMm;
                    fallbackMinDepth = rawDepth;
                    fallbackMinLocation = loc || "N/A";
                    fallbackMinQid = compQid;
                    fallbackMinFace = effectiveFace;
                }

                if (compQid && compQid !== "N/A") {
                    const existing = scourQidMap.get(compQid);
                    if (!existing || inMm > existing.depthMm) {
                        scourQidMap.set(compQid, {
                            qid: compQid,
                            location: loc && loc !== "N/A" ? loc : (effectiveFace || "N/A"),
                            face: effectiveFace || face || "N/A",
                            depthMm: inMm,
                            depthM: inM,
                            burialPct: burialPct,
                            isBuried: isBuried,
                            isExposed: d.Exposed_pile === "Yes" || d.Exposed_pile === true
                        });
                    }
                }
            }

            const isExposed = d.Exposed_pile === "Yes" || d.Exposed_pile === true;
            const hasFindingText = (d.findings && String(d.findings).trim() !== "" && String(d.findings).toUpperCase() !== "N/A") ||
                                   (d.finding && String(d.finding).trim() !== "" && String(d.finding).toUpperCase() !== "N/A") ||
                                   (d.comments && String(d.comments).trim() !== "" && String(d.comments).toUpperCase() !== "N/A");
            if (rawDepth > 0 || isExposed || hasFindingText) {
                if (isPileOrLeg) {
                    pilesWithFindingsSet.add(loc);
                }
            }
        });

        if (minScourDepthMm === Infinity) {
            minScourDepthMm = fallbackMinDepthMm !== Infinity ? fallbackMinDepthMm : 0;
            minScourDepth = fallbackMinDepth !== Infinity ? fallbackMinDepth : 0;
            minScourLocation = fallbackMinLocation;
            minScourQid = fallbackMinQid;
            minScourFace = fallbackMinFace;
        }

        const allScourQids = Array.from(scourQidMap.values()).sort((a, b) => b.depthMm - a.depthMm);
        const nonZeroScourQids = allScourQids.filter(r => r.depthMm > 0 && !r.isBuried && (r.burialPct === undefined || r.burialPct === 0));
        const finalScourQidReadings = nonZeroScourQids.length > 0 ? nonZeroScourQids : allScourQids;

        // ─── 10. ANOMALIES ─────────────────────────────────────────────────────
        // Anomaly = (has_anomaly=true OR has insp_anomalies) AND _meta_status != "Finding"
        // Finding = (has_anomaly=true OR has insp_anomalies) AND _meta_status == "Finding"
        const candidateRecords = records.length > 0 ? records : rawRecords;
        let anomalyRecords = candidateRecords.filter((r: any) => {
            const isAnomaly = r.has_anomaly === true || (r.insp_anomalies && r.insp_anomalies.length > 0) || String(r.status || "").toUpperCase() === "ANOMALY";
            if (!isAnomaly) return false;
            const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
            return metaStatus !== "finding";
        });

        // Fallback to rawRecords for the structure/jobpack if report-filtered subset yielded 0 anomalies
        if (anomalyRecords.length === 0 && rawRecords.length > 0) {
            anomalyRecords = rawRecords.filter((r: any) => {
                const isAnomaly = r.has_anomaly === true || (r.insp_anomalies && r.insp_anomalies.length > 0) || String(r.status || "").toUpperCase() === "ANOMALY";
                if (!isAnomaly) return false;
                const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
                return metaStatus !== "finding";
            });
        }

        let findingRecords = candidateRecords.filter((r: any) => {
            const isAnomaly = r.has_anomaly === true || (r.insp_anomalies && r.insp_anomalies.length > 0) || String(r.status || "").toUpperCase() === "ANOMALY";
            if (!isAnomaly) return false;
            const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
            return metaStatus === "finding";
        });

        if (findingRecords.length === 0 && rawRecords.length > 0) {
            findingRecords = rawRecords.filter((r: any) => {
                const isAnomaly = r.has_anomaly === true || (r.insp_anomalies && r.insp_anomalies.length > 0) || String(r.status || "").toUpperCase() === "ANOMALY";
                if (!isAnomaly) return false;
                const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
                return metaStatus === "finding";
            });
        }

        const VALID_PRIORITY = (p: string | null | undefined): boolean => {
            if (!p) return false;
            const up = p.trim().toUpperCase();
            return up !== "" && up !== "NONE" && up !== "UNKNOWN" && up !== "N/A";
        };

        const DEFECT_NORM_MAP: Record<string, string> = {
            "ANODE WASTAGE": "AW",
            "ANODE_WASTAGE": "AW",
            "WASTAGE": "AW",
            "ANODE": "AW",
            "AW": "AW",
            "CATHODIC POTENTIAL": "CP",
            "CATHODIC_POTENTIAL": "CP",
            "CP": "CP",
            "DEBRIS": "DB",
            "DB": "DB",
            "LACK OF INTEGRITY": "LI",
            "LACK_OF_INTEGRITY": "LI",
            "LI": "LI",
            "PHYSICAL DAMAGE": "PD",
            "PHYSICAL_DAMAGE": "PD",
            "DAMAGE": "PD",
            "PD": "PD",
            "SCOUR": "SC",
            "SC": "SC",
            "VARIATION TO SPECIFICATION": "VS",
            "VARIATION TO SPEC": "VS",
            "VARIATION_TO_SPEC": "VS",
            "VS": "VS",
            "CORROSION": "CR",
            "CR": "CR",
            "MARINE GROWTH": "MT",
            "MT": "MT",
            "COATING DAMAGE": "CD",
            "CD": "CD",
        };

        const anomalyByPriority: Record<string, number> = {};
        let rectifiedCount = 0;
        let anomalyValidTotal = 0;

        anomalyRecords.forEach((r: any) => {
            const anomaly = r.insp_anomalies?.[0];
            const rawPriority = anomaly
                ? (anomaly.priority_code || "")
                : (r.inspection_data?.priority || "");

            anomalyValidTotal++;
            if (anomaly?.status === "CLOSED" || anomaly?.is_rectified || r.inspection_data?.rectify || r.inspection_data?.is_rectified) {
                rectifiedCount++;
            }

            const rawPrioUpper = VALID_PRIORITY(rawPriority) ? rawPriority.trim().toUpperCase() : "N/A";
            let prioKey = "Other";
            if (rawPrioUpper === "PRIORITY 1" || rawPrioUpper === "P1" || rawPrioUpper === "1" || rawPrioUpper === "HIGH") {
                prioKey = "Priority 1";
            } else if (rawPrioUpper === "PRIORITY 2" || rawPrioUpper === "P2" || rawPrioUpper === "2" || rawPrioUpper === "MEDIUM") {
                prioKey = "Priority 2";
            } else if (rawPrioUpper === "PRIORITY 3" || rawPrioUpper === "P3" || rawPrioUpper === "3" || rawPrioUpper === "LOW") {
                prioKey = "Priority 3";
            } else if (rawPrioUpper === "OBSERVATION" || rawPrioUpper === "OBS") {
                prioKey = "Observation";
            } else if (rawPrioUpper !== "N/A") {
                prioKey = rawPriority.trim();
            }
            anomalyByPriority[prioKey] = (anomalyByPriority[prioKey] || 0) + 1;
        });

        // Ensure active non-deleted priority items from library (P1, P2, P3, OBSERVATION) default to 0
        const activePriorityLabels = ["Priority 1", "Priority 2", "Priority 3", "Observation"];
        activePriorityLabels.forEach(lbl => {
            if (anomalyByPriority[lbl] === undefined) {
                anomalyByPriority[lbl] = 0;
            }
        });

        const VALID_DEFECT_TYPE = (t: string | null | undefined): boolean => {
            if (!t) return false;
            const up = t.trim().toUpperCase();
            return up !== "" && up !== "UNKNOWN" && up !== "N/A" && up !== "NONE";
        };

        const anomalyByDefectType: Record<string, number> = {};
        const anomalyByDefectTypeDetails: Record<string, Array<{ qid: string; inspectionTypeName: string }>> = {};

        anomalyRecords.forEach((r: any) => {
            const anomaly = r.insp_anomalies?.[0];
            const defectType = (
                anomaly?.defect_type_code ||
                anomaly?.defect_category_code ||
                r.inspection_data?.defectCode ||
                r.inspection_data?.defect_code ||
                r.inspection_data?.defect_type ||
                ""
            ).trim();
            if (!VALID_DEFECT_TYPE(defectType)) return;

            const codeNorm = DEFECT_NORM_MAP[defectType.toUpperCase()] || defectType.toUpperCase();
            anomalyByDefectType[codeNorm] = (anomalyByDefectType[codeNorm] || 0) + 1;

            const comp = r.structure_components || {};
            const qid = comp.q_id || r.inspection_data?.q_id || `ID: ${r.component_id || "Unknown"}`;
            const inspCode = r.inspection_type_code || r.inspection_type?.code || "UNKNOWN";
            const typeName = formatInspectionTypeName(r.inspection_type?.name || inspCode);

            if (!anomalyByDefectTypeDetails[codeNorm]) {
                anomalyByDefectTypeDetails[codeNorm] = [];
            }
            const exists = anomalyByDefectTypeDetails[codeNorm].some(
                (item: any) => item.qid === qid && item.inspectionTypeName === typeName
            );
            if (!exists) {
                anomalyByDefectTypeDetails[codeNorm].push({ qid, inspectionTypeName: typeName });
            }
        });

        // Finding: group by priority_code
        const findingByPriority: Record<string, number> = {};
        let findingRectifiedCount = 0;
        let findingValidTotal = 0;

        findingRecords.forEach((r: any) => {
            const anomaly = r.insp_anomalies?.[0];
            const rawPriority = anomaly
                ? (anomaly.priority_code || "")
                : (r.inspection_data?.priority || "");

            findingValidTotal++;
            if (anomaly?.status === "CLOSED") findingRectifiedCount++;

            const rawPrioUpper = VALID_PRIORITY(rawPriority) ? rawPriority.trim().toUpperCase() : "N/A";
            let prioKey = "Other";
            if (rawPrioUpper === "PRIORITY 1" || rawPrioUpper === "P1" || rawPrioUpper === "1" || rawPrioUpper === "HIGH") {
                prioKey = "Priority 1";
            } else if (rawPrioUpper === "PRIORITY 2" || rawPrioUpper === "P2" || rawPrioUpper === "2" || rawPrioUpper === "MEDIUM") {
                prioKey = "Priority 2";
            } else if (rawPrioUpper === "PRIORITY 3" || rawPrioUpper === "P3" || rawPrioUpper === "3" || rawPrioUpper === "LOW") {
                prioKey = "Priority 3";
            } else if (rawPrioUpper === "OBSERVATION" || rawPrioUpper === "OBS") {
                prioKey = "Observation";
            } else if (rawPrioUpper !== "N/A") {
                prioKey = rawPriority.trim();
            }
            findingByPriority[prioKey] = (findingByPriority[prioKey] || 0) + 1;
        });

        activePriorityLabels.forEach(lbl => {
            if (findingByPriority[lbl] === undefined) {
                findingByPriority[lbl] = 0;
            }
        });

        const ATTACHMENT_GROUPS: Record<string, string[]> = {
            "Riser":        ["RS", "RIS", "RISER"],
            "Conductor":    ["CD", "COND", "CONDUCTOR", "CON", "C-"],
            "Caisson":      ["CA", "CAIS", "CAISSON", "CS"],
            "Riser Guard":  ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD", "SG"],
            "Boat Landing": ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD"],
        };

        const sowCompIds: Record<string, Set<string>> = {
            "Riser": new Set(), "Conductor": new Set(), "Caisson": new Set(),
            "Riser Guard": new Set(), "Boat Landing": new Set(),
        };
        const recordCompIds: Record<string, Set<string>> = {
            "Riser": new Set(), "Conductor": new Set(), "Caisson": new Set(),
            "Riser Guard": new Set(), "Boat Landing": new Set(),
        };

        // Helper to extract a clean component code from QID or Type
        const getEffectiveCode = (item: any, comp: any) => {
            const qid = (comp?.q_id || "").toUpperCase();
            const type = (item.component_type || comp?.code || "").toUpperCase();
            
            if (type && type !== "UNKNOWN") return type;
            
            // Fallback to parsing QID: PLAT-C/RS-01 -> RS
            const lastPart = qid.split("/").pop() || "";
            return lastPart.split("-")[0] || lastPart.split(" ")[0] || "";
        };

        // Helper to normalize a component to its top-level parent identifier
        const getParentKey = (item: any, comp: any) => {
            const meta = comp?.metadata || {};
            // Try all known metadata fields that might contain the parent reference
            const parentId = meta.associated_comp_id || 
                             meta.parent_id || 
                             meta.comp_id_parent || 
                             meta.parent_comp_id || 
                             meta.associated_id ||
                             meta.associated_comp_qid;

            if (parentId) return String(parentId).toUpperCase();
            
            // Priority 2: Use the component's own ID if it's a root item
            if (item.component_id || comp?.id) return String(item.component_id || comp?.id);

            // Priority 3: Fallback to QID segment analysis
            const qid = (comp?.q_id || "").toUpperCase();
            if (!qid) return "";
            
            const segments = qid.split("/");
            if (segments.length >= 2) return segments.slice(0, 2).join("/");
            
            const dashSegments = qid.split("-");
            if (dashSegments.length > 2) return dashSegments.slice(0, 2).join("-");
            
            return qid;
        };

        // Scope (Total) is based on ALL items in the SOW (the whole platform's scope)
        allSowItems.forEach((item: any) => {
            const compIdKey = item.component_id != null ? String(item.component_id) : "";
            const dbComp = compIdKey ? compMap.get(compIdKey) : null;
            const comp = { 
                q_id: dbComp?.q_id || item.component_qid, 
                code: dbComp?.code || item.component_type,
                metadata: dbComp?.metadata 
            };
            const qid = (comp?.q_id || "").toUpperCase();
            if (!qid && !item.component_id) return;

            const code = getEffectiveCode(item, comp);
            const parentKey = getParentKey(item, comp);

            for (const [group, aliases] of Object.entries(ATTACHMENT_GROUPS)) {
                if (
                    aliases.some(a => code === a || code.startsWith(a) || qid.includes("/" + a) || qid.startsWith(a)) ||
                    qid.includes(group.toUpperCase().replace(" ", ""))
                ) {
                    sowCompIds[group].add(parentKey);
                    break;
                }
            }
        });

        // Actual (Inspected) is based on ALL records for this structure/jobpack
        rawRecords.forEach((r: any) => {
            const comp = r.structure_components || r.component || {};
            const qid = (comp?.q_id || "").toUpperCase();
            if (!qid && !r.component_id) return;

            const code = getEffectiveCode(r, comp);
            const parentKey = getParentKey(r, comp);

            for (const [group, aliases] of Object.entries(ATTACHMENT_GROUPS)) {
                if (
                    aliases.some(a => code === a || code.startsWith(a) || qid.includes("/" + a) || qid.startsWith(a)) ||
                    qid.includes(group.toUpperCase().replace(" ", ""))
                ) {
                    recordCompIds[group].add(parentKey);
                    break;
                }
            }
        });

        // Combine into a structured breakdown
        const attachmentGroupBreakdown = Object.keys(ATTACHMENT_GROUPS).reduce((acc, group) => {
            acc[group] = {
                count: recordCompIds[group].size,
                total: sowCompIds[group].size
            };
            return acc;
        }, {} as Record<string, { count: number; total: number }>);

        // ─── 10. OVERALL INSPECTION STATS ─────────────────────────────────────
        const totalRecords = records.length;
        const completedRecords = records.filter((r: any) => r.status === "COMPLETED" && !r.has_anomaly).length;
        const incompleteRecords = records.filter((r: any) =>
            (r.status || "").toUpperCase() === "INCOMPLETE"
        ).length;
        const anomalyTotal = anomalyRecords.length;
        const findingTotal = findingRecords.length;

        const uniqueRovJobs = new Set(records.filter(isRovRecord).map((r: any) => r.rov_job_id || r.inspection_data?.dive_no || "ROV-JOB")).size;
        const uniqueDiveJobs = new Set(records.filter(isDiveRecord).map((r: any) => r.dive_job_id || r.inspection_data?.dive_no || "DIVE-JOB")).size;

        const inspTypeBreakdown: Record<string, { name: string; count: number; rov: number; dive: number; anomaly: number; finding: number }> = {};
        records.forEach((r: any) => {
            const code = r.inspection_type_code || r.inspection_type?.code || "UNKNOWN";
            if (!isPipelineStructure && (code.toUpperCase() === "PL_CO" || code.toUpperCase() === "PLCO")) {
                return;
            }
            const name = formatInspectionTypeName(r.inspection_type?.name) || code;
            if (!inspTypeBreakdown[code]) {
                inspTypeBreakdown[code] = { name, count: 0, rov: 0, dive: 0, anomaly: 0, finding: 0 };
            }
            inspTypeBreakdown[code].count++;
            if (isRovRecord(r)) inspTypeBreakdown[code].rov++;
            if (isDiveRecord(r)) inspTypeBreakdown[code].dive++;
            if (r.has_anomaly) {
                const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
                const isFinding = metaStatus === "finding";

                // Only count if there is a valid (non-null, non-unknown) defect code or priority
                const anomaly = r.insp_anomalies?.[0];
                const rawPriority = anomaly
                    ? (anomaly.priority_code || "")
                    : (r.inspection_data?.priority || "");
                const rawDefect = (
                    anomaly?.defect_type_code ||
                    anomaly?.defect_category_code ||
                    r.inspection_data?.defectCode ||
                    ""
                ).trim();

                const hasPriority = VALID_PRIORITY(rawPriority);
                const hasDefect   = VALID_DEFECT_TYPE(rawDefect);

                if (hasPriority || hasDefect) {
                    if (isFinding) {
                        inspTypeBreakdown[code].finding++;
                    } else {
                        inspTypeBreakdown[code].anomaly++;
                    }
                }
            }
        });

        // Fetch library descriptions for COMPGRP (Component Groups) to ensure full component names
        const { data: compLibData } = await (supabase as any)
            .from("u_lib_list")
            .select("lib_desc, workunit, lib_code, lib_id")
            .or("lib_code.eq.COMPGRP,lib_code.eq.COMP_TYP,lib_code.eq.COMPONENT_TYPE");

        const libCodeNameMap: Record<string, string> = {};
        if (compLibData && Array.isArray(compLibData)) {
            compLibData.forEach((item: any) => {
                if (item.workunit && item.lib_desc) {
                    libCodeNameMap[String(item.workunit).toUpperCase().trim()] = item.lib_desc;
                }
                if (item.lib_code && item.lib_desc) {
                    libCodeNameMap[String(item.lib_code).toUpperCase().trim()] = item.lib_desc;
                }
                if (item.lib_id && item.lib_desc) {
                    libCodeNameMap[String(item.lib_id).toUpperCase().trim()] = item.lib_desc;
                }
            });
        }

        const COMPONENT_TYPE_NAMES: Record<string, string> = {
            "AD": "Adaptor",
            "AN": "Anode",
            "BB": "Boat Bumper",
            "BL": "Boat Landing",
            "BO": "Boat Landing",
            "BP": "Bottom Plugs",
            "BR": "Bracing",
            "BU": "Buoy",
            "CA": "Caisson",
            "CB": "Conductor / Caisson Guides",
            "CD": "Conductor",
            "CE": "Crater",
            "CF": "Conductor Guide Frame",
            "CG": "Conductor / Caisson Guides",
            "CH": "Anchor Chains",
            "CL": "Clamp",
            "CP": "Cathodic Protection",
            "CR": "Crane",
            "CS": "Conductor Support",
            "CT": "Cable Tray",
            "CU": "Conductor Guard",
            "DK": "Deck",
            "DR": "Drilling Derrick",
            "FA": "Face",
            "FB": "Flare Boom",
            "FD": "Fender",
            "FH": "Floating Hose",
            "FL": "Flange",
            "FV": "Flood Valve",
            "FW": "Fairlead",
            "FWD": "Fairlead",
            "GP": "Marine Growth Preventer",
            "GR": "Grating",
            "GS": "Gas Seepage",
            "HB": "Hose Breakaway Coupling",
            "HC": "Hatch / Doorway",
            "HD": "Horizontal Diagonal Member",
            "HE": "Helipad",
            "HM": "Horizontal Member",
            "HP": "Hull Plate",
            "HS": "Hose / Flexible Riser",
            "HU": "Hull",
            "IA": "Imp. Current Anode",
            "IT": "Item / Appurtenance",
            "JK": "Jacket",
            "LA": "Ladder",
            "LD": "Load Bearing",
            "LG": "Leg",
            "LEG": "Leg",
            "LV": "Life Boat Davit",
            "MB": "Member",
            "MH": "Manhole",
            "MN": "Moon Pool",
            "MR": "Mooring Line & Hawser",
            "ND": "Structural Node",
            "NT": "Safety Nets",
            "PA": "Padeye",
            "PC": "Repair Clamp",
            "PE": "Crane Pedestal",
            "PG": "Pile Guide",
            "PIPE": "Pipeline",
            "PL": "Pile",
            "PM": "Pipeline End Manifold",
            "PN": "Propeller Nozzle",
            "PP": "Pipeline",
            "PR": "Propeller",
            "PT": "Deck Plate",
            "PV": "Pipeline Tap Valve",
            "PW": "Field Joint Weld",
            "RB": "Riser Support Beam",
            "RC": "Repair Connector",
            "RD": "Rudder",
            "RE": "Rigging & Lifting",
            "RG": "Riser Guard",
            "RL": "Railing",
            "RP": "Rope Guard",
            "RS": "Riser",
            "SB": "Conical Stub",
            "SC": "Seachest",
            "SD": "Seabed Debris",
            "SG": "Caisson Guard",
            "SH": "Sheave",
            "SJ": "Swivel Joint",
            "SK": "SBM Skirt",
            "SL": "Shock Cell",
            "SS": "Support Structure",
            "ST": "Stiffener",
            "SW": "Structural Weld",
            "TK": "Tank",
            "TR": "Truss",
            "VD": "Vertical Diagonal Member",
            "VL": "Valve",
            "VM": "Vertical Member",
            "VS": "Vent Stack",
            "WA": "Wall / Fire Wall",
            "WB": "Wellhead / Butt Weld",
            "WC": "Castellation Weld",
            "WD": "Water Depth",
            "WF": "Wavestaff",
            "WH": "Wellhead",
            "WK": "Walkway",
            "WN": "Weld Node",
            "WP": "Support Weld",
            "WR": "Wire Rope",
            "WS": "Seam Weld",
            "YO": "Yokohama Buoy",
            "YP": "Yoke Plate"
        };
        const getComponentTypeName = (code: string) => {
            const uc = (code || "").toUpperCase().trim();
            return COMPONENT_TYPE_NAMES[uc] || libCodeNameMap[uc] || uc || "Other";
        };

        const componentSummary: Record<string, Record<string, {
            totalRecords: number;
            inspectionTypes: Record<string, {
                completed: number;
                incomplete: number;
                anomaly: number;
                pending: number;
                _scoped: number;
            }>
        }>> = {};

        // 1. Initialize from SOW items for selected SOW Report (to capture scoped tasks)
        sowItemsToProcess.forEach((item: any) => {
            const compIdKey = item.component_id != null ? String(item.component_id) : "";
            const dbComp = compIdKey ? compMap.get(compIdKey) : null;
            
            // Derive component code: dbComp.code -> item.component_type -> qid prefix (e.g. CGF -> CF)
            let rawCode = dbComp?.code || item.component_type || "";
            if (!rawCode && item.component_qid) {
                const prefix = String(item.component_qid).trim().toUpperCase().split(/[\/\-_0-9]/)[0];
                rawCode = prefix;
            }
            if (rawCode === "CGF") rawCode = "CF";

            const compType = getComponentTypeName(rawCode || "Other");
            const qid = dbComp?.q_id || item.component_qid || `ID: ${item.component_id}`;
            const inspCode = item.inspection_code || "UNKNOWN";
            
            // Skip pipeline-only inspection types on platform structure
            if (!isPipelineStructure && (inspCode.toUpperCase() === "PL_CO" || inspCode.toUpperCase() === "PLCO")) {
                return;
            }

            if (!componentSummary[compType]) {
                componentSummary[compType] = {};
            }
            if (!componentSummary[compType][qid]) {
                componentSummary[compType][qid] = {
                    totalRecords: 0,
                    inspectionTypes: {}
                };
            }
            if (!componentSummary[compType][qid].inspectionTypes[inspCode]) {
                componentSummary[compType][qid].inspectionTypes[inspCode] = {
                    completed: 0,
                    incomplete: 0,
                    anomaly: 0,
                    pending: 0,
                    _scoped: 0
                };
            }
            
            componentSummary[compType][qid].inspectionTypes[inspCode]._scoped++;
        });

        // 2. Populate from actual inspection records for the current SOW Report
        records.forEach((r: any) => {
            const comp = r.structure_components || {};
            let rawCode = comp.code || r.component_type || "";
            const qid = comp.q_id || r.inspection_data?.q_id || `ID: ${r.component_id || "Unknown"}`;
            if (!rawCode && qid) {
                const qidUpper = String(qid).trim().toUpperCase();
                const prefix = qidUpper.split(/[\/\-_0-9]/)[0];
                rawCode = prefix;
            }
            if (rawCode === "CGF") rawCode = "CF";

            const compType = getComponentTypeName(rawCode || "Other");
            const inspCode = r.inspection_type_code || r.inspection_type?.code || "UNKNOWN";

            // Ignore pipeline-only inspection types on platform structures
            if (!isPipelineStructure && (inspCode.toUpperCase() === "PL_CO" || inspCode.toUpperCase() === "PLCO")) {
                return;
            }

            if (!componentSummary[compType]) {
                componentSummary[compType] = {};
            }
            if (!componentSummary[compType][qid]) {
                componentSummary[compType][qid] = {
                    totalRecords: 0,
                    inspectionTypes: {}
                };
            }
            if (!componentSummary[compType][qid].inspectionTypes[inspCode]) {
                componentSummary[compType][qid].inspectionTypes[inspCode] = {
                    completed: 0,
                    incomplete: 0,
                    anomaly: 0,
                    pending: 0,
                    _scoped: 0
                };
            }

            componentSummary[compType][qid].totalRecords++;
            
            const isAnomaly = !!r.has_anomaly;
            const status = (r.status || "").toUpperCase();
            
            if (isAnomaly) {
                componentSummary[compType][qid].inspectionTypes[inspCode].anomaly++;
            } else if (status === "COMPLETED") {
                componentSummary[compType][qid].inspectionTypes[inspCode].completed++;
            } else if (status === "INCOMPLETE") {
                componentSummary[compType][qid].inspectionTypes[inspCode].incomplete++;
            }
        });

        // 3. Reconcile remaining pending count: pending = max(0, scoped - (completed + incomplete + anomaly))
        Object.values(componentSummary).forEach(qids => {
            Object.values(qids).forEach(qidData => {
                Object.values(qidData.inspectionTypes).forEach(stats => {
                    const totalInspected = stats.completed + stats.incomplete + stats.anomaly;
                    stats.pending = Math.max(0, stats._scoped - totalInspected);
                });
            });
        });

        const inspectionTypeSummary: Record<string, Record<string, Record<string, {
            completed: number;
            incomplete: number;
            anomaly: number;
            pending: number;
            total: number;
            _scoped: number;
        }>>> = {};

        // 1. Initialize from SOW items (to capture any scoped items)
        allSowItems.forEach((item: any) => {
            const inspCode = item.inspection_code || "UNKNOWN";
            const compIdKey = item.component_id != null ? String(item.component_id) : "";
            const dbComp = compIdKey ? compMap.get(compIdKey) : null;
            const compTypeRaw = dbComp?.code || item.component_type || "Other";
            const compType = getComponentTypeName(compTypeRaw);
            const qid = dbComp?.q_id || item.component_qid || `ID: ${item.component_id}`;
            
            if (!inspectionTypeSummary[inspCode]) {
                inspectionTypeSummary[inspCode] = {};
            }
            if (!inspectionTypeSummary[inspCode][compType]) {
                inspectionTypeSummary[inspCode][compType] = {};
            }
            if (!inspectionTypeSummary[inspCode][compType][qid]) {
                inspectionTypeSummary[inspCode][compType][qid] = {
                    completed: 0,
                    incomplete: 0,
                    anomaly: 0,
                    pending: 0,
                    total: 0,
                    _scoped: 0
                };
            }
            
            inspectionTypeSummary[inspCode][compType][qid]._scoped++;
        });

        // 2. Populate from actual inspection records
        rawRecords.forEach((r: any) => {
            const comp = r.structure_components || {};
            const compTypeRaw = r.component_type || comp.code || "Other";
            const compType = getComponentTypeName(compTypeRaw);
            const qid = comp.q_id || r.inspection_data?.q_id || `ID: ${r.component_id || "Unknown"}`;
            const inspCode = r.inspection_type_code || r.inspection_type?.code || "UNKNOWN";

            if (!inspectionTypeSummary[inspCode]) {
                inspectionTypeSummary[inspCode] = {};
            }
            if (!inspectionTypeSummary[inspCode][compType]) {
                inspectionTypeSummary[inspCode][compType] = {};
            }
            if (!inspectionTypeSummary[inspCode][compType][qid]) {
                inspectionTypeSummary[inspCode][compType][qid] = {
                    completed: 0,
                    incomplete: 0,
                    anomaly: 0,
                    pending: 0,
                    total: 0,
                    _scoped: 0
                };
            }

            const isAnomaly = !!r.has_anomaly;
            const status = (r.status || "").toUpperCase();
            
            if (isAnomaly) {
                inspectionTypeSummary[inspCode][compType][qid].anomaly++;
            } else if (status === "COMPLETED") {
                inspectionTypeSummary[inspCode][compType][qid].completed++;
            } else if (status === "INCOMPLETE") {
                inspectionTypeSummary[inspCode][compType][qid].incomplete++;
            }
        });

        // 3. Reconcile remaining pending count and total
        Object.values(inspectionTypeSummary).forEach(compGroup => {
            Object.values(compGroup).forEach(qidGroup => {
                Object.values(qidGroup).forEach(stats => {
                    const inspected = stats.completed + stats.incomplete + stats.anomaly;
                    stats.pending = Math.max(0, stats._scoped - inspected);
                    stats.total = Math.max(stats._scoped, inspected);
                });
            });
        });

        const sowSummaryMap = new Map<string, {
            inspectionName: string;
            taskType: string;
            totalQid: number;
            completedQid: number;
            incompleteQid: number;
        }>();

        const { data: inspTypes } = await (supabase as any)
            .from("inspection_type")
            .select("id, code, name, metadata");

        const inspTypeMap = new Map<string, any>();
        if (inspTypes && Array.isArray(inspTypes)) {
            inspTypes.forEach((t: any) => {
                if (t.code) inspTypeMap.set(String(t.code).toUpperCase().trim(), t);
                if (t.name) inspTypeMap.set(String(t.name).toUpperCase().trim(), t);
            });
        }

        const isJpRov = Number(jobpackInfo?.metadata?.rov) === 1 || 
                         String(jobpackInfo?.metadata?.rov) === "1" || 
                         jobpackInfo?.metadata?.rov === true || 
                         (Array.isArray(jobpackInfo?.metadata?.methods) && jobpackInfo.metadata.methods.includes("ROV")) ||
                         String(jobpackInfo?.metadata?.plantype || "").toUpperCase().includes("ROV") ||
                         String(jobpackInfo?.metadata?.tasktype || "").toUpperCase().includes("ROV");

        const isJpDiving = Boolean(jobpackInfo?.metadata?.divetyp) || 
                            (Array.isArray(jobpackInfo?.metadata?.methods) && jobpackInfo.metadata.methods.includes("DIVE")) ||
                            String(jobpackInfo?.metadata?.plantype || "").toUpperCase().includes("DIVE") ||
                            String(jobpackInfo?.metadata?.tasktype || "").toUpperCase().includes("DIVE");

        const determineTaskType = (itemOrRecord: any, codeParam?: string, nameParam?: string): "ROV" | "Diving" => {
            const data = itemOrRecord?.inspection_data || {};
            const code = String(codeParam || itemOrRecord?.inspection_code || itemOrRecord?.inspection_type_code || itemOrRecord?.inspection_type?.code || "").trim().toUpperCase();
            const name = String(nameParam || itemOrRecord?.inspection_name || itemOrRecord?.inspection_type?.name || "").trim().toUpperCase();

            // 1. Direct record job identifiers
            if (itemOrRecord?.rov_job_id || data?.rov_job_id || data?.rov_job_no) return "ROV";
            if (itemOrRecord?.dive_job_id || data?.dive_job_id || data?.dive_job_no) return "Diving";

            // 2. Dive / Run Number prefixes: R01, ROV-1 -> ROV; D01, DIVE-1 -> Diving
            const diveNo = String(itemOrRecord?.dive_no || data?.dive_no || data?.DIVE_NO || "").trim().toUpperCase();
            if (diveNo.startsWith("R") || diveNo.includes("ROV")) return "ROV";
            if (diveNo.startsWith("D") || diveNo.includes("DIVE")) return "Diving";

            // 3. Mode fields in inspection_data
            const inspMode = String(data?.insp_mode || data?.mode || data?.task_type || data?.taskType || "").toUpperCase();
            if (inspMode.includes("ROV")) return "ROV";
            if (inspMode.includes("DIVE") || inspMode.includes("DIVING")) return "Diving";

            // 4. Inspection type metadata in DB
            const inspTypeObj = inspTypeMap.get(code) || (name ? inspTypeMap.get(name) : null);
            if (inspTypeObj && inspTypeObj.metadata) {
                const meta = inspTypeObj.metadata;
                if (meta.rov === 1 || meta.rov === "1" || meta.rov === true || String(meta.mode || "").toUpperCase() === "ROV") return "ROV";
                if (meta.diving === 1 || meta.diving === "1" || meta.diving === true || String(meta.mode || "").toUpperCase().includes("DIVE")) return "Diving";
            }

            // 5. Code prefix conventions (RGVI, RCP, RMGI, etc. -> ROV; DGVI, DCP, DUT -> Diving)
            if (code.startsWith("R") && code !== "RISER" && code !== "RB" && code !== "RE") return "ROV";
            if (code.startsWith("D") && code !== "DEBRIS" && code !== "DK" && code !== "DR") return "Diving";
            if (["NAVIG", "ROVCLB", "RSEAB", "RSCO", "RSZ", "RWDI"].includes(code)) return "ROV";
            if (["BSINS", "CVINS", "ACFMC", "MPINS", "SZONE", "SANI", "ANMAIN"].includes(code)) return "Diving";

            // 6. Name conventions
            if (name.includes("ROV") || name.includes("(ROV)")) return "ROV";
            if (name.includes("DIVING") || name.includes("DIVER") || name.includes("(DIVING)")) return "Diving";

            // 7. Jobpack-level default
            if (isJpRov && !isJpDiving) return "ROV";
            if (isJpDiving && !isJpRov) return "Diving";

            return "ROV";
        };

        const itemsForSowSummary = (resolvedSowItems && resolvedSowItems.length > 0)
            ? resolvedSowItems
            : (sowItemsToProcess && sowItemsToProcess.length > 0 ? sowItemsToProcess : targetSowItems);

        if (itemsForSowSummary && itemsForSowSummary.length > 0) {
            itemsForSowSummary.forEach((item: any) => {
                const code = String(item.inspection_code || "").trim().toUpperCase();
                const name = item.inspection_name || formatInspectionTypeName(code || "UNKNOWN");
                const status = String(item.effectiveStatus || item.status || "").toLowerCase().trim();
                const isIncomplete = status === "incomplete" || status === "pending";
                const isCompleted = status === "completed";
                const taskType = determineTaskType(item, code, name);

                if (!sowSummaryMap.has(name)) {
                    sowSummaryMap.set(name, {
                        inspectionName: name,
                        taskType: taskType,
                        totalQid: 0,
                        completedQid: 0,
                        incompleteQid: 0
                    });
                }
                const group = sowSummaryMap.get(name)!;
                group.totalQid++;
                if (isIncomplete) {
                    group.incompleteQid++;
                } else if (isCompleted) {
                    group.completedQid++;
                }
            });
        }

        // Also incorporate any inspection types present in inspection records for this scope
        records.forEach((r: any) => {
            const code = String(r.inspection_type_code || r.inspection_type?.code || "").trim().toUpperCase();
            if (!isPipelineStructure && (code === "PL_CO" || code === "PLCO")) return;
            const name = formatInspectionTypeName(r.inspection_type?.name || code);
            const status = String(r.status || "").toUpperCase();
            const taskType = determineTaskType(r, code, name);

            if (!sowSummaryMap.has(name)) {
                sowSummaryMap.set(name, {
                    inspectionName: name,
                    taskType: taskType,
                    totalQid: 0,
                    completedQid: 0,
                    incompleteQid: 0
                });
            }
            // If sowSummaryMap group didn't have items from sow_items, populate from records
            if (itemsForSowSummary.length === 0) {
                const group = sowSummaryMap.get(name)!;
                group.totalQid++;
                if (status === "INCOMPLETE") {
                    group.incompleteQid++;
                } else {
                    group.completedQid++;
                }
            }
        });

        // Compute completion and incomplete percentages for all inspection types involved
        const sowSummary = Array.from(sowSummaryMap.values())
            .filter((g: any) => (g.totalQid || (g.completedQid + g.incompleteQid) || 0) > 0)
            .sort((a, b) => (b.incompleteQid - a.incompleteQid) || (b.totalQid - a.totalQid) || a.inspectionName.localeCompare(b.inspectionName))
            .map((g, idx) => {
                const total = g.totalQid || (g.completedQid + g.incompleteQid) || 0;
                const incomplete = g.incompleteQid;
                const completed = g.completedQid || Math.max(0, total - incomplete);
                
                const incompletePctVal = total > 0 ? (incomplete / total) * 100 : 0;
                const incompletePct = Number.isInteger(incompletePctVal) ? `${incompletePctVal}%` : `${incompletePctVal.toFixed(1)}%`;

                const completedPctVal = total > 0 ? (completed / total) * 100 : 0;
                const completedPct = Number.isInteger(completedPctVal) ? `${completedPctVal}%` : `${completedPctVal.toFixed(1)}%`;

                return {
                    no: idx + 1,
                    NO: idx + 1,
                    id: idx + 1,
                    ID: idx + 1,
                    inspectionName: g.inspectionName,
                    inspection_name: g.inspectionName,
                    INSPECTION_NAME: g.inspectionName,
                    name: g.inspectionName,
                    NAME: g.inspectionName,
                    taskType: g.taskType,
                    tasktype: g.taskType,
                    task_type: g.taskType,
                    TASK_TYPE: g.taskType,
                    TASKTYPE: g.taskType,
                    totalQid: total,
                    total_qid: total,
                    total: total,
                    TOTAL_QID: total,
                    TOTAL: total,
                    completedQid: completed,
                    completed_qid: completed,
                    completed: completed,
                    COMPLETED_QID: completed,
                    COMPLETED: completed,
                    incompleteQid: incomplete,
                    incomplete_qid: incomplete,
                    incomplete: incomplete,
                    INCOMPLETE_QID: incomplete,
                    INCOMPLETE: incomplete,
                    completedPct: completedPct,
                    completed_pct: completedPct,
                    completionPct: completedPct,
                    completion_pct: completedPct,
                    COMPLETED_PCT: completedPct,
                    COMPLETION_PCT: completedPct,
                    incompletePct: incompletePct,
                    incomplete_pct: incompletePct,
                    INCOMPLETE_PCT: incompletePct,
                    completedPctVal,
                    incompletePctVal
                };
            });

        // Task-level statistics (covering all tasks/records, even when multiple tasks or records exist on same QID)
        const isRecIncomplete = (r: any): boolean => {
            if (!r) return false;
            const d = r.inspection_data || r.inspection_dat || {};
            const st = String(r.status || "").trim().toUpperCase();
            const dataStatus = String(d.status || "").trim().toUpperCase();
            const metaStatus = String(d._meta_status || d.meta_status || "").trim().toUpperCase();
            const findingType = String(r.finding_type || r.findingType || d.finding_type || d.findingType || "").trim().toUpperCase();

            // 1. Explicit COMPLETED/CLOSED/APPROVED check:
            if (st === "COMPLETED" || dataStatus === "COMPLETED" || st === "CLOSED" || dataStatus === "CLOSED" || st === "APPROVED" || dataStatus === "APPROVED") {
                if (st !== "INCOMPLETE" && dataStatus !== "INCOMPLETE" && metaStatus !== "INCOMPLETE" && findingType !== "INCOMPLETE") {
                    return false;
                }
            }

            // 2. Explicit INCOMPLETE status / finding type
            if (st === "INCOMPLETE" || dataStatus === "INCOMPLETE" || metaStatus === "INCOMPLETE" || findingType === "INCOMPLETE") return true;

            // 3. Boolean flag
            if (r.is_incomplete === true || r.is_incomplete === 1 || r.incomplete === true || r.incomplete === 1 || d.is_incomplete === true || d.is_incomplete === 1) {
                return true;
            }

            // 4. Incomplete reason provided
            const incompleteReason = String(r.incomplete_reason || r.incompleteReason || d.incomplete_reason || d.incompleteReason || "").trim();
            if (incompleteReason && incompleteReason.length > 0 && incompleteReason !== "-" && incompleteReason !== "—") return true;

            // 5. Explicit prefix in description
            const desc = String(r.description || "").trim().toUpperCase();
            if (desc.startsWith("INCOMPLETE:") || desc.startsWith("STATUS: INCOMPLETE")) return true;

            return false;
        };

        const totalRecordTasks = rawRecords.length;
        const incompleteRecordTasks = rawRecords.filter(isRecIncomplete).length;
        const completedRecordTasks = Math.max(0, totalRecordTasks - incompleteRecordTasks);
        const taskCompletedPct = totalRecordTasks > 0 ? Math.round((completedRecordTasks / totalRecordTasks) * 100) : 0;
        const taskIncompletePct = totalRecordTasks > 0 ? Math.round((incompleteRecordTasks / totalRecordTasks) * 100) : 0;

        // Mode breakdown for record statuses
        const completedRov = rawRecords.filter((r: any) => !isRecIncomplete(r) && isRovRecord(r)).length;
        const completedDive = rawRecords.filter((r: any) => !isRecIncomplete(r) && isDiveRecord(r)).length;
        const incompleteRov = rawRecords.filter((r: any) => isRecIncomplete(r) && isRovRecord(r)).length;
        const incompleteDive = rawRecords.filter((r: any) => isRecIncomplete(r) && isDiveRecord(r)).length;

        const anomalyRov = anomalyRecords.filter(isRovRecord).length;
        const anomalyDive = anomalyRecords.filter(isDiveRecord).length;
        const findingRov = findingRecords.filter(isRovRecord).length;
        const findingDive = findingRecords.filter(isDiveRecord).length;

        // ─── DEFECT CRITERIA MODULE RULES RESOLUTION ──────────────────────────
        let scourMaxAllowableMm = 800; // default safe fallback
        let cpMinAllowableMv = -1150;  // default over-protection bound (more negative = over-protected)
        let cpMaxAllowableMv = -800;   // default under-protection bound (less negative = under-protected)
        let cpNominalMaxMv = -800;     // nominal under-protection threshold (P2)
        let cpCriticalMaxMv = -650;    // critical under-protection threshold (P1)

        try {
            let procQuery = (supabase as any)
                .from("defect_criteria_procedures")
                .select("id, status, procedure_name");
            if (companyId) {
                procQuery = procQuery.or(`company_id.eq.${companyId},company_id.is.null`);
            }
            const { data: procs } = await procQuery;
            const activeProcs = (procs || []).filter((p: any) => p.status === "active");
            const targetProcIds = activeProcs.length > 0 
                ? activeProcs.map((p: any) => p.id) 
                : (procs || []).map((p: any) => p.id);

            let rulesQuery = (supabase as any)
                .from("defect_criteria_rules")
                .select("*");
            if (targetProcIds.length > 0) {
                rulesQuery = rulesQuery.in("procedure_id", targetProcIds);
            } else if (companyId) {
                rulesQuery = rulesQuery.or(`company_id.eq.${companyId},company_id.is.null`);
            }
            const { data: rulesData } = await rulesQuery;
            const rules = rulesData || [];

            // 1. Scour rule
            const scourRule = rules.find((r: any) => 
                (String(r.defect_code_id || "").toUpperCase() === "SC" || 
                 String(r.field_name || "").toLowerCase().includes("scour")) &&
                r.threshold_value != null && 
                Number(r.threshold_value) > 0
            );
            if (scourRule && !isNaN(Number(scourRule.threshold_value))) {
                scourMaxAllowableMm = Number(scourRule.threshold_value);
            }

            // 2. CP rules
            const cpRules = rules.filter((r: any) => 
                String(r.defect_code_id || "").toUpperCase() === "CP" || 
                String(r.field_name || "").toLowerCase().includes("cp")
            );

            // Over-protection limit (more negative than -900 mV, e.g. -1150 mV)
            const overRule = cpRules.find((r: any) => 
                (r.threshold_operator === "<" || String(r.defect_type_id || "").toUpperCase().includes("CPOP")) && 
                r.threshold_value != null && Number(r.threshold_value) <= -900
            ) || cpRules.find((r: any) => r.threshold_value != null && Number(r.threshold_value) <= -1000);
            if (overRule && !isNaN(Number(overRule.threshold_value))) {
                cpMinAllowableMv = Number(overRule.threshold_value);
            }

            // Nominal Max allowable limit (P2 / warning, around -800 mV or -799 mV)
            cpNominalMaxMv = -800;
            const nominalRule = cpRules.find((r: any) => 
                (r.threshold_operator === ">" || String(r.defect_type_id || "").toUpperCase().includes("CPUP")) && 
                r.threshold_value != null && 
                Number(r.threshold_value) >= -900 && 
                Number(r.threshold_value) <= -750
            );
            if (nominalRule && !isNaN(Number(nominalRule.threshold_value))) {
                const tv = Number(nominalRule.threshold_value);
                cpNominalMaxMv = tv === -799 ? -800 : tv;
            }

            // Critical Max limit (P1 / severe defect, around -650 mV or -649 mV)
            cpCriticalMaxMv = -650;
            const critRule = cpRules.find((r: any) => 
                (r.threshold_operator === ">" || String(r.defect_type_id || "").toUpperCase().includes("CPOP")) && 
                r.threshold_value != null && 
                Number(r.threshold_value) > -750 && 
                Number(r.threshold_value) <= -600
            );
            if (critRule && !isNaN(Number(critRule.threshold_value))) {
                const tv = Number(critRule.threshold_value);
                cpCriticalMaxMv = tv === -649 ? -650 : tv;
            }
            cpMaxAllowableMv = cpNominalMaxMv;
        } catch (err) {
            console.warn("[Summary API] Failed to fetch defect criteria rules:", err);
        }

        return NextResponse.json({
            data: {
                structureInfo,
                jobpack: jobpackInfo,
                jobpackName: jobpackInfo?.name || "",
                jobpackInfo,
                componentSummary,
                inspectionTypeSummary,
                sow_summary: sowSummary,
                tasks: {
                    total: totalSow > 0 ? totalSow : totalRecordTasks,
                    completed: totalSow > 0 ? completedSow : completedRecordTasks,
                    incomplete: totalSow > 0 ? incompleteSow : incompleteRecordTasks,
                    completedPct: totalSow > 0 ? completedPct : taskCompletedPct,
                    incompletePct: totalSow > 0 ? incompletePct : taskIncompletePct,
                    completionPct: totalSow > 0 ? completedPct : taskCompletedPct,
                },
                sow: {
                    total: totalSow,
                    completed: completedSow,
                    incomplete: incompleteSow,
                    pending: pendingSow,
                    completionPct,
                    completedPct,
                    incompletePct,
                    pendingPct,
                    rov: {
                        total: rovSowTotal,
                        completed: rovSowCompleted,
                        incomplete: rovSowIncomplete,
                        pending: rovSowPending,
                        completionPct: rovSowCompletionPct,
                    },
                    dive: {
                        total: diveSowTotal,
                        completed: diveSowCompleted,
                        incomplete: diveSowIncomplete,
                        pending: diveSowPending,
                        completionPct: diveSowCompletionPct,
                    },
                },
                records: { 
                    total: totalRecordTasks, 
                    completed: completedRecordTasks,
                    completedRov,
                    completedDive,
                    incomplete: incompleteRecordTasks,
                    incompleteRov,
                    incompleteDive,
                    completionPct: taskCompletedPct,
                    incompletePct: taskIncompletePct,
                    anomaly: anomalyValidTotal, 
                    anomalyRov,
                    anomalyDive,
                    finding: findingValidTotal, 
                    findingRov,
                    findingDive,
                    rovCount: rovRecords.length, 
                    diveCount: diveRecords.length, 
                    hasBothModes, 
                    uniqueRovJobs, 
                    uniqueDiveJobs, 
                    inspTypeBreakdown,
                    startDate: minDate,
                    endDate: maxDate
                },
                fmd: {
                    total: fmdTotal,
                    rov: fmdRov,
                    dive: fmdDive,
                    // member_status breakdown (correct field from RFMD inspection type)
                    conditions: fmdConditions,
                },
                anodeGvi: {
                    total: anodeGviTotal,
                    rov: anodeGviRov,
                    dive: anodeGviDive,
                    anodeTypes: cleanAnodeTypesList,
                    anodeTypeStr: anodeTypeSummaryStr,
                    // anode_depletion breakdown bucketed by %
                    depletionBuckets: cleanDepletionBuckets,
                    // anode_condition breakdown
                    conditionCounts: anodeConditionCounts,
                },
                anodeMaintenance: {
                    total: anmainTotal,
                    replaced: anmainReplaced,
                    installed: anmainInstalled,
                    maintenanceCount: anmainMaintenanceCount,
                },
                sani: { total: saniTotal, rov: saniRov, dive: saniDive },
                cp: {
                    primaryCount: cpPrimaryCount,
                    primaryRov:   cpPrimaryRov,
                    primaryDive:  cpPrimaryDive,
                    additionalCount: cpAdditionalCount,
                    additionalRov:   cpAdditionalRov,
                    additionalDive:  cpAdditionalDive,
                    totalCount: cpPrimaryCount + cpAdditionalCount,
                    minVal: cpMinVal,
                    maxVal: cpMaxVal,
                    minAllowableMv: cpMinAllowableMv,
                    maxAllowableMv: cpNominalMaxMv,
                    nominalMaxMv: cpNominalMaxMv,
                    criticalMaxMv: cpCriticalMaxMv,
                    cpDetails: cpDetails,
                },
                anomalies: {
                    total: anomalyValidTotal,
                    rov: anomalyRov,
                    dive: anomalyDive,
                    rectified: rectifiedCount,
                    open: anomalyValidTotal - rectifiedCount,
                    activePriorities: activePriorityLabels,
                    byPriority: anomalyByPriority,
                    byDefectType: anomalyByDefectType,
                    defectTypeDetails: anomalyByDefectTypeDetails,
                    items: anomalyRecords.map((r: any) => {
                        const anomaly = r.insp_anomalies?.[0];
                        let defectCode = (
                            anomaly?.defect_type_code ||
                            anomaly?.defect_category_code ||
                            r.inspection_data?.defectCode ||
                            r.inspection_data?.defect_code ||
                            r.inspection_data?.defect_type ||
                            r.inspection_type_code ||
                            r.inspection_type?.code ||
                            "N/A"
                        );
                        if (typeof defectCode === 'string') {
                            defectCode = defectCode.trim();
                            if (defectCode.toLowerCase() === 'undefined' || defectCode === '') {
                                defectCode = r.inspection_type_code || r.inspection_type?.code || "N/A";
                            }
                        } else {
                            defectCode = "N/A";
                        }

                        const compMeta = r.structure_components?.metadata || {};
                        const elv1 = compMeta.elv_1 !== undefined && compMeta.elv_1 !== null ? compMeta.elv_1 : null;
                        const elv2 = compMeta.elv_2 !== undefined && compMeta.elv_2 !== null ? compMeta.elv_2 : null;
                        const compElev = elv1 !== null
                            ? (elv2 !== null && elv1 !== elv2
                                ? `${elv1} to ${elv2}`
                                : `${elv1}`)
                            : null;

                        let inspectionElev: any = null;
                        if (r.inspection_data && typeof r.inspection_data === 'object') {
                            const keys = Object.keys(r.inspection_data);
                            const targetKey = keys.find(k => {
                                const lk = k.toLowerCase();
                                return (lk.includes('elevation') || lk.includes('depth') || lk === 'elv' || lk === 'dep');
                            });
                            if (targetKey) {
                                inspectionElev = r.inspection_data[targetKey];
                            }
                        }

                        const elevation = (
                            r.elevation ||
                            inspectionElev ||
                            r.inspection_data?.elevation ||
                            r.inspection_data?.depth ||
                            r.inspection_data?.water_depth ||
                            compElev ||
                            "-"
                        );

                        const comp = r.structure_components || {};
                        const compType = (r.component_type || comp.code || comp.metadata?.type || r.inspection_data?.component_type || "").toUpperCase().trim();

                        return {
                            ref: anomaly?.anomaly_ref_no || `ID: ${r.insp_id}`,
                            qid: r.structure_components?.q_id || r.inspection_data?.q_id || "N/A",
                            component_id: r.component_id || null,
                            component_type: compType,
                            component_code: comp.code || compType,
                            elevation: elevation,
                            inspectionType: formatInspectionTypeName(r.inspection_type?.name || r.inspection_type_code || "UNKNOWN"),
                            inspection_type_code: r.inspection_type_code || r.inspection_type?.code || "UNKNOWN",
                            description: getInspectionFindings(r, anomaly),
                            priority: anomaly?.priority_code || r.inspection_data?.priority || "N/A",
                            status: anomaly?.status || "OPEN",
                            rectification: anomaly?.follow_up_notes || "N/A",
                            defectCode: defectCode,
                            anomaly: defectCode,
                            anomaly_code: defectCode,
                            anomalyCode: defectCode,
                            defect_code: defectCode,
                            defect_type: defectCode,
                            defectType: defectCode
                        };
                    })
                    .sort((a: any, b: any) => String(a.ref || "").localeCompare(String(b.ref || ""), undefined, { numeric: true, sensitivity: 'base' }))
                    .map((item: any, idx: number) => ({
                        ...item,
                        id: idx + 1,
                        no: idx + 1
                    }))
                },
                findings: {
                    total: findingValidTotal,
                    rectified: findingRectifiedCount,
                    open: findingValidTotal - findingRectifiedCount,
                    activePriorities: activePriorityLabels,
                    byPriority: findingByPriority,
                    items: findingRecords.map((r: any) => {
                        const anomaly = r.insp_anomalies?.[0];
                        let defectCode = (
                            anomaly?.defect_type_code ||
                            anomaly?.defect_category_code ||
                            r.inspection_data?.defectCode ||
                            r.inspection_data?.defect_code ||
                            r.inspection_data?.defect_type ||
                            r.inspection_type_code ||
                            r.inspection_type?.code ||
                            "N/A"
                        );
                        if (typeof defectCode === 'string') {
                            defectCode = defectCode.trim();
                            if (defectCode.toLowerCase() === 'undefined' || defectCode === '') {
                                defectCode = r.inspection_type_code || r.inspection_type?.code || "N/A";
                            }
                        } else {
                            defectCode = "N/A";
                        }

                        const compMeta = r.structure_components?.metadata || {};
                        const elv1 = compMeta.elv_1 !== undefined && compMeta.elv_1 !== null ? compMeta.elv_1 : null;
                        const elv2 = compMeta.elv_2 !== undefined && compMeta.elv_2 !== null ? compMeta.elv_2 : null;
                        const compElev = elv1 !== null
                            ? (elv2 !== null && elv1 !== elv2
                                ? `${elv1} to ${elv2}`
                                : `${elv1}`)
                            : null;

                        let inspectionElev: any = null;
                        if (r.inspection_data && typeof r.inspection_data === 'object') {
                            const keys = Object.keys(r.inspection_data);
                            const targetKey = keys.find(k => {
                                const lk = k.toLowerCase();
                                return (lk.includes('elevation') || lk.includes('depth') || lk === 'elv' || lk === 'dep');
                            });
                            if (targetKey) {
                                inspectionElev = r.inspection_data[targetKey];
                            }
                        }

                        const elevation = (
                            r.elevation ||
                            inspectionElev ||
                            r.inspection_data?.elevation ||
                            r.inspection_data?.depth ||
                            r.inspection_data?.water_depth ||
                            compElev ||
                            "-"
                        );

                        const comp = r.structure_components || {};
                        const compType = (r.component_type || comp.code || comp.metadata?.type || r.inspection_data?.component_type || "").toUpperCase().trim();

                        return {
                            ref: anomaly?.anomaly_ref_no || `ID: ${r.insp_id}`,
                            qid: r.structure_components?.q_id || r.inspection_data?.q_id || "N/A",
                            component_id: r.component_id || null,
                            component_type: compType,
                            component_code: comp.code || compType,
                            elevation: elevation,
                            inspectionType: formatInspectionTypeName(r.inspection_type?.name || r.inspection_type_code || "UNKNOWN"),
                            inspection_type_code: r.inspection_type_code || r.inspection_type?.code || "UNKNOWN",
                            description: getInspectionFindings(r, anomaly),
                            priority: anomaly?.priority_code || r.inspection_data?.priority || "N/A",
                            status: anomaly?.status || "OPEN",
                            defectCode: defectCode,
                            defect_code: defectCode,
                            defect_type: defectCode,
                            defectType: defectCode
                        };
                    })
                    .sort((a: any, b: any) => String(a.ref || "").localeCompare(String(b.ref || ""), undefined, { numeric: true, sensitivity: 'base' }))
                    .map((item: any, idx: number) => ({
                        ...item,
                        id: idx + 1,
                        no: idx + 1
                    }))
                },
                mgi: { 
                    total: mgiRecords.length, 
                    max: mgiMax, 
                    maxComp: mgiMaxComp, 
                    min: mgiMin, 
                    minComp: mgiMinComp, 
                    avg: mgiAvg, 
                    
                    // Coverage bands for Hard and Soft
                    hardBands: hardCoverageBands,
                    softBands: softCoverageBands,
                    totalHardReadings,
                    totalSoftReadings,
                    hasCoverageData: (totalHardReadings > 0 || totalSoftReadings > 0),

                    // Thickness readings
                    thickness: {
                        hasData: thkCount > 0,
                        count: thkCount,
                        min: thkMin,
                        max: thkMax,
                        avg: thkAvg,
                        hardAvg: thkHardAvg,
                        hardMax: thkHardMax,
                        softAvg: thkSoftAvg,
                        softMax: thkSoftMax,
                    },

                    // Split coverage percentage
                    hardMaxPct: mgiHardMaxPct,
                    hardMaxPctComp: mgiHardMaxPctComp,
                    hardMinPct: mgiHardMinPct,
                    hardMinPctComp: mgiHardMinPctComp,
                    
                    softMaxPct: mgiSoftMaxPct,
                    softMaxPctComp: mgiSoftMaxPctComp,
                    softMinPct: mgiSoftMinPct,
                    softMinPctComp: mgiSoftMinPctComp,

                    // Readings exceeding effective thickness reported as anomalies
                    exceeded: mgiExceeded,
                    anomaliesCount: mgiAnomaliesCount,

                    // MGI Elevation & Effective Thickness Profile data
                    profileName: resolvedMgiProfile?.name || "Standard MGI Profile",
                    profileThresholds: profileThresholds,
                    profilePoints: mgiProfilePoints,
                    byQid: mgiByQid,
                    waterDepth: mgiWaterDepth,
                    hasProfileGraphData: Object.keys(mgiByQid).length > 0
                },
                scour: { 
                    total: scourRecords.length, 
                    exposed: scourExposedCount, 
                    exposedCount: scourExposedCount,
                    exposedComponents: scourExposedComponents,
                    exposedLocationsStr: scourExposedLocationsStr,
                    minBurial: scourMinBurial,
                    registeredFaces: 4,
                    facesSurveyed: distinctFacesSet.size > 0 ? distinctFacesSet.size : 4,
                    distinctFacesCount: distinctFacesSet.size > 0 ? distinctFacesSet.size : 4,
                    pilesSurveyed: distinctPilesSet.size > 0 ? distinctPilesSet.size : (scourRecords.length > 0 ? Math.min(4, scourRecords.length) : 0),
                    distinctPilesCount: distinctPilesSet.size > 0 ? distinctPilesSet.size : (scourRecords.length > 0 ? Math.min(4, scourRecords.length) : 0),
                    scourFindingsCount: pilesWithFindingsSet.size > 0 ? pilesWithFindingsSet.size : scourExposedCount,
                    maxDepth: maxScourDepth,
                    maxDepthMm: maxScourDepthMm > 0 ? maxScourDepthMm : maxScourDepth,
                    maxDepthMeters: maxScourDepthMeters,
                    maxDepthQid: maxScourQid,
                    maxDepthLeg: maxScourLocation, // alias
                    maxDepthLocation: maxScourLocation,
                    maxDepthFace: maxScourFace,
                    minDepth: minScourDepth !== Infinity ? minScourDepth : 0,
                    minDepthMm: minScourDepthMm !== Infinity ? minScourDepthMm : 0,
                    minDepthLocation: minScourLocation,
                    minDepthFace: minScourFace,
                    minDepthQid: minScourQid,
                    maxAllowableMm: scourMaxAllowableMm,
                    maxAllowableLimit: scourMaxAllowableMm,
                    qidReadings: finalScourQidReadings,
                },
                defectCriteria: {
                    scour: {
                        maxAllowableMm: scourMaxAllowableMm,
                        operator: ">"
                    },
                    cp: {
                        minAllowableMv: cpMinAllowableMv,
                        maxAllowableMv: cpNominalMaxMv,
                        nominalMaxMv: cpNominalMaxMv,
                        criticalMaxMv: cpCriticalMaxMv,
                    }
                },
                attachmentGroups: attachmentGroupBreakdown,

                // ─── PIPELINE SPECIFIC EVENT SUMMARY ─────────────────────────────────
                pipelineSummary: (() => {
                    let totalAnodes = 0;
                    let totalFieldJoints = 0;
                    let totalSpanCount = 0;
                    let totalBurialCount = 0;
                    const burialDepth = 0;
                    let totalCpStab = 0;
                    let totalAnodeCpStab = 0;
                    let totalFjCpStab = 0;
                    let totalLineCpStab = 0;
                    let totalFlangeCpStab = 0;
                    let totalOtherCpStab = 0;
                    let totalLineCrossing = 0;
                    let totalDebris = 0;
                    let lineSkippedCount = 0;
                    let totalSkippedKm = 0;

                    let span0_5 = 0;
                    let span5_10 = 0;
                    let span10_20 = 0;
                    let span20_30 = 0;
                    let span30_40 = 0;
                    let span40_plus = 0;

                    let totalSpanKm = 0;
                    let totalBurialKm = 0;
                    const validKps: number[] = [];

                    // Parse inspection records for pipeline event features
                    records.forEach((r: any) => {
                        const d = r.inspection_data || {};
                        const evtName = String(d.event_name || d.eventName || d.EVENT || d.raw_event || d.actionName || r.inspection_type_code || "").toUpperCase();
                        const evtType = String(d.event_type || d.eventType || d.TYPE || d.raw_type || d.eventCategory || "").toUpperCase();
                        const desc = String(d.event_description || d.eventDescription || d.description || d.DESCR || d.FINDINGS || d.COMMENTS || r.description || "").toUpperCase();
                        
                        const rawKpVal = d.kp ?? d.KP ?? d.fp_kp ?? d.FP_KP ?? d.fp ?? d.FP ?? d.raw_fp ?? r.fp_kp;
                        let kp = NaN;
                        if (rawKpVal !== undefined && rawKpVal !== null && String(rawKpVal).trim() !== "") {
                            kp = parseFloat(String(rawKpVal));
                            if (!isNaN(kp)) {
                                validKps.push(kp);
                            }
                        }

                        // Anodes
                        if (evtName.includes("ANODE") || evtType.includes("ANODE")) {
                            totalAnodes++;
                        }

                        // Field Joints
                        if (evtName.includes("FIELD JOINT") || evtType.includes("FIELD JOINT") || evtType.includes("FJ") || evtName === "FJ" || evtName.includes("WELD") || evtType.includes("WELD")) {
                            totalFieldJoints++;
                        }

                        // Spans
                        if (evtName.includes("SPAN") || evtType.includes("SPAN") || desc.includes("FREE SPAN") || desc.includes("FREESPAN")) {
                            totalSpanCount++;
                            const lenMatch = desc.match(/LENGTH:\s*([\d.]+)/i) || desc.match(/LEN:\s*([\d.]+)/i);
                            if (lenMatch) {
                                const lenM = parseFloat(lenMatch[1]);
                                if (!isNaN(lenM)) {
                                    totalSpanKm += lenM / 1000;
                                }
                            } else if (d.length !== undefined && d.length !== null) {
                                const lenM = parseFloat(String(d.length_m || d.length || "0"));
                                if (!isNaN(lenM)) totalSpanKm += lenM / 1000;
                            }

                            if (!isNaN(kp) && kp >= 0) {
                                if (kp < 5) span0_5++;
                                else if (kp < 10) span5_10++;
                                else if (kp < 20) span10_20++;
                                else if (kp < 30) span20_30++;
                                else if (kp < 40) span30_40++;
                                else span40_plus++;
                            }
                        }

                        // Burials
                        if (evtName.includes("BURIAL") || evtType.includes("BURIAL") || evtName.includes("BURIED") || evtType.includes("BURIED") || desc.includes("BURIAL")) {
                            totalBurialCount++;
                            const lenMatch = desc.match(/LENGTH:\s*([\d.]+)/i) || desc.match(/LEN:\s*([\d.]+)/i);
                            if (lenMatch) {
                                const lenM = parseFloat(lenMatch[1]);
                                if (!isNaN(lenM)) {
                                    totalBurialKm += lenM / 1000;
                                }
                            } else if (d.length !== undefined && d.length !== null) {
                                const lenM = parseFloat(String(d.length_m || d.length || "0"));
                                if (!isNaN(lenM)) totalBurialKm += lenM / 1000;
                            }
                        }

                        // CP Stabs
                        const hasCp = d.cp_rdg !== undefined || d.cp_reading_mv !== undefined || d.cp !== undefined || d.cp_reading !== undefined || evtName.includes("CP") || evtType.includes("CP");
                        if (hasCp) {
                            totalCpStab++;
                            if (evtName.includes("ANODE") || evtType.includes("ANODE")) totalAnodeCpStab++;
                            else if (evtName.includes("FIELD JOINT") || evtType.includes("FJ")) totalFjCpStab++;
                            else if (evtName.includes("LINE") || evtName.includes("PIPE")) totalLineCpStab++;
                            else if (evtName.includes("FLANGE")) totalFlangeCpStab++;
                            else totalOtherCpStab++;
                        }

                        // Crossings
                        if (evtName.includes("CROSSING") || evtType.includes("CROSSING") || d.crossing_line || d.c_lin) {
                            totalLineCrossing++;
                        }

                        // Debris
                        if (evtName.includes("DEBRIS") || evtType.includes("DEBRIS") || desc.includes("DEBRIS")) {
                            totalDebris++;
                        }

                        // Line Skipped
                        if (evtName.includes("SKIP") || evtType.includes("SKIP") || desc.includes("SKIP")) {
                            lineSkippedCount++;
                            const lenMatch = desc.match(/LENGTH:\s*([\d.]+)/i) || desc.match(/LEN:\s*([\d.]+)/i);
                            if (lenMatch) {
                                const lenM = parseFloat(lenMatch[1]);
                                if (!isNaN(lenM)) totalSkippedKm += lenM / 1000;
                            }
                        }
                    });

                    const minKp = validKps.length > 0 ? Math.min(...validKps) : 0;
                    const maxKp = validKps.length > 0 ? Math.max(...validKps) : 0;

                    const meta = structureInfo?.metadata || {};
                    const pipeTotalLengthKm = parseFloat(
                        String(
                            meta.plength ||
                            meta.total_length ||
                            meta.length ||
                            meta.line_length ||
                            meta.totalLength ||
                            meta.pipeline_length ||
                            structureInfo?.length ||
                            "0"
                        )
                    ) || (maxKp > 0 ? maxKp : 0);

                    const fromLoc =
                        meta.st_loc ||
                        meta.from_location ||
                        meta.from_platform ||
                        meta.from_structure ||
                        meta.start_location ||
                        meta.start_platform ||
                        meta.from ||
                        "N/A";

                    const toLoc =
                        meta.end_loc ||
                        meta.to_location ||
                        meta.to_platform ||
                        meta.to_structure ||
                        meta.end_location ||
                        meta.end_platform ||
                        meta.to ||
                        "N/A";

                    // Determine inspection direction from records
                    const latestRecord = records[records.length - 1];
                    const firstRecord = records[0];
                    const flowModeStr = String(
                        latestRecord?.flow_direction ||
                        latestRecord?.inspection_data?.flow_direction ||
                        latestRecord?.inspection_data?.flow_mode ||
                        latestRecord?.inspection_data?.FLOW_MODE ||
                        firstRecord?.inspection_data?.flow_mode ||
                        firstRecord?.inspection_data?.FLOW_MODE ||
                        ""
                    ).toUpperCase();

                    const isDecreaseFlow = flowModeStr.includes("DECREASE") || flowModeStr.includes("REVERSE") || (validKps.length > 1 && validKps[0] > validKps[validKps.length - 1]);

                    // Raw surveyed coverage based on flow direction
                    let surveyedLengthKm = 0;
                    if (pipeTotalLengthKm > 0) {
                        if (isDecreaseFlow) {
                            surveyedLengthKm = Math.max(0, pipeTotalLengthKm - minKp);
                        } else {
                            surveyedLengthKm = Math.min(pipeTotalLengthKm, maxKp);
                        }
                    } else {
                        surveyedLengthKm = maxKp;
                    }

                    // If all records were surveyed or reached end of line
                    if (records.length > 0 && validKps.length > 0 && maxKp >= pipeTotalLengthKm * 0.95 && minKp <= 0.05) {
                        surveyedLengthKm = pipeTotalLengthKm;
                    }

                    // Net Completed Length = Surveyed Length - Skipped Length
                    const netCompletedLengthKm = Math.max(0, surveyedLengthKm - totalSkippedKm);

                    // Overall Progress Percentage
                    const completionPct = pipeTotalLengthKm > 0
                        ? Math.min(100, Math.max(0, (netCompletedLengthKm / pipeTotalLengthKm) * 100))
                        : (records.length > 0 ? 100 : 0);

                    const totalPctSpan = pipeTotalLengthKm > 0 ? (totalSpanKm / pipeTotalLengthKm) * 100 : 0;
                    const totalPctBurial = pipeTotalLengthKm > 0 ? (totalBurialKm / pipeTotalLengthKm) * 100 : 0;

                    return {
                        isPipeline: isPipelineStructure,
                        pipelineName: structureInfo?.name || "Pipeline",
                        pipelineCode: structureInfo?.code || "PL",
                        totalLength: pipeTotalLengthKm,
                        surveyedLengthKm,
                        netCompletedLengthKm,
                        completionPct,
                        isDecreaseFlow,
                        fromLocation: fromLoc,
                        toLocation: toLoc,
                        totalAnodes,
                        totalFieldJoints,
                        totalSpanCount,
                        totalBurialCount,
                        burialDepth,
                        totalCpStab,
                        totalAnodeCpStab,
                        totalFjCpStab,
                        totalLineCpStab,
                        totalFlangeCpStab,
                        totalOtherCpStab,
                        totalLineCrossing,
                        totalDebris,
                        totalAnomaly: anomalyValidTotal,
                        totalRectified: rectifiedCount,
                        lineStartKp: minKp,
                        lineEndKp: maxKp,
                        lineSkippedCount,
                        totalSkippedKm,
                        span0_5,
                        span5_10,
                        span10_20,
                        span20_30,
                        span30_40,
                        span40_plus,
                        totalSpanKm,
                        totalPctSpan,
                        totalBurialKm,
                        totalPctBurial,
                    };
                })(),
                
                 // Detailed Item Lists for Tables
                cp_items: rawRecords.filter((r: any) => {
                    const d = r.inspection_data || {};
                    return (d.cp_rdg !== undefined || d.cp_reading_mv !== undefined);
                }).map((r: any) => ({
                    component: r.structure_components?.code || r.component_type || "N/A",
                    reading: r.inspection_data?.cp_rdg || r.inspection_data?.cp_reading_mv || "N/A",
                    status: r.status || "COMPLETED"
                })),

                fmd_items: fmdRecords.map((r: any) => ({
                    component: r.structure_components?.code || r.component_type || "N/A",
                    status: r.inspection_data?.member_status || "N/A",
                    mode: isRovRecord(r) ? "ROV" : "DIVE"
                })),

                mgi_items: mgiRecords.map((r: any) => ({
                    component: r.structure_components?.code || r.component_type || "N/A",
                    thickness: r.inspection_data?.avg_thickness || r.inspection_data?.thickness || "0",
                    date: r.inspection_data?.date || new Date().toLocaleDateString("en-GB")
                })),
                outstanding_tasks: outstandingTasks,
            },
        });
    } catch (error: any) {
        console.error("[Summary] Critical error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
});
