
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

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
        }

        let prefix = searchParams.get("prefix");
        if (prefix === "undefined" || prefix === "null") prefix = null;
        if (prefix) {
            query = query.ilike("display_ref_no", `%${prefix}%`);
        }

        const { data: anomaliesData, error: viewError } = await query;
        let anomalies = anomaliesData || [];

        if (viewError) {
            console.warn("[AnomalyReport] View query error, attempting direct query fallback:", viewError);
        }

        // Robust Fallback: If view query returned 0 rows or errored and specific inspectionId or anomalyId is requested
        if (anomalies.length === 0 && (inspectionId || anomalyId)) {
            try {
                console.log(`[AnomalyReport] View returned 0 rows for inspectionId=${inspectionId}, anomalyId=${anomalyId}. Attempting direct query fallback...`);
                let directQuery = (supabase as any)
                    .from("insp_anomalies")
                    .select("*, insp_records!inner(*, structure_components(*), insp_video_tapes(*), insp_dive_jobs(*), insp_rov_jobs(*))");

                if (anomalyId) {
                    directQuery = directQuery.eq("anomaly_id", anomalyId);
                } else if (inspectionId) {
                    directQuery = directQuery.eq("inspection_id", inspectionId);
                }

                const { data: directAnoms, error: directErr } = await directQuery;
                if (!directErr && directAnoms && directAnoms.length > 0) {
                    anomalies = directAnoms.map((da: any) => {
                        const r = da.insp_records || {};
                        const sc = r.structure_components || {};
                        const dj = r.insp_dive_jobs || {};
                        const rj = r.insp_rov_jobs || {};
                        const vt = r.insp_video_tapes || {};
                        return {
                            anomaly_id: da.anomaly_id,
                            display_ref_no: da.anomaly_ref_no,
                            description: da.defect_description,
                            priority: da.priority_code,
                            category: da.defect_category_code,
                            defect_type: da.defect_type_code,
                            recommended_action: da.recommended_action,
                            status: da.status,
                            rectified: da.is_rectified,
                            rectified_by: da.rectified_by,
                            rectified_date: da.rectified_date,
                            rectified_remarks: da.rectified_remarks,
                            action_priority: da.action_priority,
                            anomaly_status: da.status,
                            id: r.insp_id,
                            inspection_date: r.inspection_date,
                            observations: r.description,
                            has_anomaly: r.has_anomaly,
                            elevation: r.elevation,
                            fp_kp: r.fp_kp,
                            tape_id: r.tape_id,
                            tape_no: vt.tape_no || r.tape_no,
                            video_ref: r.tape_count_no,
                            component_id: sc.id || r.component_id,
                            component_type: sc.code || r.component_type,
                            component_qid: sc.q_id || r.component_qid,
                            jobpack_id: r.jobpack_id,
                            structure_id: r.structure_id,
                            sow_report_no: r.sow_report_no,
                            dive_job_id: dj.dive_job_id,
                            dive_no: dj.dive_no,
                            diver_name: dj.diver_name,
                            dive_start: dj.start_time,
                            rov_job_id: rj.rov_job_id,
                            deployment_no: rj.deployment_no,
                            rov_name: rj.rov_operator,
                            rov_machine: rj.rov_serial_no,
                            rov_start: rj.start_time,
                        };
                    });
                }
            } catch (fbErr) {
                console.error("[AnomalyReport] Fallback query error:", fbErr);
            }
        }

        if (viewError && anomalies.length === 0) {
            console.error("View Error:", viewError);
            throw viewError;
        }

        // If sowReportNo is provided, try filtering by normalized sow_report_no
        if (sowReportNo && sowReportNo !== "all" && sowReportNo !== "N/A" && anomalies.length > 0) {
            const cleanFilter = String(sowReportNo).replace(/\s+/g, "").toLowerCase();
            const matching = anomalies.filter((a: any) => {
                if (!a.sow_report_no) return false;
                const cleanRep = String(a.sow_report_no).replace(/\s+/g, "").toLowerCase();
                return cleanRep === cleanFilter;
            });
            if (matching.length > 0) {
                anomalies = matching;
            }
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
        
        // Enrich missing tape_no and inspection_data from insp_records & insp_video_tapes
        const allInspIds = Array.from(new Set(anomalies.map((a: any) => a.id || a.insp_id).filter(Boolean)));
        if (allInspIds.length > 0) {
            try {
                const { data: recData } = await (supabase as any)
                    .from("insp_records")
                    .select("insp_id, tape_id, inspection_data, insp_video_tapes:tape_id(tape_no)")
                    .in("insp_id", allInspIds);
                if (recData && recData.length > 0) {
                    const recMap = new Map<number, any>();
                    recData.forEach((rt: any) => recMap.set(Number(rt.insp_id), rt));
                    anomalies.forEach((a: any) => {
                        const iId = Number(a.id || a.insp_id);
                        const match = recMap.get(iId);
                        if (match) {
                            if (!a.tape_no && match.insp_video_tapes?.tape_no) {
                                a.tape_no = match.insp_video_tapes.tape_no;
                            }
                            if (!a.inspection_data && match.inspection_data) {
                                a.inspection_data = match.inspection_data;
                            }
                        }
                    });
                }
            } catch (err) {
                console.warn("[AnomalyReport] Error enriching insp_records:", err);
            }
        }

        // 2. Fetch Attachments (Both Inspection and Anomaly level)
        const inspIds = Array.from(new Set(anomalies.map((a: any) => a.id ?? a.insp_id).filter(Boolean)));
        const anomalyIds = Array.from(new Set(anomalies.map((a: any) => a.anomaly_id).filter(Boolean)));

        const attachments: any[] = [];
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
