
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/utils/supabase/client";
import { CompanySettings, ReportConfig } from "./defect-anomaly-report";

import { loadLogoWithTransparency, drawLogo, draw3SectionHeader, applyWatermarkAndSignaturesGlobal, normalizeReportRecords , applyRecordCellStyling, formatReportFindingText, REPORT_FOOTER_APP_TEXT } from "./shared-logo";

// Friendly labels for video log event types
const EVENT_TYPE_LABELS: Record<string, string> = {
    NEW_LOG_START: "Start Tape",
    START_TAPE: "Start Tape",
    END: "Stop Tape",
    STOP: "Stop Tape",
    STOP_TAPE: "Stop Tape",
    PAUSE: "Pause Tape",
    RESUME: "Resume Tape",
    START_TASK: "Start Task",
    STOP_TASK: "Stop Task",
    PAUSE_TASK: "Pause Task",
    RESUME_TASK: "Resume Task",
    INSPECTION: "Inspection",
    ANNOTATION: "Annotation",
    CHAPTER: "Chapter",
    NOTE: "Note",
    ANOMALY: "Anomaly Detected",
    SNAPSHOT: "Snapshot",
};

export const TASK_NAME_FALLBACKS: Record<string, string> = {
    NAVIG: "Pipeline Navigation Inspection",
    RGVI: "ROV General Visual Inspection",
    RFMD: "Flooded Member Detection",
    RSEAB: "Seabed Survey",
    RRISI: "Riser Inspection",
    RCOND: "Condition Assessment",
    RSCOR: "Scour / Marine Growth Survey",
    RMGI: "MGI Wall Thickness Survey",
    RCPSU: "Cathodic Protection Survey",
    BSINS: "Bolt Survey",
    CLEAN: "Cleaning Survey",
    CPCLB: "CP Calibration",
    CPSURV: "CP Survey",
    SZONE: "Splash Zone Survey",
    RSZCI: "Splash Zone Inspection",
    DSZCI: "Diving Splash Zone Inspection",
    UTCLB: "UT Calibration",
    UTWTK: "UT Wall Thickness",
    UTWT: "UT Wall Thickness",
    MGROW: "Marine Growth Survey",
    PL_AN: "Pipeline Anode Inspection",
    GVINS: "General Visual Inspection",
    RISER: "Riser Inspection",
    DANOD: "Diving Anode Inspection",
    RANOD: "ROV Anode Inspection",
    ITMAIN: "Item Maintenance Inspection",
};

export function getInspectionTaskName(code?: string | null): string {
    if (!code) return "";
    const cleanCode = String(code).trim().toUpperCase();
    if (TASK_NAME_FALLBACKS[cleanCode]) return TASK_NAME_FALLBACKS[cleanCode];
    return cleanCode;
}

