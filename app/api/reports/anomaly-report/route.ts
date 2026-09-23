
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        let sowReportNo = searchParams.get("sow_report_no");
        let jobpackId = searchParams.get("jobpack_id");
        let structureId = searchParams.get("structure_id");
        let inspectionId = searchParams.get("inspection_id");
        let anomalyId = searchParams.get("anomaly_id");

        // Robust cleanup for parameters
        const clean = (val: string | null) => (val === "undefined" || val === "null" || !val) ? null : val;
        sowReportNo = clean(sowReportNo);
        if (sowReportNo) sowReportNo = decodeURIComponent(sowReportNo);
        jobpackId = clean(jobpackId);
        structureId = clean(structureId);
        inspectionId = clean(inspectionId);
        anomalyId = clean(anomalyId);

        if (!jobpackId && !inspectionId && !anomalyId) {
            return NextResponse.json({ error: "JobPack ID, Inspection ID, or Anomaly ID is required" }, { status: 400 });
        }

        console.log(`[AnomalyReport] Req: JobPack=${jobpackId}, Structure=${structureId}, Report=${sowReportNo}, Inspection=${inspectionId}, Anomaly=${anomalyId}`);

        // 1. Query v_anomaly_details View
        let query = (supabase as any)
            .from("v_anomaly_details")
            .select("*");

        // If specific anomaly ID is requested, prioritize it to print ONLY that single anomaly!
        if (anomalyId) {
            query = query.eq("anomaly_id", anomalyId);
        } else if (inspectionId) {
            query = query.eq("id", inspectionId); 
        } else {
            // Apply broad filters only if no direct ID is provided
            if (jobpackId) {
                query = query.eq("jobpack_id", jobpackId);
            }
            if (structureId) {
                query = query.eq("structure_id", structureId);
            }
            if (sowReportNo) {
                query = query.eq("sow_report_no", sowReportNo);
            }
        }

        let prefix = searchParams.get("prefix");
        if (prefix === "undefined" || prefix === "null") prefix = null;
        if (prefix) {
            query = query.ilike("display_ref_no", `%${prefix}%`);
        }

        let { data: anomalies, error: viewError } = await query;

        if (viewError) {
            console.error("View Error:", viewError);
            throw viewError;
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
        // Filter out completely empty ghost records without ID, reference or observations
        const validAnomalies = uniqueAnomalies.filter(item => {
            const hasId = Boolean(item.anomaly_id || item.id || item.insp_id);
            const hasRef = Boolean((item.display_ref_no || item.anomaly_ref_no || item.ref_no || "").toString().trim());
            const hasDesc = Boolean((item.description || item.observations || item.findings || item.defect_type || "").toString().trim());
            return hasId && (hasRef || hasDesc);
        });

        // Sort anomalies naturally by defect reference number
        const getRef = (item: any) => (item.display_ref_no || item.anomaly_ref_no || item.ref_no || "").toString().trim();
        validAnomalies.sort((a, b) => {
            const refA = getRef(a);
            const refB = getRef(b);
            if (refA && refB) {
                return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: "base" });
            }
            return refA ? -1 : (refB ? 1 : 0);
        });

        anomalies = validAnomalies;

        if (!anomalies || anomalies.length === 0) {
            return NextResponse.json({
                data: [],
                debug: {
                    message: "No data found with filters",
                    filters: { jobpackId, structureId, sowReportNo },
                    viewError
                }
            });
        }

        console.log(`[AnomalyReport] Found ${anomalies.length} anomalies via View.`);

        // 2. Fetch Attachments (Both Inspection and Anomaly level)
        const inspIds = Array.from(new Set(anomalies.map((a: any) => a.id ?? a.insp_id).filter(Boolean)));
        const anomalyIds = Array.from(new Set(anomalies.map((a: any) => a.anomaly_id).filter(Boolean)));

        let attachments: any[] = [];
        const allSourceIds = Array.from(new Set([...inspIds, ...anomalyIds].map(String)));

        if (allSourceIds.length > 0) {
            const { data: attData, error: attErr } = await (supabase as any)
                .from("attachment")
                .select("*")
                .in("source_type", ["inspection", "INSPECTION", "anomaly", "ANOMALY", "insp_record", "INSP_RECORD", "defect", "DEFECT"])
                .in("source_id", allSourceIds);

            if (attErr) {
                console.error("[AnomalyReport] Error querying attachments:", attErr);
            } else if (attData) {
                attachments.push(...attData);
            }

            // Also check insp_media for direct photo captures
            if (inspIds.length > 0) {
                const { data: mediaData } = await (supabase as any)
                    .from("insp_media")
                    .select("*")
                    .in("inspection_id", inspIds);

                if (mediaData && mediaData.length > 0) {
                    for (const m of mediaData) {
                        if (!attachments.some((a: any) => a.path === m.file_path || String(a.id) === `media-${m.media_id}`)) {
                            attachments.push({
                                id: `media-${m.media_id}`,
                                name: m.name || `Photo ${m.media_id}`,
                                path: m.file_path,
                                source_type: "INSPECTION",
                                source_id: m.inspection_id,
                                meta: {
                                    ...m.meta,
                                    bucket: "inspection-media",
                                    is_insp_media: true,
                                },
                                created_at: m.captured_at,
                            });
                        }
                    }
                }
            }
        }

        // 3. Merge Attachments
        const result = anomalies.map((a: any) => {
            const currentInspId = String(a.id ?? a.insp_id ?? "");
            const currentAnomId = String(a.anomaly_id ?? "");

            const relAttachments = attachments.filter((att: any) => {
                const sType = (att.source_type || "").toUpperCase();
                const sId = String(att.source_id);
                const isInsp = (sType === 'INSPECTION' || sType === 'INSP_RECORD') && currentInspId && (sId === currentInspId);
                const isAnom = (sType === 'ANOMALY' || sType === 'DEFECT') && currentAnomId && (sId === currentAnomId);
                return isInsp || isAnom;
            });

            // Sort by meta.sort_order
            relAttachments.sort((ra, rb) => {
                const orderA = ra.meta?.sort_order ?? 999999;
                const orderB = rb.meta?.sort_order ?? 999999;
                if (orderA !== orderB) return orderA - orderB;
                return new Date(ra.created_at || 0).getTime() - new Date(rb.created_at || 0).getTime();
            });

            return {
                ...a,
                attachments: relAttachments
            };
        });

        return NextResponse.json({ data: result });

    } catch (error: any) {
        console.error("Error fetching anomaly report data:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
