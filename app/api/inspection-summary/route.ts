import { NextRequest, NextResponse } from "next/server";
// Last Updated: 2026-05-11T18:01:00
import { createClient } from "@/utils/supabase/server";
import { formatInspectionTypeName } from "@/utils/inspection-utils";

const ATTACHMENT_GROUPS: Record<string, string[]> = {
    "Riser":        ["RS", "RIS", "RISER"],
    "Conductor":    ["CD", "COND", "CONDUCTOR"],
    "Caisson":      ["CA", "CAIS", "CAISSON"],
    "Riser Guard":  ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD"],
    "Boat Landing": ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD"],
};

export async function GET(request: NextRequest) {
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

        if (!sowId && !structureId && !jobpackId) {
            return NextResponse.json({ error: "sow_id, structure_id, or jobpack_id required" }, { status: 400 });
        }

        // ─── 1. RESOLVE SOW ID ────────────────────────────────────────────────
        let resolvedSowId = sowId;
        const jpNum = parseInt(String(jobpackId));
        const strNum = parseInt(String(structureId));

        console.log(`[Summary API] sowId=${sowId}, jp=${jpNum}, str=${strNum}`);

        if (!resolvedSowId && !isNaN(jpNum) && !isNaN(strNum)) {
            const { data: sowRec } = await (supabase as any)
                .from("u_sow")
                .select("id")
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
                    component_type, 
                    report_number, 
                    structure_components:component_id(
                        id, q_id, code, metadata
                    )
                `)
                .eq("sow_id", Number(resolvedSowId));
            
            itemsErr = err;
            if (itemsErr) {
                console.error("[Summary API] SOW Items fetch error:", itemsErr);
            }
            allSowItems = itemsData || [];
        }

        const sowItems = allSowItems;

        const totalSow = sowItems.length;
        const completedSow = sowItems.filter((i: any) => i.status === "completed").length;
        const incompleteSow = sowItems.filter((i: any) => i.status === "incomplete").length;
        const pendingSow = sowItems.filter((i: any) => i.status === "pending").length;

        const completionPct = totalSow > 0 ? Math.round(((completedSow + incompleteSow) / totalSow) * 100) : 0;
        const completedPct = totalSow > 0 ? Math.round((completedSow / totalSow) * 100) : 0;
        const incompletePct = totalSow > 0 ? Math.round((incompleteSow / totalSow) * 100) : 0;
        const pendingPct = totalSow > 0 ? Math.round((pendingSow / totalSow) * 100) : 0;

        // ─── 3. INSPECTION RECORDS ─────────────────────────────────────────────
        let recQuery = (supabase as any)
            .from("insp_records")
            .select(`
                insp_id,
                status,
                has_anomaly,
                inspection_type_id,
                inspection_type_code,
                inspection_data,
                component_type,
                component_id,
                dive_job_id,
                rov_job_id,
                sow_report_no,
                structure_components:component_id!left(
                    id, q_id, code, metadata
                ),
                inspection_type:inspection_type_id!left(id, code, name),
                insp_anomalies(anomaly_id, status, defect_type_code, defect_category_code, priority_code, record_category)
            `);

        if (!isNaN(jpNum)) recQuery = recQuery.eq("jobpack_id", jpNum);
        if (!isNaN(strNum)) recQuery = recQuery.eq("structure_id", strNum);

        const { data: allRecordsData, error: recErr } = await recQuery;
        if (recErr) {
            console.error("[Summary] Records fetch error:", recErr);
            return NextResponse.json({ error: recErr.message }, { status: 500 });
        }

        const rawRecords: any[] = allRecordsData || [];
        
        // Determine if we should filter the overview by the current report
        const isReportSpecific = sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null" && sowReportNo !== "all";

        // Filter records by report locally if requested
        // Using loose matching (includes) to handle variations like "2026-01" vs "2026-01 MAJOR"
        const records = isReportSpecific
            ? rawRecords.filter((r: any) => {
                const recRep = String(r.sow_report_no || "").toLowerCase();
                const filterRep = String(sowReportNo).toLowerCase();
                return recRep === filterRep || recRep.includes(filterRep) || filterRep.includes(recRep);
              })
            : rawRecords;

        // ─── 3. INSPECTIONS BY MODE ────────────────────────────────────────────
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

        // ─── 6. SELECTED ANODE INSPECTION (SANI/RSANI) ────────────────────────
        const saniRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "SANI" || code === "RSANI";
        });
        const saniTotal = saniRecords.length;
        const saniRov = saniRecords.filter((r: any) => !!r.rov_job_id).length;
        const saniDive = saniRecords.filter((r: any) => !!r.dive_job_id && !r.rov_job_id).length;

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

            // --- Primary CP reading ---
            const primaryRaw = d.cp_rdg ?? d.cp_reading_mv ?? "";
            const primary = parseFloat(primaryRaw);
            if (!isNaN(primary) && isFinite(primary)) {
                cpPrimaryCount++;
                if (isRov)  cpPrimaryRov++;
                if (isDive) cpPrimaryDive++;
                trackCp(primary);
            }

            // --- Additional CP readings ---
            (Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : []).forEach((a: any) => {
                const addVal = parseFloat(a.reading ?? a.cp_rdg ?? "");
                if (!isNaN(addVal) && isFinite(addVal)) {
                    cpAdditionalCount++;
                    if (isRov)  cpAdditionalRov++;
                    if (isDive) cpAdditionalDive++;
                    trackCp(addVal);
                }
            });
        });

        // --- 8. MGI ANALYSIS ---
        const mgiRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "RMGI" || code === "MGROW" || code === "MGI";
        });
        const mgiThicknesses = mgiRecords.map(r => parseFloat(r.inspection_data?.avg_thickness || r.inspection_data?.thickness || '0')).filter(v => !isNaN(v) && v > 0);
        const mgiMax = mgiThicknesses.length > 0 ? Math.max(...mgiThicknesses) : 0;
        const mgiAvg = mgiThicknesses.length > 0 ? mgiThicknesses.reduce((a, b) => a + b, 0) / mgiThicknesses.length : 0;

        // --- 9. SCOUR ANALYSIS ---
        const scourRecords = rawRecords.filter((r: any) => {
            const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
            return code === "RSCOR" || code === "SCOUR";
        });
        const scourExposedCount = scourRecords.filter(r => r.inspection_data?.Exposed_pile === "Yes" || r.inspection_data?.Exposed_pile === true).length;
        const scourBurials = scourRecords.map(r => parseFloat(r.inspection_data?.Burial_percent || '0')).filter(v => !isNaN(v));
        const scourMinBurial = scourBurials.length > 0 ? Math.min(...scourBurials) : 100;

        // ─── 10. ANOMALIES ─────────────────────────────────────────────────────
        // Anomaly = has_anomaly=true AND _meta_status != "Finding"
        // Finding = has_anomaly=true AND _meta_status == "Finding"
        const anomalyRecords = rawRecords.filter((r: any) => {
            if (!r.has_anomaly) return false;
            const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
            return metaStatus !== "finding";
        });

        const findingRecords = rawRecords.filter((r: any) => {
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

            if (!VALID_PRIORITY(rawPriority)) return; // skip unknown/no-priority

            anomalyValidTotal++;
            if (anomaly?.status === "CLOSED") rectifiedCount++;

            const priority = rawPriority.trim().toUpperCase();
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

            if (!VALID_PRIORITY(rawPriority)) return; // skip unknown/no-priority

            findingValidTotal++;
            if (anomaly?.status === "CLOSED") findingRectifiedCount++;

            const priority = rawPriority.trim().toUpperCase();
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
            const comp = item.structure_components || item.component || {};
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

                // Must have at least one valid identifier (priority or defect type) to count
                if (hasPriority || hasDefect) {
                    if (isFinding) {
                        inspTypeBreakdown[code].finding++;
                    } else {
                        inspTypeBreakdown[code].anomaly++;
                    }
                }
            }
        });

        return NextResponse.json({
            data: {
                sow: { total: totalSow, completed: completedSow, incomplete: incompleteSow, pending: pendingSow, completionPct, completedPct, incompletePct, pendingPct },
                records: { 
                    total: rawRecords.length, 
                    completed: rawRecords.filter(r => r.status === 'COMPLETED').length, 
                    incomplete: rawRecords.filter(r => r.status === 'INCOMPLETE').length, 
                    anomaly: anomalyValidTotal, 
                    finding: findingValidTotal, 
                    rovCount: rovRecords.length, 
                    diveCount: diveRecords.length, 
                    hasBothModes, 
                    uniqueRovJobs, 
                    uniqueDiveJobs, 
                    inspTypeBreakdown 
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
                },
                anomalies: {
                    total: anomalyValidTotal,
                    rectified: rectifiedCount,
                    open: anomalyValidTotal - rectifiedCount,
                    byPriority: anomalyByPriority,
                    byDefectType: anomalyByDefectType,
                    items: anomalyRecords.map((r: any) => {
                        const anomaly = r.insp_anomalies?.[0];
                        return {
                            ref: anomaly?.anomaly_ref_no || `ID: ${r.insp_id}`,
                            description: anomaly?.defect_description || r.inspection_data?.observation || "N/A",
                            priority: anomaly?.priority_code || r.inspection_data?.priority || "N/A",
                            status: anomaly?.status || "OPEN",
                            rectification: anomaly?.follow_up_notes || "N/A"
                        };
                    })
                },
                findings: {
                    total: findingValidTotal,
                    rectified: findingRectifiedCount,
                    open: findingValidTotal - findingRectifiedCount,
                    byPriority: findingByPriority,
                    items: findingRecords.map((r: any) => {
                        const anomaly = r.insp_anomalies?.[0];
                        return {
                            ref: anomaly?.anomaly_ref_no || `ID: ${r.insp_id}`,
                            description: anomaly?.defect_description || r.inspection_data?.observation || "N/A",
                            priority: anomaly?.priority_code || r.inspection_data?.priority || "N/A",
                            status: anomaly?.status || "OPEN"
                        };
                    })
                },
                mgi: { total: mgiRecords.length, max: mgiMax, avg: mgiAvg },
                scour: { total: scourRecords.length, exposed: scourExposedCount, minBurial: scourMinBurial },
                attachmentGroups: attachmentGroupBreakdown,
                
                // Detailed Item Lists for Tables
                cp_items: rawRecords.filter(r => {
                    const d = r.inspection_data || {};
                    return (d.cp_rdg !== undefined || d.cp_reading_mv !== undefined);
                }).map(r => ({
                    component: r.structure_components?.code || r.component_type || "N/A",
                    reading: r.inspection_data?.cp_rdg || r.inspection_data?.cp_reading_mv || "N/A",
                    status: r.status || "COMPLETED"
                })),

                fmd_items: fmdRecords.map(r => ({
                    component: r.structure_components?.code || r.component_type || "N/A",
                    status: r.inspection_data?.member_status || "N/A",
                    mode: r.rov_job_id ? "ROV" : "DIVE"
                })),

                mgi_items: mgiRecords.map(r => ({
                    component: r.structure_components?.code || r.component_type || "N/A",
                    thickness: r.inspection_data?.avg_thickness || r.inspection_data?.thickness || "0",
                    date: r.inspection_data?.date || new Date().toLocaleDateString("en-GB")
                })),
            },
        });
    } catch (error: any) {
        console.error("[Summary] Critical error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