export function parseTimecodeToSeconds(tc: any): number {
    if (tc === null || tc === undefined || tc === "" || tc === "—" || tc === "-") return -1;
    if (typeof tc === "number") return tc;
    const str = String(tc).trim();
    if (str.includes(":")) {
        const parts = str.split(":").map(Number);
        if (parts.length === 3 && parts.every(p => !isNaN(p))) {
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
        if (parts.length === 2 && parts.every(p => !isNaN(p))) {
            return parts[0] * 60 + parts[1];
        }
    }
    const num = Number(str);
    if (!isNaN(num)) return num;
    return -1;
}

export function formatTimecode(tc: any): string {
    if (tc === null || tc === undefined || tc === "" || tc === "—" || tc === "-") return "—";
    const str = String(tc).trim();
    if (str.includes(":")) {
        const parts = str.split(":");
        if (parts.length === 2) return `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
        if (parts.length === 3) return parts.map(p => p.padStart(2, "0")).join(":");
        return str;
    }
    const num = Number(str);
    if (!isNaN(num) && num >= 0) {
        const hrs = Math.floor(num / 3600);
        const mins = Math.floor((num % 3600) / 60);
        const secs = Math.floor(num % 60);
        return [hrs, mins, secs].map(v => String(v).padStart(2, "0")).join(":");
    }
    return str;
}

export function formatInspectionDateTime(dateStr?: string | null, timeStr?: string | null): string {
    if (!dateStr) return "—";
    let d = dateStr;
    let t = timeStr || "";
    if (d.includes("T")) {
        const parts = d.split("T");
        d = parts[0];
        if (!t) t = parts[1];
    }
    const [y, m, day] = d.split("-");
    const formattedDate = (y && m && day) ? `${day.padStart(2, "0")}/${m.padStart(2, "0")}/${y}` : d;
    if (!t) return formattedDate;
    const timeClean = t.replace(/Z|[\+\-].*$/, "").trim();
    const timeParts = timeClean.split(":");
    const formattedTime = timeParts.length >= 2 ? `${timeParts[0].padStart(2, "0")}:${timeParts[1].padStart(2, "0")}` : timeClean;
    return `${formattedDate}, ${formattedTime}`;
}

function friendlyEventType(eventType: string): string {
    if (!eventType) return "—";
    if (EVENT_TYPE_LABELS[eventType]) return EVENT_TYPE_LABELS[eventType];
    const upper = String(eventType).toUpperCase();
    if (EVENT_TYPE_LABELS[upper]) return EVENT_TYPE_LABELS[upper];
    return eventType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export const generateVideoLogReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    const supabase = createClient();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    // ── Fetch Data ──────────────────────────────────────────────────────────
    let tapes: any[] = [];
    try {
        let url = `/api/reports/video-log?`;
        if (jobPack?.id) url += `jobpack_id=${jobPack.id}&`;
        if (sowReportNo) url += `sow_report_no=${sowReportNo}&`;
        if (structure?.id) url += `structure_id=${structure.id}&`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.data) tapes = json.data;
    } catch (e) {
        console.error("Error fetching video log data", e);
    }

    // ── Logos ────────────────────────────────────────────────────────────────
    let clientLogo: any = null;
    if (companySettings.logo_url) clientLogo = await loadLogoWithTransparency(companySettings.logo_url);

    let contractorLogo: any = null;
    let contractorName = "";
    if (config.showContractorLogo) {
        const contractorId = jobPack?.metadata?.contrac;
        if (contractorId) {
            try {
                const cid = String(contractorId);
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
                let q = supabase.from("u_lib_list").select("logo_url, lib_desc").eq("lib_code", "CONTR_NAM");
                q = isUUID ? q.or(`id.eq.${cid},lib_id.eq.${cid}`) : q.eq("lib_id", cid);
                const { data } = await q.maybeSingle();
                if (data?.logo_url) contractorLogo = await loadLogoWithTransparency(data.logo_url);
                if (data?.lib_desc) contractorName = data.lib_desc;
            } catch (e) { console.error("Error fetching contractor logo", e); }
        }
    }

    // ── Layout Constants ─────────────────────────────────────────────────────
    const headerH = 25;
    const isPrintFriendly = config.printFriendly === true;
    const FOOTER_Y_OFFSET = 10;

    // ── Draw Header ──────────────────────────────────────────────────────────
    const drawHeader = (d: jsPDF) => {
        const reportNoDisplay = sowReportNo || jobPack?.metadata?.report_no || (config as any)?.reportNoPrefix || (config as any)?.headerData?.sowReportNo || "N/A";
        const structName = structure?.str_name ? `${structure.str_name}${structure.title ? ` - ${structure.title}` : ''}` : jobPack?.name;

        draw3SectionHeader(d, {
            reportTitle: "Video Log Report",
            reportNo: reportNoDisplay,
            structureName: structName,
            companySettings,
            config,
            contractorLogoData: contractorLogo,
            clientLogoData: clientLogo,
            isPrintFriendly,
            margin: 10,
            headerY: 7,
            headerH: 25,
            orientation: "portrait"
        });
    };

    // ── Summary Sub-Header ───────────────────────────────────────────────────
    const drawSubHeader = (d: jsPDF) => {
        const field = structure?.field_name || structure?.str_name || "N/A";
        const installation = structure?.str_name || structure?.str_desc || "N/A";
        const vessel = jobPack?.metadata?.vessel || "N/A";
        const projectDesc = jobPack?.name || "N/A";

        const labelColWidth = 32;
        const valueColWidth = (contentWidth - labelColWidth * 2) / 2;

        const headStyle = isPrintFriendly
            ? { fillColor: [255, 255, 255] as [number, number, number], textColor: [7, 78, 136] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [200, 200, 200] as [number, number, number] }
            : { fillColor: [229, 231, 235] as [number, number, number], textColor: [0, 0, 0] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [200, 200, 200] as [number, number, number] };

        autoTable(d, {
            startY: margin + headerH + 2,
            head: [],
            body: [
                [
                    { content: "Project Description:", styles: headStyle },
                    { content: projectDesc },
                    { content: "Installation:", styles: headStyle },
                    { content: installation }
                ],
                [
                    { content: "Field:", styles: headStyle },
                    { content: field },
                    { content: "Vessel:", styles: headStyle },
                    { content: vessel }
                ]
            ] as any,
            theme: "grid",
            tableLineWidth: 0.1,
            tableLineColor: [200, 200, 200],
            styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: labelColWidth },
                1: { cellWidth: valueColWidth },
                2: { cellWidth: labelColWidth },
                3: { cellWidth: valueColWidth }
            },
            margin: { left: margin, right: margin, top: margin + headerH + 2 }
        });
    };

    if (tapes.length === 0) {
        // Direct Supabase fetch fallback if API fetch didn't return data
        try {
            const jobpackId = jobPack?.id;
            const structureId = structure?.id;
            if (jobpackId) {
                let diveJobsQ = (supabase as any).from("insp_dive_jobs").select("dive_job_id, dive_no").eq("jobpack_id", jobpackId);
                if (structureId) diveJobsQ = diveJobsQ.eq("structure_id", structureId);
                const { data: dj } = await diveJobsQ;

                let rovJobsQ = (supabase as any).from("insp_rov_jobs").select("rov_job_id, deployment_no").eq("jobpack_id", jobpackId);
                if (structureId) rovJobsQ = rovJobsQ.eq("structure_id", structureId);
                const { data: rj } = await rovJobsQ;

                const djIds = (dj || []).map((j: any) => j.dive_job_id);
                const rjIds = (rj || []).map((j: any) => j.rov_job_id);

                if (djIds.length > 0 || rjIds.length > 0) {
                    const diveMap: Record<number, string> = {};
                    (dj || []).forEach((j: any) => { diveMap[j.dive_job_id] = j.dive_no; });
                    (rj || []).forEach((j: any) => { diveMap[j.rov_job_id] = j.deployment_no; });

                    let tQuery = (supabase as any).from("insp_video_tapes").select("tape_id, tape_no, dive_job_id, rov_job_id, status, chapter_no, remarks").order("tape_no", { ascending: true });
                    if (djIds.length > 0 && rjIds.length > 0) {
                        tQuery = tQuery.or(`dive_job_id.in.(${djIds.join(",")}),rov_job_id.in.(${rjIds.join(",")})`);
                    } else if (djIds.length > 0) {
                        tQuery = tQuery.in("dive_job_id", djIds);
                    } else {
                        tQuery = tQuery.in("rov_job_id", rjIds);
                    }
                    const { data: rawTapes } = await tQuery;
                    if (rawTapes && rawTapes.length > 0) {
                        const rawTapeIds = rawTapes.map((t: any) => t.tape_id);
                        const { data: rawLogs } = await (supabase as any).from("insp_video_logs").select("video_log_id, tape_id, event_type, event_time, timecode_start, tape_counter_start, remarks, inspection_id").in("tape_id", rawTapeIds).order("event_time", { ascending: true });
                        
                        const lByTape: Record<number, any[]> = {};
                        (rawLogs || []).forEach((l: any) => {
                            if (!lByTape[l.tape_id]) lByTape[l.tape_id] = [];
                            lByTape[l.tape_id].push(l);
                        });

                        // Also fetch insp_records for fallback
                        try {
                            const { data: rawInspRecs } = await (supabase as any)
                                .from("insp_records")
                                .select("insp_id, tape_id, component_id, inspection_type_code, tape_count_no, description, inspection_date, inspection_time, inspection_data, structure_components:component_id(id, q_id)")
                                .in("tape_id", rawTapeIds);

                            (rawInspRecs || []).forEach((r: any) => {
                                const targetTapeId = r.tape_id;
                                if (!targetTapeId) return;
                                const rawTc = r.inspection_data?.tape_count_no || r.inspection_data?._meta_timecode || r.tape_count_no;
                                const timecode = formatTimecode(rawTc);
                                const dateStr = r.inspection_date || r.inspection_data?.inspection_date || "";
                                const timeStr = r.inspection_time || r.inspection_data?.inspection_time || "";
                                const qid = r.structure_components?.q_id || r.inspection_data?.q_id || r.inspection_data?.qid || "";
                                const taskCode = r.inspection_type_code || "";
                                const taskName = getInspectionTaskName(taskCode);

                                const inspLog = {
                                    video_log_id: `insp_${r.insp_id}`,
                                    tape_id: targetTapeId,
                                    event_type: "INSPECTION",
                                    is_inspection: true,
                                    event_time: dateStr && timeStr ? `${dateStr}T${timeStr}` : (dateStr || ""),
                                    date_time_display: formatInspectionDateTime(dateStr, timeStr),
                                    timecode_start: timecode,
                                    tape_counter_start: r.tape_count_no,
                                    qid,
                                    inspection_task: taskName,
                                    inspection_type_code: taskCode,
                                    description: r.description,
                                    remarks: r.description || r.inspection_data?.finding || r.inspection_data?.remarks || "",
                                    inspection_id: r.insp_id,
                                    inspection_data: r.inspection_data,
                                    structure_components: r.structure_components,
                                    insp_records: r
                                };

                                if (!lByTape[targetTapeId]) lByTape[targetTapeId] = [];
                                lByTape[targetTapeId].push(inspLog);
                            });
                        } catch (recErr) {
                            console.warn("[VideoLog] Fallback insp_records fetch failed:", recErr);
                        }

                        tapes = rawTapes.map((t: any) => ({
                            ...t,
                            dive_no: diveMap[t.dive_job_id] || diveMap[t.rov_job_id] || null,
                            logs: lByTape[t.tape_id] || []
                        })).filter((t: any) => t.logs.length > 0);
                    }
                }
            }
        } catch (e) {
            console.warn("[VideoLog] Direct fetch fallback failed:", e);
        }
    }

    if (tapes.length === 0) {
        if ((config as any).isBlankReport) {
            tapes = [{
                tape_no: "__________",
                tape_type: "Video Tape",
                logs: Array.from({ length: 8 }, (_, i) => ({
                    counter_no: "",
                    dive_no: "",
                    component_qid: "",
                    elevation: "",
                    description: "",
                    remarks: ""
                }))
            }];
        } else if (config.returnBlob) {
            tapes = [{
                tape_no: "N/A",
                tape_type: "Video Tape",
                logs: []
            }];
        } else {
            return null;
        }
    }

    // ── First Page ───────────────────────────────────────────────────────────
    drawHeader(doc);
    drawSubHeader(doc);
    let currentY = ((doc as any).lastAutoTable?.finalY ?? (margin + headerH + 20)) + 6;
    let isFirstPage = true;

    // ── Per-Tape Groups ──────────────────────────────────────────────────────
    // Sort tapes by tape_no ascending, keeping chapters in numeric sequence
    const sortedTapes = [...tapes].sort((a, b) => {
        const an = String(a.tape_no ?? "").toLowerCase();
        const bn = String(b.tape_no ?? "").toLowerCase();

        // If same tape_no, sort by chapter_no numeric ascending
        if (an === bn) {
            const chA = Number(a.chapter_no);
            const chB = Number(b.chapter_no);
            if (!isNaN(chA) && !isNaN(chB) && chA !== chB) {
                return chA - chB;
            }
            return String(a.chapter_no ?? "").localeCompare(String(b.chapter_no ?? ""), undefined, { numeric: true });
        }

        const aLogs = a.logs || [];
        const bLogs = b.logs || [];
        
        let aTime = Infinity;
        for (const log of aLogs) {
            if (log.event_time) {
                const t = new Date(log.event_time).getTime();
                if (t < aTime) aTime = t;
            }
        }
        
        let bTime = Infinity;
        for (const log of bLogs) {
            if (log.event_time) {
                const t = new Date(log.event_time).getTime();
                if (t < bTime) bTime = t;
            }
        }
        
        if (aTime !== bTime && aTime !== Infinity && bTime !== Infinity) {
            return aTime - bTime;
        }
        
        return an.localeCompare(bn, undefined, { numeric: true });
    });

    for (let i = 0; i < sortedTapes.length; i++) {
        const tape = sortedTapes[i];
        const logs = [...(tape.logs || [])].sort((a: any, b: any) => {
            const secA = parseTimecodeToSeconds(a.timecode_start);
            const secB = parseTimecodeToSeconds(b.timecode_start);

            if (secA !== -1 && secB !== -1 && secA !== secB) {
                return secA - secB;
            }

            const isStartA = a.event_type === "NEW_LOG_START" || a.event_type === "START_TAPE";
            const isStartB = b.event_type === "NEW_LOG_START" || b.event_type === "START_TAPE";
            if (isStartA && !isStartB) return -1;
            if (!isStartA && isStartB) return 1;

            const isEndA = a.event_type === "END" || a.event_type === "STOP" || a.event_type === "STOP_TAPE";
            const isEndB = b.event_type === "END" || b.event_type === "STOP" || b.event_type === "STOP_TAPE";
            if (isEndA && !isEndB) return 1;
            if (!isEndA && isEndB) return -1;

            const aT = a.event_time ? new Date(a.event_time).getTime() : 0;
            const bT = b.event_time ? new Date(b.event_time).getTime() : 0;
            return aT - bT;
        });

        // Ensure there is space for the section header + at least a few rows
        if (!isFirstPage && currentY > pageHeight - margin - FOOTER_Y_OFFSET - 30) {
            doc.addPage();
            drawHeader(doc);
            currentY = margin + headerH + 6;
        }

        // Tape section header bar
        const tapeLabel = `Tape No: ${tape.tape_no ?? `Tape #${tape.tape_id}`}`;
        const diveLabel = tape.dive_no ? `Dive No: ${tape.dive_no}` : "";
        const chapterLabel = tape.chapter_no ? `Chapter: ${tape.chapter_no}` : "";
        const headerParts = [tapeLabel, diveLabel, chapterLabel].filter(Boolean).join("   |   ");

        if (isPrintFriendly) {
            doc.setFillColor(240, 240, 240);
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            doc.rect(margin, currentY, contentWidth, 7, "FD");
        } else {
            doc.setFillColor(7, 78, 136);
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            doc.rect(margin, currentY, contentWidth, 7, "FD");
        }
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
        doc.text(headerParts, margin + 3, currentY + 5);
        doc.setTextColor(0, 0, 0);
        currentY += 8;

        // Log rows
        const tableBody: any[][] = [];

        if (logs.length === 0) {
            tableBody.push([{ content: "No log entries for this tape.", colSpan: 5, styles: {halign: "center", textColor: [100, 100, 100], lineWidth: 0.1, lineColor: [200, 200, 200]} }]);
        } else {
            logs.forEach((log: any, idx: number) => {
                const eventDateTime = log.date_time_display || (log.event_time
                    ? (() => {
                        let t = String(log.event_time).trim().replace(" ", "T");
                        if (!t.includes("Z") && !/[\+\-]\d{2}(:\d{2})?$/.test(t)) {
                            t = `${t}Z`;
                        }
                        const d = new Date(t);
                        return isNaN(d.getTime())
                            ? "—"
                            : d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
                    })()
                    : "—");

                const timecode = formatTimecode(log.timecode_start ?? log.tape_counter_start);
                const isInspection = log.event_type === "INSPECTION" || Boolean(log.is_inspection) || Boolean(log.qid) || Boolean(log.inspection_task);

                let actionDisplay = "";

                if (isInspection) {
                    const taskCode = log.inspection_type_code || log.insp_records?.inspection_type_code || "";
                    const taskName = log.inspection_task || getInspectionTaskName(taskCode);
                    const qid = log.qid || log.structure_components?.q_id || log.insp_records?.structure_components?.q_id || log.inspection_data?.q_id || log.inspection_data?.qid || log.insp_records?.inspection_data?.q_id || log.insp_records?.inspection_data?.qid || "—";

                    const actionHeader = taskCode ? `Inspection (${taskCode})` : "Inspection";
                    const metaLine = `QID: ${qid}   |   Task: ${taskName || "General Visual Inspection"}`;

                    const remarkParts: string[] = [];
                    const inspDesc = log.insp_records?.description ?? log.description ?? "";
                    if (inspDesc && String(inspDesc).trim()) {
                        remarkParts.push(String(inspDesc).trim());
                    }
                    const inspData = log.insp_records?.inspection_data ?? log.inspection_data ?? {};
                    const dataRemark = inspData.remarks ?? inspData.notes ?? inspData.comments ?? inspData.comment ?? inspData.finding ?? inspData.findings ?? "";
                    if (dataRemark && String(dataRemark).trim() && !remarkParts.includes(String(dataRemark).trim())) {
                        remarkParts.push(String(dataRemark).trim());
                    }
                    const directRemark = log.remarks ?? log.remark ?? log.notes ?? log.note ?? "";
                    if (directRemark && String(directRemark).trim() && !remarkParts.includes(String(directRemark).trim())) {
                        remarkParts.push(String(directRemark).trim());
                    }

                    const remarksText = remarkParts.join("\n");
                    actionDisplay = remarksText
                        ? `${actionHeader}\n${metaLine}\n${remarksText}`
                        : `${actionHeader}\n${metaLine}`;
                } else {
                    const action = friendlyEventType(log.event_type || log.action);
                    const remarkParts: string[] = [];
                    const directRemark = log.remarks ?? log.remark ?? log.notes ?? log.note ?? "";
                    if (directRemark && String(directRemark).trim()) {
                        remarkParts.push(String(directRemark).trim());
                    }
                    const inspDesc = log.insp_records?.description ?? log.description ?? "";
                    if (inspDesc && String(inspDesc).trim() && !remarkParts.includes(String(inspDesc).trim())) {
                        remarkParts.push(String(inspDesc).trim());
                    }
                    const remarksText = remarkParts.join("\n");
                    actionDisplay = remarksText ? `${action}\n${remarksText}` : action;
                }

                tableBody.push([
                    String(idx + 1),
                    tape.dive_no ?? "—",
                    actionDisplay,
                    timecode,
                    eventDateTime
                ]);
            });
        }

        autoTable(doc, {
            startY: currentY,
            head: [["#", "Dive No", "Action / Remarks", "Timecode", "Date & Time"]],
            body: tableBody,
            theme: "grid",
            tableLineWidth: 0.1,
            tableLineColor: [200, 200, 200],
            headStyles: {
                fillColor: isPrintFriendly ? [229, 231, 235] : [7, 78, 136],
                textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
                fontStyle: "bold",
                fontSize: 8,
                lineWidth: 0.1,
                lineColor: [200, 200, 200]
            },
            styles: { fontSize: 8, cellPadding: 2, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 20, halign: "center" },
                2: { cellWidth: contentWidth - 10 - 20 - 28 - 36 },
                3: { cellWidth: 28, halign: "center" },
                4: { cellWidth: 36, halign: "center" }
            },
            margin: { left: margin, right: margin, top: margin + headerH + 6 },
            didDrawPage: (data: any) => {
                if (data.pageNumber > 1) {
                    drawHeader(doc);
                }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
        isFirstPage = false;
    }

    // ── Footer on every page ─────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    const printedDateStr = `Printed: ${new Date().toLocaleDateString("en-GB")}`;

    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");

        const footerLineY = pageHeight - FOOTER_Y_OFFSET;

        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(margin, footerLineY, pageWidth - margin, footerLineY);

        doc.setTextColor(100, 100, 100);
        doc.text(REPORT_FOOTER_APP_TEXT, margin, footerLineY + 4);

        if (config.showPageNumbers) {
            doc.setTextColor(100, 100, 100);
            doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, footerLineY + 4, { align: "center" });
        }

        doc.setTextColor(100, 100, 100);
        doc.text(printedDateStr, pageWidth - margin, footerLineY + 4, { align: "right" });
    }

    applyWatermarkAndSignaturesGlobal(doc, config);
    if (config.returnBlob) return doc.output("blob");
    applyWatermarkAndSignaturesGlobal(doc, config);
    doc.save(`${config.reportNoPrefix}_VideoLog.pdf`);
};
