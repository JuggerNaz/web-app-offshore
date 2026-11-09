import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/utils/with-auth";

export const dynamic = "force-dynamic";

function formatTimecode(tc: any): string {
    if (tc === null || tc === undefined || tc === "" || tc === "—" || tc === "-") return "";
    const str = String(tc).trim();
    if (str.includes(":")) {
        const parts = str.split(":");
        if (parts.length === 2) return `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
        if (parts.length === 3) return parts.map((p) => p.padStart(2, "0")).join(":");
        return str;
    }
    const num = Number(str);
    if (!isNaN(num) && num >= 0 && num <= 43200) {
        const hrs = Math.floor(num / 3600);
        const mins = Math.floor((num % 3600) / 60);
        const secs = Math.floor(num % 60);
        return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
    }
    return str;
}

export async function GET(request: NextRequest) {
    const authUser = await getCurrentUser();
    if (!authUser) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    try {
        const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabase = useAdmin ? createAdminClient() : createClient();
        const { searchParams } = new URL(request.url);

        const rawStructureId = searchParams.get("structure_id");
        const rawComponentId = searchParams.get("component_id");
        const rawQId = (searchParams.get("q_id") || "").trim();

        const structureId = rawStructureId ? Number(rawStructureId) : NaN;
        const componentId = rawComponentId ? Number(rawComponentId) : NaN;

        if (isNaN(componentId) && !rawQId) {
            return NextResponse.json({ error: "component_id or q_id is required" }, { status: 400 });
        }

        // 1. Resolve component record to get all matching IDs and canonical QID
        let compQuery = (supabase as any)
            .from("structure_components")
            .select("id, comp_id, q_id, id_no, code, structure_id, metadata");

        if (!isNaN(structureId) && structureId > 0) {
            compQuery = compQuery.eq("structure_id", structureId);
        }

        if (!isNaN(componentId) && componentId > 0) {
            compQuery = compQuery.or(`id.eq.${componentId},comp_id.eq.${componentId}`);
        } else if (rawQId) {
            compQuery = compQuery.ilike("q_id", rawQId);
        }

        const { data: compRows } = await compQuery.limit(5);
        const comp = compRows?.[0] || null;

        const effectiveStructureId = !isNaN(structureId) && structureId > 0
            ? structureId
            : (comp?.structure_id ? Number(comp.structure_id) : null);

        const compIds = Array.from(
            new Set(
                [
                    !isNaN(componentId) ? componentId : null,
                    comp?.id ? Number(comp.id) : null,
                    comp?.comp_id ? Number(comp.comp_id) : null,
                    ...(compRows || []).flatMap((r: any) => [Number(r.id), Number(r.comp_id)]),
                ].filter((n): n is number => typeof n === "number" && !isNaN(n) && n > 0)
            )
        );

        const qid = (comp?.q_id || rawQId || "").trim();
        const qidUpper = qid.toUpperCase();

        // 2. Fetch SOW items for this component / QID on this structure
        let sowItems: any[] = [];
        let sowsMap = new Map<number, any>();
        if (effectiveStructureId) {
            const { data: structureSows } = await (supabase as any)
                .from("u_sow")
                .select("id, jobpack_id, structure_id, structure_title, report_numbers")
                .eq("structure_id", effectiveStructureId);

            const sowIds = (structureSows || []).map((s: any) => s.id).filter(Boolean);
            (structureSows || []).forEach((s: any) => sowsMap.set(Number(s.id), s));

            if (sowIds.length > 0) {
                let sowItemQuery = (supabase as any)
                    .from("u_sow_items")
                    .select("*")
                    .in("sow_id", sowIds);

                const itemOrs: string[] = [];
                if (compIds.length > 0) itemOrs.push(`component_id.in.(${compIds.join(",")})`);
                if (qid) itemOrs.push(`component_qid.ilike.${qid}`);
                if (itemOrs.length > 0) {
                    sowItemQuery = sowItemQuery.or(itemOrs.join(","));
                    const { data: sItems } = await sowItemQuery;
                    sowItems = sItems || [];
                }
            }
        }

        // 3. Fetch all inspection records for this component / QID
        let inspQuery = (supabase as any)
            .from("insp_records")
            .select(`
                insp_id,
                jobpack_id,
                structure_id,
                component_id,
                component_qid,
                component_type,
                sow_report_no,
                inspection_type_code,
                description,
                inspection_date,
                inspection_time,
                has_anomaly,
                status,
                elevation,
                fp_kp,
                tape_id,
                tape_count_no,
                dive_job_id,
                rov_job_id,
                inspection_data,
                insp_video_tapes:tape_id(tape_id, tape_no, chapter_no, status, remarks),
                insp_dive_jobs:dive_job_id(dive_job_id, dive_no, diver_name),
                insp_rov_jobs:rov_job_id(rov_job_id, deployment_no, rov_operator)
            `)
            .order("inspection_date", { ascending: false })
            .order("insp_id", { ascending: false });

        if (effectiveStructureId) {
            inspQuery = inspQuery.eq("structure_id", effectiveStructureId);
        }

        const inspOrs: string[] = [];
        if (compIds.length > 0) inspOrs.push(`component_id.in.(${compIds.join(",")})`);
        if (qid) inspOrs.push(`component_qid.ilike.${qid}`);
        if (inspOrs.length > 0) {
            inspQuery = inspQuery.or(inspOrs.join(","));
        }

        const { data: inspData } = await inspQuery;
        const inspRecords: any[] = inspData || [];

        // 4. Fetch all anomalies for this component / QID
        let anomViewQuery = (supabase as any)
            .from("v_anomaly_details")
            .select("*");

        if (effectiveStructureId) {
            anomViewQuery = anomViewQuery.eq("structure_id", effectiveStructureId);
        }
        const anomOrs: string[] = [];
        if (compIds.length > 0) anomOrs.push(`component_id.in.(${compIds.join(",")})`);
        if (qid) anomOrs.push(`component_qid.ilike.${qid}`);
        if (anomOrs.length > 0) {
            anomViewQuery = anomViewQuery.or(anomOrs.join(","));
        }

        const { data: viewAnoms } = await anomViewQuery;
        const rawAnomList: any[] = viewAnoms || [];

        const directInspIds = inspRecords.map((r: any) => Number(r.insp_id)).filter(Boolean);
        const directAnomOrs: string[] = [];
        if (compIds.length > 0) directAnomOrs.push(`component_id.in.(${compIds.join(",")})`);
        if (directInspIds.length > 0) directAnomOrs.push(`inspection_id.in.(${directInspIds.join(",")})`);

        let directAnomsMap = new Map<number, any>();
        if (directAnomOrs.length > 0) {
            const { data: directAnoms } = await (supabase as any)
                .from("insp_anomalies")
                .select("*")
                .or(directAnomOrs.join(","));

            (directAnoms || []).forEach((da: any) => {
                directAnomsMap.set(Number(da.anomaly_id), da);
                if (!rawAnomList.some((va) => Number(va.anomaly_id) === Number(da.anomaly_id))) {
                    const parentInsp = inspRecords.find((r) => Number(r.insp_id) === Number(da.inspection_id));
                    rawAnomList.push({
                        anomaly_id: da.anomaly_id,
                        id: da.inspection_id,
                        display_ref_no: da.anomaly_ref_no,
                        priority: da.priority_code,
                        status: da.status,
                        rectified: da.is_rectified,
                        is_rectified: da.is_rectified,
                        rectified_date: da.rectified_date,
                        rectified_remarks: da.rectified_remarks,
                        defect_type: da.defect_type_code,
                        category: da.defect_category_code,
                        description: da.defect_description,
                        recommended_action: da.recommended_action,
                        component_id: da.component_id || parentInsp?.component_id,
                        component_qid: parentInsp?.component_qid || qid,
                        jobpack_id: parentInsp?.jobpack_id,
                        sow_report_no: parentInsp?.sow_report_no,
                    });
                }
            });
        }

        // Deduplicate & enrich anomalies
        const seenAnomKeys = new Set<string>();
        const anomalies: any[] = [];
        for (const a of rawAnomList) {
            const key = a.anomaly_id
                ? `id_${a.anomaly_id}`
                : `${a.display_ref_no || ""}_${a.defect_type || ""}_${a.description || ""}`;
            if (seenAnomKeys.has(key)) continue;
            seenAnomKeys.add(key);

            const direct = a.anomaly_id ? directAnomsMap.get(Number(a.anomaly_id)) : null;
            const parentInsp = inspRecords.find((r) => Number(r.insp_id) === Number(a.id || a.inspection_id));
            const statusStr = String(direct?.status || a.status || "OPEN").toUpperCase();
            const refStr = String(direct?.anomaly_ref_no || a.display_ref_no || a.anomaly_ref_no || "").trim();
            const isRectified = Boolean(
                direct?.is_rectified ||
                a.rectified ||
                a.is_rectified ||
                statusStr === "CLOSED" ||
                statusStr === "RECTIFIED" ||
                direct?.rectified_date ||
                a.rectified_date ||
                /\d+R$/i.test(refStr)
            );

            anomalies.push({
                ...a,
                anomaly_id: a.anomaly_id,
                inspection_id: a.id || a.inspection_id || parentInsp?.insp_id || null,
                display_ref_no: refStr || `ANOM-${a.anomaly_id}`,
                priority: direct?.priority_code || a.priority || a.priority_code || "N/A",
                status: isRectified ? "Rectified" : "Open",
                raw_status: statusStr,
                is_rectified: isRectified,
                rectified_date: direct?.rectified_date || a.rectified_date || null,
                rectified_remarks: direct?.rectified_remarks || a.rectified_remarks || null,
                defect_type: direct?.defect_type_code || a.defect_type || a.defect_type_code || "Anomaly",
                category: direct?.defect_category_code || a.category || a.defect_category_code || "",
                description: direct?.defect_description || a.description || "",
                jobpack_id: a.jobpack_id || parentInsp?.jobpack_id || null,
                jobpack_name: a.jobpack_name || null,
                sow_report_no: a.sow_report_no || parentInsp?.sow_report_no || null,
            });
        }

        // 5. Resolve all Jobpacks referenced across SOWs, Inspections, and Anomalies
        const allJobpackIds = Array.from(
            new Set(
                [
                    ...sowItems.map((si) => sowsMap.get(Number(si.sow_id))?.jobpack_id),
                    ...inspRecords.map((r) => r.jobpack_id),
                    ...anomalies.map((a) => a.jobpack_id),
                ]
                    .map((id) => Number(id))
                    .filter((id) => !isNaN(id) && id > 0)
            )
        );

        const jobpackInfoMap = new Map<number, any>();
        if (allJobpackIds.length > 0) {
            const { data: jpRows } = await (supabase as any)
                .from("jobpack")
                .select("id, name, status, metadata, created_at")
                .in("id", allJobpackIds);
            (jpRows || []).forEach((jp: any) => jobpackInfoMap.set(Number(jp.id), jp));
        }

        // Enrich inspections & anomalies with resolved jobpack names
        const enrichedInspections = inspRecords.map((r: any) => {
            const jp = r.jobpack_id ? jobpackInfoMap.get(Number(r.jobpack_id)) : null;
            return {
                ...r,
                jobpack: jp ? { id: jp.id, name: jp.name, status: jp.status } : (r.jobpack_id ? { id: r.jobpack_id, name: `Jobpack #${r.jobpack_id}` } : null),
                jobpack_name: jp?.name || (r.jobpack_id ? `Jobpack #${r.jobpack_id}` : "Unassigned Jobpack"),
            };
        });

        anomalies.forEach((a) => {
            if (!a.jobpack_name && a.jobpack_id) {
                const jp = jobpackInfoMap.get(Number(a.jobpack_id));
                if (jp) a.jobpack_name = jp.name;
            }
        });

        // Build Jobpacks summary list
        const jobpacksList: any[] = [];
        const seenJpKeys = new Set<string>();

        allJobpackIds.forEach((jpId) => {
            const jp = jobpackInfoMap.get(jpId);
            const jpSowItems = sowItems.filter((si) => Number(sowsMap.get(Number(si.sow_id))?.jobpack_id) === jpId);
            const jpInsps = enrichedInspections.filter((r) => Number(r.jobpack_id) === jpId);
            const jpAnoms = anomalies.filter((a) => Number(a.jobpack_id) === jpId || (jp?.name && a.jobpack_name === jp.name));
            const reportNumbers = Array.from(
                new Set(
                    [
                        ...jpSowItems.map((si) => si.report_number),
                        ...jpInsps.map((r) => r.sow_report_no),
                        ...jpAnoms.map((a) => a.sow_report_no),
                    ].filter((rn) => rn && rn !== "N/A" && rn !== "null")
                )
            );
            const tasks = Array.from(
                new Set(
                    [
                        ...jpSowItems.map((si) => si.inspection_code || si.inspection_name),
                        ...jpInsps.map((r) => r.inspection_type_code),
                    ].filter(Boolean)
                )
            );

            seenJpKeys.add(`id_${jpId}`);
            if (jp?.name) seenJpKeys.add(`name_${jp.name.toUpperCase()}`);

            jobpacksList.push({
                id: jpId,
                name: jp?.name || `Jobpack #${jpId}`,
                status: jp?.status || "ACTIVE",
                sow_count: jpSowItems.length,
                inspection_count: jpInsps.length,
                anomaly_count: jpAnoms.length,
                report_numbers: reportNumbers,
                tasks,
                sow_items: jpSowItems,
            });
        });

        // Also include any jobpack_name from anomalies that didn't have a numeric jobpack_id
        anomalies.forEach((a) => {
            if (a.jobpack_name && !seenJpKeys.has(`name_${a.jobpack_name.toUpperCase()}`)) {
                seenJpKeys.add(`name_${a.jobpack_name.toUpperCase()}`);
                const jpAnoms = anomalies.filter((x) => x.jobpack_name === a.jobpack_name);
                jobpacksList.push({
                    id: a.jobpack_id || null,
                    name: a.jobpack_name,
                    status: "RECORDED",
                    sow_count: 0,
                    inspection_count: 0,
                    anomaly_count: jpAnoms.length,
                    report_numbers: Array.from(new Set(jpAnoms.map((x) => x.sow_report_no).filter(Boolean))),
                    tasks: [],
                    sow_items: [],
                });
            }
        });

        // 6. Build Reports list (SOW Report Scopes, Anomaly Reports, Inspection Summary Reports)
        const reportsList: any[] = [];
        const seenReportKeys = new Set<string>();

        // 6a. SOW Report Numbers from SOW items & Inspections
        jobpacksList.forEach((jp) => {
            (jp.report_numbers || []).forEach((rptNo: string) => {
                const key = `sow_${jp.id}_${rptNo}`;
                if (seenReportKeys.has(key)) return;
                seenReportKeys.add(key);

                const rptInsps = enrichedInspections.filter(
                    (r) => Number(r.jobpack_id) === Number(jp.id) && r.sow_report_no === rptNo
                );
                const rptAnoms = anomalies.filter(
                    (a) => (Number(a.jobpack_id) === Number(jp.id) || a.jobpack_name === jp.name) && a.sow_report_no === rptNo
                );
                const rptSowItems = (jp.sow_items || []).filter((si: any) => si.report_number === rptNo);

                reportsList.push({
                    id: key,
                    report_no: rptNo,
                    title: `SOW Report ${rptNo}`,
                    type: "SOW_REPORT",
                    jobpack_id: jp.id,
                    jobpack_name: jp.name,
                    inspection_count: rptInsps.length,
                    anomaly_count: rptAnoms.length,
                    tasks: Array.from(
                        new Set([
                            ...rptSowItems.map((si: any) => si.inspection_code),
                            ...rptInsps.map((r: any) => r.inspection_type_code),
                        ].filter(Boolean))
                    ),
                });
            });
        });

        // 6b. Anomaly Reports for each anomaly on this QID
        anomalies.forEach((a) => {
            const key = `anom_rpt_${a.anomaly_id || a.display_ref_no}`;
            if (seenReportKeys.has(key)) return;
            seenReportKeys.add(key);

            reportsList.push({
                id: key,
                report_no: a.display_ref_no,
                title: `Anomaly Report: ${a.display_ref_no}`,
                subtitle: `${a.defect_type}${a.category ? ` (${a.category})` : ""}`,
                type: "ANOMALY_REPORT",
                priority: a.priority,
                status: a.status,
                anomaly_id: a.anomaly_id,
                inspection_id: a.inspection_id,
                jobpack_id: a.jobpack_id,
                jobpack_name: a.jobpack_name,
                sow_report_no: a.sow_report_no,
            });
        });

        // 6c. Component Data Sheet / Inspection Summary Report if inspections exist
        if (enrichedInspections.length > 0 || comp) {
            const firstJp = jobpacksList[0] || null;
            reportsList.push({
                id: `comp_datasheet_${comp?.id || componentId || qid}`,
                report_no: qid || `COMP-${componentId}`,
                title: `Component Specification & History Report`,
                subtitle: `${enrichedInspections.length} Inspection(s) • ${anomalies.length} Anomaly(s)`,
                type: "COMPONENT_REPORT",
                jobpack_id: firstJp?.id || null,
                jobpack_name: firstJp?.name || null,
                sow_report_no: firstJp?.report_numbers?.[0] || null,
            });
        }

        // 7. Fetch Videos (Video Tapes, Video Logs, and Inspection Timecode references)
        const videosList: any[] = [];
        const seenVideoKeys = new Set<string>();

        const allTapeIds = Array.from(
            new Set(enrichedInspections.map((r) => Number(r.tape_id)).filter((n) => !isNaN(n) && n > 0))
        );

        let videoLogsByInspId = new Map<number, any[]>();
        if (directInspIds.length > 0 || allTapeIds.length > 0) {
            let vLogQuery = (supabase as any)
                .from("insp_video_logs")
                .select("video_log_id, tape_id, inspection_id, event_type, timecode_start, time_in, tape_counter, remarks")
                .order("video_log_id", { ascending: true });

            if (directInspIds.length > 0) {
                vLogQuery = vLogQuery.in("inspection_id", directInspIds);
                const { data: vLogs } = await vLogQuery;
                (vLogs || []).forEach((vl: any) => {
                    const iid = Number(vl.inspection_id);
                    if (!videoLogsByInspId.has(iid)) videoLogsByInspId.set(iid, []);
                    videoLogsByInspId.get(iid)!.push(vl);
                });
            }
        }

        enrichedInspections.forEach((r: any) => {
            const d = (typeof r.inspection_data === "string" ? JSON.parse(r.inspection_data) : r.inspection_data) || {};
            const tapeObj = r.insp_video_tapes || {};
            const tapeNo = tapeObj.tape_no || d.tape_no || d.video_tape || d.dvd_no || "";
            const rawTc = r.tape_count_no || d.timecode || d.counter || d.video_ref || "";
            const timecode = formatTimecode(rawTc);
            const linkedLogs = videoLogsByInspId.get(Number(r.insp_id)) || [];

            const code = String(r.inspection_type_code || "").toUpperCase();
            let mode = r.rov_job_id ? "ROV" : "DIVING";
            if (code.startsWith("R") || code === "NAVIG") mode = "ROV";
            else if (code.startsWith("D")) mode = "DIVING";

            if (linkedLogs.length > 0) {
                linkedLogs.forEach((vl: any) => {
                    const tc = formatTimecode(vl.timecode_start || vl.tape_counter || rawTc);
                    const vKey = `vlog_${vl.video_log_id}`;
                    if (seenVideoKeys.has(vKey)) return;
                    seenVideoKeys.add(vKey);

                    videosList.push({
                        id: vKey,
                        tape_id: vl.tape_id || r.tape_id,
                        tape_no: tapeNo || `Tape #${vl.tape_id || r.tape_id}`,
                        chapter_no: tapeObj.chapter_no || null,
                        timecode: tc || "00:00:00",
                        event_type: vl.event_type || r.inspection_type_code || "Inspection Event",
                        remarks: vl.remarks || r.description || d.findings || "",
                        inspection_id: r.insp_id,
                        inspection_date: r.inspection_date,
                        jobpack_id: r.jobpack_id,
                        jobpack_name: r.jobpack_name,
                        sow_report_no: r.sow_report_no,
                        mode,
                    });
                });
            } else if (tapeNo || r.tape_id || timecode) {
                const vKey = `insp_vid_${r.insp_id}_${tapeNo}_${timecode}`;
                if (seenVideoKeys.has(vKey)) return;
                seenVideoKeys.add(vKey);

                videosList.push({
                    id: vKey,
                    tape_id: r.tape_id || null,
                    tape_no: tapeNo || (r.tape_id ? `Tape #${r.tape_id}` : "Video Log"),
                    chapter_no: tapeObj.chapter_no || null,
                    timecode: timecode || "—",
                    event_type: r.inspection_type_code || "Inspection",
                    remarks: r.description || d.findings || d.comments || "",
                    inspection_id: r.insp_id,
                    inspection_date: r.inspection_date,
                    jobpack_id: r.jobpack_id,
                    jobpack_name: r.jobpack_name,
                    sow_report_no: r.sow_report_no,
                    mode,
                });
            }
        });

        // 8. Fetch Photos & Attachments (Component, Inspection, and Anomaly level)
        const allAnomIds = anomalies.map((a) => Number(a.anomaly_id)).filter((n) => !isNaN(n) && n > 0);
        const rawPhotos: any[] = [];

        if (compIds.length > 0) {
            const { data: compAtts } = await supabase
                .from("attachment")
                .select("*")
                .in("source_id", compIds)
                .in("source_type", ["component", "COMPONENT", "structure_component", "STRUCTURE_COMPONENT", "structure_components"]);
            (compAtts || []).forEach((a: any) =>
                rawPhotos.push({ ...a, source_label: "Component", source_category: "Component" })
            );
        }

        if (directInspIds.length > 0) {
            const { data: inspAtts } = await supabase
                .from("attachment")
                .select("*")
                .in("source_id", directInspIds)
                .in("source_type", ["inspection", "INSPECTION", "insp_record", "INSP_RECORD"]);
            (inspAtts || []).forEach((a: any) => {
                const parent = enrichedInspections.find((r) => Number(r.insp_id) === Number(a.source_id));
                rawPhotos.push({
                    ...a,
                    source_label: parent ? `${parent.inspection_type_code || "Inspection"} (${parent.jobpack_name})` : "Inspection",
                    source_category: "Inspection",
                    jobpack_id: parent?.jobpack_id,
                    inspection_id: parent?.insp_id,
                });
            });

            const { data: inspMedia } = await (supabase as any)
                .from("insp_media")
                .select("*")
                .in("inspection_id", directInspIds);
            (inspMedia || []).forEach((m: any) => {
                const parent = enrichedInspections.find((r) => Number(r.insp_id) === Number(m.inspection_id));
                rawPhotos.push({
                    id: `media-${m.media_id}`,
                    name: m.name || m.file_name || `Snapshot ${m.media_id}`,
                    path: m.file_path,
                    source_id: m.inspection_id,
                    source_type: "Inspection",
                    source_label: parent ? `${parent.inspection_type_code || "Inspection"} (${parent.jobpack_name})` : "Inspection Snapshot",
                    source_category: "Inspection",
                    jobpack_id: parent?.jobpack_id,
                    inspection_id: parent?.insp_id,
                    meta: {
                        ...(typeof m.meta === "object" ? m.meta : {}),
                        bucket: "inspection-media",
                        is_insp_media: true,
                    },
                    created_at: m.captured_at || new Date().toISOString(),
                });
            });
        }

        if (allAnomIds.length > 0) {
            const { data: anomAtts } = await supabase
                .from("attachment")
                .select("*")
                .in("source_id", allAnomIds)
                .in("source_type", ["anomaly", "ANOMALY", "defect", "DEFECT"]);
            (anomAtts || []).forEach((a: any) => {
                const parent = anomalies.find((an) => Number(an.anomaly_id) === Number(a.source_id));
                rawPhotos.push({
                    ...a,
                    source_label: parent ? `Anomaly ${parent.display_ref_no}` : "Anomaly",
                    source_category: "Anomaly",
                    anomaly_id: parent?.anomaly_id,
                    inspection_id: parent?.inspection_id,
                    jobpack_id: parent?.jobpack_id,
                });
            });

            const { data: anomMedia } = await (supabase as any)
                .from("insp_media")
                .select("*")
                .in("anomaly_id", allAnomIds);
            (anomMedia || []).forEach((m: any) => {
                const parent = anomalies.find((an) => Number(an.anomaly_id) === Number(m.anomaly_id));
                rawPhotos.push({
                    id: `media-anom-${m.media_id}`,
                    name: m.name || m.file_name || `Anomaly Snapshot ${m.media_id}`,
                    path: m.file_path,
                    source_id: m.anomaly_id,
                    source_type: "Anomaly",
                    source_label: parent ? `Anomaly ${parent.display_ref_no}` : "Anomaly Snapshot",
                    source_category: "Anomaly",
                    anomaly_id: parent?.anomaly_id,
                    inspection_id: parent?.inspection_id,
                    jobpack_id: parent?.jobpack_id,
                    meta: {
                        ...(typeof m.meta === "object" ? m.meta : {}),
                        bucket: "inspection-media",
                        is_insp_media: true,
                    },
                    created_at: m.captured_at || new Date().toISOString(),
                });
            });
        }

        // Deduplicate photos/attachments and separate any video file attachments
        const seenPhotoKeys = new Set<string>();
        const photosList: any[] = [];

        rawPhotos.forEach((att: any) => {
            const key = String(att.id || att.path || "");
            if (!key || seenPhotoKeys.has(key)) return;
            seenPhotoKeys.add(key);

            let metaObj = att.meta;
            if (typeof metaObj === "string") {
                try { metaObj = JSON.parse(metaObj); } catch { metaObj = {}; }
            } else if (!metaObj || typeof metaObj !== "object") {
                metaObj = {};
            }

            const fileName = String(metaObj?.original_file_name || att.name || att.path || "");
            const ext = fileName.split(".").pop()?.toLowerCase() || "";
            const isVideoFile = ["mp4", "webm", "mov", "avi", "mkv"].includes(ext) || String(metaObj?.file_type || "").startsWith("video/");
            const isImage = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"].includes(ext) || String(metaObj?.file_type || "").startsWith("image/") || Boolean(metaObj?.is_insp_media);

            let fileUrl = att.file_url || att.url || "";
            if (!fileUrl) {
                if (metaObj?.bucket && att.path) {
                    fileUrl = `/api/attachment/download?path=${encodeURIComponent(att.path)}&bucket=${encodeURIComponent(metaObj.bucket)}`;
                } else if (typeof att.id === "number") {
                    fileUrl = `/api/attachment/url?id=${att.id}`;
                } else if (att.path?.startsWith("http") || att.path?.startsWith("/")) {
                    fileUrl = att.path;
                }
            }

            if (isVideoFile) {
                videosList.push({
                    id: `att_vid_${att.id}`,
                    tape_id: null,
                    tape_no: att.name || "Video Clip",
                    chapter_no: null,
                    timecode: "Video File",
                    event_type: att.source_category || "Media",
                    remarks: metaObj?.description || att.source_label || "",
                    inspection_id: att.inspection_id || null,
                    jobpack_id: att.jobpack_id || null,
                    file_url: fileUrl,
                });
            }

            photosList.push({
                id: att.id,
                name: att.name || fileName || "Attachment",
                path: att.path || "",
                file_url: fileUrl,
                is_image: isImage,
                is_video: isVideoFile,
                source_label: att.source_label || "Component",
                source_category: att.source_category || "Component",
                description: metaObj?.description || metaObj?.title || "",
                created_at: att.created_at || att.cr_date || null,
                inspection_id: att.inspection_id || null,
                anomaly_id: att.anomaly_id || null,
                jobpack_id: att.jobpack_id || null,
            });
        });

        return NextResponse.json({
            data: {
                component: comp,
                q_id: qid,
                jobpacks: jobpacksList,
                reports: reportsList,
                inspections: enrichedInspections,
                anomalies,
                videos: videosList,
                photos: photosList,
            },
        });
    } catch (error: any) {
        console.error("[QID Details API] Error:", error);
        return NextResponse.json({ error: error.message || "Failed to load QID details" }, { status: 500 });
    }
}

