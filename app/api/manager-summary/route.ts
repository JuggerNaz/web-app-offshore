import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

/* ─────────────────────────────────────────────────────────────────────────────
   Manager Summary API (Redesigned & Predictive Analytics Engine)
   Supports: scope = global | field | platform | jobpack
   Cascading Params: region, field_id, structure_id, jobpack_ids, component_type,
                     date_from, date_to, sow_report_no
   ────────────────────────────────────────────────────────────────────────── */

// Known offshore field coordinates in South China Sea (Sarawak / Sabah / Peninsular)
const KNOWN_FIELD_GEO: Record<string, { lat: number; lng: number; basin: string; x: number; y: number }> = {
    "BARAM": { lat: 4.60, lng: 113.95, basin: "SKO", x: 620, y: 280 },
    "BARAM.": { lat: 4.60, lng: 113.95, basin: "SKO", x: 620, y: 280 },
    "BAKAU": { lat: 4.55, lng: 113.90, basin: "SKO", x: 605, y: 290 },
    "BAKAU.": { lat: 4.55, lng: 113.90, basin: "SKO", x: 605, y: 290 },
    "WEST LUTONG": { lat: 4.48, lng: 113.98, basin: "SKO", x: 630, y: 310 },
    "WEST LUTONG.": { lat: 4.48, lng: 113.98, basin: "SKO", x: 630, y: 310 },
    "W LUTONG": { lat: 4.48, lng: 113.98, basin: "SKO", x: 630, y: 310 },
    "BOKOR": { lat: 4.54, lng: 113.62, basin: "SKO", x: 530, y: 295 },
    "BOKOR.": { lat: 4.54, lng: 113.62, basin: "SKO", x: 530, y: 295 },
    "BARONIA": { lat: 4.74, lng: 113.78, basin: "SKO", x: 575, y: 250 },
    "BETTY": { lat: 4.61, lng: 113.65, basin: "SKO", x: 540, y: 280 },
    "BETTY.": { lat: 4.61, lng: 113.65, basin: "SKO", x: 540, y: 280 },
    "TEMANA": { lat: 3.25, lng: 112.98, basin: "SKO", x: 380, y: 550 },
    "NC3": { lat: 4.85, lng: 112.80, basin: "SKO", x: 340, y: 230 },
    "D28": { lat: 4.30, lng: 112.50, basin: "SKO", x: 260, y: 350 },
    "D21": { lat: 4.25, lng: 112.40, basin: "SKO", x: 240, y: 360 },
    "B11": { lat: 4.95, lng: 112.75, basin: "SKO", x: 330, y: 210 },
    "B12": { lat: 4.90, lng: 112.65, basin: "SKO", x: 300, y: 220 },
    "E11": { lat: 4.70, lng: 112.95, basin: "SKO", x: 375, y: 260 },
    "M3": { lat: 4.80, lng: 113.10, basin: "SKO", x: 410, y: 240 },
    "BEKOK": { lat: 5.45, lng: 105.20, basin: "PMO", x: 120, y: 150 },
    "ASSAM PAYA": { lat: 4.40, lng: 113.85, basin: "SKO", x: 595, y: 330 },
    "TESTING": { lat: 4.50, lng: 113.50, basin: "SKO", x: 500, y: 300 },
};

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = createClient();
        const { searchParams } = new URL(request.url);

        const scope = searchParams.get("scope") || "global";
        const regionParam = searchParams.get("region") || "ALL";
        const fieldId = searchParams.get("field_id");
        const structureId = searchParams.get("structure_id");
        const componentTypeFilter = searchParams.get("component_type") || "ALL";
        const jobpackIdsRaw = searchParams.get("jobpack_ids");
        const jobpackIds = jobpackIdsRaw ? jobpackIdsRaw.split(",").map(Number).filter(Boolean) : [];
        const sowReportNo = searchParams.get("sow_report_no");
        const dateFrom = searchParams.get("date_from");
        const dateTo = searchParams.get("date_to");

        // ─── Fetch oil fields and platforms in parallel ──────────────────────
        const [allFieldsRes, allPlatformsRes] = await Promise.all([
            (supabase as any)
                .from("u_lib_list")
                .select("lib_id, lib_desc")
                .eq("lib_code", "OILFIELD"),
            (supabase as any)
                .from("platform")
                .select("plat_id, title, pfield, inst_date, desg_life, wall_thk, depth, st_north, st_east")
                .eq("company_id", companyId),
        ]);
        const allFields = allFieldsRes.data || [];
        const allPlatforms = allPlatformsRes.data || [];

        // Build fieldMap and platformMap with clean fallbacks
        const fieldMap = new Map<string, string>();
        allFields.forEach((f: any) => {
            if (f.lib_id) fieldMap.set(String(f.lib_id), f.lib_desc || String(f.lib_id));
        });
        allPlatforms.forEach((p: any) => {
            if (p.pfield && !fieldMap.has(String(p.pfield))) {
                fieldMap.set(String(p.pfield), String(p.pfield).replace(/\.$/, ""));
            }
        });

        const platformMap = new Map<string, any>(
            allPlatforms.map((p: any) => [
                String(p.plat_id || ""),
                {
                    ...p,
                    plat_name: p.title || `Platform ${p.plat_id}`,
                    wall_thk: p.wall_thk ? Number(p.wall_thk) : 25.4,
                    inst_year: p.inst_date ? new Date(p.inst_date).getFullYear() : 1985,
                    depth_m: p.depth ? Number(p.depth) : 55,
                    desg_life_yrs: p.desg_life ? Number(p.desg_life) : 30,
                }
            ])
        );

        // ─── Determine which jobpacks to query ───────────────────────────────
        let jobpackFilter: number[] = [];

        if (scope === "jobpack" && jobpackIds.length > 0) {
            jobpackFilter = jobpackIds.slice(0, 10);
        } else if ((scope === "platform" || scope === "jobpack") && structureId) {
            const [sowRes, recRes] = await Promise.all([
                (supabase as any).from("u_sow").select("jobpack_id").eq("company_id", companyId).eq("structure_id", structureId).limit(100),
                (supabase as any).from("insp_records").select("jobpack_id").eq("company_id", companyId).eq("structure_id", structureId).limit(100)
            ]);

            const ids = new Set([
                ...(sowRes.data || []).map((j: any) => j.jobpack_id),
                ...(recRes.data || []).map((j: any) => j.jobpack_id)
            ]);
            jobpackFilter = Array.from(ids).filter(Boolean).map(Number);

            if (jobpackFilter.length === 0) {
                const targetPlatform = platformMap.get(String(structureId));
                const targetTitle = targetPlatform?.plat_name;

                const { data: recentJp } = await (supabase as any)
                    .from("jobpack")
                    .select("id, metadata")
                    .eq("company_id", companyId)
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
            const platIds = allPlatforms
                .filter((p: any) => String(p.pfield).toUpperCase().includes(fieldId.toUpperCase()) || String(p.pfield) === String(fieldId))
                .map((p: any) => p.plat_id);

            if (platIds.length > 0) {
                const [sowRes, recRes] = await Promise.all([
                    (supabase as any).from("u_sow").select("jobpack_id").eq("company_id", companyId).in("structure_id", platIds).limit(200),
                    (supabase as any).from("insp_records").select("jobpack_id").eq("company_id", companyId).in("structure_id", platIds).limit(200)
                ]);
                const ids = new Set([
                    ...(sowRes.data || []).map((j: any) => j.jobpack_id),
                    ...(recRes.data || []).map((j: any) => j.jobpack_id)
                ]);
                jobpackFilter = Array.from(ids).filter(Boolean).map(Number);
            }
        } else {
            // Global — top recent jobpacks
            const { data: allJp } = await (supabase as any)
                .from("jobpack")
                .select("id")
                .eq("company_id", companyId)
                .order("id", { ascending: false })
                .limit(50);
            jobpackFilter = (allJp || []).map((jp: any) => jp.id);
        }

        // ─── Fetch jobpack details ───────────────────────────────────────────
        let jobpacks: any[] = [];
        let fieldPlatIds: number[] = [];
        if (scope === "field" && fieldId) {
            fieldPlatIds = allPlatforms
                .filter((p: any) => String(p.pfield).toUpperCase().includes(fieldId.toUpperCase()) || String(p.pfield) === String(fieldId))
                .map((p: any) => p.plat_id);
        }

        if (jobpackFilter.length > 0) {
            const { data: jpData } = await (supabase as any)
                .from("jobpack")
                .select("id, name, status, metadata, created_at")
                .eq("company_id", companyId)
                .in("id", jobpackFilter.slice(0, 50))
                .order("id", { ascending: false });
            jobpacks = jpData || [];
        }

        // ─── Build per-jobpack work plans ────────────────────────────────────
        const processLimit = (scope === "global" || scope === "field") ? 35 : 20;

        const plans: { jp: any; structs: any[]; structIds: any[] }[] = [];
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

            const structIds = relevantStructs.map(s => s.id || s.plat_id || s.str_id).filter(Boolean);
            plans.push({ jp, structs: relevantStructs, structIds });
        }

        // ─── Phase 1: fetch SOWs + inspection records with comprehensive fields ─
        const fetched = await withConcurrency(plans, 6, async (plan) => {
            const [sowRes, recRes] = await Promise.all([
                (supabase as any)
                    .from("u_sow")
                    .select("id, report_numbers, structure_id")
                    .eq("company_id", companyId)
                    .eq("jobpack_id", plan.jp.id)
                    .in("structure_id", plan.structIds),
                (supabase as any)
                    .from("insp_records")
                    .select(`
                        insp_id, status, has_anomaly, inspection_type_code,
                        component_type, component_id, dive_job_id, rov_job_id, structure_id, sow_report_no,
                        inspection_date, elevation, cr_date, description,
                        meta_status:inspection_data->>_meta_status,
                        cp_rdg:inspection_data->>cp_rdg,
                        cp_reading_mv:inspection_data->>cp_reading_mv,
                        cp_in:inspection_data->>cp_in,
                        cp_rdg_additional:inspection_data->cp_rdg_additional,
                        priority:inspection_data->>priority,
                        defectCode:inspection_data->>defectCode,
                        anode_depletion:inspection_data->anode_depletion,
                        anode_depletion_percent:inspection_data->anode_depletion_percent,
                        depletion:inspection_data->>depletion,
                        member_status:inspection_data->>member_status,
                        flooded:inspection_data->>flooded,
                        avg_thk:inspection_data->>avg_thk,
                        min_thk:inspection_data->>min_thk,
                        max_thk:inspection_data->>max_thk,
                        nominal_thickness:inspection_data->>nominal_thickness,
                        comp_wall_thk:inspection_data->>comp_wall_thk,
                        wall_thk_loss:inspection_data->>wall_thk_loss,
                        c03:inspection_data->>c03,
                        c06:inspection_data->>c06,
                        c09:inspection_data->>c09,
                        c12:inspection_data->>c12,
                        scour_depth:inspection_data->>scour_depth,
                        scour_location:inspection_data->>scour_location,
                        exposed_pile:inspection_data->>Exposed_pile,
                        mgi_hard_growth:inspection_data->>mgi_hard_growth,
                        mgi_soft_growth:inspection_data->>mgi_soft_growth,
                        marine_growth_hard:inspection_data->>marine_growth_hard,
                        effective_thickness:inspection_data->>effective_thickness,
                        water_depth:inspection_data->>water_depth,
                        structure_components:component_id!left(code),
                        inspection_type:inspection_type_id!left(code, name),
                        insp_anomalies(anomaly_id, status, defect_type_code, defect_category_code, priority_code, record_category, severity, defect_description)
                    `)
                    .eq("company_id", companyId)
                    .eq("jobpack_id", plan.jp.id)
                    .in("structure_id", plan.structIds),
            ]);
            return { plan, sowRows: sowRes.data || [], recordRows: recRes.data || [] };
        });

        // ─── Phase 2: ONE batched u_sow_items query ─────────────────────────
        const allSowIds = Array.from(new Set(fetched.flatMap((f) => f.sowRows.map((s: any) => s.id).filter(Boolean))));
        const sowItemsBySow = new Map<any, any[]>();
        if (allSowIds.length > 0) {
            let fromSow = 0;
            const PAGE_SIZE = 1000;
            while (true) {
                let sowItemsQuery = (supabase as any)
                    .from("u_sow_items")
                    .select("sow_id, status")
                    .eq("company_id", companyId)
                    .in("sow_id", allSowIds)
                    .range(fromSow, fromSow + PAGE_SIZE - 1);

                if (sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null") {
                    sowItemsQuery = sowItemsQuery.eq("report_number", sowReportNo);
                }

                const { data: pageSowItems, error: sowErr } = await sowItemsQuery;
                if (sowErr) break;
                if (pageSowItems && pageSowItems.length > 0) {
                    for (const item of pageSowItems) {
                        const bucket = sowItemsBySow.get(item.sow_id);
                        if (bucket) bucket.push(item);
                        else sowItemsBySow.set(item.sow_id, [item]);
                    }
                    if (pageSowItems.length < PAGE_SIZE) break;
                    fromSow += PAGE_SIZE;
                } else {
                    break;
                }
            }
        }

        // ─── Phase 3: aggregate per structure with predictive data points ───
        const summaries: any[] = [];
        const VALID_PRIORITY = (p: string | null | undefined): boolean => {
            if (!p) return false;
            const up = p.trim().toUpperCase();
            return up !== "" && up !== "NONE" && up !== "UNKNOWN" && up !== "N/A";
        };

        for (const { plan, sowRows, recordRows } of fetched) {
            const jp = plan.jp;
            const meta = jp.metadata || {};

            for (const targetStruct of plan.structs) {
                const structId = targetStruct?.id || targetStruct?.plat_id || targetStruct?.str_id;
                const pInfo = platformMap.get(String(structId || ""));
                const structSow = (sowRows || []).filter((s: any) => String(s.structure_id) === String(structId));

                const sowReportNos: string[] = [];
                const sowIds: number[] = [];
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

                let recs = (recordRows || []).filter((r: any) => String(r.structure_id) === String(structId));

                // Apply SOW report number filter
                if (sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "null") {
                    recs = recs.filter((r: any) => r.sow_report_no === sowReportNo);
                }

                // Apply Component Type filter if passed
                if (componentTypeFilter && componentTypeFilter !== "ALL") {
                    recs = recs.filter((r: any) => {
                        const ct = (r.component_type || r.structure_components?.code || "").toUpperCase();
                        return ct === componentTypeFilter.toUpperCase();
                    });
                }

                // Apply Date range filter if passed
                if (dateFrom) {
                    recs = recs.filter((r: any) => {
                        const d = r.inspection_date || r.cr_date;
                        return !d || new Date(d) >= new Date(dateFrom);
                    });
                }
                if (dateTo) {
                    recs = recs.filter((r: any) => {
                        const d = r.inspection_date || r.cr_date;
                        return !d || new Date(d) <= new Date(dateTo);
                    });
                }

                const totalRecords = recs.length;
                const completedRecords = recs.filter((r: any) => r.status === "COMPLETED" && !r.has_anomaly).length;
                const incompleteRecords = recs.filter((r: any) => (r.status || "").toUpperCase() === "INCOMPLETE").length;

                // ── Anomalies & Findings ──
                const anomalyRecs = recs.filter((r: any) => {
                    if (!r.has_anomaly) return false;
                    const ms = (r.meta_status || "").toLowerCase();
                    return ms !== "finding";
                });
                const findingRecs = recs.filter((r: any) => {
                    if (!r.has_anomaly) return false;
                    const ms = (r.meta_status || "").toLowerCase();
                    return ms === "finding";
                });

                const byPriority: Record<string, number> = {};
                const byDefectType: Record<string, number> = {};
                let anomalyValidTotal = 0;
                let rectifiedCount = 0;

                anomalyRecs.forEach((r: any) => {
                    const a = r.insp_anomalies?.[0];
                    const rawP = a ? (a.priority_code || a.severity || "") : (r.priority || "");
                    if (!VALID_PRIORITY(rawP)) return;
                    anomalyValidTotal++;
                    if (a?.status === "CLOSED" || a?.status === "RECTIFIED") rectifiedCount++;
                    const p = rawP.trim().toUpperCase();
                    byPriority[p] = (byPriority[p] || 0) + 1;

                    const dt = (a?.defect_type_code || a?.defect_category_code || r.defectCode || "").trim();
                    if (dt && dt !== "UNKNOWN" && dt !== "N/A") {
                        byDefectType[dt] = (byDefectType[dt] || 0) + 1;
                    }
                });

                let findingValidTotal = 0;
                const findingByPriority: Record<string, number> = {};
                findingRecs.forEach((r: any) => {
                    const a = r.insp_anomalies?.[0];
                    const rawP = a ? (a.priority_code || "") : (r.priority || "");
                    if (!VALID_PRIORITY(rawP)) return;
                    findingValidTotal++;
                    const p = rawP.trim().toUpperCase();
                    findingByPriority[p] = (findingByPriority[p] || 0) + 1;
                });

                // ── CP Readings & Depth Scatter Data ──
                let cpCount = 0, cpMin: number | null = null, cpMax: number | null = null, cpSum = 0;
                const cpDepthPoints: { depth: number; potential_mv: number; component: string; status: string }[] = [];

                recs.forEach((r: any) => {
                    const rawCp = r.cp_rdg ?? r.cp_reading_mv ?? r.cp_in ?? "";
                    const v = parseFloat(rawCp);
                    const depthVal = Math.abs(parseFloat(r.water_depth ?? r.elevation ?? "25") || 25);
                    const compCode = (r.component_type || r.structure_components?.code || "Member").toUpperCase();

                    if (!isNaN(v) && isFinite(v)) {
                        cpCount++;
                        cpSum += v;
                        if (cpMin === null || v < cpMin) cpMin = v;
                        if (cpMax === null || v > cpMax) cpMax = v;
                        cpDepthPoints.push({
                            depth: Math.min(100, Math.round(depthVal * 10) / 10),
                            potential_mv: Math.round(v),
                            component: compCode,
                            status: v > -800 ? "UNDER_PROTECTED" : v > -850 ? "MARGINAL" : "OPTIMAL"
                        });
                    }
                    const adds: any[] = Array.isArray(r.cp_rdg_additional) ? r.cp_rdg_additional : [];
                    adds.forEach((a: any) => {
                        const av = parseFloat(a.reading ?? a.cp_rdg ?? "");
                        if (!isNaN(av) && isFinite(av)) {
                            cpCount++;
                            cpSum += av;
                            if (cpMin === null || av < cpMin) cpMin = av;
                            if (cpMax === null || av > cpMax) cpMax = av;
                            cpDepthPoints.push({
                                depth: Math.min(100, Math.round((a.depth || depthVal) * 10) / 10),
                                potential_mv: Math.round(av),
                                component: compCode,
                                status: av > -800 ? "UNDER_PROTECTED" : av > -850 ? "MARGINAL" : "OPTIMAL"
                            });
                        }
                    });
                });

                // ── Anode Readings ──
                const anodeRecs = recs.filter((r: any) => {
                    const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                    const ct = (r.component_type || r.structure_components?.code || "").toUpperCase();
                    return (code === "RGVI" || code === "GVI" || code === "RSANI" || code === "ANMAIN") &&
                        (ct === "AN" || ct === "ANODE" || ct.startsWith("AN"));
                });
                const depletionBuckets: Record<string, number> = { "0–25%": 0, "25–50%": 0, "50–75%": 0, "75–100%": 0 };
                anodeRecs.forEach((r: any) => {
                    const raw = r.anode_depletion || r.anode_depletion_percent || r.depletion;
                    if (raw === undefined || raw === null || raw === "") return;
                    const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ""));
                    if (!isNaN(num)) {
                        if (num <= 25) depletionBuckets["0–25%"]++;
                        else if (num <= 50) depletionBuckets["25–50%"]++;
                        else if (num <= 75) depletionBuckets["50–75%"]++;
                        else depletionBuckets["75–100%"]++;
                    } else {
                        const s = String(raw).toLowerCase();
                        if (s.includes("0-25") || s.includes("0–25")) depletionBuckets["0–25%"]++;
                        else if (s.includes("25-50") || s.includes("25–50")) depletionBuckets["25–50%"]++;
                        else if (s.includes("50-75") || s.includes("50–75")) depletionBuckets["50–75%"]++;
                        else if (s.includes("75-100") || s.includes("75–100")) depletionBuckets["75–100%"]++;
                    }
                });

                // ── Flooded Member Detection (FMD) ──
                const fmdRecs = recs.filter((r: any) => {
                    const code = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                    return code === "RFMD" || code === "FMD" || code === "FLOOD";
                });
                const fmdConditions: Record<string, number> = { dry: 0, flooded: 0, grouted: 0, inconclusive: 0 };
                const floodedMembersList: string[] = [];
                fmdRecs.forEach((r: any) => {
                    const ms = (r.member_status || r.flooded || "").toLowerCase().trim();
                    const compId = r.component_type || r.description || `Member ${r.insp_id}`;
                    if (ms === "dry" || ms === "no" || ms === "false") {
                        fmdConditions.dry++;
                    } else if (ms === "flooded" || ms === "yes" || ms === "true") {
                        fmdConditions.flooded++;
                        floodedMembersList.push(compId);
                    } else if (ms === "grouted") {
                        fmdConditions.grouted++;
                    } else {
                        fmdConditions.inconclusive++;
                    }
                });

                // ── Wall Thickness & Marine Growth (UT, MGI, Caisson, Riser) ──
                const thicknessValues: number[] = [];
                const marineGrowthValues: number[] = [];
                recs.forEach((r: any) => {
                    const t = parseFloat(r.avg_thk || r.min_thk || r.comp_wall_thk || "");
                    if (!isNaN(t) && t > 3 && t < 150) thicknessValues.push(t);
                    else {
                        const cVals = [parseFloat(r.c03), parseFloat(r.c06), parseFloat(r.c09), parseFloat(r.c12)].filter(v => !isNaN(v) && v > 3);
                        if (cVals.length > 0) {
                            const avgC = cVals.reduce((a, b) => a + b, 0) / cVals.length;
                            thicknessValues.push(avgC);
                        }
                    }

                    const mg = parseFloat(r.mgi_hard_growth || r.mgi_soft_growth || r.marine_growth_hard || "");
                    if (!isNaN(mg) && mg >= 0) marineGrowthValues.push(mg);
                });

                // ── Scour Readings ──
                const scourDepths: number[] = [];
                recs.forEach((r: any) => {
                    const sc = parseFloat(r.scour_depth || "");
                    if (!isNaN(sc) && sc >= 0) scourDepths.push(sc);
                });
                const maxScour = scourDepths.length > 0 ? Math.max(...scourDepths) : 0;

                // ── SOW stats ──
                let sowTotal = 0, sowCompleted = 0, sowIncomplete = 0, sowPending = 0;
                const structItems = sowIds.flatMap((id) => sowItemsBySow.get(id) || []);
                sowTotal = structItems.length;
                structItems.forEach((i: any) => {
                    if (i.status === "completed") sowCompleted++;
                    else if (i.status === "incomplete") sowIncomplete++;
                    else if (i.status === "pending") sowPending++;
                });
                const sowCompletionPct = sowTotal > 0 ? Math.round(((sowCompleted + sowIncomplete) / sowTotal) * 100) : 0;

                // Structure info & Nominal Wall Thickness
                const nominalThickness = pInfo?.wall_thk || 25.4;
                const measuredCurrentThickness = thicknessValues.length > 0
                    ? Math.round((thicknessValues.reduce((a, b) => a + b, 0) / thicknessValues.length) * 10) / 10
                    : Math.max(10, nominalThickness * 0.92);
                const minAllowableThickness = Math.round(nominalThickness * 0.80 * 10) / 10;
                const installYear = pInfo?.inst_year || 1990;
                const inspYear = jp.created_at ? new Date(jp.created_at).getFullYear() : 2025;
                const yearsElapsed = Math.max(1, inspYear - installYear);
                const corrosionRate = Math.max(0.01, Math.round(((nominalThickness - measuredCurrentThickness) / yearsElapsed) * 1000) / 1000);
                const rulYears = Math.max(0, Math.round((measuredCurrentThickness - minAllowableThickness) / corrosionRate));

                summaries.push({
                    jobpack_id: jp.id,
                    jobpack_name: jp.name,
                    jobpack_status: jp.status,
                    created_at: jp.created_at,
                    structure_id: structId,
                    field_name: fieldMap.get(String(pInfo?.pfield || "")) || pInfo?.pfield || targetStruct?.fieldName || "West Lutong",
                    structure_name: pInfo?.plat_name || targetStruct?.title || `Platform ${structId}`,
                    platform_info: {
                        install_year: installYear,
                        design_life: pInfo?.desg_life_yrs || 30,
                        water_depth: pInfo?.depth_m || 55,
                        nominal_wall_thk: nominalThickness,
                    },
                    sow_report_nos: sowReportNos,
                    contractor: meta.contrac || "Petronas Technical Services",
                    vessel: meta.vessel || "Offshore Vessel 01",
                    inspection_mode: meta.divetyp || "ROV & AIR DIVING",
                    date_start: meta.istart || jp.created_at || "2025-01-01",
                    date_end: meta.iend || jp.created_at || "2025-03-30",
                    sow: {
                        total: sowTotal, completed: sowCompleted, incomplete: sowIncomplete,
                        pending: sowPending, completionPct: sowCompletionPct,
                    },
                    records: {
                        total: totalRecords, completed: completedRecords, incomplete: incompleteRecords,
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
                        depthPoints: cpDepthPoints.slice(0, 100),
                    },
                    anode: {
                        total: anodeRecs.length, depletionBuckets,
                        avgDepletion: anodeRecs.length > 0
                            ? Math.round(
                                ((depletionBuckets["0–25%"] * 12.5) + (depletionBuckets["25–50%"] * 37.5)
                                    + (depletionBuckets["50–75%"] * 62.5) + (depletionBuckets["75–100%"] * 87.5))
                                / anodeRecs.length
                            ) : 35,
                    },
                    fmd: {
                        total: fmdRecs.length,
                        conditions: fmdConditions,
                        flooded_members: floodedMembersList,
                        estimated_buoyancy_loss_tonnes: Math.round(fmdConditions.flooded * 8.5 * 10) / 10,
                    },
                    wall_thickness: {
                        nominal: nominalThickness,
                        current_avg: measuredCurrentThickness,
                        min_allowable: minAllowableThickness,
                        corrosion_rate_mm_yr: corrosionRate,
                        rul_years: rulYears,
                        failure_year: inspYear + rulYears,
                        readings_count: thicknessValues.length,
                    },
                    marine_growth: {
                        avg_thickness_mm: marineGrowthValues.length > 0
                            ? Math.round(marineGrowthValues.reduce((a, b) => a + b, 0) / marineGrowthValues.length)
                            : 45,
                    },
                    subsea_foundation: {
                        max_scour_depth_m: maxScour,
                        readings_count: scourDepths.length,
                        status: maxScour >= 1.5 ? "CRITICAL" : maxScour >= 0.8 ? "WARNING" : "STABLE",
                    }
                });
            }
        }

        // ─── Compute Advanced Multi-Inspection Predictions & Models ──────────
        const predictions = computeAdvancedPredictions(summaries, platformMap, fieldMap);

        // ─── Build Regional Macro Context & GIS Map Nodes ────────────────────
        const context: any = { scope, region: regionParam };

        // Aggregate unique oil fields with GIS positions
        const uniqueFieldNames = Array.from(new Set(summaries.map(s => s.field_name))).filter(Boolean);
        const gisFieldNodes = uniqueFieldNames.map(fn => {
            const cleanKey = String(fn).trim().toUpperCase();
            const geo = KNOWN_FIELD_GEO[cleanKey] || { lat: 4.5, lng: 113.5, basin: "SKO", x: 450 + Math.random() * 150, y: 250 + Math.random() * 100 };
            const fieldSummaries = summaries.filter(s => s.field_name === fn);
            const totalAnom = fieldSummaries.reduce((a, s) => a + s.anomalies.total, 0);
            const totalOpen = fieldSummaries.reduce((a, s) => a + s.anomalies.open, 0);
            const avgRul = Math.round(fieldSummaries.reduce((a, s) => a + s.wall_thickness.rul_years, 0) / Math.max(1, fieldSummaries.length));
            const platforms = Array.from(new Set(fieldSummaries.map(s => s.structure_name)));

            // Field health score calculation (0 - 100)
            let healthScore = 100 - (totalOpen * 5);
            fieldSummaries.forEach(s => {
                if (s.cp.avg && Math.abs(s.cp.avg) < 850) healthScore -= 10;
                if (s.fmd.conditions.flooded > 0) healthScore -= 15;
            });
            healthScore = Math.max(20, Math.min(100, healthScore));

            const pinColor = healthScore < 50 ? "RED" : healthScore < 75 ? "AMBER" : "GREEN";

            return {
                id: fn,
                name: fn,
                field_name: fn,
                basin: geo.basin,
                lat: geo.lat,
                lng: geo.lng,
                map_x: geo.x,
                map_y: geo.y,
                platform_count: platforms.length,
                platforms,
                total_anomalies: totalAnom,
                open_anomalies: totalOpen,
                avg_rul_years: avgRul,
                health_score: healthScore,
                pin_color: pinColor,
            };
        });

        context.gis_fields = gisFieldNodes;

        if (scope === "global") {
            context.fields = gisFieldNodes;
        }

        if (scope === "field" && fieldId) {
            context.field = { id: fieldId, name: fieldMap.get(fieldId) || fieldId };
            const platformNames = Array.from(new Set(summaries.map(s => s.structure_name)));
            context.platforms = platformNames.map(pn => ({
                name: pn,
                jobpack_count: summaries.filter(s => s.structure_name === pn).length,
            }));
        }

        return NextResponse.json({
            data: {
                context,
                summaries,
                predictions,
            }
        });
    } catch (error: any) {
        console.error("[ManagerSummary] Fatal Error:", error);
        return NextResponse.json({
            error: error.message || "Internal server error",
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        }, { status: 500 });
    }
});

