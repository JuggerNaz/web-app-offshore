
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

        if (!jobpackId) {
            return NextResponse.json({ error: "jobpack_id is required" }, { status: 400 });
        }

        console.log(`[DefectSummary] jobpack=${jobpackId} structure=${structureId} sow=${sowReportNo}`);

        // ── 1. Fetch anomalies from the view ───────────────────────────────────
        let query = (supabase as any)
            .from("v_anomaly_details")
            .select("*")
            .eq("jobpack_id", jobpackId);

        if (structureId) query = query.eq("structure_id", structureId);
        if (sowReportNo) query = query.eq("sow_report_no", sowReportNo);

        query = query.order("priority", { ascending: true });

        const { data: anomalies, error: anomalyError } = await query;
        if (anomalyError) {
            console.error("[DefectSummary] Anomaly query error:", anomalyError);
            throw anomalyError;
        }

        console.log(`[DefectSummary] Found ${anomalies?.length ?? 0} anomaly record(s)`);

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

        // ── 4. Build priority_colors map: { "critical": "192,0,0", ... } ───────
        const priorityColors: Record<string, string> = {};

        if (priorityTypes) {
            // Build a lookup: lib_id → color rgb string
            const idToColor: Record<string, string> = {};
            (colorCombos || []).forEach((combo: any) => {
                if (combo.code_1 && combo.code_2) {
                    idToColor[combo.code_1] = combo.code_2;
                }
            });

            // Map: priority label → color
            (priorityTypes || []).forEach((row: any) => {
                const label = (row.lib_desc || "").toLowerCase();
                const color = idToColor[row.lib_id] || ""; // Include label even if color is missing
                if (label) {
                    priorityColors[label] = color;
                }
            });
        }

        console.log("[DefectSummary] Priority color map:", priorityColors);

        return NextResponse.json({
            data: anomalies || [],
            priority_colors: priorityColors,
        });

    } catch (error: any) {
        console.error("[DefectSummary] Fatal:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
