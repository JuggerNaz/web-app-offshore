
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/reports/defect-summary
 *
 * Query params:
 *   jobpack_id   (required)
 *   structure_id (optional)
 *   sow_report_no (optional — when present, filter to that SOW)
 *
 * Returns:
 *   { data: anomaly[], priority_colors: { [lib_desc_lowercase]: "R,G,B" } }
 *
 * Priority colours are read from u_lib_list (lib_code = AMLY_TYP) and then
 * cross-referenced with u_lib_combo (lib_code = ANMLYCLR) where:
 *   code_1 = priority lib_id
 *   code_2 = "R,G,B" colour string
 * If no combo entry exists for a priority the generator falls back to its
 * built-in industry-standard palette.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        let jobpackId = searchParams.get("jobpack_id");
        let structureId = searchParams.get("structure_id");
        let sowReportNo = searchParams.get("sow_report_no");

        if (jobpackId === "undefined" || jobpackId === "null") jobpackId = null;
        if (structureId === "undefined" || structureId === "null") structureId = null;
        if (sowReportNo === "undefined" || sowReportNo === "null") sowReportNo = null;
        if (sowReportNo) sowReportNo = decodeURIComponent(sowReportNo);

        if (!jobpackId) {
            return NextResponse.json({ error: "jobpack_id is required" }, { status: 400 });
        }

        console.log(`[DefectSummary] jobpack=${jobpackId} structure=${structureId} sow=${sowReportNo}`);

        // ── 1. Fetch anomalies from the view ───────────────────────────────────
        let query = (supabase as any)
            .from("v_anomaly_details")
            .select("*")
            .eq("jobpack_id", jobpackId);

        let prefix = searchParams.get("prefix");
        if (prefix === "undefined" || prefix === "null") prefix = null;

        if (structureId) query = query.eq("structure_id", structureId);
        if (sowReportNo) query = query.eq("sow_report_no", sowReportNo);
        if (prefix) query = query.ilike("display_ref_no", `%${prefix}%`);

        query = query.order("priority", { ascending: true });

        let { data: anomalies, error: anomalyError } = await query;
        if (anomalyError) {
            console.error("[DefectSummary] Anomaly query error:", anomalyError);
            throw anomalyError;
        }

        // Deduplicate anomalies (since v_anomaly_details LEFT JOIN u_lib_combo can return duplicate rows per combo entry)
        const seenKeys = new Set<string>();
        const uniqueAnomalies: any[] = [];
        for (const item of (anomalies || [])) {
            const key = item.anomaly_id 
                ? `anom_${item.anomaly_id}` 
                : (item.id ? `insp_${item.id}_${item.display_ref_no || ''}` : `ref_${item.display_ref_no || ''}_${item.priority || ''}`);
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            uniqueAnomalies.push(item);
        }

        const PRIORITY_ORDER: Record<string, number> = {
            critical: 1, c: 1, "priority 1": 1, p1: 1,
            high: 2, h: 2, "priority 2": 2, p2: 2,
            medium: 3, m: 3, "priority 3": 3, p3: 3,
            low: 4, l: 4, "priority 4": 4, p4: 4,
            observation: 5, o: 5, "priority 5": 5, p5: 5, "priority 6": 6, p6: 6,
            informational: 7, info: 7, i: 7
        };
        const prioritySortKey = (p: string) => PRIORITY_ORDER[(p || "").toLowerCase()] ?? 99;

        uniqueAnomalies.sort((a, b) => {
            const pDiff = prioritySortKey(a.priority) - prioritySortKey(b.priority);
            if (pDiff !== 0) return pDiff;
            const refA = (a.display_ref_no || a.ref_no || a.anomaly_ref_no || "").toString();
            const refB = (b.display_ref_no || b.ref_no || b.anomaly_ref_no || "").toString();
            return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: "base" });
        });

        console.log(`[DefectSummary] Found ${anomalies?.length ?? 0} raw record(s), deduplicated to ${uniqueAnomalies.length}`);

        // ── 2. Fetch priority types from u_lib_list (AMLY_TYP) ────────────────
        const { data: priorityTypes, error: typesError } = await (supabase as any)
            .from("u_lib_list")
            .select("lib_id, lib_desc")
            .eq("lib_code", "AMLY_TYP")
            .or("lib_delete.is.null,lib_delete.eq.0");

        if (typesError) {
            console.warn("[DefectSummary] Could not fetch AMLY_TYP:", typesError.message);
        }

        // ── 3. Fetch priority→color combos (lib_code = ANMLYCLR) ─────────────
        // Format: code_1 = priority lib_id, code_2 = "R,G,B" colour string
        const { data: colorCombos, error: colorError } = await (supabase as any)
            .from("u_lib_combo")
            .select("code_1, code_2")
            .eq("lib_code", "ANMLYCLR")
            .or("lib_delete.is.null,lib_delete.eq.0");

        if (colorError) {
            console.warn("[DefectSummary] Could not fetch ANMLYCLR combos:", colorError.message);
        }

        // ── 4. Build priority_colors map: { "p1": "255,0,0", "priority 1": "255,0,0", ... } ───────
        const priorityColors: Record<string, string> = {};

        if (priorityTypes) {
            // Build lookup: lib_id -> color string (preferring numeric RGB strings if multiple rows exist)
            const idToColor: Record<string, string> = {};
            (colorCombos || []).forEach((combo: any) => {
                if (combo.code_1 && combo.code_2) {
                    const existing = idToColor[combo.code_1];
                    // If no existing, or existing is not a numeric RGB string while new one is, overwrite
                    if (!existing || (!existing.includes(",") && combo.code_2.includes(","))) {
                        idToColor[combo.code_1] = combo.code_2;
                    }
                }
            });

            // Map both lib_id (e.g. "p1") and lib_desc (e.g. "priority 1")
            (priorityTypes || []).forEach((row: any) => {
                const color = idToColor[row.lib_id] || "";
                if (color) {
                    if (row.lib_id) priorityColors[String(row.lib_id).toLowerCase()] = color;
                    if (row.lib_desc) priorityColors[String(row.lib_desc).toLowerCase()] = color;
                }
            });
        }

        console.log("[DefectSummary] Priority color map:", priorityColors);

        return NextResponse.json({
            data: uniqueAnomalies,
            priority_colors: priorityColors,
        });

    } catch (error: any) {
        console.error("[DefectSummary] Fatal:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