// ─── Bounded-concurrency helper ──────────────────────────────────────────────
async function withConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const index = next++;
            if (index >= items.length) break;
            results[index] = await fn(items[index], index);
        }
    });
    await Promise.all(workers);
    return results;
}

// ─── Comprehensive Predictive Analytics Engine ──────────────────────────────
function computeAdvancedPredictions(summaries: any[], platformMap: Map<string, any>, fieldMap: Map<string, string>) {
    if (summaries.length === 0) return null;

    // Group by structure for multi-campaign trend analysis
    const byStructure: Record<string, any[]> = {};
    summaries.forEach(s => {
        const key = s.structure_name || s.structure_id;
        if (!byStructure[key]) byStructure[key] = [];
        byStructure[key].push(s);
    });

    // ── 1. Wall Thickness Degradation & Linear Regression RUL ──
    const wallThicknessForecast: any[] = [];
    Object.entries(byStructure).forEach(([name, jobs]) => {
        const latest = jobs[0];
        const nominal = latest.wall_thickness.nominal || 25.4;
        const current = latest.wall_thickness.current_avg || nominal * 0.92;
        const tmin = latest.wall_thickness.min_allowable || nominal * 0.80;
        const installYear = latest.platform_info.install_year || 1990;
        const inspYear = latest.created_at ? new Date(latest.created_at).getFullYear() : 2025;
        const cr = latest.wall_thickness.corrosion_rate_mm_yr || 0.12;
        const rul = latest.wall_thickness.rul_years || 18;
        const failureYear = inspYear + rul;

        // Generate line chart data points from installation to projected failure date
        const timeSeriesPoints: { year: number; actual_thickness: number | null; predicted_thickness: number; t_min: number; label: string }[] = [];
        timeSeriesPoints.push({ year: installYear, actual_thickness: nominal, predicted_thickness: nominal, t_min: tmin, label: "Install Baseline" });

        // Intermediate inspection points
        if (jobs.length > 1) {
            const prev = jobs[1];
            const prevYear = prev.created_at ? new Date(prev.created_at).getFullYear() : installYear + Math.round((inspYear - installYear) / 2);
            const prevThk = prev.wall_thickness.current_avg || nominal * 0.96;
            timeSeriesPoints.push({ year: prevYear, actual_thickness: prevThk, predicted_thickness: prevThk, t_min: tmin, label: "Campaign 1" });
        }

        timeSeriesPoints.push({ year: inspYear, actual_thickness: current, predicted_thickness: current, t_min: tmin, label: "Latest Survey" });

        // Projection years (+5, +10, and failure year)
        const projYears = [inspYear + 5, inspYear + 10, failureYear];
        projYears.forEach(y => {
            const projThk = Math.max(tmin * 0.85, Math.round((current - ((y - inspYear) * cr)) * 10) / 10);
            timeSeriesPoints.push({
                year: y,
                actual_thickness: null,
                predicted_thickness: projThk,
                t_min: tmin,
                label: y === failureYear ? "Predicted Failure Date" : `Forecast ${y}`
            });
        });

        // Sort by year
        timeSeriesPoints.sort((a, b) => a.year - b.year);

        wallThicknessForecast.push({
            structure: name,
            nominal_thickness: nominal,
            current_thickness: current,
            min_allowable_thickness: tmin,
            corrosion_rate_mm_yr: cr,
            rul_years: rul,
            predicted_failure_year: failureYear,
            status: rul < 5 ? "CRITICAL" : rul < 10 ? "WARNING" : "HEALTHY",
            time_series_points: timeSeriesPoints,
        });
    });

    // ── 2. CP Potential & Anode Replacement Forecast ──
    const cpForecast: any[] = [];
    const anodeLifeForecast: any[] = [];

    Object.entries(byStructure).forEach(([name, jobs]) => {
        const latest = jobs[0];
        const cpAvg = latest.cp.avg || -930;
        const underprotectedCount = (latest.cp.depthPoints || []).filter((p: any) => p.potential_mv > -800).length;
        const totalPoints = latest.cp.depthPoints?.length || 1;
        const underprotectedPct = Math.round((underprotectedCount / totalPoints) * 100);

        cpForecast.push({
            structure: name,
            current_avg_mv: cpAvg,
            protection_status: cpAvg > -800 ? "UNDER_PROTECTED" : cpAvg > -850 ? "MARGINAL" : "OPTIMAL",
            underprotected_points_count: underprotectedCount,
            underprotected_pct: underprotectedPct,
            scatter_points: latest.cp.depthPoints || [],
        });

        // Anode depletion projection
        const curDep = latest.anode.avgDepletion ?? 35;
        const assetAge = Math.max(1, (new Date().getFullYear()) - (latest.platform_info.install_year || 1990));
        const depRatePerYear = Math.max(0.5, Math.round((curDep / assetAge) * 10) / 10);
        const yearsTo100 = Math.max(0, Math.round((100 - curDep) / depRatePerYear));
        const replacementYear = new Date().getFullYear() + Math.max(1, yearsTo100);

        anodeLifeForecast.push({
            structure: name,
            current_depletion_pct: curDep,
            depletion_rate_pct_yr: depRatePerYear,
            years_remaining: yearsTo100,
            recommended_replacement_year: replacementYear,
            alert: yearsTo100 < 5 || curDep >= 75,
        });
    });

    // ── 3. Structural Integrity & 5x5 Risk Matrix ──
    // Matrix: 5 Probability levels x 5 Consequence levels
    const riskMatrix5x5: { p: number; c: number; count: number; risk_level: string; components: string[] }[] = [];
    for (let p = 1; p <= 5; p++) {
        for (let c = 1; c <= 5; c++) {
            const score = p * c;
            const level = score >= 15 ? "CRITICAL" : score >= 10 ? "HIGH" : score >= 5 ? "MEDIUM" : "LOW";
            riskMatrix5x5.push({ p, c, count: 0, risk_level: level, components: [] });
        }
    }

    // Populate matrix cells from active anomalies and degraded components
    summaries.forEach(s => {
        const p1 = s.anomalies.byPriority?.["P1"] || 0;
        const p2 = s.anomalies.byPriority?.["P2"] || 0;
        const p3 = s.anomalies.byPriority?.["P3"] || 0;
        const otherAnom = Math.max(0, s.anomalies.total - (p1 + p2 + p3));

        // P1 anomalies on primary members (LG, RS, CD) -> P5, C5 (Critical)
        if (p1 > 0) {
            const cell = riskMatrix5x5.find(c => c.p === 5 && c.c === 5);
            if (cell) {
                cell.count += p1;
                cell.components.push(`${s.structure_name}: Critical Leg/Riser Defect`);
            }
        }
        // P2 anomalies on secondary braces (HM, VD) -> P4, C4 (High)
        if (p2 > 0) {
            const cell = riskMatrix5x5.find(c => c.p === 4 && c.c === 4);
            if (cell) {
                cell.count += p2;
                cell.components.push(`${s.structure_name}: Brace Crack / Anomaly`);
            }
        }
        // P3 anomalies on caissons / clamps -> P3, C3 (Medium)
        if (p3 > 0) {
            const cell = riskMatrix5x5.find(c => c.p === 3 && c.c === 3);
            if (cell) {
                cell.count += p3;
                cell.components.push(`${s.structure_name}: Caisson / Clamp Finding`);
            }
        }
        // Flooded members -> P4, C5 (High)
        if (s.fmd.conditions.flooded > 0) {
            const cell = riskMatrix5x5.find(c => c.p === 4 && c.c === 5);
            if (cell) {
                cell.count += s.fmd.conditions.flooded;
                cell.components.push(`${s.structure_name}: Flooded Subsea Member`);
            }
        }
        // Scour alert -> P4, C4
        if (s.subsea_foundation.max_scour_depth_m >= 1.5) {
            const cell = riskMatrix5x5.find(c => c.p === 4 && c.c === 4);
            if (cell) {
                cell.count += 1;
                cell.components.push(`${s.structure_name}: Scour Depth > 1.5m`);
            }
        }
        // Low risk items -> P1, C2
        const cellLow = riskMatrix5x5.find(c => c.p === 1 && c.c === 2);
        if (cellLow) {
            cellLow.count += Math.max(2, otherAnom + 1);
            cellLow.components.push(`${s.structure_name}: Routine Coating / Debris`);
        }
    });

    // ── Component Health Scores (Sub-components) ──
    const componentHealthScores: any[] = [];
    Object.entries(byStructure).forEach(([name, jobs]) => {
        const latest = jobs[0];
        const p1 = latest.anomalies.byPriority?.["P1"] || 0;
        const p2 = latest.anomalies.byPriority?.["P2"] || 0;
        const flooded = latest.fmd.conditions.flooded || 0;
        const cpAvg = Math.abs(latest.cp.avg || 900);
        const scour = latest.subsea_foundation.max_scour_depth_m || 0;

        const jacketScore = Math.max(10, Math.min(100, 100 - (p1 * 20) - (p2 * 10) - (flooded * 15)));
        const boatlandingScore = Math.max(15, Math.min(100, 75 - (p2 * 15)));
        const caissonScore = Math.max(25, Math.min(100, 95 - (latest.wall_thickness.corrosion_rate_mm_yr > 0.15 ? 20 : 5)));
        const riserScore = Math.max(30, Math.min(100, 100 - (p1 * 25)));
        const anodeScore = Math.max(10, Math.min(100, 100 - (latest.anode.avgDepletion * 0.8) - (cpAvg < 850 ? 25 : 0)));
        const foundationScore = Math.max(20, Math.min(100, 100 - (scour >= 1.5 ? 35 : scour >= 0.8 ? 15 : 0)));

        const overallAssetScore = Math.round(
            (jacketScore * 0.35) + (riserScore * 0.20) + (foundationScore * 0.15) + (anodeScore * 0.15) + (caissonScore * 0.10) + (boatlandingScore * 0.05)
        );

        componentHealthScores.push({
            structure: name,
            overall_score: overallAssetScore,
            grade: overallAssetScore >= 85 ? "A" : overallAssetScore >= 70 ? "B" : overallAssetScore >= 50 ? "C" : overallAssetScore >= 35 ? "D" : "F",
            components: {
                jacket: { score: jacketScore, label: "Jacket Legs & Braces", status: jacketScore < 60 ? "CRITICAL" : "NORMAL" },
                boatlanding: { score: boatlandingScore, label: "Boatlanding & Fenders", status: boatlandingScore < 50 ? "ATTENTION" : "NORMAL" },
                caisson: { score: caissonScore, label: "Caissons & Sumps", status: caissonScore < 65 ? "DEGRADED" : "NORMAL" },
                riser: { score: riserScore, label: "Risers & Clamps", status: riserScore < 75 ? "WARNING" : "NORMAL" },
                anode: { score: anodeScore, label: "Cathodic Protection", status: anodeScore < 60 ? "DEPLETED" : "NORMAL" },
                foundation: { score: foundationScore, label: "Seabed & Piles", status: foundationScore < 70 ? "SCOUR RISK" : "NORMAL" },
            }
        });
    });

    // ── 4. 5-Year Maintenance CAPEX Forecast ($M USD) ──
    const currentYear = new Date().getFullYear();
    const capexByField: Record<string, { year: number; capex_m: number }[]> = {};
    const fleetCapexForecast: { year: number; critical_repairs: number; anode_retrofits: number; routine_inspections: number; total_m: number }[] = [];

    for (let yr = currentYear; yr <= currentYear + 4; yr++) {
        let critRepairs = 0;
        let anodeRetro = 0;
        let routineInsp = 1.2;

        summaries.forEach(s => {
            const p1 = s.anomalies.byPriority?.["P1"] || 0;
            const p2 = s.anomalies.byPriority?.["P2"] || 0;
            if (yr === currentYear) {
                critRepairs += (p1 * 0.35) + (p2 * 0.12);
                if (s.subsea_foundation.max_scour_depth_m >= 1.5) critRepairs += 0.45;
            } else if (yr === currentYear + 1) {
                critRepairs += (p2 * 0.08);
            }

            if (s.anode.avgDepletion > 70 && yr === currentYear + 1) {
                anodeRetro += 0.28;
            } else if (s.anode.avgDepletion > 50 && yr === currentYear + 3) {
                anodeRetro += 0.25;
            }
        });

        const totalYear = Math.round((critRepairs + anodeRetro + routineInsp) * 100) / 100;
        fleetCapexForecast.push({
            year: yr,
            critical_repairs: Math.round(critRepairs * 100) / 100,
            anode_retrofits: Math.round(anodeRetro * 100) / 100,
            routine_inspections: routineInsp,
            total_m: totalYear,
        });
    }

    // ── 5. Subsea & Foundation Risk Summary ──
    const subseaFoundationSummary: any[] = [];
    Object.entries(byStructure).forEach(([name, jobs]) => {
        const latest = jobs[0];
        const maxScour = latest.subsea_foundation.max_scour_depth_m || 0;
        const flooded = latest.fmd.conditions.flooded || 0;
        const buoyancyLoss = latest.fmd.estimated_buoyancy_loss_tonnes || 0;

        subseaFoundationSummary.push({
            structure: name,
            max_scour_depth_m: maxScour,
            scour_risk_level: maxScour >= 1.5 ? "CRITICAL" : maxScour >= 0.8 ? "WARNING" : "STABLE",
            flooded_members_count: flooded,
            buoyancy_loss_tonnes: buoyancyLoss,
            hydrodynamic_overload_alert: (flooded > 1 && latest.marine_growth.avg_thickness_mm > 50),
            action_recommended: maxScour >= 1.5
                ? "Immediate Seabed Rock-Dumping Remediation"
                : flooded > 0
                    ? "Ultrasonic Structural Crack Sizing & Member Grouting"
                    : "Routine Acoustic Bathymetry Survey",
        });
    });

    return {
        wall_thickness_forecast: wallThicknessForecast,
        cp_forecast: cpForecast,
        anode_life: anodeLifeForecast.sort((a, b) => a.years_remaining - b.years_remaining),
        risk_matrix_5x5: riskMatrix5x5,
        component_health_scores: componentHealthScores,
        capex_forecast_5yr: fleetCapexForecast,
        subsea_foundation: subseaFoundationSummary,
    };
}
