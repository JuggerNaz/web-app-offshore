
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/utils/supabase/client";
import { CompanySettings, ReportConfig } from "./defect-anomaly-report";

import {
    loadLogoWithTransparency,
    drawLogo,
    draw3SectionHeader,
    applyWatermarkAndSignaturesGlobal,
    normalizeReportRecords,
    applyRecordCellStyling,
    formatReportFindingText,
    getRecordStatusInfo,
    REPORT_COLORS,
    REPORT_FOOTER_APP_TEXT
} from "./shared-logo";

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

export function calculateTapeDurationSeconds(logs: any[]): number {
    if (!logs || logs.length === 0) return 0;
    const validSeconds = logs
        .map(l => parseTimecodeToSeconds(l.timecode_start ?? l.tape_counter_start))
        .filter(s => s >= 0);

    if (validSeconds.length >= 2) {
        return Math.max(0, Math.max(...validSeconds) - Math.min(...validSeconds));
    }
    if (validSeconds.length === 1 && validSeconds[0] > 0) {
        return validSeconds[0];
    }

    const validTimes = logs
        .map(l => l.event_time ? new Date(l.event_time).getTime() : 0)
        .filter(t => t > 0 && !isNaN(t));
    if (validTimes.length >= 2) {
        return Math.max(0, Math.round((Math.max(...validTimes) - Math.min(...validTimes)) / 1000));
    }
    return 0;
}

