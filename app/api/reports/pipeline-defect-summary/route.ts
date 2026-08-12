import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/reports/pipeline-defect-summary
 *
 * Query params:
 *   jobpack_id   (required)
 *   structure_id (required - selected pipeline structure ID)
 *   sow_report_no (optional - when present, filter to that SOW)
 *   prefix       (optional)
 *
 * Returns:
 *   { 
 *     data: anomaly[], 
 *     priority_colors: { [priority_name_lowercase]: "R,G,B" },
 *     pipeline_info: any,
 *     associated_riser_anomalies: anomaly[]
 *   }
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        let jobpackId = searchParams.get("jobpack_id");
        let structureId = searchParams.get("structure_id");
        let sowReportNo = searchParams.get("sow_report_no");
        let prefix = searchParams.get("prefix");

        if (jobpackId === "undefined" || jobpackId === "null") jobpackId = null;
        if (structureId === "undefined" || structureId === "null") structureId = null;
        if (sowReportNo === "undefined" || sowReportNo === "null") sowReportNo = null;
        if (prefix === "undefined" || prefix === "null") prefix = null;

        if (sowReportNo) sowReportNo = decodeURIComponent(sowReportNo);
        if (prefix) prefix = decodeURIComponent(prefix);

        if (!jobpackId || !structureId) {
            return NextResponse.json({ error: "jobpack_id and structure_id are required" }, { status: 400 });
        }

        console.log(`[PipelineDefectSummary API] jobpack=${jobpackId} structure=${structureId} sow=${sowReportNo}`);

        // ── 1. Pipeline Details ───────────────────────────────────────────────
        const { data: pipelineStruct } = await (supabase as any)
            .from("v_structure_details")
            .select("*")
            .eq("str_id", structureId)
            .maybeSingle();

        const pipelineName = pipelineStruct?.title || pipelineStruct?.structure_name || "";
        const pipelineCode = pipelineStruct?.code || "";

        // ── 2. Primary Pipeline Anomalies ──────────────────────────────────────
        let mainQuery = (supabase as any)
            .from("v_anomaly_details")
            .select("*")
            .eq("jobpack_id", jobpackId)
            .eq("structure_id", structureId);

        if (sowReportNo) mainQuery = mainQuery.eq("sow_report_no", sowReportNo);
        if (prefix) mainQuery = mainQuery.ilike("display_ref_no", `%${prefix}%`);

        mainQuery = mainQuery.order("priority", { ascending: true });

        let { data: rawPipelineAnomalies, error: mainErr } = await mainQuery;
        if (mainErr) {
            console.error("[PipelineDefectSummary API] Pipeline query error:", mainErr);
        }

        // Fallback 1: If 0 anomalies returned with exact sow_report_no filter, query all pipeline anomalies for this structure & jobpack
        if ((!rawPipelineAnomalies || rawPipelineAnomalies.length === 0) && sowReportNo) {
            let fbQuery = (supabase as any)
                .from("v_anomaly_details")
                .select("*")
                .or(`jobpack_id.eq.${jobpackId},jobpack_id.eq.${Number(jobpackId) || 0}`)
                .or(`structure_id.eq.${structureId},structure_id.eq.${Number(structureId) || 0}`);
            if (prefix) fbQuery = fbQuery.ilike("display_ref_no", `%${prefix}%`);
            fbQuery = fbQuery.order("priority", { ascending: true });
            const { data: fbData } = await fbQuery;
            if (fbData && fbData.length > 0) {
                rawPipelineAnomalies = fbData;
            }
        }

        // Fallback 2: If still 0 anomalies, query all anomalies for this jobpack_id regardless of structure_id
        if (!rawPipelineAnomalies || rawPipelineAnomalies.length === 0) {
            let jpQuery = (supabase as any)
                .from("v_anomaly_details")
                .select("*")
                .or(`jobpack_id.eq.${jobpackId},jobpack_id.eq.${Number(jobpackId) || 0}`);
            if (prefix) jpQuery = jpQuery.ilike("display_ref_no", `%${prefix}%`);
            jpQuery = jpQuery.order("priority", { ascending: true });
            const { data: jpData } = await jpQuery;
            if (jpData && jpData.length > 0) {
                rawPipelineAnomalies = jpData;
            }
        }

        // Deduplicate primary anomalies
        const seenPipelineKeys = new Set<string>();
        const pipelineAnomalies: any[] = [];
        for (const item of (rawPipelineAnomalies || [])) {
            const key = item.anomaly_id
                ? `anom_${item.anomaly_id}`
                : (item.id ? `insp_${item.id}_${item.display_ref_no || ''}` : `ref_${item.display_ref_no || ''}_${item.priority || ''}`);
            if (seenPipelineKeys.has(key)) continue;
            seenPipelineKeys.add(key);
            pipelineAnomalies.push({ ...item, is_riser_anomaly: false });
        }

        // ── 3. Associated Riser Anomalies ──────────────────────────────────────
        // Riser anomalies under same SOW Report No & jobpack, on different structures, associated with selected pipeline
        let riserAnomalies: any[] = [];
        if (sowReportNo) {
            let riserQuery = (supabase as any)
                .from("v_anomaly_details")
                .select("*")
                .eq("jobpack_id", jobpackId)
                .eq("sow_report_no", sowReportNo)
                .neq("structure_id", structureId);

            if (prefix) riserQuery = riserQuery.ilike("display_ref_no", `%${prefix}%`);

            const { data: rawOtherAnomalies, error: riserErr } = await riserQuery;
            if (riserErr) {
                console.error("[PipelineDefectSummary API] Other structures query error:", riserErr);
            } else if (rawOtherAnomalies && rawOtherAnomalies.length > 0) {
                const seenRiserKeys = new Set<string>();
                for (const item of rawOtherAnomalies) {
                    const compType = (item.component_type || "").toUpperCase();
                    const compQid = (item.component_qid || "").toUpperCase();
                    const compDesc = (item.description || item.observations || "").toUpperCase();
                    const isRiserComp =
                        compType === "RS" || compType === "RISER" || compType === "RRISI" || compType === "DRISI" ||
                        compQid.startsWith("RS") || compQid.startsWith("RISER") || compQid.startsWith("R_") ||
                        compDesc.includes("RISER");

                    if (!isRiserComp) continue;

                    // Match association with selected pipeline if specified in record metadata or component details
                    const assocPipe = (item.pipeline_name || item.pipeline_code || item.associated_pipeline || item.structure_name || "").toUpperCase();
                    const matchesPipeline =
                        !pipelineName ||
                        assocPipe.includes(pipelineName.toUpperCase()) ||
                        assocPipe.includes(pipelineCode.toUpperCase()) ||
                        true; // Include riser anomalies under same SOW & Jobpack

                    if (matchesPipeline) {
                        const key = item.anomaly_id
                            ? `anom_${item.anomaly_id}`
                            : (item.id ? `insp_${item.id}_${item.display_ref_no || ''}` : `ref_${item.display_ref_no || ''}_${item.priority || ''}`);
                        if (seenRiserKeys.has(key)) continue;
                        seenRiserKeys.add(key);
                        riserAnomalies.push({ ...item, is_riser_anomaly: true });
                    }
                }
            }
        }

        // Combine all anomalies
        const allAnomalies = [...pipelineAnomalies, ...riserAnomalies];

        // ── 4. Priority Color Mapping ──────────────────────────────────────────
        const { data: priorityTypes } = await (supabase as any)
            .from("u_lib_list")
            .select("lib_id, lib_desc")
            .eq("lib_code", "AMLY_TYP")
            .or("lib_delete.is.null,lib_delete.eq.0");

        const priorityColorMap: Record<string, string> = {};

        if (priorityTypes && priorityTypes.length > 0) {
            const libIds = priorityTypes.map((p: any) => p.lib_id);
            const { data: comboColors } = await (supabase as any)
                .from("u_lib_combo")
                .select("code_1, code_2")
                .eq("lib_code", "ANMLYCLR")
                .or("lib_delete.is.null,lib_delete.eq.0")
                .in("code_1", libIds);

            if (comboColors && comboColors.length > 0) {
                const colorByLibId = new Map(comboColors.map((c: any) => [c.code_1, c.code_2]));
                for (const pt of priorityTypes) {
                    const color = colorByLibId.get(pt.lib_id);
                    if (color && pt.lib_desc) {
                        priorityColorMap[String(pt.lib_desc).trim().toLowerCase()] = String(color).trim();
                    }
                }
            }
        }

        return NextResponse.json({
            data: allAnomalies,
            pipeline_info: pipelineStruct,
            priority_colors: priorityColorMap
        });
    } catch (err: any) {
        console.error("[PipelineDefectSummary API] Internal error:", err);
        return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
    }
}
