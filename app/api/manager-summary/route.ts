import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/* ─────────────────────────────────────────────────────────────────────────────
   Manager Summary API
   Supports: scope = global | field | platform | jobpack
   Params : field_id, structure_id, jobpack_ids (comma-separated, 1-4)
   ────────────────────────────────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const { searchParams } = new URL(request.url);

        const scope = searchParams.get("scope") || "global";
        const fieldId = searchParams.get("field_id");
        const structureId = searchParams.get("structure_id");
        const jobpackIdsRaw = searchParams.get("jobpack_ids");
        const jobpackIds = jobpackIdsRaw ? jobpackIdsRaw.split(",").map(Number).filter(Boolean) : [];
        const sowReportNo = searchParams.get("sow_report_no");

        // ─── Fetch oil fields ────────────────────────────────────────────────
        const { data: allFields } = await (supabase as any)
            .from("u_lib_list")
            .select("lib_id, lib_desc")
            .eq("lib_code", "OILFIELD");
        const fieldMap = new Map((allFields || []).map((f: any) => [String(f.lib_id || ""), f.lib_desc]));

        // ─── Fetch all platforms to resolve names ────────────────────────────
        const { data: allPlatforms } = await (supabase as any)
            .from("platform")
            .select("plat_id, plat_name, pfield");
        const platformMap = new Map<string, any>((allPlatforms || []).map((p: any) => [String(p.plat_id || ""), p]));

        // ─── Determine which jobpacks to query ───────────────────────────────
        let jobpackFilter: number[] = [];

        if (scope === "jobpack" && jobpackIds.length > 0) {
            jobpackFilter = jobpackIds.slice(0, 4);
        } else if ((scope === "platform" || scope === "jobpack") && structureId) {
            // Efficient DB-level discovery
            const [sowRes, recRes] = await Promise.all([
                (supabase as any).from("u_sow").select("jobpack_id").eq("structure_id", structureId).limit(100),
                (supabase as any).from("insp_records").select("jobpack_id").eq("structure_id", structureId).limit(100)
            ]);

            if (sowRes.error) console.error("[ManagerSummary] SOW discovery error:", sowRes.error);
            if (recRes.error) console.error("[ManagerSummary] Records discovery error:", recRes.error);

            const ids = new Set([
                ...(sowRes.data || []).map((j: any) => j.jobpack_id),
                ...(recRes.data || []).map((j: any) => j.jobpack_id)
            ]);
            jobpackFilter = Array.from(ids).filter(Boolean).map(Number);

            // Fallback: If no jobpacks found via SOW/Records, check recent jobpack metadata
            if (jobpackFilter.length === 0) {
                const targetPlatform = platformMap.get(String(structureId));
                const targetTitle = targetPlatform?.plat_name;

                const { data: recentJp } = await (supabase as any)
                    .from("jobpack")
                    .select("id, metadata")
                    .order("id", { ascending: false })
                    .limit(200);
                
                const filtered = (recentJp || []).filter((jp: any) => {
                    const structs: any[] = [];
                    const strMeta = jp.metadata?.structures;
                    if (Array.isArray(strMeta)) structs.push(...strMeta);
                    else if (strMeta) {
                        if (Array.isArray(strMeta.cs)) structs.push(...strMeta.cs);
                        if (Array.isArray(strMeta.pl)) structs.push(...strMeta.pl);
                    }
                    return structs.some((s: any) => 
                        String(s.id) === String(structureId) || 
                        String(s.plat_id) === String(structureId) ||
                        (targetTitle && String(s.title || s.name || "").toUpperCase() === targetTitle.toUpperCase())
                    );
                });
                jobpackFilter = filtered.map((jp: any) => jp.id);
            }
        } else if (scope === "field" && fieldId) {
            // Platforms in field -> Jobpacks
            const { data: platforms } = await (supabase as any)
                .from("platform")
                .select("plat_id")
                .eq("pfield", fieldId);
            const platIds = (platforms || []).map((p: any) => p.plat_id);
            
            if (platIds.length > 0) {
                const [sowRes, recRes] = await Promise.all([
                    (supabase as any).from("u_sow").select("jobpack_id").in("structure_id", platIds).limit(200),
                    (supabase as any).from("insp_records").select("jobpack_id").in("structure_id", platIds).limit(200)
                ]);
                const ids = new Set([
                    ...(sowRes.data || []).map((j: any) => j.jobpack_id),
                    ...(recRes.data || []).map((j: any) => j.jobpack_id)
                ]);
                jobpackFilter = Array.from(ids).filter(Boolean).map(Number);

                // Fallback for Field scope metadata links
                if (jobpackFilter.length < 5) {
                    const { data: recentJp } = await (supabase as any)
                        .from("jobpack")
                        .select("id, metadata")
                        .order("id", { ascending: false })
                        .limit(100);
                    const filtered = (recentJp || []).filter((jp: any) => {
                        const structs: any[] = [];
                        const strMeta = jp.metadata?.structures;
                        if (Array.isArray(strMeta)) structs.push(...strMeta);
                        else if (strMeta) {
                            if (Array.isArray(strMeta.cs)) structs.push(...strMeta.cs);
                            if (Array.isArray(strMeta.pl)) structs.push(...strMeta.pl);
                        }
                        return structs.some((s: any) => platIds.includes(Number(s.id || s.plat_id)));
                    });
                    const fallbackIds = filtered.map((jp: any) => jp.id);
                    jobpackFilter = Array.from(new Set([...jobpackFilter, ...fallbackIds]));
                }
            }
        } else {
            // Global — top recent jobpacks
            const { data: allJp } = await (supabase as any)
                .from("jobpack")
                .select("id")
                .order("id", { ascending: false })
                .limit(40);
            jobpackFilter = (allJp || []).map((jp: any) => jp.id);
        }

        // ─── Fetch jobpack details ───────────────────────────────────────────
        let jobpacks: any[] = [];
        let fieldPlatIds: number[] = [];
        if (scope === "field" && fieldId) {
            const { data: platforms } = await (supabase as any)
                .from("platform")
                .select("plat_id")
                .eq("pfield", fieldId);
            fieldPlatIds = (platforms || []).map((p: any) => p.plat_id);
        }

        if (jobpackFilter.length > 0) {
            const { data: jpData } = await (supabase as any)
                .from("jobpack")
                .select("id, name, status, metadata, created_at")
                .in("id", jobpackFilter.slice(0, 50)) // Increase to 50 for better aggregation
                .order("id", { ascending: false });
            jobpacks = jpData || [];
        }

        // ─── Fetch inspection summary for each jobpack ───────────────────────
        const summaries: any[] = [];

        // Increase processing limit for global/field aggregations
        const processLimit = (scope === "global" || scope === "field") ? 30 : 20;

        for (const jp of jobpacks.slice(0, processLimit)) {
            const meta = jp.metadata || {};
            const structs: any[] = [];
            const strMeta = meta.structures;
            if (Array.isArray(strMeta)) structs.push(...strMeta);
            else if (strMeta) {
                if (Array.isArray(strMeta.cs)) structs.push(...strMeta.cs);
                if (Array.isArray(strMeta.pl)) structs.push(...strMeta.pl);
            }
            if (structs.length === 0) continue;

            const relevantStructs = structs.filter(s => {
                const sid = s.id || s.plat_id || s.str_id;
                if (scope === "global") return true;
                if (scope === "field") {
                    if (!sid || isNaN(Number(sid))) return false;
                    return fieldPlatIds.includes(Number(sid));
                }
                if (structureId) return String(sid) === String(structureId) || String(s.title) === String(structureId);
                return true;
            });

            if (relevantStructs.length === 0) continue;

            // Batch fetch all SOWs and records for all relevant structures in this jobpack
            const structIds = relevantStructs.map(s => s.id || s.plat_id || s.str_id).filter(Boolean);
            
            const { data: allSowData, error: sowErr } = await (supabase as any)
                .from("u_sow")
                .select("id, report_numbers, structure_id")
                .eq("jobpack_id", jp.id)
                .in("structure_id", structIds);
            if (sowErr) console.error(`[ManagerSummary] JP ${jp.id} SOW error:`, sowErr);

            const { data: allRecordsData, error: recErr } = await (supabase as any)
                .from("insp_records")
                .select(`
                    insp_id, status, has_anomaly, inspection_type_code, inspection_data,
                    component_type, component_id, dive_job_id, rov_job_id, structure_id, sow_report_no,
                    structure_components:component_id!left(q_id, code, metadata),
                    inspection_type:inspection_type_id!left(id, code, name),
                    insp_anomalies(anomaly_id, status, defect_type_code, defect_category_code, priority_code, record_category)
                `)
                .eq("jobpack_id", jp.id)
                .in("structure_id", structIds);
            if (recErr) console.error(`[ManagerSummary] JP ${jp.id} records error:`, recErr);

            for (const targetStruct of relevantStructs) {
                const structId = targetStruct?.id || targetStruct?.plat_id || targetStruct?.str_id;
                const sowReportNos: string[] = [];
                let sowIds: number[] = [];

                // Filter SOW data for this structure
                const structSow = (allSowData || []).filter((s: any) => String(s.structure_id) === String(structId));
                structSow.forEach((s: any) => {
                    sowIds.push(s.id);
                    const rns = s.report_numbers;
                    if (Array.isArray(rns)) {
                        rns.forEach((r: any) => {
                            const num = r.number || r.report_no || r;
                            if (num && typeof num === "string") sowReportNos.push(num);
                        });
                    }
                });

                // Filter inspection records for this structure
                let recs = (allRecordsData || []).filter((r: any) => String(r.structure_id) === String(structId));

                if (sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null") {
                    recs = recs.filter((r: any) => r.sow_report_no === sowReportNo);
                }

            // ── Compute summary stats ──
            const totalRecords = recs.length;
            const completedRecords = recs.filter((r: any) => r.status === "COMPLETED" && !r.has_anomaly).length;
            const incompleteRecords = recs.filter((r: any) => (r.status || "").toUpperCase() === "INCOMPLETE").length;

            // Anomalies
            const VALID_PRIORITY = (p: string | null | undefined): boolean => {
                if (!p) return false;
                const up = p.trim().toUpperCase();
                return up !== "" && up !== "NONE" && up !== "UNKNOWN" && up !== "N/A";
            };

            const anomalyRecs = recs.filter((r: any) => {
                if (!r.has_anomaly) return false;
                const ms = (r.inspection_data?._meta_status || "").toLowerCase();
                return ms !== "finding";
            });
            const findingRecs = recs.filter((r: any) => {
                if (!r.has_anomaly) return false;
                const ms = (r.inspection_data?._meta_status || "").toLowerCase();
                return ms === "finding";
            });

            const byPriority: Record<string, number> = {};
            const byDefectType: Record<string, number> = {};
            let anomalyValidTotal = 0;
            let rectifiedCount = 0;

            anomalyRecs.forEach((r: any) => {
                const a = r.insp_anomalies?.[0];
                const rawP = a ? (a.priority_code || "") : (r.inspection_data?.priority || "");
                if (!VALID_PRIORITY(rawP)) return;
                anomalyValidTotal++;
                if (a?.status === "CLOSED") rectifiedCount++;
                const p = rawP.trim().toUpperCase();
                byPriority[p] = (byPriority[p] || 0) + 1;

                const dt = (a?.defect_type_code || a?.defect_category_code || r.inspection_data?.defectCode || "").trim();
                if (dt && dt !== "UNKNOWN" && dt !== "N/A") {
                    byDefectType[dt] = (byDefectType[dt] || 0) + 1;
                }
            });

            let findingValidTotal = 0;
            const findingByPriority: Record<string, number> = {};
            findingRecs.forEach((r: any) => {
                const a = r.insp_anomalies?.[0];
                const rawP = a ? (a.priority_code || "") : (r.inspection_data?.priority || "");
                if (!VALID_PRIORITY(rawP)) return;
                findingValidTotal++;
                const p = rawP.trim().toUpperCase();
                findingByPriority[p] = (findingByPriority[p] || 0) + 1;
            });

            // CP readings
            let cpCount = 0, cpMin: number | null = null, cpMax: number | null = null, cpSum = 0;
            recs.forEach((r: any) => {
                const d = r.inspection_data || {};
                const v = parseFloat(d.cp_rdg ?? d.cp_reading_mv ?? "");
                if (!isNaN(v) && isFinite(v)) {
                    cpCount++;
                    cpSum += v;
                    if (cpMin === null || v < cpMin) cpMin = v;
                    if (cpMax === null || v > cpMax) cpMax = v;
                }
                const adds: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : [];
                adds.forEach((a: any) => {
                    const av = parseFloat(a.reading ?? a.cp_rdg ?? "");
                    if (!isNaN(av) && isFinite(av)) {
                        cpCount++;
                        cpSum += av;
                        if (cpMin === null || av < cpMin) cpMin = av;
                        if (cpMax === null || av > cpMax) cpMax = av;
                    }
                });
            });

            // Anode
            const anodeRecs = recs.filter((r: any) => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                const ct = (r.component_type || r.structure_components?.code || "").toUpperCase();
                return (code === "RGVI" || code === "GVI") && (ct === "AN" || ct === "ANODE" || ct.startsWith("AN"));
            });
            const depletionBuckets: Record<string, number> = { "0–25%": 0, "25–50%": 0, "50–75%": 0, "75–100%": 0 };
            anodeRecs.forEach((r: any) => {
                const d = r.inspection_data || {};
                const raw = d.anode_depletion || d.anode_depletion_percent;
                if (raw === undefined || raw === null || raw === "") return;
                if (typeof raw === "number") {
                    if (raw <= 25) depletionBuckets["0–25%"]++;
                    else if (raw <= 50) depletionBuckets["25–50%"]++;
                    else if (raw <= 75) depletionBuckets["50–75%"]++;
                    else depletionBuckets["75–100%"]++;
                } else {
                    const s = String(raw).toLowerCase().replace(/\s+/g, "");
                    if (s.includes("0-25") || s.includes("0–25")) depletionBuckets["0–25%"]++;
                    else if (s.includes("25-50") || s.includes("25–50")) depletionBuckets["25–50%"]++;
                    else if (s.includes("50-75") || s.includes("50–75")) depletionBuckets["50–75%"]++;
                    else if (s.includes("75-100") || s.includes("75–100")) depletionBuckets["75–100%"]++;
                }
            });

            // FMD
            const fmdRecs = recs.filter((r: any) => {
                const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                return code === "RFMD" || code === "FMD";
            });
            const fmdConditions: Record<string, number> = { dry: 0, flooded: 0, grouted: 0, inconclusive: 0 };
            fmdRecs.forEach((r: any) => {
                const ms = (r.inspection_data?.member_status || "").toLowerCase().trim();
                if (ms === "dry") fmdConditions.dry++;
                else if (ms === "flooded") fmdConditions.flooded++;
                else if (ms === "grouted") fmdConditions.grouted++;
                else if (ms === "inconclusive") fmdConditions.inconclusive++;
            });

            // Inspection type breakdown
            const inspTypeBreakdown: Record<string, { name: string; count: number; anomaly: number; finding: number }> = {};
            recs.forEach((r: any) => {
                const code = r.inspection_type_code || r.inspection_type?.code || "UNKNOWN";
                const name = r.inspection_type?.name || code;
                if (!inspTypeBreakdown[code]) inspTypeBreakdown[code] = { name, count: 0, anomaly: 0, finding: 0 };
                inspTypeBreakdown[code].count++;
            });

            // SOW data
            let sowTotal = 0, sowCompleted = 0, sowIncomplete = 0, sowPending = 0;
            if (sowIds.length > 0) {
                let sowItemsQuery = (supabase as any)
                    .from("u_sow_items")
                    .select("status")
                    .in("sow_id", sowIds);
                
                if (sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null") {
                    sowItemsQuery = sowItemsQuery.eq("report_number", sowReportNo);
                }

                const { data: sowItems } = await sowItemsQuery;
                const items = sowItems || [];
                sowTotal = items.length;
                sowCompleted = items.filter((i: any) => i.status === "completed").length;
                sowIncomplete = items.filter((i: any) => i.status === "incomplete").length;
                sowPending = items.filter((i: any) => i.status === "pending").length;
            }
            const sowCompletionPct = sowTotal > 0 ? Math.round(((sowCompleted + sowIncomplete) / sowTotal) * 100) : 0;

            // Structure info
            const pInfo = platformMap.get(String(structId || ""));
            summaries.push({
                jobpack_id: jp.id,
                jobpack_name: jp.name,
                jobpack_status: jp.status,
                created_at: jp.created_at,
                structure_id: structId,
                field_name: fieldMap.get(String(pInfo?.pfield || "")) || pInfo?.pfield || targetStruct?.fieldName || "Unknown",
                structure_name: pInfo?.plat_name || targetStruct?.title || "Unknown",
                sow_report_nos: sowReportNos,
                contractor: meta.contrac || "",
                vessel: meta.vessel || "",
                inspection_mode: meta.divetyp || "",
                date_start: meta.istart || "",
                date_end: meta.iend || "",
                sow: {
                    total: sowTotal, completed: sowCompleted, incomplete: sowIncomplete,
                    pending: sowPending, completionPct: sowCompletionPct,
                },
                records: {
                    total: totalRecords, completed: completedRecords, incomplete: incompleteRecords,
                    inspTypeBreakdown,
                },
                anomalies: {
                    total: anomalyValidTotal, rectified: rectifiedCount,
                    open: anomalyValidTotal - rectifiedCount,
                    byPriority, byDefectType,
                },
                findings: { total: findingValidTotal, byPriority: findingByPriority },
                cp: {
                    count: cpCount, min: cpMin, max: cpMax,
                    avg: cpCount > 0 ? Math.round((cpSum / cpCount) * 100) / 100 : null,
                },
                anode: {
                    total: anodeRecs.length, depletionBuckets,
                    avgDepletion: anodeRecs.length > 0
                        ? Math.round(
                            ((depletionBuckets["0–25%"] * 12.5) + (depletionBuckets["25–50%"] * 37.5)
                            + (depletionBuckets["50–75%"] * 62.5) + (depletionBuckets["75–100%"] * 87.5))
                            / anodeRecs.length
                        ) : null,
                },
                fmd: { total: fmdRecs.length, conditions: fmdConditions },
            });
        }
    }

        // ─── Compute predictions (cross-jobpack for same structure) ──────────
        const predictions = computePredictions(summaries);

        // ─── Build context ───────────────────────────────────────────────────
        const context: any = { scope };

        if (scope === "global") {
            // Build field-level aggregation
            const fieldAgg: any[] = [];
            const fieldIds = new Set(summaries.map(s => s.field_name));
            fieldIds.forEach(fn => {
                const fieldSummaries = summaries.filter(s => s.field_name === fn);
                fieldAgg.push({
                    field_name: fn,
                    jobpack_count: fieldSummaries.length,
                    total_anomalies: fieldSummaries.reduce((a, s) => a + s.anomalies.total, 0),
                    total_inspections: fieldSummaries.reduce((a, s) => a + s.records.total, 0),
                    platforms: Array.from(new Set(fieldSummaries.map(s => s.structure_name))),
                });
            });
            context.fields = fieldAgg;
        }

        if (scope === "field" && fieldId) {
            context.field = { id: fieldId, name: fieldMap.get(fieldId) || fieldId };
            const platformNames = Array.from(new Set(summaries.map(s => s.structure_name)));
            context.platforms = platformNames.map(pn => ({
                name: pn,
                jobpack_count: summaries.filter(s => s.structure_name === pn).length,
            }));
        }

        return NextResponse.json({ data: { context, summaries, predictions } });
    } catch (error: any) {
        console.error("[ManagerSummary] Fatal Error:", error);
        return NextResponse.json({ 
            error: error.message || "Internal server error",
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        }, { status: 500 });
    }
}

// ─── Prediction Engine ───────────────────────────────────────────────────────
function computePredictions(summaries: any[]) {
    if (summaries.length === 0) return null;

    // Group by structure for cross-campaign comparison
    const byStructure: Record<string, any[]> = {};
    summaries.forEach(s => {
        const key = s.structure_name || s.structure_id;
        if (!byStructure[key]) byStructure[key] = [];
        byStructure[key].push(s);
    });

    // ── Corrosion Risk per structure ──
    const corrosionRisk: any[] = [];
    Object.entries(byStructure).forEach(([name, jobs]) => {
        const latest = jobs[0];
        let score = 0;

        // Anomaly severity (max 30 pts)
        const p1 = latest.anomalies?.byPriority?.["P1"] || 0;
        const p2 = latest.anomalies?.byPriority?.["P2"] || 0;
        const totalAnom = latest.anomalies?.total || 0;
        score += Math.min(30, (p1 * 15) + (p2 * 8) + (totalAnom * 2));
        
        // CP health (max 25 pts) — closer to -800mV or above = higher risk
        if (latest.cp?.avg !== undefined && latest.cp?.avg !== null) {
            const cpVal = Math.abs(latest.cp.avg);
            if (cpVal < 800) score += 25;
            else if (cpVal < 850) score += 18;
            else if (cpVal < 900) score += 10;
            else if (cpVal < 950) score += 5;
        }

        // Anode depletion (max 25 pts)
        if (latest.anode?.avgDepletion !== undefined && latest.anode?.avgDepletion !== null) {
            score += Math.round(latest.anode.avgDepletion * 0.25);
        }

        // FMD flooded members (max 20 pts)
        const flooded = latest.fmd?.conditions?.flooded || 0;
        score += Math.min(20, flooded * 10);

        corrosionRisk.push({
            structure: name,
            score: Math.min(100, score),
            level: score >= 70 ? "CRITICAL" : score >= 45 ? "HIGH" : score >= 25 ? "MODERATE" : "LOW",
            factors: {
                anomaly_severity: Math.min(30, (p1 * 15) + (p2 * 8)),
                cp_health: latest.cp.avg,
                anode_depletion: latest.anode.avgDepletion,
                flooded_members: flooded,
            },
        });
    });

    // ── Anode Remaining Life ──
    const anodeLife: any[] = [];
    Object.entries(byStructure).forEach(([name, jobs]) => {
        if (jobs.length >= 2) {
            const current = jobs[0];
            const previous = jobs[1];
            const curDep = current.anode?.avgDepletion;
            const prevDep = previous.anode?.avgDepletion;
            if (curDep !== undefined && curDep !== null && prevDep !== undefined && prevDep !== null) {
                const depletionRate = curDep - prevDep;
                const yearsElapsed = Math.max(1, getYearsBetween(previous.date_start, current.date_start));
                const ratePerYear = depletionRate / yearsElapsed;
                const remaining = ratePerYear > 0 ? Math.round((100 - curDep) / ratePerYear) : 99;

                anodeLife.push({
                    structure: name,
                    current_depletion: curDep,
                    rate_per_year: Math.round(ratePerYear * 10) / 10,
                    estimated_years_remaining: Math.max(0, remaining),
                    alert: remaining < 5,
                });
            }
        }
    });

    // ── CP Degradation Forecast ──
    const cpForecast: any[] = [];
    Object.entries(byStructure).forEach(([name, jobs]) => {
        const cpPoints = jobs.filter(j => j.cp?.avg !== undefined && j.cp?.avg !== null).map(j => ({
            date: j.date_start, value: j.cp.avg,
        })).reverse();

        if (cpPoints.length >= 2) {
            const first = cpPoints[0];
            const last = cpPoints[cpPoints.length - 1];
            const years = getYearsBetween(first.date, last.date) || 1;
            const changePerYear = (last.value - first.value) / years;
            const threshold = -800;
            const yearsToThreshold = changePerYear > 0 ? Math.round((threshold - last.value) / changePerYear) : 99;

            cpForecast.push({
                structure: name,
                current_avg: last.value,
                trend_per_year: Math.round(changePerYear * 100) / 100,
                direction: changePerYear > 0 ? "DEGRADING" : "STABLE",
                years_to_threshold: Math.max(0, yearsToThreshold),
                alert: yearsToThreshold < 5 && changePerYear > 0,
                data_points: cpPoints,
            });
        }
    });

    // ── Anomaly Recurrence ──
    const recurrence: any[] = [];
    Object.entries(byStructure).forEach(([name, jobs]) => {
        if (jobs.length >= 2) {
            const campaignsWithAnomalies = jobs.filter(j => (j.anomalies?.total || 0) > 0).length;
            if (campaignsWithAnomalies >= 2) {
                recurrence.push({
                    structure: name,
                    campaigns_with_anomalies: campaignsWithAnomalies,
                    total_campaigns: jobs.length,
                    latest_anomaly_count: jobs[0].anomalies?.total || 0,
                    trend: (jobs[0].anomalies?.total || 0) > (jobs[1].anomalies?.total || 0) ? "INCREASING" : "DECREASING",
                    chronic: campaignsWithAnomalies === jobs.length,
                });
            }
        }
    });

    // ── Next Inspection Priority ──
    const priority: any[] = [];
    Object.entries(byStructure).forEach(([name, jobs]) => {
        const latest = jobs[0];
        let urgencyScore = 0;

        // Time since last inspection (max 25)
        const yearsSince = getYearsBetween(latest.date_end || latest.date_start, new Date().toISOString());
        urgencyScore += Math.min(25, yearsSince * 8);

        // Anomaly severity (max 30)
        const p1 = latest.anomalies?.byPriority?.["P1"] || 0;
        const p2 = latest.anomalies?.byPriority?.["P2"] || 0;
        urgencyScore += Math.min(30, p1 * 15 + p2 * 8);

        // CP trend (max 20)
        const cpf = cpForecast.find(c => c.structure === name);
        if (cpf && cpf.direction === "DEGRADING") urgencyScore += Math.min(20, 20 - cpf.years_to_threshold);

        // Anode life (max 15)
        const al = anodeLife.find(a => a.structure === name);
        if (al && al.alert) urgencyScore += 15;

        // Recurrence (max 10)
        const rec = recurrence.find(r => r.structure === name);
        if (rec?.chronic) urgencyScore += 10;

        priority.push({
            structure: name,
            urgency_score: Math.min(100, urgencyScore),
            classification: urgencyScore >= 60 ? "INSPECT FIRST" : urgencyScore >= 35 ? "MONITOR" : "LOW PRIORITY",
            years_since_last: Math.round(yearsSince * 10) / 10,
            last_inspection: latest.date_end || latest.date_start,
        });
    });

    // ── Structural Integrity Score (overall health) ──
    const integrityScores: any[] = [];
    Object.entries(byStructure).forEach(([name, jobs]) => {
        const latest = jobs[0];
        let healthScore = 100;

        // Deduct for anomalies
        const totalAnom = latest.anomalies?.total || 0;
        healthScore -= Math.min(25, totalAnom * 3);
        // Deduct for P1/P2
        const p1 = latest.anomalies?.byPriority?.["P1"] || 0;
        const p2 = latest.anomalies?.byPriority?.["P2"] || 0;
        healthScore -= Math.min(20, p1 * 10);
        healthScore -= Math.min(10, p2 * 5);
        // Deduct for poor CP
        const cpAvg = latest.cp?.avg;
        if (cpAvg !== undefined && cpAvg !== null && Math.abs(cpAvg) < 850) healthScore -= 15;
        // Deduct for high anode depletion
        const anDep = latest.anode?.avgDepletion;
        if (anDep !== undefined && anDep !== null && anDep > 60) healthScore -= 10;
        // Deduct for flooded members
        const flooded = latest.fmd?.conditions?.flooded || 0;
        healthScore -= Math.min(15, flooded * 8);
        // Deduct for low SOW completion
        const sowPct = latest.sow?.completionPct || 0;
        if (sowPct < 50) healthScore -= 5;

        integrityScores.push({
            structure: name,
            score: Math.max(0, healthScore),
            grade: healthScore >= 85 ? "A" : healthScore >= 70 ? "B" : healthScore >= 50 ? "C" : healthScore >= 30 ? "D" : "F",
            sow_completion: latest.sow.completionPct,
        });
    });

    return {
        corrosion_risk: corrosionRisk.sort((a, b) => b.score - a.score),
        anode_life: anodeLife.sort((a, b) => a.estimated_years_remaining - b.estimated_years_remaining),
        cp_forecast: cpForecast,
        anomaly_recurrence: recurrence,
        inspection_priority: priority.sort((a, b) => b.urgency_score - a.urgency_score),
        integrity_scores: integrityScores.sort((a, b) => a.score - b.score),
    };
}

function getYearsBetween(d1: string, d2: string): number {
    try {
        const date1 = new Date(d1);
        const date2 = new Date(d2);
        return Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    } catch {
        return 1;
    }
}