export function formatDurationSummary(totalSeconds: number): string {
    if (totalSeconds <= 0) return "00:00:00";
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    if (hrs > 0) {
        return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
}

export function formatDurationHMS(totalSeconds: number): string {
    if (totalSeconds <= 0) return "00:00:00";
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    return [hrs, mins, secs].map(v => String(v).padStart(2, "0")).join(":");
}

export interface DetectedAnomalyInfo {
    isAnomalyOrFinding: boolean;
    isFinding: boolean;
    isAnomaly: boolean;
    refNo: string;
    description: string;
    actionLabel: string;
}

/**
 * Detects if a log entry represents an anomaly or finding, extracting its reference number and description.
 */
export function detectLogAnomalyOrFinding(log: any): DetectedAnomalyInfo {
    if (!log) {
        return { isAnomalyOrFinding: false, isFinding: false, isAnomaly: false, refNo: "", description: "", actionLabel: "" };
    }

    const rec = log.insp_records || (log.is_inspection ? log : null);
    const recStatus = rec ? getRecordStatusInfo(rec) : null;
    const d = log.inspection_data || rec?.inspection_data || {};
    const anomsList = Array.isArray(log.insp_anomalies)
        ? log.insp_anomalies
        : (Array.isArray(rec?.insp_anomalies) ? rec.insp_anomalies : []);
    const primaryAnom = anomsList[0] || null;

    // ONLY count if the status is explicitly stated as Anomaly (do NOT check finding possibilities)
    const isExplicitAnomaly = Boolean(
        log.has_anomaly === true ||
        log.has_anomaly === 1 ||
        log.is_anomaly === true ||
        log.is_anomaly === 1 ||
        log.event_type === "ANOMALY" ||
        log.status === "Anomaly" ||
        log.status === "Defect" ||
        rec?.has_anomaly === true ||
        rec?.has_anomaly === 1 ||
        rec?.status === "Anomaly" ||
        rec?.status === "Defect" ||
        recStatus?.isAnomaly === true ||
        d.has_anomaly === true ||
        d.has_anomaly === 1 ||
        d.is_anomaly === true ||
        d.is_anomaly === 1 ||
        anomsList.length > 0
    );

    if (!isExplicitAnomaly) {
        return {
            isAnomalyOrFinding: false,
            isFinding: false,
            isAnomaly: false,
            refNo: "",
            description: "",
            actionLabel: ""
        };
    }

    // Extract reference number strictly for confirmed anomalies
    let refNo = String(
        primaryAnom?.anomaly_ref_no ||
        log.anomaly_ref_no ||
        log.ref_no ||
        recStatus?.anomalyRefNo ||
        d.anomaly_ref_no ||
        d._meta_ref_no ||
        rec?.anomaly_ref_no ||
        ""
    ).trim();

    if (!refNo) {
        const fullText = `${log.remarks || ""} ${log.description || ""} ${rec?.description || ""}`;
        const refMatch = fullText.match(/\b(A-\d{3,}[A-Za-z0-9_-]*)\b/i) || fullText.match(/Anomaly\s+(?:No\.?|Ref(?:erence)?\.?|#)?\s*[:\-]?\s*([A-Za-z0-9_-]+)/i);
        if (refMatch) {
            refNo = refMatch[1].trim();
        }
    }

    const description = String(
        primaryAnom?.defect_description ||
        log.defect_description ||
        recStatus?.defectDescription ||
        d.defect_description ||
        d.anomaly_description ||
        ""
    ).trim();

    return {
        isAnomalyOrFinding: true,
        isFinding: false,
        isAnomaly: true,
        refNo,
        description,
        actionLabel: "Anomaly Detected"
    };
}

export interface VideoLogTapeAnalytics {
    tapeNo: string;
    tapeId: any;
    diveNos: string[];
    chapterNos: (string | number)[];
    chapterCount: number;
    totalLogsCount: number;
    inspectionCount: number;
    durationSeconds: number;
    anomalyCount: number;
    anomalyRefs: string[];
    chapterBreakdown: Array<{
        chapterNo: string | number;
        diveNo?: string;
        logsCount: number;
        durationSeconds: number;
        inspectionCount: number;
        anomalyCount: number;
        sampleRemark?: string;
    }>;
}

export interface VideoLogExecutiveSummary {
    totalTapesCount: number;
    totalChaptersCount: number;
    totalDurationSeconds: number;
    totalLogsCount: number;
    totalDivesCount: number;
    totalInspectionsCount: number;
    completedInspectionsCount: number;
    incompleteInspectionsCount: number;
    totalAnomaliesCount: number;
    uniqueAnomalyRefsCount: number;
    uniqueQidsCount: number;
    avgChaptersPerTape: number;
    tapesBreakdown: VideoLogTapeAnalytics[];
    eventCategories: {
        inspections: number;
        operations: number;
        anomalies: number;
        annotations: number;
    };
    sowScope?: {
        total: number;
        completed: number;
        incomplete: number;
        pending: number;
        completionPct: number;
    };
    recordsSummary?: {
        totalRecords: number;
        completedRecords: number;
        incompleteRecords: number;
        deploymentsCount: number;
    };
}

export function compileVideoLogAnalytics(tapes: any[], meta?: any): VideoLogExecutiveSummary {
    const tapeMap = new Map<string, VideoLogTapeAnalytics>();
    const allDives = new Set<string>();
    const allQids = new Set<string>();
    const allAnomalyRefs = new Set<string>();
    const allDeploymentIds = new Set<any>();
    let grandTotalLogs = 0;
    let grandTotalInspections = 0;
    let grandTotalIncomplete = 0;
    let grandTotalAnomalies = 0;
    let grandTotalDuration = 0;

    const eventCategories = {
        inspections: 0,
        operations: 0,
        anomalies: 0,
        annotations: 0,
    };

    const isOpEvent = (evt: string) => {
        const u = String(evt || "").toUpperCase();
        return [
            "START_TAPE", "STOP_TAPE", "NEW_LOG_START", "END", "STOP",
            "PAUSE", "RESUME", "START_TASK", "STOP_TASK", "PAUSE_TASK", "RESUME_TASK"
        ].includes(u);
    };

    const isRecIncomplete = (log: any) => {
        const rec = log.insp_records || log;
        const d = log.inspection_data || rec.inspection_data || {};
        const status = String(log.status || rec.status || d.status || "").toUpperCase().trim();
        if (status === "INCOMPLETE") return true;
        if (log.is_incomplete === true || rec.is_incomplete === true) return true;
        if (log.reason_id != null && Number(log.reason_id) > 0) return true;
        if (rec.reason_id != null && Number(rec.reason_id) > 0) return true;
        if (d.reason_id != null && Number(d.reason_id) > 0) return true;
        const incompleteReason = String(log.incomplete_reason || rec.incomplete_reason || d.incomplete_reason || d.incompleteReason || "").trim();
        if (incompleteReason && incompleteReason.length > 0 && incompleteReason !== "-" && incompleteReason !== "—") return true;
        const desc = String(log.remarks || log.description || rec.description || "").trim().toUpperCase();
        if (desc.startsWith("INCOMPLETE:") || desc.startsWith("STATUS: INCOMPLETE")) return true;
        return false;
    };

    const attachedMeta = meta || (tapes as any)?.meta;

    (tapes || []).forEach((t: any) => {
        if (!t) return;
        const rawTapeNo = String(t.tape_no || (t.tape_id ? `Tape #${t.tape_id}` : "Unknown Tape")).trim();
        const logs = t.logs || [];
        const durationSec = calculateTapeDurationSeconds(logs);

        if (!tapeMap.has(rawTapeNo)) {
            tapeMap.set(rawTapeNo, {
                tapeNo: rawTapeNo,
                tapeId: t.tape_id,
                diveNos: [],
                chapterNos: [],
                chapterCount: 0,
                totalLogsCount: 0,
                inspectionCount: 0,
                durationSeconds: 0,
                anomalyCount: 0,
                anomalyRefs: [],
                chapterBreakdown: [],
            });
        }

        const entry = tapeMap.get(rawTapeNo)!;
        entry.durationSeconds += durationSec;
        grandTotalDuration += durationSec;

        const ch = t.chapter_no !== null && t.chapter_no !== undefined && String(t.chapter_no).trim() !== ""
            ? String(t.chapter_no).trim()
            : `Ch-${entry.chapterBreakdown.length + 1}`;
        if (!entry.chapterNos.includes(ch)) {
            entry.chapterNos.push(ch);
        }

        const dive = t.dive_no ? String(t.dive_no).trim() : "";
        if (dive && !entry.diveNos.includes(dive)) {
            entry.diveNos.push(dive);
            allDives.add(dive);
        }
        if (t.rov_job_id) allDeploymentIds.add(`ROV_${t.rov_job_id}`);
        if (t.dive_job_id) allDeploymentIds.add(`DIVE_${t.dive_job_id}`);

        let chInspections = 0;
        let chAnomalies = 0;
        let sampleRemark = "";

        logs.forEach((log: any) => {
            grandTotalLogs++;
            entry.totalLogsCount++;

            const anomInfo = detectLogAnomalyOrFinding(log);
            const isAnomalyOrFinding = anomInfo.isAnomalyOrFinding;

            if (isAnomalyOrFinding) {
                grandTotalAnomalies++;
                entry.anomalyCount++;
                chAnomalies++;
                eventCategories.anomalies++;
                if (anomInfo.refNo) {
                    allAnomalyRefs.add(anomInfo.refNo);
                    if (!entry.anomalyRefs.includes(anomInfo.refNo)) {
                        entry.anomalyRefs.push(anomInfo.refNo);
                    }
                }
            }

            const isInsp = Boolean(
                log.is_inspection ||
                log.event_type === "INSPECTION" ||
                log.qid ||
                log.inspection_task ||
                log.inspection_id
            );

            if (isInsp) {
                grandTotalInspections++;
                entry.inspectionCount++;
                chInspections++;
                if (isRecIncomplete(log)) {
                    grandTotalIncomplete++;
                }
                if (!isAnomalyOrFinding) {
                    eventCategories.inspections++;
                }
                const qid = String(log.qid || log.inspection_data?.q_id || log.inspection_data?.qid || "").trim();
                if (qid && qid !== "—" && qid !== "N/A" && qid !== "-") {
                    allQids.add(qid);
                }
                if (!sampleRemark && log.remarks) sampleRemark = String(log.remarks).trim();
            } else if (!isAnomalyOrFinding) {
                if (isOpEvent(log.event_type)) {
                    eventCategories.operations++;
                } else {
                    eventCategories.annotations++;
                }
                if (!sampleRemark && log.remarks) sampleRemark = String(log.remarks).trim();
            } else {
                if (!sampleRemark && log.remarks) sampleRemark = String(log.remarks).trim();
            }

            const logDive = log.dive_no || log.deployment_no || log.inspection_data?.dive_no;
            if (logDive && String(logDive).trim() !== "") {
                const s = String(logDive).trim();
                allDives.add(s);
                if (!entry.diveNos.includes(s)) entry.diveNos.push(s);
            }
            if (log.rov_job_id || log.insp_records?.rov_job_id) allDeploymentIds.add(`ROV_${log.rov_job_id || log.insp_records?.rov_job_id}`);
            if (log.dive_job_id || log.insp_records?.dive_job_id) allDeploymentIds.add(`DIVE_${log.dive_job_id || log.insp_records?.dive_job_id}`);
        });

        entry.chapterBreakdown.push({
            chapterNo: ch,
            diveNo: dive || undefined,
            logsCount: logs.length,
            durationSeconds: durationSec,
            inspectionCount: chInspections,
            anomalyCount: chAnomalies,
            sampleRemark: sampleRemark.length > 30 ? sampleRemark.substring(0, 28) + "..." : sampleRemark,
        });
    });

    // Sort tapesBreakdown naturally ascending by tapeNo (e.g. V001R, V002R, ..., V014R)
    const tapesBreakdown: VideoLogTapeAnalytics[] = Array.from(tapeMap.values()).map(t => {
        const count = t.chapterNos.length > 0 ? t.chapterNos.length : (t.chapterBreakdown.length > 0 ? t.chapterBreakdown.length : 1);
        return {
            ...t,
            chapterCount: count,
        };
    }).sort((a, b) => a.tapeNo.localeCompare(b.tapeNo, undefined, { numeric: true, sensitivity: 'base' }));

    const totalTapesCount = tapesBreakdown.length;
    const totalChaptersCount = tapesBreakdown.reduce((sum, t) => sum + t.chapterCount, 0);
    const avgChaptersPerTape = totalTapesCount > 0 ? parseFloat((totalChaptersCount / totalTapesCount).toFixed(1)) : 0;

    const sowScope = attachedMeta?.sow_scope || attachedMeta?.sowScope;
    const recordsSummary = attachedMeta?.records_summary || attachedMeta?.recordsSummary;

    const totalDivesCount = Math.max(
        allDives.size,
        allDeploymentIds.size,
        recordsSummary?.deploymentsCount || 0
    );

    const completedInspectionsCount = recordsSummary?.completedRecords !== undefined
        ? recordsSummary.completedRecords
        : Math.max(0, grandTotalInspections - grandTotalIncomplete);

    const incompleteInspectionsCount = recordsSummary?.incompleteRecords !== undefined
        ? recordsSummary.incompleteRecords
        : grandTotalIncomplete;

    return {
        totalTapesCount,
        totalChaptersCount,
        totalDurationSeconds: grandTotalDuration,
        totalLogsCount: grandTotalLogs,
        totalDivesCount,
        totalInspectionsCount: grandTotalInspections,
        completedInspectionsCount,
        incompleteInspectionsCount,
        totalAnomaliesCount: grandTotalAnomalies,
        uniqueAnomalyRefsCount: allAnomalyRefs.size,
        uniqueQidsCount: allQids.size,
        avgChaptersPerTape,
        tapesBreakdown,
        eventCategories,
        sowScope,
        recordsSummary,
    };
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
    let tapes: any[] = (config as any)?.tapes || (jobPack as any)?.tapes || [];
    if (tapes.length === 0) {
        try {
            let url = `/api/reports/video-log?`;
            if (jobPack?.id) url += `jobpack_id=${jobPack.id}&`;
            if (sowReportNo) url += `sow_report_no=${sowReportNo}&`;
            if (structure?.id) url += `structure_id=${structure.id}&`;

            const res = await fetch(url);
            const json = await res.json();
            if (json.data) tapes = json.data;
            if (json.sow_scope || json.records_summary || json.meta) {
                (tapes as any).meta = {
                    sow_scope: json.sow_scope,
                    records_summary: json.records_summary,
                    ...json.meta
                };
            }
        } catch (e) {
            console.error("Error fetching video log data", e);
        }
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
                        const rawLogs: any[] = [];
                        const rawTapeChunkSize = 80;
                        for (let ti = 0; ti < rawTapeIds.length; ti += rawTapeChunkSize) {
                            const subTapeIds = rawTapeIds.slice(ti, ti + rawTapeChunkSize);
                            let lp = 0;
                            while (true) {
                                const { data: lChunk, error: lErr } = await (supabase as any)
                                    .from("insp_video_logs")
                                    .select("video_log_id, tape_id, event_type, event_time, timecode_start, tape_counter_start, remarks, inspection_id")
                                    .in("tape_id", subTapeIds)
                                    .order("video_log_id", { ascending: true })
                                    .range(lp * 1000, (lp + 1) * 1000 - 1);
                                if (lErr || !lChunk || lChunk.length === 0) break;
                                rawLogs.push(...lChunk);
                                if (lChunk.length < 1000) break;
                                lp++;
                            }
                        }
                        
                        const lByTape: Record<number, any[]> = {};
                        (rawLogs || []).forEach((l: any) => {
                            if (!lByTape[l.tape_id]) lByTape[l.tape_id] = [];
                            lByTape[l.tape_id].push(l);
                        });

                        // Also fetch insp_records for fallback with pagination and deterministic order
                        try {
                            const rawInspRecs: any[] = [];
                            let ip = 0;
                            while (true) {
                                const { data: rChunk, error: rErr } = await (supabase as any)
                                    .from("insp_records")
                                    .select("insp_id, tape_id, component_id, inspection_type_code, tape_count_no, description, inspection_date, inspection_time, inspection_data, structure_components:component_id(id, q_id)")
                                    .in("tape_id", rawTapeIds)
                                    .order("insp_id", { ascending: true })
                                    .range(ip * 1000, (ip + 1) * 1000 - 1);
                                if (rErr || !rChunk || rChunk.length === 0) break;
                                rawInspRecs.push(...rChunk);
                                if (rChunk.length < 1000) break;
                                ip++;
                            }

                            // Fetch anomalies for fallback records
                            const rawInspIds = Array.from(new Set(rawInspRecs.map((r: any) => Number(r.insp_id)).filter(id => !isNaN(id) && id > 0)));
                            const rawAnomMap = new Map<number, any[]>();
                            for (let i = 0; i < rawInspIds.length; i += 500) {
                                const b = rawInspIds.slice(i, i + 500);
                                const { data: anData } = await (supabase as any)
                                    .from("insp_anomalies")
                                    .select("anomaly_id, inspection_id, anomaly_ref_no, defect_description, defect_type_code, status")
                                    .in("inspection_id", b);
                                (anData || []).forEach((a: any) => {
                                    const tid = Number(a.inspection_id);
                                    if (!rawAnomMap.has(tid)) rawAnomMap.set(tid, []);
                                    rawAnomMap.get(tid)!.push(a);
                                });
                            }

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
                                const anoms = rawAnomMap.get(Number(r.insp_id)) || [];
                                const hasAnom = anoms.length > 0 || r.has_anomaly;
                                const primaryAnom = anoms[0] || null;

                                const inspLog = {
                                    video_log_id: `insp_${r.insp_id}`,
                                    tape_id: targetTapeId,
                                    event_type: hasAnom ? "ANOMALY" : "INSPECTION",
                                    is_inspection: true,
                                    has_anomaly: hasAnom,
                                    is_anomaly: hasAnom,
                                    anomaly_ref_no: primaryAnom?.anomaly_ref_no || r.inspection_data?.anomaly_ref_no || "",
                                    defect_description: primaryAnom?.defect_description || r.inspection_data?.defect_description || "",
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
                                    insp_anomalies: anoms,
                                    insp_records: { ...r, insp_anomalies: anoms }
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

    // ── Theme Colors ────────────────────────────────────────────────────────
    const colors = {
        navy: [7, 78, 136] as [number, number, number],
        darkNavy: [3, 44, 82] as [number, number, number],
        lightNavy: [14, 116, 144] as [number, number, number],
        blue: [37, 99, 235] as [number, number, number],
        teal: [13, 148, 136] as [number, number, number],
        amber: [217, 119, 6] as [number, number, number],
        coral: [234, 88, 12] as [number, number, number],
        purple: [124, 58, 237] as [number, number, number],
        slate: [100, 116, 139] as [number, number, number],
        cardBg: [248, 250, 252] as [number, number, number],
        cardBorder: [226, 232, 240] as [number, number, number],
        border: [203, 213, 225] as [number, number, number],
        text: [30, 41, 59] as [number, number, number],
        textMuted: [100, 116, 139] as [number, number, number],
        barTrack: [241, 245, 249] as [number, number, number],
        red: [220, 38, 38] as [number, number, number],
        emerald: [16, 185, 129] as [number, number, number],
    };

    // ── Vector Donut Chart Helper ───────────────────────────────────────────
    const drawDonutChart = (
        centerX: number,
        centerY: number,
        outerRadius: number,
        innerRadius: number,
        slices: Array<{ value: number; color: [number, number, number] }>,
        centerTextLine1?: string,
        centerTextLine2?: string,
        centerTextColor?: [number, number, number]
    ) => {
        const total = slices.reduce((sum, s) => sum + s.value, 0);
        if (total === 0) {
            doc.setFillColor(241, 245, 249);
            doc.circle(centerX, centerY, outerRadius, "F");
            doc.setFillColor(255, 255, 255);
            doc.circle(centerX, centerY, innerRadius, "F");
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.15);
            doc.circle(centerX, centerY, innerRadius, "S");
            doc.circle(centerX, centerY, outerRadius, "S");
            return;
        }

        const activeSlices = slices.filter(s => s.value > 0);
        if (activeSlices.length === 1) {
            const single = activeSlices[0];
            doc.setFillColor(isPrintFriendly ? 245 : single.color[0], isPrintFriendly ? 245 : single.color[1], isPrintFriendly ? 245 : single.color[2]);
            doc.circle(centerX, centerY, outerRadius, isPrintFriendly ? "S" : "FD");
        } else {
            let currentAngle = -Math.PI / 2; // 12 o'clock
            slices.forEach(slice => {
                if (slice.value <= 0) return;
                const sliceAngle = (slice.value / total) * 2 * Math.PI;
                const steps = Math.max(12, Math.floor(sliceAngle * 28));

                doc.setFillColor(isPrintFriendly ? 245 : slice.color[0], isPrintFriendly ? 245 : slice.color[1], isPrintFriendly ? 245 : slice.color[2]);
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(0.2);

                for (let i = 0; i < steps; i++) {
                    const a1 = currentAngle + (sliceAngle * i / steps);
                    const a2 = currentAngle + (sliceAngle * (i + 1) / steps);
                    const x1 = centerX + outerRadius * Math.cos(a1);
                    const y1 = centerY + outerRadius * Math.sin(a1);
                    const x2 = centerX + outerRadius * Math.cos(a2);
                    const y2 = centerY + outerRadius * Math.sin(a2);
                    doc.triangle(centerX, centerY, x1, y1, x2, y2, "F");
                }
                currentAngle += sliceAngle;
            });
        }

        // Inner cutout circle
        doc.setFillColor(255, 255, 255);
        doc.circle(centerX, centerY, innerRadius, "F");
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.15);
        doc.circle(centerX, centerY, innerRadius, "S");
        doc.circle(centerX, centerY, outerRadius, "S");

        // Center text
        if (centerTextLine1) {
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            const cColor = centerTextColor || colors.navy;
            doc.setTextColor(...cColor);
            doc.text(centerTextLine1, centerX, centerY - (centerTextLine2 ? 0.7 : -1.2), { align: "center" });
        }
        if (centerTextLine2) {
            doc.setFontSize(4.8);
            doc.setFont("helvetica", "bold");
            const cColor = centerTextColor || colors.textMuted;
            doc.setTextColor(...cColor);
            doc.text(centerTextLine2, centerX, centerY + 2.5, { align: "center" });
        }
    };

    // ── First Page ───────────────────────────────────────────────────────────
    drawHeader(doc);
    drawSubHeader(doc);
    let currentY = ((doc as any).lastAutoTable?.finalY ?? (margin + headerH + 20)) + 4;
    let isFirstPage = true;

    // ── Executive Graphical Summary ──────────────────────────────────────────
    const hasRealLogs = tapes.some(t => t.logs && t.logs.length > 0 && t.tape_no !== "__________");

    if (hasRealLogs && !(config as any)?.isBlankReport) {
        const summary = compileVideoLogAnalytics(tapes, (config as any)?.meta || (tapes as any)?.meta);

        // 1. Executive Summary Header Banner
        const sumBannerH = 5.5;
        doc.setDrawColor(...colors.navy);
        doc.setLineWidth(0.2);
        if (!isPrintFriendly) {
            doc.setFillColor(...colors.navy);
            doc.rect(margin, currentY, contentWidth, sumBannerH, "FD");
            doc.setTextColor(255);
        } else {
            doc.setFillColor(255, 255, 255);
            doc.rect(margin, currentY, contentWidth, sumBannerH, "FD");
            doc.setTextColor(...colors.navy);
        }
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("VIDEO LOG EXECUTIVE SUMMARY & TAPE ANALYTICS", margin + 3, currentY + 3.8);

        doc.setFontSize(5.8);
        doc.setFont("helvetica", "normal");
        if (!isPrintFriendly) doc.setTextColor(220, 230, 242);
        const sowBanner = summary.sowScope ? `SOW: ${summary.sowScope.completed}/${summary.sowScope.total} (${summary.sowScope.completionPct}%)   |   ` : "";
        const subheaderRight = `TOTAL TAPES: ${summary.totalTapesCount}   |   TOTAL CHAPTERS: ${summary.totalChaptersCount}   |   ${sowBanner}ANOMALIES: ${summary.totalAnomaliesCount}   |   RECORDED TIME: ${formatDurationHMS(summary.totalDurationSeconds)}`;
        doc.text(subheaderRight, margin + contentWidth - 3, currentY + 3.8, { align: "right" });

        currentY += sumBannerH + 2;

        // 2. Top 6 KPI Scorecard Cards
        const cardGap = 2.0;
        const cardW = (contentWidth - (cardGap * 5)) / 6; // ~29.8mm
        const cardH = 13.5;

        const drawKpiCard = (
            x: number,
            y: number,
            w: number,
            h: number,
            title: string,
            value: string,
            subtext: string,
            accentColor: [number, number, number]
        ) => {
            doc.setFillColor(isPrintFriendly ? 255 : 248, isPrintFriendly ? 255 : 250, isPrintFriendly ? 255 : 252);
            doc.setDrawColor(...colors.cardBorder);
            doc.setLineWidth(0.15);
            doc.roundedRect(x, y, w, h, 1, 1, "FD");

            // Left colored accent indicator
            doc.setFillColor(...accentColor);
            doc.roundedRect(x, y, 1.8, h, 0.5, 0.5, "F");

            doc.setFontSize(5.0);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.textMuted);
            doc.text(title.toUpperCase(), x + 3.2, y + 3.2);

            doc.setFontSize(8.8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...accentColor);
            doc.text(value, x + 3.2, y + 7.8);

            doc.setFontSize(4.6);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.textMuted);
            doc.text(subtext, x + 3.2, y + 11.4);
        };

        // Card 1: Total Video Tapes
        drawKpiCard(
            margin,
            currentY,
            cardW,
            cardH,
            "Total Video Tapes",
            `${summary.totalTapesCount} Tape${summary.totalTapesCount > 1 ? "s" : ""}`,
            "Recorded Media Volumes",
            colors.navy
        );

        // Card 2: Total Chapters
        drawKpiCard(
            margin + (cardW + cardGap),
            currentY,
            cardW,
            cardH,
            "Total Chapters",
            `${summary.totalChaptersCount} Chaps`,
            `Avg ${summary.avgChaptersPerTape} Ch / Tape`,
            colors.blue
        );

        // Card 3: Recorded Duration
        drawKpiCard(
            margin + (cardW + cardGap) * 2,
            currentY,
            cardW,
            cardH,
            "Recorded Duration",
            formatDurationSummary(summary.totalDurationSeconds),
            "Cumulative Timecode",
            colors.teal
        );

        // Card 4: Logged Inspections (showing completed & incomplete record totals)
        drawKpiCard(
            margin + (cardW + cardGap) * 3,
            currentY,
            cardW,
            cardH,
            "Logged Inspections",
            `${summary.totalInspectionsCount} Insps`,
            `${summary.completedInspectionsCount} Complete · ${summary.incompleteInspectionsCount} Incomp`,
            colors.lightNavy
        );

        // Card 5: Anomalies (Highlighted in Red)
        drawKpiCard(
            margin + (cardW + cardGap) * 4,
            currentY,
            cardW,
            cardH,
            "Anomalies",
            `${summary.totalAnomaliesCount} Flagged`,
            summary.uniqueAnomalyRefsCount > 0 ? `${summary.uniqueAnomalyRefsCount} Unique Ref No(s)` : "All Clear (0 Flagged)",
            colors.red
        );

        // Card 6: Deployments (ROV & Diving Operations)
        drawKpiCard(
            margin + (cardW + cardGap) * 5,
            currentY,
            cardW,
            cardH,
            "Deployments",
            `${summary.totalDivesCount} Deployment${summary.totalDivesCount > 1 ? "s" : ""}`,
            "ROV Operations",
            colors.purple
        );

        currentY += cardH + 2.5;

        // 3. Visual Analytics (Left: Video Activity Donut | Right: Operational Metrics Overview)
        const chartBoxH = 34;
        const leftBoxW = 95;
        const rightBoxW = contentWidth - leftBoxW - 3; // 92mm
        const leftBoxX = margin;
        const rightBoxX = margin + leftBoxW + 3;

        // --- 3A. LEFT BOX: Video Log Activity Distribution (Donut Chart) ---
        doc.setFillColor(isPrintFriendly ? 255 : 248, isPrintFriendly ? 255 : 250, isPrintFriendly ? 255 : 252);
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.15);
        doc.roundedRect(leftBoxX, currentY, leftBoxW, chartBoxH, 1, 1, "FD");

        // Sub-title bar
        doc.setFillColor(isPrintFriendly ? 255 : 241, isPrintFriendly ? 255 : 245, isPrintFriendly ? 255 : 249);
        doc.roundedRect(leftBoxX, currentY, leftBoxW, 5.0, 1, 1, "F");
        doc.setDrawColor(...colors.border);
        doc.line(leftBoxX, currentY + 5.0, leftBoxX + leftBoxW, currentY + 5.0);

        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.navy);
        doc.text("VIDEO ACTIVITY DISTRIBUTION", leftBoxX + 3, currentY + 3.5);

        doc.setFontSize(5.0);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.textMuted);
        doc.text("Activity category share", leftBoxX + leftBoxW - 3, currentY + 3.5, { align: "right" });

        // Donut Chart on Left Side of Left Box
        const donutCenterX = leftBoxX + 17;
        const donutCenterY = currentY + 19;
        const donutOuterR = 10.5;
        const donutInnerR = 5.5;

        const donutSlices: Array<{ value: number; color: [number, number, number] }> = [];
        if (summary.eventCategories.inspections > 0) {
            donutSlices.push({ value: summary.eventCategories.inspections, color: colors.teal });
        }
        if (summary.eventCategories.operations > 0) {
            donutSlices.push({ value: summary.eventCategories.operations, color: colors.navy });
        }
        if (summary.eventCategories.anomalies > 0) {
            donutSlices.push({ value: summary.eventCategories.anomalies, color: colors.red });
        }
        if (summary.eventCategories.annotations > 0) {
            donutSlices.push({ value: summary.eventCategories.annotations, color: colors.slate });
        }

        drawDonutChart(
            donutCenterX,
            donutCenterY,
            donutOuterR,
            donutInnerR,
            donutSlices,
            String(summary.totalLogsCount),
            "LOGS",
            colors.navy
        );

        // Legend on Right Side of Left Box
        const legX = leftBoxX + 32;
        let legY = currentY + 8.2;

        const totalLogsForPct = Math.max(summary.totalLogsCount, 1);
        const drawLegendItem = (label: string, count: number, color: [number, number, number]) => {
            const pct = Math.round((count / totalLogsForPct) * 100);
            doc.setFillColor(...color);
            doc.rect(legX, legY - 1.8, 2.0, 2.0, "F");

            doc.setFontSize(5.2);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.text);
            doc.text(`${label}:`, legX + 3.2, legY);

            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.textMuted);
            doc.text(`${count} (${pct}%)`, leftBoxX + leftBoxW - 3, legY, { align: "right" });
            legY += 4.2;
        };

        drawLegendItem("Inspections", summary.eventCategories.inspections, colors.teal);
        drawLegendItem("Tape Operations", summary.eventCategories.operations, colors.navy);
        drawLegendItem("Anomalies", summary.eventCategories.anomalies, colors.red);
        drawLegendItem("Notes / Obs", summary.eventCategories.annotations, colors.slate);

        // --- 3B. RIGHT BOX: Operational & Quality Overview ---
        doc.setFillColor(isPrintFriendly ? 255 : 248, isPrintFriendly ? 255 : 250, isPrintFriendly ? 255 : 252);
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.15);
        doc.roundedRect(rightBoxX, currentY, rightBoxW, chartBoxH, 1, 1, "FD");

        // Sub-title bar
        doc.setFillColor(isPrintFriendly ? 255 : 241, isPrintFriendly ? 255 : 245, isPrintFriendly ? 255 : 249);
        doc.roundedRect(rightBoxX, currentY, rightBoxW, 5.0, 1, 1, "F");
        doc.setDrawColor(...colors.border);
        doc.line(rightBoxX, currentY + 5.0, rightBoxX + rightBoxW, currentY + 5.0);

        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.navy);
        doc.text("OPERATIONAL & QUALITY OVERVIEW", rightBoxX + 3, currentY + 3.5);

        doc.setFontSize(5.0);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.textMuted);
        doc.text("Deployment & integrity metrics", rightBoxX + rightBoxW - 3, currentY + 3.5, { align: "right" });

        let opsY = currentY + 8.5;
        const drawMetricRow = (label: string, value: string, valColor: [number, number, number]) => {
            doc.setFontSize(5.2);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.text);
            doc.text(label, rightBoxX + 4, opsY);

            doc.setFont("helvetica", "bold");
            doc.setTextColor(...valColor);
            doc.text(value, rightBoxX + rightBoxW - 4, opsY, { align: "right" });

            doc.setDrawColor(...colors.cardBorder);
            doc.setLineWidth(0.08);
            doc.line(rightBoxX + 4, opsY + 1.2, rightBoxX + rightBoxW - 4, opsY + 1.2);
            opsY += 4.8;
        };

        const sowVal = summary.sowScope
            ? `${summary.sowScope.completed} / ${summary.sowScope.total} Tasks (${summary.sowScope.completionPct}%)`
            : `${summary.completedInspectionsCount} / ${summary.totalInspectionsCount} Tasks (${Math.round((summary.completedInspectionsCount / Math.max(summary.totalInspectionsCount, 1)) * 100)}%)`;

        drawMetricRow("SOW Scope Tasks:", sowVal, colors.lightNavy);
        drawMetricRow("Inspection Records:", `${summary.completedInspectionsCount} Complete · ${summary.incompleteInspectionsCount} Incomplete (${summary.totalInspectionsCount} Total)`, colors.teal);
        drawMetricRow("Deployment Operations:", `${summary.totalDivesCount} Deployments (ROV)`, colors.purple);
        drawMetricRow("Chapter Volume Density:", `Avg ${summary.avgChaptersPerTape} Ch/Tape (${summary.totalChaptersCount} Total)`, colors.blue);
        const anomRate = summary.totalInspectionsCount > 0 ? ((summary.totalAnomaliesCount / summary.totalInspectionsCount) * 100).toFixed(1) : "0";
        drawMetricRow("Anomaly Detection Rate:", `${anomRate}% of Insps (${summary.totalAnomaliesCount} Flagged)`, summary.totalAnomaliesCount > 0 ? colors.red : colors.emerald);
        drawMetricRow("Cumulative Video Runtime:", formatDurationHMS(summary.totalDurationSeconds), colors.navy);

        currentY += chartBoxH + 3.5;

        // 4. Full Width Table Chart: TAPE MEDIA & CHAPTER LOG SUMMARY (All Tapes & Progress)
        const maxChapters = Math.max(...summary.tapesBreakdown.map(t => t.chapterCount), 1);
        const summaryTableRows: any[][] = summary.tapesBreakdown.map(t => {
            const diveDisplay = t.diveNos.length > 0 ? t.diveNos.join(", ") : "—";
            const anomDisplay = t.anomalyCount > 0 ? `${t.anomalyCount} Flagged` : "—";
            return [
                t.tapeNo,
                diveDisplay,
                `${t.chapterCount} Ch`,
                formatDurationSummary(t.durationSeconds),
                `${t.totalLogsCount} Logs`,
                `${t.inspectionCount} Insps`,
                anomDisplay,
            ];
        });

        // Totals row at the bottom of the table chart
        summaryTableRows.push([
            `Total (${summary.totalTapesCount} Tapes)`,
            `${summary.totalDivesCount} Deployments`,
            `${summary.totalChaptersCount} Chapters`,
            formatDurationHMS(summary.totalDurationSeconds),
            `${summary.totalLogsCount} Logs`,
            `${summary.totalInspectionsCount} Insps`,
            summary.totalAnomaliesCount > 0 ? `${summary.totalAnomaliesCount} Flagged` : "0 Flagged"
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [["Tape No. (Full Media Details)", "Dive / ROV", "Chapters & Volume", "Duration", "Logged Events", "Inspections", "Anomalies"]],
            body: summaryTableRows,
            theme: "grid",
            tableLineWidth: 0.1,
            tableLineColor: [200, 200, 200],
            headStyles: {
                fillColor: isPrintFriendly ? [229, 231, 235] : [7, 78, 136],
                textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
                fontStyle: "bold",
                fontSize: 7.2,
                lineWidth: 0.1,
                lineColor: [200, 200, 200],
                halign: "center",
            },
            styles: { fontSize: 7, cellPadding: 1.8, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [30, 41, 59] },
            columnStyles: {
                0: { cellWidth: 52, fontStyle: "bold", textColor: isPrintFriendly ? [0, 0, 0] : [7, 78, 136] },
                1: { cellWidth: 18, halign: "center" },
                2: { cellWidth: 40, halign: "left" },
                3: { cellWidth: 24, halign: "center" },
                4: { cellWidth: 18, halign: "center" },
                5: { cellWidth: 20, halign: "center" },
                6: { cellWidth: 18, halign: "center" }
            },
            margin: { left: margin, right: margin },
            didParseCell: (data: any) => {
                if (data.section === "body") {
                    const isTotalRow = data.row.index === summaryTableRows.length - 1;
                    if (isTotalRow) {
                        data.cell.styles.fillColor = isPrintFriendly ? [240, 240, 240] : [238, 242, 246];
                        data.cell.styles.fontStyle = "bold";
                        data.cell.styles.textColor = [7, 78, 136];
                        if (data.column.index === 6 && summary.totalAnomaliesCount > 0) {
                            data.cell.styles.textColor = isPrintFriendly ? [185, 28, 28] : [220, 38, 38];
                        }
                    } else {
                        const tapeItem = summary.tapesBreakdown[data.row.index];
                        if (tapeItem && tapeItem.anomalyCount > 0 && data.column.index === 6) {
                            data.cell.styles.textColor = isPrintFriendly ? [185, 28, 28] : [220, 38, 38];
                            data.cell.styles.fontStyle = "bold";
                        }
                    }
                }
            },
            didDrawCell: (data: any) => {
                if (data.section === "body" && data.column.index === 2) {
                    const isTotalRow = data.row.index === summaryTableRows.length - 1;
                    const cellX = data.cell.x;
                    const cellY = data.cell.y;
                    const cellW = data.cell.width;
                    const cellH = data.cell.height;

                    const textW = isTotalRow ? 18 : 12;
                    const barX = cellX + textW + 1;
                    const barW = cellW - textW - 3;
                    const barH = 2.2;
                    const barY = cellY + (cellH - barH) / 2;

                    if (barW > 8) {
                        // Track background
                        doc.setFillColor(241, 245, 249);
                        doc.roundedRect(barX, barY, barW, barH, 0.4, 0.4, "F");

                        // Progress bar
                        const tapeItem = isTotalRow ? null : summary.tapesBreakdown[data.row.index];
                        const fillRatio = isTotalRow ? 1.0 : Math.min(1.0, Math.max(0.08, (tapeItem?.chapterCount || 1) / maxChapters));
                        const fillW = barW * fillRatio;

                        doc.setFillColor(isPrintFriendly ? 180 : 7, isPrintFriendly ? 180 : 78, isPrintFriendly ? 180 : 136);
                        doc.roundedRect(barX, barY, fillW, barH, 0.4, 0.4, "F");
                    }
                }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Per-Tape Groups ──────────────────────────────────────────────────────
    // Sort tapes naturally ascending by tape_no (V001R, V002R, ..., V014R), keeping chapters in numeric sequence
    const sortedTapes = [...tapes].sort((a, b) => {
        const cmp = String(a.tape_no ?? "").localeCompare(String(b.tape_no ?? ""), undefined, { numeric: true, sensitivity: "base" });
        if (cmp !== 0) return cmp;
        const chA = Number(a.chapter_no);
        const chB = Number(b.chapter_no);
        if (!isNaN(chA) && !isNaN(chB) && chA !== chB) {
            return chA - chB;
        }
        return String(a.chapter_no ?? "").localeCompare(String(b.chapter_no ?? ""), undefined, { numeric: true, sensitivity: "base" });
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
        if (currentY > pageHeight - margin - FOOTER_Y_OFFSET - 35) {
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
        const anomalyRowIndices = new Set<number>();

        if (logs.length === 0) {
            tableBody.push([{ content: "No log entries for this tape.", colSpan: 5, styles: { halign: "center", textColor: [100, 100, 100], lineWidth: 0.1, lineColor: [200, 200, 200] } }]);
        } else {
            logs.forEach((log: any, idx: number) => {
                const anomInfo = detectLogAnomalyOrFinding(log);
                if (anomInfo.isAnomalyOrFinding) {
                    anomalyRowIndices.add(idx);
                }

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

                    const actionHeader = anomInfo.actionLabel
                        ? (taskCode ? `${anomInfo.actionLabel} (${taskCode})` : anomInfo.actionLabel)
                        : (taskCode ? `Inspection (${taskCode})` : "Inspection");

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

                    // Append Anomaly / Finding description
                    if (anomInfo.description && !remarkParts.some(p => p.toLowerCase().includes(anomInfo.description.toLowerCase()))) {
                        const descPrefix = anomInfo.isFinding ? "Finding Description:" : "Anomaly Description:";
                        remarkParts.push(`${descPrefix} ${anomInfo.description}`);
                    }

                    // Append Anomaly / Finding Reference Number
                    if (anomInfo.refNo) {
                        const refPrefix = anomInfo.isFinding ? "Please refer to Finding No.:" : "Please refer to Anomaly No.:";
                        const refLine = `${refPrefix} ${anomInfo.refNo}`;
                        if (!remarkParts.some(p => p.toLowerCase().includes(anomInfo.refNo.toLowerCase()))) {
                            remarkParts.push(refLine);
                        }
                    }

                    const remarksText = remarkParts.join("\n");
                    actionDisplay = remarksText
                        ? `${actionHeader}\n${metaLine}\n${remarksText}`
                        : `${actionHeader}\n${metaLine}`;
                } else {
                    const action = anomInfo.actionLabel || friendlyEventType(log.event_type || log.action);
                    const remarkParts: string[] = [];
                    const directRemark = log.remarks ?? log.remark ?? log.notes ?? log.note ?? "";
                    if (directRemark && String(directRemark).trim()) {
                        remarkParts.push(String(directRemark).trim());
                    }
                    const inspDesc = log.insp_records?.description ?? log.description ?? "";
                    if (inspDesc && String(inspDesc).trim() && !remarkParts.includes(String(inspDesc).trim())) {
                        remarkParts.push(String(inspDesc).trim());
                    }

                    if (anomInfo.description && !remarkParts.some(p => p.toLowerCase().includes(anomInfo.description.toLowerCase()))) {
                        const descPrefix = anomInfo.isFinding ? "Finding Description:" : "Anomaly Description:";
                        remarkParts.push(`${descPrefix} ${anomInfo.description}`);
                    }

                    if (anomInfo.refNo) {
                        const refPrefix = anomInfo.isFinding ? "Please refer to Finding No.:" : "Please refer to Anomaly No.:";
                        const refLine = `${refPrefix} ${anomInfo.refNo}`;
                        if (!remarkParts.some(p => p.toLowerCase().includes(anomInfo.refNo.toLowerCase()))) {
                            remarkParts.push(refLine);
                        }
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
            head: [["No.", "Dive No", "Action / Remarks", "Timecode", "Date & Time"]],
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
            didParseCell: (data: any) => {
                if (data.section === "body" && anomalyRowIndices.has(data.row.index)) {
                    data.cell.styles.textColor = isPrintFriendly ? [185, 28, 28] : [220, 38, 38];
                    if (data.column.index === 0 || data.column.index === 2) {
                        data.cell.styles.fontStyle = "bold";
                    }
                }
            },
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
