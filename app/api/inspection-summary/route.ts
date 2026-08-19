import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";
import { formatInspectionTypeName } from "@/utils/inspection-utils";

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
        const sowId = sowIdRaw ? sowIdRaw.split('-')[0] : null;
        const structureIdRaw = searchParams.get("structure_id");
        const structureId = structureIdRaw ? structureIdRaw.split('-')[0] : null;
        const jobpackIdRaw = searchParams.get("jobpack_id");
        const jobpackId = jobpackIdRaw ? jobpackIdRaw.split('-')[0] : null;
        const sowReportNo = searchParams.get("sow_report_no");
        const jpNum = parseInt(String(jobpackId));
        const strNum = parseInt(String(structureId));

        // ─── 1. RESOLVE STRUCTURE METADATA & PIPELINE SPECS ─────────────────
        let structureInfo: any = null;
        let pipelineSpec: any = null;

        if (!isNaN(strNum)) {
            const [structRes, pipeRes] = await Promise.all([
                (supabase as any)
                    .from("u_structures")
                    .select("id, name, code, type, metadata")
                    .eq("id", strNum)
                    .maybeSingle(),
                (supabase as any)
                    .from("u_pipeline")
                    .select("*")
                    .eq("pipe_id", strNum)
                    .maybeSingle(),
            ]);

            if (structRes.data) structureInfo = structRes.data;
            if (pipeRes.data) pipelineSpec = pipeRes.data;
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

        if (!resolvedSowId && !isNaN(jpNum) && !isNaN(strNum)) {
            const { data: sowRec } = await (supabase as any)
                .from("u_sow")
                .select("id")
                .eq("company_id", companyId)
                .eq("jobpack_id", jpNum)
                .eq("structure_id", strNum)
                .limit(1)
                .maybeSingle();
            if (sowRec) {
                resolvedSowId = String(sowRec.id);
                console.log(`[Summary API] Resolved SOW ID to ${resolvedSowId}`);
            }
        }

        // ─── 2. SOW ITEMS ─────────────────────────────────────────────────────
        let allSowItems: any[] = [];
        let itemsErr = null;
        if (resolvedSowId) {
            const { data: itemsData, error: err } = await (supabase as any)
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
                .eq("company_id", companyId)
                .eq("sow_id", Number(resolvedSowId));
            itemsErr = err;
            if (itemsErr) {
                console.error("[Summary API] SOW Items fetch error:", itemsErr);
            }
            allSowItems = itemsData || [];
        }

        const isReportSpecific = sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null" && sowReportNo !== "all";
        const sowItemsToProcess = isReportSpecific
            ? allSowItems.filter((i: any) => {
                const itemRep = String(i.report_number || "").replace(/\s+/g, "").toLowerCase();
                const filterRep = String(sowReportNo).replace(/\s+/g, "").toLowerCase();
                return itemRep === filterRep;
              })
            : allSowItems;

        // Extract active component IDs and QIDs to query target components specifically
        // Coerce componentIds strictly to numbers to prevent "operator does not exist: integer = text" SQL errors
        const componentIds = sowItemsToProcess
            .map((i: any) => {
                const val = parseInt(String(i.component_id));
                return isNaN(val) ? null : val;
            })
            .filter(Boolean) as number[];
        const componentQids = sowItemsToProcess.map((i: any) => String(i.component_qid || "").trim()).filter(q => q !== "");

        let compList: any[] = [];
        if (!isNaN(strNum)) {
            const queries: Promise<any>[] = [];
            if (componentIds.length > 0) {
                queries.push(
                    (supabase as any)
                        .from("structure_components")
                        .select("id, q_id, code, metadata")
                        .eq("structure_id", strNum)
                        .in("id", componentIds)
                );
            }
            if (componentQids.length > 0) {
                queries.push(
                    (supabase as any)
                        .from("structure_components")
                        .select("id, q_id, code, metadata")
                        .eq("structure_id", strNum)
                        .in("q_id", componentQids)
                );
            }

            if (queries.length > 0) {
                const results = await Promise.all(queries);
                results.forEach((res) => {
                    if (res.data) {
                        compList = compList.concat(res.data);
                    }
                });
            }
        }

        console.log(`[Summary API] Fetched ${compList.length} targeted components for SOW items`);

        const compMap = new Map();
        const qidMap = new Map();
        if (compList) {
            compList.forEach((c: any) => {
                compMap.set(String(c.id), c);
                if (c.q_id) {
                    qidMap.set(String(c.q_id).trim().toUpperCase(), c);
                }
            });
        }

        const sowItems = allSowItems;

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

        const totalSow = sowItems.length;
        const completedSow = sowItems.filter((i: any) => i.status === "completed").length;
        const incompleteSow = sowItems.filter((i: any) => i.status === "incomplete").length;
        const pendingSow = sowItems.filter((i: any) => i.status === "pending").length;

        const completionPct = totalSow > 0 ? Math.round(((completedSow + incompleteSow) / totalSow) * 100) : 0;
        const completedPct = totalSow > 0 ? Math.round((completedSow / totalSow) * 100) : 0;
        const incompletePct = totalSow > 0 ? Math.round((incompleteSow / totalSow) * 100) : 0;
        const pendingPct = totalSow > 0 ? Math.round((pendingSow / totalSow) * 100) : 0;

        // ROV SOW Breakdown
        const rovSowItems = sowItems.filter(isRovSowItem);
        const rovSowTotal = rovSowItems.length;
        const rovSowCompleted = rovSowItems.filter((i: any) => i.status === "completed").length;
        const rovSowIncomplete = rovSowItems.filter((i: any) => i.status === "incomplete").length;
        const rovSowPending = rovSowItems.filter((i: any) => i.status === "pending").length;
        const rovSowCompletionPct = rovSowTotal > 0 ? Math.round(((rovSowCompleted + rovSowIncomplete) / rovSowTotal) * 100) : 0;

        // Diving SOW Breakdown
        const diveSowItems = sowItems.filter(isDivingSowItem);
        const diveSowTotal = diveSowItems.length;
        const diveSowCompleted = diveSowItems.filter((i: any) => i.status === "completed").length;
        const diveSowIncomplete = diveSowItems.filter((i: any) => i.status === "incomplete").length;
        const diveSowPending = diveSowItems.filter((i: any) => i.status === "pending").length;
        const diveSowCompletionPct = diveSowTotal > 0 ? Math.round(((diveSowCompleted + diveSowIncomplete) / diveSowTotal) * 100) : 0;

        const outstandingTasks: any[] = [];
        sowItemsToProcess.forEach((item: any) => {
            const statusStr = String(item.status || "").toLowerCase().trim();
            if (statusStr === "incomplete" || statusStr === "pending") {
                let comp = compMap.get(String(item.component_id));
                if (!comp && item.component_qid) {
                    comp = qidMap.get(String(item.component_qid).trim().toUpperCase());
                }
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

        let recQuery = (supabase as any)
            .from("insp_records")
            .select(`
                insp_id,
                status,
                has_anomaly,
                inspection_type_id,
                inspection_type_code,
                inspection_data,
                description,
                component_type,
                component_id,
                dive_job_id,
                rov_job_id,
                sow_report_no,
                jobpack_id,
                structure_components:component_id!left(
                    id, q_id, code, metadata
                ),
                inspection_type:inspection_type_id!left(id, code, name),
                insp_anomalies(anomaly_id, anomaly_ref_no, status, defect_type_code, defect_category_code, priority_code, record_category, defect_description)
            `)
            .eq("company_id", companyId);

        if (!isNaN(strNum)) recQuery = recQuery.eq("structure_id", strNum);

        const { data: allRecordsData, error: recErr } = await recQuery;
        if (recErr) {
            console.error("[Summary] Records fetch error:", recErr);
            return NextResponse.json({ error: recErr.message }, { status: 500 });
        }

        const sowReportNumbers = new Set(
            allSowItems
                .map((item: any) => (item.report_number || "").trim())
                .filter((r: string) => r !== "")
        );

        const dbRecords = allRecordsData || [];
        const rawRecords = dbRecords.filter((r: any) => {
            const matchesJobpack = !isNaN(jpNum) ? r.jobpack_id === jpNum : true;
            return matchesJobpack;
        });
        
        // Determine if we should filter the overview by the current report
        // isReportSpecific already declared and evaluated above

        // Filter records by report locally if requested
        // Using strict matching after trim and lowercase conversion to match selected report number exactly
        const records = isReportSpecific
            ? rawRecords.filter((r: any) => {
                const recRep = String(r.sow_report_no || "").replace(/\s+/g, "").toLowerCase();
                const filterRep = String(sowReportNo).replace(/\s+/g, "").toLowerCase();
                return recRep === filterRep;
              })
            : rawRecords;

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

        // Analysis sections use rawRecords to show the full history of the structure
        const rovRecords = rawRecords.filter((r: any) => !!r.rov_job_id);
        const diveRecords = rawRecords.filter((r: any) => !!r.dive_job_id && !r.rov_job_id);
        const hasBothModes = rovRecords.length > 0 && diveRecords.length > 0;

        // ─── 4. FMD ANALYSIS ──────────────────────────────────────────────────
        // Field: inspection_data.member_status
        // Values (from inspection-types.json): "Flooded" | "Dry" | "Grouted" | "Inconclusive"
        const fmdRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "RFMD" || code === "FMD";
        });

        const fmdTotal = fmdRecords.length;
        const fmdRov = fmdRecords.filter((r: any) => !!r.rov_job_id).length;
        const fmdDive = fmdRecords.filter((r: any) => !!r.dive_job_id && !r.rov_job_id).length;

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

        // ─── 5. ANODE (GVI / RGVI) ANALYSIS ───────────────────────────────────
        // GVI type: field = anode_depletion_percent (number 0-100)
        // RGVI type: field = anode_depletion (combo from ADA lib - string like "0-25%", "25-50%", etc.)
        const anodeGviRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            const isGvi = code === "RGVI" || code === "GVI";
            const compType = (
                r.component_type ||
                r.structure_components?.code ||
                r.structure_components?.metadata?.type ||
                ""
            ).toUpperCase();
            return isGvi && (compType === "AN" || compType === "ANODE" || compType.startsWith("AN"));
        });

        const anodeGviTotal = anodeGviRecords.length;
        const anodeGviRov = anodeGviRecords.filter((r: any) => !!r.rov_job_id).length;
        const anodeGviDive = anodeGviRecords.filter((r: any) => !!r.dive_job_id && !r.rov_job_id).length;

        // Anode depletion breakdown
        // We bucket by percentage ranges: 0-25, 25-50, 50-75, 75-100, and string-based entries
        const anodeDepletionBuckets: Record<string, number> = {
            "0–25%": 0,
            "25–50%": 0,
            "50–75%": 0,
            "75–100%": 0,
            "Not Recorded": 0,
        };
        // Anode condition breakdown (Intact, Wasted, Missing, Disconnected)
        const anodeConditionCounts: Record<string, number> = {};

        anodeGviRecords.forEach((r: any) => {
            const d = r.inspection_data || {};

            // --- Depletion ---
            // RGVI: anode_depletion (string from ADA lib, e.g. "0-25%", "25-50%", etc.)
            // GVI: anode_depletion_percent (number)
            const rawDepletion = d.anode_depletion || d.anode_depletion_percent;

            if (rawDepletion === undefined || rawDepletion === null || rawDepletion === "") {
                anodeDepletionBuckets["Not Recorded"]++;
            } else if (typeof rawDepletion === "number") {
                if (rawDepletion <= 25) anodeDepletionBuckets["0–25%"]++;
                else if (rawDepletion <= 50) anodeDepletionBuckets["25–50%"]++;
                else if (rawDepletion <= 75) anodeDepletionBuckets["50–75%"]++;
                else anodeDepletionBuckets["75–100%"]++;
            } else {
                // String from combo lib — parse range
                const s = String(rawDepletion).toLowerCase().replace(/\s+/g, "");
                if (s.includes("0-25") || s.includes("0–25") || s.includes("<25")) {
                    anodeDepletionBuckets["0–25%"]++;
                } else if (s.includes("25-50") || s.includes("25–50")) {
                    anodeDepletionBuckets["25–50%"]++;
                } else if (s.includes("50-75") || s.includes("50–75")) {
                    anodeDepletionBuckets["50–75%"]++;
                } else if (
                    s.includes("75-100") || s.includes("75–100") ||
                    s.includes(">75") || s.includes(">75%")
                ) {
                    anodeDepletionBuckets["75–100%"]++;
                } else {
                    // Use the raw string as-is if it doesn't fit a standard bucket
                    const key = String(rawDepletion).trim() || "Not Recorded";
                    anodeDepletionBuckets[key] = (anodeDepletionBuckets[key] || 0) + 1;
                }
            }

            // --- Condition ---
            const condition = d.anode_condition || d.anodeCondition || "";
            if (condition) {
                const key = String(condition).trim();
                anodeConditionCounts[key] = (anodeConditionCounts[key] || 0) + 1;
            }
        });

        // Remove empty buckets for cleaner display
        const cleanDepletionBuckets = Object.fromEntries(
            Object.entries(anodeDepletionBuckets).filter(([, v]) => v > 0)
        );

        // ─── 6. SELECTED ANODE INSPECTION (SANI/RSANI) & MAINTENANCE (ANMAIN) ─
        const saniRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "SANI" || code === "RSANI";
        });
        const saniTotal = saniRecords.length;
        const saniRov = saniRecords.filter((r: any) => !!r.rov_job_id).length;
        const saniDive = saniRecords.filter((r: any) => !!r.dive_job_id && !r.rov_job_id).length;

        // Anode Maintenance (ANMAIN) Analysis
        const anmainRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "ANMAIN" || code === "ANODE_MAINT";
        });
        const anmainTotal = anmainRecords.length;
        let anmainReplaced = 0;
        let anmainInstalled = 0;
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
            const isRov  = !!r.rov_job_id;
            const isDive = !!r.dive_job_id && !r.rov_job_id;
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
            return code === "RMGI" || code === "MGROW" || code === "MGI";
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
            let rawVal = mg.split(':').pop()?.replace(/coverage/i, '').trim() || '';
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

        // Thickness calculations (only RMGI/MGROW/MGI)
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

        // --- 9. SCOUR ANALYSIS ---
        const scourRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "RSCOR" || code === "SCOUR";
        });
        const scourExposedRecords = scourRecords.filter((r: any) => r.inspection_data?.Exposed_pile === "Yes" || r.inspection_data?.Exposed_pile === true);
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

        let maxScourDepth = 0;
        let maxScourLocation = "N/A";
        let maxScourFace = "N/A";
        let maxScourQid = "N/A";

        scourRecords.forEach((r: any) => {
            const d = r.inspection_data || {};
            const depth = parseFloat(d.scour_depth || '0');
            if (!isNaN(depth) && depth > maxScourDepth) {
                maxScourDepth = depth;
                maxScourQid = r.structure_components?.q_id || d.q_id || "N/A";
                maxScourLocation = d.scour_location || r.structure_components?.metadata?.location || r.structure_components?.metadata?.leg || d.location || d.leg || "N/A";
                
                const meta = r.structure_components?.metadata || {};
                const face = r.structure_components?.metadata?.face || d.face || r.structure_components?.metadata?.elevation || "";
                
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
                
                if (face && nodesOrLegs) {
                    maxScourFace = `${face} (${nodesOrLegs})`;
                } else if (nodesOrLegs) {
                    maxScourFace = nodesOrLegs;
                } else {
                    maxScourFace = face || "N/A";
                }
            }
        });

        // ─── 10. ANOMALIES ─────────────────────────────────────────────────────
        // Anomaly = has_anomaly=true AND _meta_status != "Finding"
        // Finding = has_anomaly=true AND _meta_status == "Finding"
        const anomalyRecords = records.filter((r: any) => {
            if (!r.has_anomaly) return false;
            const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
            return metaStatus !== "finding";
        });

        const findingRecords = records.filter((r: any) => {
            if (!r.has_anomaly) return false;
            const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
            return metaStatus === "finding";
        });

        // Anomaly: group by priority_code (P1, P2, P3, etc.) from insp_anomalies.priority_code
        // Records without a real priority (null / empty / "NONE" / "Unknown") are EXCLUDED
        // from both byPriority map and the total count.
        const VALID_PRIORITY = (p: string | null | undefined): boolean => {
            if (!p) return false;
            const up = p.trim().toUpperCase();
            return up !== "" && up !== "NONE" && up !== "UNKNOWN" && up !== "N/A";
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
            if (anomaly?.status === "CLOSED") rectifiedCount++;

            const priority = VALID_PRIORITY(rawPriority) ? rawPriority.trim().toUpperCase() : "N/A";
            anomalyByPriority[priority] = (anomalyByPriority[priority] || 0) + 1;
        });

        // Anomaly: also group by defect_type_code (structural category)
        // Skip unknown/empty defect type codes
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
                ""
            ).trim();
            if (!VALID_DEFECT_TYPE(defectType)) return; // skip unknown/empty
            anomalyByDefectType[defectType] = (anomalyByDefectType[defectType] || 0) + 1;

            const comp = r.structure_components || {};
            const qid = comp.q_id || r.inspection_data?.q_id || `ID: ${r.component_id || "Unknown"}`;
            const inspCode = r.inspection_type_code || r.inspection_type?.code || "UNKNOWN";
            const typeName = formatInspectionTypeName(r.inspection_type?.name || inspCode);

            if (!anomalyByDefectTypeDetails[defectType]) {
                anomalyByDefectTypeDetails[defectType] = [];
            }
            const exists = anomalyByDefectTypeDetails[defectType].some(
                (item: any) => item.qid === qid && item.inspectionTypeName === typeName
            );
            if (!exists) {
                anomalyByDefectTypeDetails[defectType].push({ qid, inspectionTypeName: typeName });
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

            const priority = VALID_PRIORITY(rawPriority) ? rawPriority.trim().toUpperCase() : "N/A";
            findingByPriority[priority] = (findingByPriority[priority] || 0) + 1;
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
            const dbComp = compMap.get(item.component_id);
            const comp = { 
                q_id: item.component_qid || dbComp?.q_id, 
                code: item.component_type || dbComp?.code,
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

        const uniqueRovJobs = new Set(records.filter((r: any) => r.rov_job_id).map((r: any) => r.rov_job_id)).size;
        const uniqueDiveJobs = new Set(records.filter((r: any) => r.dive_job_id).map((r: any) => r.dive_job_id)).size;

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
            if (r.rov_job_id) inspTypeBreakdown[code].rov++;
            if (r.dive_job_id && !r.rov_job_id) inspTypeBreakdown[code].dive++;
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
            });
        }

        const COMPONENT_TYPE_NAMES: Record<string, string> = {
            "RS": "Riser",
            "CD": "Conductor",
            "CA": "Caisson",
            "RG": "Riser Guard",
            "BL": "Boat Landing",
            "BO": "Boat Landing",
            "AN": "Anode",
            "SD": "Seabed Debris",
            "LG": "Leg",
            "LEG": "Leg",
            "MB": "Member",
            "PL": "Pipeline",
            "SH": "Sheave",
            "CP": "Cathodic Protection",
            "CL": "Clamp",
            "CS": "Conductor Support",
            "CF": "Conductor Guide Frame",
            "FD": "Fender",
            "HD": "Horizontal Diagonal Member",
            "HM": "Horizontal Member",
            "VM": "Vertical Member",
            "VD": "Vertical Diagonal Member",
            "IT": "Item / Appurtenance",
            "WN": "Weld Node",
            "WP": "Support Weld",
            "CU": "Conductor Guide",
            "SG": "Safety Gate",
            "BB": "Boat Bumper",
            "BR": "Bracing",
            "DK": "Deck",
            "FW": "Fairlead",
            "FWD": "Fairlead",
            "JK": "Jacket",
            "ST": "Stiffener",
            "TR": "Truss",
            "WB": "Wellhead",
            "GR": "Guard Rail",
            "ND": "Node",
            "PA": "Pad Eye",
            "PT": "Protection Structure",
            "RL": "Railing",
            "VS": "Vent Stack",
            "WK": "Walkway",
            "LA": "Ladder",
            "PG": "Pile Guide"
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
            }>
        }>> = {};

        // 1. Initialize from SOW items for selected SOW Report (to capture pending items)
        sowItemsToProcess.forEach((item: any) => {
            const dbComp = compMap.get(item.component_id) || qidMap.get(String(item.component_qid || "").trim().toUpperCase());
            
            // Derive component code: dbComp.code -> item.component_type -> qid prefix (e.g. CGF -> CF)
            let rawCode = dbComp?.code || item.component_type || "";
            if (!rawCode && item.component_qid) {
                const qidUpper = String(item.component_qid).trim().toUpperCase();
                const prefix = qidUpper.split(/[\/\-_0-9]/)[0];
                rawCode = prefix;
            }
            if (rawCode === "CGF") rawCode = "CF";

            const compType = getComponentTypeName(rawCode || "Other");
            const qid = item.component_qid || dbComp?.q_id || `ID: ${item.component_id}`;
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
                    pending: 0
                };
            }
            
            if (item.status === "pending" || item.status === "incomplete") {
                componentSummary[compType][qid].inspectionTypes[inspCode].pending++;
            }
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
                    pending: 0
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

        const inspectionTypeSummary: Record<string, Record<string, Record<string, {
            completed: number;
            incomplete: number;
            anomaly: number;
            pending: number;
            total: number;
        }>>> = {};

        // 1. Initialize from SOW items (to capture any pending items)
        allSowItems.forEach((item: any) => {
            const inspCode = item.inspection_code || "UNKNOWN";
            const dbComp = compMap.get(item.component_id);
            const compTypeRaw = item.component_type || dbComp?.code || "Other";
            const compType = getComponentTypeName(compTypeRaw);
            const qid = item.component_qid || dbComp?.q_id || `ID: ${item.component_id}`;
            
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
                    total: 0
                };
            }
            
            if (item.status === "pending" || item.status === "incomplete") {
                inspectionTypeSummary[inspCode][compType][qid].pending++;
                inspectionTypeSummary[inspCode][compType][qid].total++;
            }
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
                    total: 0
                };
            }

            const isAnomaly = !!r.has_anomaly;
            const status = (r.status || "").toUpperCase();
            
            inspectionTypeSummary[inspCode][compType][qid].total++;
            if (isAnomaly) {
                inspectionTypeSummary[inspCode][compType][qid].anomaly++;
            } else if (status === "COMPLETED") {
                inspectionTypeSummary[inspCode][compType][qid].completed++;
            } else if (status === "INCOMPLETE") {
                inspectionTypeSummary[inspCode][compType][qid].incomplete++;
            }
        });

        const sowSummaryMap = new Map<string, {
            inspectionName: string;
            taskType: string;
            totalQid: number;
            incompleteQid: number;
        }>();

        const defaultTaskType = (() => {
            const hasRov = rawRecords.some((r: any) => r.rov_job_id);
            const hasDive = rawRecords.some((r: any) => r.dive_job_id && !r.rov_job_id);
            if (hasRov && hasDive) return "ROV / DIVE";
            if (hasRov) return "ROV";
            if (hasDive) return "DIVE";
            return "ROV";
        })();

        const { data: inspTypes } = await (supabase as any)
            .from("inspection_type")
            .select("id, code, name, metadata");

        const inspTypeMap = new Map<string, any>();
        if (inspTypes) {
            inspTypes.forEach((t: any) => {
                if (t.code) inspTypeMap.set(t.code.toUpperCase().trim(), t);
                if (t.name) inspTypeMap.set(t.name.toUpperCase().trim(), t);
            });
        }

        sowItemsToProcess.forEach((item: any) => {
            const name = item.inspection_name || formatInspectionTypeName(item.inspection_code || "UNKNOWN");
            const code = String(item.inspection_code || "").trim().toUpperCase();
            const status = String(item.status || "").toLowerCase().trim();
            const isIncomplete = status === "incomplete" || status === "pending";

            // Determine task type based on inspection_type metadata
            let taskType = "ROV";

            // Try to find the inspection type metadata
            const inspTypeObj = inspTypeMap.get(code) || (item.inspection_name ? inspTypeMap.get(item.inspection_name.toUpperCase().trim()) : null);
            if (inspTypeObj && inspTypeObj.metadata) {
                const meta = inspTypeObj.metadata;
                if (meta.rov === 1 || meta.rov === "1" || meta.rov === true) {
                    taskType = "ROV";
                } else if (meta.diving === 1 || meta.diving === "1" || meta.diving === true) {
                    taskType = "Diving";
                } else {
                    // fallback to name/code checking
                    const lowerName = name.toLowerCase();
                    const lowerCode = code.toLowerCase();
                    if (lowerName.includes("rov") || lowerCode.startsWith("r")) {
                        taskType = "ROV";
                    } else if (lowerName.includes("dive") || lowerName.includes("diving") || lowerCode.startsWith("d")) {
                        taskType = "Diving";
                    }
                }
            } else {
                // fallback to name/code checking if not found in db
                const lowerName = name.toLowerCase();
                const lowerCode = code.toLowerCase();
                if (lowerName.includes("rov") || lowerCode.startsWith("r")) {
                    taskType = "ROV";
                } else if (lowerName.includes("dive") || lowerName.includes("diving") || lowerCode.startsWith("d")) {
                    taskType = "Diving";
                }
            }

            if (!sowSummaryMap.has(name)) {
                sowSummaryMap.set(name, {
                    inspectionName: name,
                    taskType: taskType,
                    totalQid: 0,
                    incompleteQid: 0
                });
            }
            const group = sowSummaryMap.get(name)!;
            group.totalQid++;
            if (isIncomplete) {
                group.incompleteQid++;
            }
        });

        const sowSummary = Array.from(sowSummaryMap.values())
            .filter(g => g.incompleteQid > 0)
            .map((g, idx) => {
                const incompletePctVal = g.totalQid > 0 ? (g.incompleteQid / g.totalQid) * 100 : 0;
                const incompletePct = Number.isInteger(incompletePctVal) ? `${incompletePctVal}%` : `${incompletePctVal.toFixed(2)}%`;
                return {
                    no: idx + 1,
                    inspectionName: g.inspectionName,
                    taskType: g.taskType,
                    tasktype: g.taskType,
                    totalQid: g.totalQid,
                    incompleteQid: g.incompleteQid,
                    incompletePct: incompletePct
                };
            });

        // Mode breakdown for record statuses
        const completedRov = rawRecords.filter((r: any) => r.status === 'COMPLETED' && !!r.rov_job_id).length;
        const completedDive = rawRecords.filter((r: any) => r.status === 'COMPLETED' && !!r.dive_job_id && !r.rov_job_id).length;
        const incompleteRov = rawRecords.filter((r: any) => (r.status || "").toUpperCase() === 'INCOMPLETE' && !!r.rov_job_id).length;
        const incompleteDive = rawRecords.filter((r: any) => (r.status || "").toUpperCase() === 'INCOMPLETE' && !!r.dive_job_id && !r.rov_job_id).length;

        const anomalyRov = anomalyRecords.filter((r: any) => !!r.rov_job_id).length;
        const anomalyDive = anomalyRecords.filter((r: any) => !!r.dive_job_id && !r.rov_job_id).length;
        const findingRov = findingRecords.filter((r: any) => !!r.rov_job_id).length;
        const findingDive = findingRecords.filter((r: any) => !!r.dive_job_id && !r.rov_job_id).length;

        return NextResponse.json({
            data: {
                componentSummary,
                inspectionTypeSummary,
                sow_summary: sowSummary,
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
                    total: rawRecords.length, 
                    completed: rawRecords.filter((r: any) => r.status === 'COMPLETED').length,
                    completedRov,
                    completedDive,
                    incomplete: rawRecords.filter((r: any) => r.status === 'INCOMPLETE').length,
                    incompleteRov,
                    incompleteDive,
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
                    cpDetails: cpDetails,
                },
                anomalies: {
                    total: anomalyValidTotal,
                    rov: anomalyRov,
                    dive: anomalyDive,
                    rectified: rectifiedCount,
                    open: anomalyValidTotal - rectifiedCount,
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

                        let inspectionElev = null;
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

                        return {
                            ref: anomaly?.anomaly_ref_no || `ID: ${r.insp_id}`,
                            qid: r.structure_components?.q_id || r.inspection_data?.q_id || "N/A",
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

                        let inspectionElev = null;
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

                        return {
                            ref: anomaly?.anomaly_ref_no || `ID: ${r.insp_id}`,
                            qid: r.structure_components?.q_id || r.inspection_data?.q_id || "N/A",
                            elevation: elevation,
                            inspectionType: formatInspectionTypeName(r.inspection_type?.name || r.inspection_type_code || "UNKNOWN"),
                            description: getInspectionFindings(r, anomaly),
                            priority: anomaly?.priority_code || r.inspection_data?.priority || "N/A",
                            status: anomaly?.status || "OPEN",
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
                mgi: { 
                    total: mgiRecords.length, 
                    max: mgiMax, 
                    maxComp: mgiMaxComp, 
                    min: mgiMin, 
                    minComp: mgiMinComp, 
                    avg: mgiAvg, 
                    
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
                    anomaliesCount: mgiAnomaliesCount 
                },
                scour: { 
                    total: scourRecords.length, 
                    exposed: scourExposedCount, 
                    exposedComponents: scourExposedComponents,
                    exposedLocationsStr: scourExposedLocationsStr,
                    minBurial: scourMinBurial,
                    maxDepth: maxScourDepth,
                    maxDepthQid: maxScourQid,
                    maxDepthLeg: maxScourLocation, // alias
                    maxDepthLocation: maxScourLocation,
                    maxDepthFace: maxScourFace
                },
                attachmentGroups: attachmentGroupBreakdown,

                // ─── PIPELINE SPECIFIC EVENT SUMMARY ─────────────────────────────────
                pipelineSummary: (() => {
                    let totalAnodes = 0;
                    let totalFieldJoints = 0;
                    let totalSpanCount = 0;
                    let totalBurialCount = 0;
                    let burialDepth = 0;
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

                    let minKp = 999999;
                    let maxKp = 0;

                    let span0_5 = 0;
                    let span5_10 = 0;
                    let span10_20 = 0;
                    let span20_30 = 0;
                    let span30_40 = 0;
                    let span40_plus = 0;

                    let totalSpanKm = 0;
                    let totalBurialKm = 0;

                    // Parse inspection records for pipeline event features
                    records.forEach((r: any) => {
                        const d = r.inspection_data || {};
                        const evtName = (d.event_name || d.eventName || r.inspection_type_code || "").toUpperCase();
                        const evtType = (d.event_type || d.eventType || r.description || "").toUpperCase();
                        const desc = (d.event_description || d.description || r.description || "").toUpperCase();
                        const kp = typeof r.fp_kp === "number" ? r.fp_kp : parseFloat(d.kp || r.fp_kp || "0");

                        if (!isNaN(kp) && kp > 0) {
                            if (kp < minKp) minKp = kp;
                            if (kp > maxKp) maxKp = kp;
                        }

                        // Anodes
                        if (evtName.includes("ANODE") || evtType.includes("ANODE")) {
                            totalAnodes++;
                        }

                        // Field Joints
                        if (evtName.includes("FIELD JOINT") || evtType.includes("FIELD JOINT") || evtType.includes("FJ")) {
                            totalFieldJoints++;
                        }

                        // Spans
                        if (evtName.includes("SPAN") || evtType.includes("SPAN")) {
                            totalSpanCount++;
                            // Extract LENGTH:xx.xxm from description if present
                            const lenMatch = desc.match(/LENGTH:([\d.]+)/);
                            if (lenMatch) {
                                const lenM = parseFloat(lenMatch[1]);
                                if (!isNaN(lenM)) {
                                    const lenKm = lenM / 1000;
                                    totalSpanKm += lenKm;
                                }
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
                        if (evtName.includes("BURIAL") || evtType.includes("BURIAL") || evtName.includes("BURIED")) {
                            totalBurialCount++;
                            const lenMatch = desc.match(/LENGTH:([\d.]+)/);
                            if (lenMatch) {
                                const lenM = parseFloat(lenMatch[1]);
                                if (!isNaN(lenM)) {
                                    totalBurialKm += lenM / 1000;
                                }
                            }
                        }

                        // CP Stabs
                        const hasCp = d.cp_rdg !== undefined || d.cp_reading_mv !== undefined || evtName.includes("CP");
                        if (hasCp) {
                            totalCpStab++;
                            if (evtName.includes("ANODE") || evtType.includes("ANODE")) totalAnodeCpStab++;
                            else if (evtName.includes("FIELD JOINT") || evtType.includes("FJ")) totalFjCpStab++;
                            else if (evtName.includes("LINE") || evtName.includes("PIPE")) totalLineCpStab++;
                            else if (evtName.includes("FLANGE")) totalFlangeCpStab++;
                            else totalOtherCpStab++;
                        }

                        // Crossings
                        if (evtName.includes("CROSSING") || evtType.includes("CROSSING")) {
                            totalLineCrossing++;
                        }

                        // Debris
                        if (evtName.includes("DEBRIS") || evtType.includes("DEBRIS")) {
                            totalDebris++;
                        }

                        // Line Skipped
                        if (evtName.includes("SKIP") || evtType.includes("SKIP")) {
                            lineSkippedCount++;
                            const lenMatch = desc.match(/LENGTH:([\d.]+)/);
                            if (lenMatch) {
                                const lenM = parseFloat(lenMatch[1]);
                                if (!isNaN(lenM)) totalSkippedKm += lenM / 1000;
                            }
                        }
                    });

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

                    // Determine inspection direction from latest record
                    const latestRecord = records[records.length - 1];
                    const isDecreaseFlow = String(latestRecord?.flow_direction || latestRecord?.inspection_data?.flow_direction || "")
                        .toUpperCase()
                        .includes("DECREASE");

                    // Raw surveyed coverage based on flow direction
                    const lastInspectedKp = maxKp;
                    let surveyedLengthKm = 0;
                    if (pipeTotalLengthKm > 0) {
                        if (isDecreaseFlow) {
                            // Reverse inspection: inspected distance = Total Length - Current KP
                            surveyedLengthKm = Math.max(0, pipeTotalLengthKm - lastInspectedKp);
                        } else {
                            // Forward inspection: inspected distance = Current KP
                            surveyedLengthKm = Math.min(pipeTotalLengthKm, lastInspectedKp);
                        }
                    } else {
                        surveyedLengthKm = maxKp;
                    }

                    // Net Completed Length = Surveyed Length - Skipped Length
                    const netCompletedLengthKm = Math.max(0, surveyedLengthKm - totalSkippedKm);

                    // Overall Progress Percentage
                    const completionPct = pipeTotalLengthKm > 0
                        ? Math.min(100, Math.max(0, (netCompletedLengthKm / pipeTotalLengthKm) * 100))
                        : 0;

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
                    mode: r.rov_job_id ? "ROV" : "DIVE"
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
