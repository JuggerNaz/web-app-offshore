import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const sowId = searchParams.get("sow_id");
        const structureId = searchParams.get("structure_id");
        const jobpackId = searchParams.get("jobpack_id");
        const sowReportNo = searchParams.get("sow_report_no");

        if (!sowId && !structureId) {
            return NextResponse.json({ error: "sow_id or structure_id required" }, { status: 400 });
        }

        // ─── 1. SOW COMPLETION ─────────────────────────────────────────────────
        // Scope: sow_id already ties to a unique jobpack + structure.
        // Additionally filter by report_number (= sowReportNo) so progress only counts
        // items belonging to the active report within this SOW.
        let sowItems: any[] = [];

        if (sowId) {
            let sowQuery = (supabase as any)
                .from("u_sow_items")
                .select("status")
                .eq("sow_id", sowId);

            // Filter by report number when provided — this scopes to the specific
            // jobpack + structure + SOW report combination shown in the workspace
            if (sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null") {
                sowQuery = sowQuery.eq("report_number", sowReportNo);
            }

            const { data: itemsData } = await sowQuery;
            sowItems = itemsData || [];
        }

        const totalSow = sowItems.length;
        const completedSow = sowItems.filter((i: any) => i.status === "completed").length;
        const incompleteSow = sowItems.filter((i: any) => i.status === "incomplete").length;
        const pendingSow = sowItems.filter((i: any) => i.status === "pending").length;

        const completionPct = totalSow > 0 ? Math.round(((completedSow + incompleteSow) / totalSow) * 100) : 0;
        const completedPct = totalSow > 0 ? Math.round((completedSow / totalSow) * 100) : 0;
        const incompletePct = totalSow > 0 ? Math.round((incompleteSow / totalSow) * 100) : 0;
        const pendingPct = totalSow > 0 ? Math.round((pendingSow / totalSow) * 100) : 0;

        // ─── 2. INSPECTION RECORDS ─────────────────────────────────────────────
        // Scope: must match BOTH jobpack_id AND sow_report_no when both are provided
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
                structure_components:component_id!left(q_id, code, metadata),
                inspection_type:inspection_type_id!left(id, code, name),
                insp_anomalies(anomaly_id, status, defect_type_code, defect_category_code, priority_code, record_category)
            `);

        if (structureId) recQuery = recQuery.eq("structure_id", Number(structureId));
        // Both jobpack_id AND sow_report_no must match for accurate scoping
        if (jobpackId && jobpackId !== "null") recQuery = recQuery.eq("jobpack_id", Number(jobpackId));
        if (sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null") {
            recQuery = recQuery.eq("sow_report_no", sowReportNo);
        }

        const { data: allRecords, error: recErr } = await recQuery;
        if (recErr) {
            console.error("[Summary] Records fetch error:", recErr);
            return NextResponse.json({ error: recErr.message }, { status: 500 });
        }

        const records: any[] = allRecords || [];

        // ─── 3. INSPECTIONS BY MODE ────────────────────────────────────────────
        const rovRecords = records.filter((r: any) => !!r.rov_job_id);
        const diveRecords = records.filter((r: any) => !!r.dive_job_id && !r.rov_job_id);
        const hasBothModes = rovRecords.length > 0 && diveRecords.length > 0;

        // ─── 4. FMD ANALYSIS ──────────────────────────────────────────────────
        // Field: inspection_data.member_status
        // Values (from inspection-types.json): "Flooded" | "Dry" | "Grouted" | "Inconclusive"
        const fmdRecords = records.filter((r: any) => {
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
        const anodeGviRecords = records.filter((r: any) => {
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
        const saniRecords = records.filter((r: any) => {
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

        records.forEach((r: any) => {
            const d = r.inspection_data || {};
            const isRov  = !!r.rov_job_id;
            const isDive = !!r.dive_job_id && !r.rov_job_id;

            // ── Primary CP reading ─────────────────────────────────────────────
            // Shared field 'cp_rdg' (used by RGVI, RRISI, RSZCI, RCOND, RCASN, RSWNI, RSANI)
            // Dedicated field 'cp_reading_mv' (used by CP inspection type)
            const primaryRaw = d.cp_rdg ?? d.cp_reading_mv ?? "";
            const primary = parseFloat(primaryRaw);
            if (!isNaN(primary) && isFinite(primary)) {
                cpPrimaryCount++;
                if (isRov)  cpPrimaryRov++;
                if (isDive) cpPrimaryDive++;
                trackCp(primary);
            }

            // ── Additional CP readings (repeater array: [{reading, location}]) ──
            const additionals: any[] = Array.isArray(d.cp_rdg_additional)
                ? d.cp_rdg_additional
                : [];

            additionals.forEach((a: any) => {
                const addVal = parseFloat(a.reading ?? a.cp_rdg ?? "");
                if (!isNaN(addVal) && isFinite(addVal)) {
                    cpAdditionalCount++;
                    if (isRov)  cpAdditionalRov++;
                    if (isDive) cpAdditionalDive++;
                    trackCp(addVal);
                }
            });
        });

        // ─── 8. ANOMALIES ─────────────────────────────────────────────────────
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

        // ─── 9. ATTACHMENT GROUPS ─────────────────────────────────────────────
        // Count unique components (by component_id) per attachment group.
        // A component inspected with 4 different inspection types still counts as 1.
        const ATTACHMENT_GROUPS: Record<string, string[]> = {
            "Riser":        ["RS", "RIS", "RISER"],
            "Conductor":    ["CD", "COND", "CONDUCTOR"],
            "Caisson":      ["CA", "CAIS", "CAISSON"],
            "Riser Guard":  ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD"],
            "Boat Landing": ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD"],
        };

        const attachmentGroupCounts: Record<string, number> = {
            "Riser": 0, "Conductor": 0, "Caisson": 0, "Riser Guard": 0, "Boat Landing": 0,
        };

        // Track seen component_ids per group to avoid double-counting
        const seenComponentIds: Record<string, Set<number>> = {
            "Riser": new Set(), "Conductor": new Set(), "Caisson": new Set(),
            "Riser Guard": new Set(), "Boat Landing": new Set(),
        };

        records.forEach((r: any) => {
            const componentId = r.component_id;
            if (!componentId) return; // skip records without a component

            const code = (
                r.component_type ||
                r.structure_components?.code ||
                ""
            ).toUpperCase();

            for (const [group, aliases] of Object.entries(ATTACHMENT_GROUPS)) {
                if (aliases.some(a => code.startsWith(a) || code === a)) {
                    // Only count this component once per group
                    if (!seenComponentIds[group].has(componentId)) {
                        seenComponentIds[group].add(componentId);
                        attachmentGroupCounts[group]++;
                    }
                    break;
                }
            }
        });

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

        const inspTypeBreakdown: Record<string, { name: string; count: number; rov: number; dive: number }> = {};
        records.forEach((r: any) => {
            const code = r.inspection_type_code || r.inspection_type?.code || "UNKNOWN";
            const name = r.inspection_type?.name || code;
            if (!inspTypeBreakdown[code]) {
                inspTypeBreakdown[code] = { name, count: 0, rov: 0, dive: 0 };
            }
            inspTypeBreakdown[code].count++;
            if (r.rov_job_id) inspTypeBreakdown[code].rov++;
            if (r.dive_job_id && !r.rov_job_id) inspTypeBreakdown[code].dive++;
        });

        return NextResponse.json({
            data: {
                sow: { total: totalSow, completed: completedSow, incomplete: incompleteSow, pending: pendingSow, completionPct, completedPct, incompletePct, pendingPct },
                records: { total: totalRecords, completed: completedRecords, incomplete: incompleteRecords, anomaly: anomalyValidTotal, finding: findingValidTotal, rovCount: rovRecords.length, diveCount: diveRecords.length, hasBothModes, uniqueRovJobs, uniqueDiveJobs, inspTypeBreakdown },
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
                    // Grouped by priority (P1, P2, P3, etc.) — Unknown excluded
                    byPriority: anomalyByPriority,
                    // Also grouped by defect type
                    byDefectType: anomalyByDefectType,
                },
                findings: {
                    total: findingValidTotal,
                    rectified: findingRectifiedCount,
                    open: findingValidTotal - findingRectifiedCount,
                    byPriority: findingByPriority,
                },
                attachmentGroups: attachmentGroupCounts,
            },
        });
    } catch (error: any) {
        console.error("[Summary] Critical error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
