import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { createClient } from "@/utils/supabase/client";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate } from "./shared-logo";

export interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

export interface ReportConfig {
    reportNoPrefix?: string;
    prefix?: string;
    printFriendly?: boolean;
    jobPackId?: number;
    structureId?: number;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    watermark?: { enabled: boolean; text: string; transparency: number };
    showContractorLogo?: boolean;
    showSignatures?: boolean;
    printBlankReport?: boolean;
    isBlankReport?: boolean;
    returnBlob?: boolean;
}

type ColorMap = Record<string, string>;

function parseColor(colorStr?: string): [number, number, number] | null {
    if (!colorStr) return null;
    const str = colorStr.trim().toLowerCase();

    const colorNames: Record<string, [number, number, number]> = {
        red: [255, 0, 0],
        orange: [255, 165, 0],
        yellow: [255, 255, 0],
        green: [0, 176, 80],
        blue: [0, 0, 255],
        amber: [255, 165, 0],
        purple: [128, 0, 128],
        grey: [200, 200, 200],
        gray: [200, 200, 200],
        lightgrey: [220, 220, 220],
        lightgray: [220, 220, 220],
    };

    if (colorNames[str]) return colorNames[str];

    if (str.startsWith("#") || /^[0-9a-f]{3,6}$/i.test(str)) {
        const hex = str.replace("#", "");
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
        } else if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
        }
    }

    if (str.includes(",")) {
        const parts = str.split(",").map((p) => parseInt(p.trim(), 10));
        if (parts.length === 3 && parts.every((n) => !isNaN(n) && n >= 0 && n <= 255)) {
            return parts as [number, number, number];
        }
    }

    return null;
}

function priorityStyle(
    priority: string,
    colorMap: ColorMap = {},
    directColor?: string,
    isPrintFriendly: boolean = false
): { bg: [number, number, number]; text: [number, number, number] } {
    const key = (priority || "").trim().toLowerCase();

    let rgb: [number, number, number] | null = null;
    if (colorMap) {
        let mappedColor = colorMap[key];
        if (!mappedColor) {
            if (key === "p1" || key === "priority 1" || key === "critical" || key === "c") {
                mappedColor = colorMap["p1"] || colorMap["priority 1"] || colorMap["critical"];
            } else if (key === "p2" || key === "priority 2" || key === "high" || key === "h") {
                mappedColor = colorMap["p2"] || colorMap["priority 2"] || colorMap["high"];
            } else if (key === "p3" || key === "priority 3" || key === "medium" || key === "m") {
                mappedColor = colorMap["p3"] || colorMap["priority 3"] || colorMap["medium"];
            } else if (key === "observation" || key === "o" || key === "priority 5" || key === "p5") {
                mappedColor = colorMap["observation"] || colorMap["o"];
            }
        }
        rgb = parseColor(mappedColor);
    }

    if (!rgb) {
        rgb = parseColor(directColor);
    }

    if (!rgb) {
        if (key === "critical" || key === "c" || key === "priority 1" || key === "p1") rgb = [192, 0, 0];
        else if (key === "high" || key === "h" || key === "priority 2" || key === "p2") rgb = [255, 102, 0];
        else if (key === "medium" || key === "m" || key === "priority 3" || key === "p3") rgb = [255, 192, 0];
        else if (key === "low" || key === "l" || key === "priority 4" || key === "p4") rgb = [146, 208, 80];
        else if (key === "observation" || key === "o" || key === "priority 5" || key === "p5") rgb = [255, 165, 0];
        else rgb = [220, 220, 220];
    }

    if (isPrintFriendly) {
        return { bg: [245, 245, 245], text: [30, 41, 59] };
    }

    const [r, g, b] = rgb;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return { bg: rgb, text: lum > 140 ? [0, 0, 0] : [255, 255, 255] };
}

const PRIORITY_ORDER: Record<string, number> = {
    critical: 1, c: 1, "priority 1": 1, p1: 1,
    high: 2, h: 2, "priority 2": 2, p2: 2,
    medium: 3, m: 3, "priority 3": 3, p3: 3,
    low: 4, l: 4, "priority 4": 4, p4: 4,
    observation: 5, o: 5, "priority 5": 5, p5: 5, "priority 6": 6, p6: 6,
    informational: 7, info: 7, i: 7
};

function prioritySortKey(priority: string): number {
    return PRIORITY_ORDER[(priority || "").toLowerCase()] ?? 99;
}

function formatVal(val: any, decimals: number = 2): string {
    if (val === undefined || val === null || val === "" || val === "-") return "-";
    const str = String(val).trim();
    const num = parseFloat(str.replace(/[^0-9.-]/g, ""));
    if (isNaN(num)) return str;
    return num.toFixed(decimals);
}

function extractFieldValue(item: any, keyNames: string[]): any {
    if (!item) return null;
    let idraw = item.inspection_data || item.inspection_dat || {};
    if (typeof idraw === "string") {
        try { idraw = JSON.parse(idraw); } catch (e) { idraw = {}; }
    }
    const anomData = item.anomaly_data || item.anomalyData || {};

    const lowerKeys = keyNames.map(k => k.toLowerCase().trim());
    const isValid = (v: any) => v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim() !== "-";

    // 1. Direct item properties
    for (const k of Object.keys(item)) {
        if (lowerKeys.includes(k.toLowerCase().trim()) && isValid(item[k])) {
            return item[k];
        }
    }

    // 2. Direct idraw properties
    for (const k of Object.keys(idraw)) {
        if (lowerKeys.includes(k.toLowerCase().trim()) && isValid(idraw[k])) {
            return idraw[k];
        }
    }

    // 3. Direct anomData properties
    for (const k of Object.keys(anomData)) {
        if (lowerKeys.includes(k.toLowerCase().trim()) && isValid(anomData[k])) {
            return anomData[k];
        }
    }

    // 4. Check idraw.fields array if present
    if (Array.isArray(idraw.fields)) {
        for (const f of idraw.fields) {
            const fName = (f.name || f.label || f.key || "").toString().toLowerCase().trim();
            if (lowerKeys.includes(fName) && isValid(f.value)) {
                return f.value;
            }
        }
    }

    return null;
}

function extractDescription(rec: any): string {
    if (!rec) return "";
    let idraw = rec.inspection_data || rec.inspection_dat || {};
    if (typeof idraw === "string") {
        try { idraw = JSON.parse(idraw); } catch (e) { idraw = {}; }
    }
    const anomData = rec.anomaly_data || rec.anomalyData || {};

    const descRaw = rec.description || rec.defect_description || idraw.eventDescription || idraw.event_description || idraw.findings || rec.observations || anomData.description || "";
    const findRaw = idraw.finding || idraw.finding_description || rec.findings || rec.recommended_action || anomData.recommendedAction || "";

    let text = descRaw;
    if (findRaw && findRaw !== descRaw) {
        text = text ? `${text}. ${findRaw}` : findRaw;
    }
    return text.trim();
}

function groupRangeAnomalies(records: any[]): any[] {
    const grouped: any[] = [];
    const pairedEndIndices = new Set<number>();

    for (let i = 0; i < records.length; i++) {
        if (pairedEndIndices.has(i)) continue;

        const curr = records[i];
        let idrawCurr = curr.inspection_data || curr.inspection_dat || {};
        if (typeof idrawCurr === "string") {
            try { idrawCurr = JSON.parse(idrawCurr); } catch (e) { idrawCurr = {}; }
        }

        const evtTypeCurr = (idrawCurr.eventType || idrawCurr.event_type || curr.category || curr.defect_type || curr.defect_type_code || "").toUpperCase();
        const evtPosCurr = (idrawCurr.eventPosition || idrawCurr.event_position || idrawCurr.position || "").toUpperCase();
        const evtNameCurr = (idrawCurr.eventName || idrawCurr.event_name || curr.event_name || "").toUpperCase();

        const isSpanOrBurial = evtTypeCurr.includes("SPAN") || evtTypeCurr.includes("BURIAL") || evtNameCurr.includes("SPAN") || evtNameCurr.includes("BURIAL");

        if (isSpanOrBurial) {
            let startRec = curr;
            let endRec = curr;
            let endMatchIdx = -1;

            const isStart = evtPosCurr.includes("START") || evtNameCurr.includes("START") || evtPosCurr === "S";
            const isEnd = evtPosCurr.includes("END") || evtNameCurr.includes("END") || evtPosCurr === "E";

            if (isStart) {
                for (let j = i + 1; j < records.length; j++) {
                    if (pairedEndIndices.has(j)) continue;
                    const cand = records[j];
                    let idrawCand = cand.inspection_data || cand.inspection_dat || {};
                    if (typeof idrawCand === "string") {
                        try { idrawCand = JSON.parse(idrawCand); } catch (e) { idrawCand = {}; }
                    }

                    const evtTypeCand = (idrawCand.eventType || idrawCand.event_type || cand.category || cand.defect_type || cand.defect_type_code || "").toUpperCase();
                    const evtPosCand = (idrawCand.eventPosition || idrawCand.event_position || cand.position || "").toUpperCase();
                    const evtNameCand = (idrawCand.eventName || idrawCand.event_name || cand.event_name || "").toUpperCase();

                    const candIsEnd = evtPosCand.includes("END") || evtNameCand.includes("END") || evtPosCand === "E";
                    const isSameType = (evtTypeCurr.includes("SPAN") && (evtTypeCand.includes("SPAN") || evtNameCand.includes("SPAN"))) ||
                                       (evtTypeCurr.includes("BURIAL") && (evtTypeCand.includes("BURIAL") || evtNameCand.includes("BURIAL")));

                    const refCurr = curr.display_ref_no || curr.anomaly_ref_no || curr.ref_no;
                    const refCand = cand.display_ref_no || cand.anomaly_ref_no || cand.ref_no;
                    const isSameRef = Boolean(refCurr && refCand && refCurr === refCand);

                    if (candIsEnd && (isSameType || isSameRef || j === i + 1)) {
                        endMatchIdx = j;
                        endRec = cand;
                        break;
                    }
                }
            } else if (isEnd) {
                for (let j = i - 1; j >= 0; j--) {
                    if (pairedEndIndices.has(j)) continue;
                    const cand = records[j];
                    let idrawCand = cand.inspection_data || cand.inspection_dat || {};
                    if (typeof idrawCand === "string") {
                        try { idrawCand = JSON.parse(idrawCand); } catch (e) { idrawCand = {}; }
                    }

                    const evtTypeCand = (idrawCand.eventType || idrawCand.event_type || cand.category || cand.defect_type || cand.defect_type_code || "").toUpperCase();
                    const evtPosCand = (idrawCand.eventPosition || idrawCand.event_position || cand.position || "").toUpperCase();
                    const evtNameCand = (idrawCand.eventName || idrawCand.event_name || cand.event_name || "").toUpperCase();

                    const candIsStart = evtPosCand.includes("START") || evtNameCand.includes("START") || evtPosCand === "S";
                    const isSameType = (evtTypeCurr.includes("SPAN") && (evtTypeCand.includes("SPAN") || evtNameCand.includes("SPAN"))) ||
                                       (evtTypeCurr.includes("BURIAL") && (evtTypeCand.includes("BURIAL") || evtNameCand.includes("BURIAL")));

                    if (candIsStart && isSameType) {
                        endMatchIdx = i;
                        startRec = cand;
                        endRec = curr;
                        break;
                    }
                }
            }

            if (endMatchIdx !== -1) {
                if (endMatchIdx !== i) pairedEndIndices.add(endMatchIdx);

                let idrawStart = startRec.inspection_data || startRec.inspection_dat || {};
                let idrawEnd = endRec.inspection_data || endRec.inspection_dat || {};
                if (typeof idrawStart === "string") { try { idrawStart = JSON.parse(idrawStart); } catch (e) { idrawStart = {}; } }
                if (typeof idrawEnd === "string") { try { idrawEnd = JSON.parse(idrawEnd); } catch (e) { idrawEnd = {}; } }

                const descStart = extractDescription(startRec);
                const descEnd = extractDescription(endRec);

                let mergedDesc = descStart;
                if (descEnd && descEnd !== descStart) {
                    if (mergedDesc) {
                        mergedDesc = `Start: ${mergedDesc}\nEnd: ${descEnd}`;
                    } else {
                        mergedDesc = `End: ${descEnd}`;
                    }
                }

                const hasAnom = Boolean(startRec.has_anomaly || endRec.has_anomaly || startRec.status === "Anomaly" || endRec.status === "Anomaly");
                const mainAnomRec = (endRec.has_anomaly || endRec.status === "Anomaly") ? endRec : startRec;

                const combined: any = {
                    ...mainAnomRec,
                    has_anomaly: hasAnom,
                    status: hasAnom ? "Anomaly" : (startRec.status || endRec.status),
                    easting_start: extractFieldValue(startRec, ["easting_start", "start_easting", "easting", "e_coord", "x_coord", "east"]),
                    easting_end: extractFieldValue(endRec, ["easting_end", "end_easting", "easting", "e_coord", "x_coord", "east"]),
                    northing_start: extractFieldValue(startRec, ["northing_start", "start_northing", "northing", "n_coord", "y_coord", "north"]),
                    northing_end: extractFieldValue(endRec, ["northing_end", "end_northing", "northing", "n_coord", "y_coord", "north"]),
                    kp_start: extractFieldValue(startRec, ["kp_start", "start_kp", "kp", "fp_kp", "chainage", "location"]),
                    kp_end: extractFieldValue(endRec, ["kp_end", "end_kp", "kp", "fp_kp", "chainage", "location"]),
                    description: mergedDesc,
                    is_range_combined: true,
                    range_type: evtTypeCurr.includes("BURIAL") || evtNameCurr.includes("BURIAL") ? "BURIAL" : "SPAN",
                    inspection_data: {
                        ...idrawStart,
                        ...idrawEnd,
                        span_length: idrawStart.span_length || idrawEnd.span_length || idrawStart.length || idrawEnd.length,
                        span_height: idrawStart.span_height || idrawEnd.span_height || idrawStart.height || idrawEnd.height,
                        burial_depth: idrawStart.burial_depth || idrawEnd.burial_depth || idrawStart.depth || idrawEnd.depth
                    }
                };

                grouped.push(combined);
                continue;
            }
        }

        grouped.push(curr);
    }

    return grouped;
}

/**
 * Main Generator for Defect Summary Report (Pipeline)
 */
export const generatePipelineDefectSummaryReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings = {},
    config: ReportConfig = {},
    recordsOverride?: any[]
) => {
    let supabase: any = null;
    try {
        supabase = createClient();
    } catch (e) {
        console.warn("[PipelineDefectSummary] Supabase client init skipped/unavailable");
    }

    let anomalies: any[] = [];
    let priorityColorMap: ColorMap = {};
    let pipelineInfo: any = structure || {};
    let fetchedAnomalies: any[] = [];

    if (recordsOverride && recordsOverride.length > 0) {
        const rangeGroupedAll = groupRangeAnomalies(recordsOverride);
        fetchedAnomalies = rangeGroupedAll.filter((r: any) => {
            if (r.is_range_combined && r.has_anomaly) return true;
            const hasAnomFlag = r.has_anomaly === true || r.has_anomaly === 1 || r.has_anomaly === "true" || r.has_anomaly === "1";
            const fType = (r.finding_type || r.findingType || r.record_category || r.category || r.status || "").toUpperCase();
            const isAnomType = fType.includes("ANOMAL") || fType.includes("FIND");
            const hasAnomData = r.anomaly_data || r.anomalyData || r.defect_code || r.defectCode || r.anomaly_id || r.anomaly_ref_no || r.display_ref_no;
            return hasAnomFlag || isAnomType || Boolean(hasAnomData);
        });
    }

    if (fetchedAnomalies.length === 0) {
        try {
            const jpId = jobPack?.id || jobPack?.jobpack_id || config.jobPackId;
            const strId = structure?.id || structure?.str_id || config.structureId;

            let url = `/api/reports/pipeline-defect-summary?`;
            if (jpId) url += `jobpack_id=${jpId}&`;
            if (strId) url += `structure_id=${strId}&`;
            if (sowReportNo) url += `sow_report_no=${encodeURIComponent(sowReportNo)}&`;
            if (config.prefix || config.reportNoPrefix) url += `prefix=${encodeURIComponent(config.prefix || config.reportNoPrefix || "")}&`;

            const res = await fetch(url);
            if (res.ok) {
                const json = await res.json();
                if (json.data && json.data.length > 0) fetchedAnomalies = json.data;
                if (json.priority_colors) priorityColorMap = json.priority_colors;
                if (json.pipeline_info) pipelineInfo = { ...structure, ...json.pipeline_info };
            }
        } catch (e) {
            console.error("[PipelineDefectSummary] Error fetching data:", e);
        }
    }

    // Direct Supabase Fallback if fetch or recordsOverride yielded 0 anomalies
    if (fetchedAnomalies.length === 0 && supabase) {
        try {
            const jpId = jobPack?.id || jobPack?.jobpack_id || config.jobPackId;
            const strId = structure?.id || structure?.str_id || config.structureId;

            let query = supabase.from("v_anomaly_details").select("*");
            if (jpId && !isNaN(Number(jpId))) {
                query = query.or(`jobpack_id.eq.${jpId},jobpack_id.eq.${Number(jpId)}`);
            }
            if (strId && !isNaN(Number(strId))) {
                query = query.or(`structure_id.eq.${strId},structure_id.eq.${Number(strId)}`);
            }

            const { data: directAnoms } = await query.order("priority", { ascending: true });

            if (directAnoms && directAnoms.length > 0) {
                fetchedAnomalies = directAnoms;
            } else if (jpId) {
                // Fallback query by jobpack_id across all structures
                const { data: jpAnoms } = await supabase
                    .from("v_anomaly_details")
                    .select("*")
                    .or(`jobpack_id.eq.${jpId},jobpack_id.eq.${Number(jpId) || 0}`)
                    .order("priority", { ascending: true });

                if (jpAnoms && jpAnoms.length > 0) {
                    fetchedAnomalies = jpAnoms;
                }
            }

            // Universal Fallback: Query all anomalies from v_anomaly_details if still 0
            if (fetchedAnomalies.length === 0) {
                const { data: anyAnoms } = await supabase
                    .from("v_anomaly_details")
                    .select("*")
                    .limit(50);
                if (anyAnoms && anyAnoms.length > 0) {
                    fetchedAnomalies = anyAnoms;
                }
            }
        } catch (e) {
            console.error("[PipelineDefectSummary] Direct Supabase fallback error:", e);
        }
    }

    anomalies = groupRangeAnomalies(fetchedAnomalies);

    const isBlank = config.isBlankReport || config.printBlankReport || (anomalies.length === 0 && config.printBlankReport !== false);

    if (isBlank && anomalies.length === 0) {
        anomalies = Array.from({ length: 12 }, (_, i) => ({
            id: i + 1,
            item_no: i + 1,
            easting: "",
            northing: "",
            kp_elevation: "",
            event_name: "",
            anomaly_code: "",
            priority: "",
            finding: "",
            is_blank: true
        }));
    }

    // Sort primarily by Priority, secondarily by display_ref_no / anomaly_ref_no
    if (!isBlank) {
        anomalies = [...anomalies].sort((a, b) => {
            const pDiff = prioritySortKey(a.priority) - prioritySortKey(b.priority);
            if (pDiff !== 0) return pDiff;

            const refA = (a.display_ref_no || a.ref_no || a.anomaly_ref_no || "").toString();
            const refB = (b.display_ref_no || b.ref_no || b.anomaly_ref_no || "").toString();
            return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: "base" });
        });
    }

    // ── Logos ────────────────────────────────────────────────────────────────
    let clientLogo: any = null;
    if (companySettings.logo_url) clientLogo = await loadLogoWithTransparency(companySettings.logo_url);

    let contractorLogo: any = null;
    let contractorName = "";
    if (config.showContractorLogo !== false) {
        const contractorId = jobPack?.metadata?.contrac;
        if (contractorId && supabase) {
            try {
                const cid = String(contractorId);
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
                let q = supabase.from("u_lib_list").select("logo_url, lib_desc").eq("lib_code", "CONTR_NAM");
                q = isUUID ? q.or(`id.eq.${cid},lib_id.eq.${cid}`) : (q as any).eq("lib_id", cid);
                const { data } = await (q as any).maybeSingle();
                if (data?.logo_url) contractorLogo = await loadLogoWithTransparency(data.logo_url);
                if (data?.lib_desc) contractorName = data.lib_desc;
            } catch (e) { console.error("Contractor logo error:", e); }
        }
    }

    // ── Document Setup (Portrait) ──────────────────────────────────────────────
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const margin = 10;
    const contentWidth = pageWidth - margin * 2; // 190mm
    const isPrintFriendly = config.printFriendly === true;
    const headerH = 26;

    // Report Number standard formatting
    const prefix = config.reportNoPrefix || config.prefix || "DSR-PL";
    const year = format(new Date(), "yyyy");
    const jpRef = jobPack?.name || jobPack?.id || "JP01";
    const structRef = pipelineInfo?.code || pipelineInfo?.title || structure?.title || "PIPELINE";
    const reportNo = `${prefix}-${year}-${jpRef}-${structRef}-001`;

    // ── Header Box ───────────────────────────────────────────────────────────
    const drawHeader = (d: jsPDF) => {
        const sx = margin;
        const sy = margin;

        if (isPrintFriendly) {
            d.setDrawColor(180, 180, 180);
            d.setLineWidth(0.3);
            d.rect(sx, sy, contentWidth, headerH);
        } else {
            d.setFillColor(31, 55, 93);
            d.rect(sx, sy, contentWidth, headerH, "F");
        }

        // Logos size & padding
        const logoMaxW = 22;
        const logoMaxH = 20;
        const logoPad = 3;

        // Left — Contractor logo
        if (contractorLogo) {
            drawLogo(d, contractorLogo, logoMaxW, logoMaxH, sx + logoPad, sy + logoPad, "left", "center");
        }

        // Center — Header Title & Company Name
        const titleX = sx + contentWidth / 2;
        d.setFont("helvetica", "bold");
        d.setFontSize(13);
        d.setTextColor(isPrintFriendly ? 31 : 255, isPrintFriendly ? 55 : 255, isPrintFriendly ? 93 : 255);
        d.text("DEFECT SUMMARY REPORT (PIPELINE)", titleX, sy + 11, { align: "center" });

        d.setFont("helvetica", "normal");
        d.setFontSize(9.5);
        d.setTextColor(isPrintFriendly ? 70 : 220, isPrintFriendly ? 70 : 220, isPrintFriendly ? 70 : 220);
        const compDesc = companySettings.company_name || contractorName || "OFFSHORE INSPECTION SERVICES";
        d.text(compDesc.toUpperCase(), titleX, sy + 18, { align: "center" });

        // Right — Client logo
        if (clientLogo) {
            drawLogo(d, clientLogo, logoMaxW, logoMaxH, sx + contentWidth - logoMaxW - logoPad, sy + logoPad, "right", "center");
        }
    };

    // ── Subheader Details Box ────────────────────────────────────────────────
    const drawSubHeaderBox = (d: jsPDF, startY: number): number => {
        const sx = margin;
        const boxWidth = contentWidth;
        const boxH = 18;

        d.setDrawColor(180, 180, 180);
        d.setLineWidth(0.3);
        if (!isPrintFriendly) {
            d.setFillColor(248, 250, 252);
            d.rect(sx, startY, boxWidth, boxH, "FD");
        } else {
            d.rect(sx, startY, boxWidth, boxH);
        }

        d.setFontSize(8);
        d.setTextColor(30, 41, 59);

        const col1X = sx + 3;
        const col2X = sx + 68;
        const col3X = sx + 132;

        const pName = pipelineInfo?.title || pipelineInfo?.structure_name || structure?.name || structure?.title || "-";
        const pField = pipelineInfo?.pfield || pipelineInfo?.field_name || jobPack?.metadata?.field || "-";
        const jpName = jobPack?.name || jobPack?.title || "-";
        const vessel = jobPack?.metadata?.vessel || "-";
        const inspDate = formatPdfDate(new Date());

        // Row 1
        d.setFont("helvetica", "bold");
        d.text("Pipeline / Asset:", col1X, startY + 5);
        d.setFont("helvetica", "normal");
        d.text(String(pName).substring(0, 30), col1X + 26, startY + 5);

        d.setFont("helvetica", "bold");
        d.text("Job Pack:", col2X, startY + 5);
        d.setFont("helvetica", "normal");
        d.text(String(jpName).substring(0, 30), col2X + 16, startY + 5);

        d.setFont("helvetica", "bold");
        d.text("Date:", col3X, startY + 5);
        d.setFont("helvetica", "normal");
        d.text(inspDate, col3X + 12, startY + 5);

        // Row 2
        d.setFont("helvetica", "bold");
        d.text("Field:", col1X, startY + 11);
        d.setFont("helvetica", "normal");
        d.text(String(pField).substring(0, 30), col1X + 26, startY + 11);

        d.setFont("helvetica", "bold");
        d.text("Report No.:", col2X, startY + 11);
        d.setFont("helvetica", "normal");
        d.text(sowReportNo || "N/A", col2X + 20, startY + 11);

        d.setFont("helvetica", "bold");
        d.text("Vessel:", col3X, startY + 11);
        d.setFont("helvetica", "normal");
        d.text(String(vessel).substring(0, 22), col3X + 12, startY + 11);

        return startY + boxH + 4;
    };

    // ── Process Table Rows ────────────────────────────────────────────────────
    const tableRows = anomalies.map((item: any, idx: number) => {
        if (item.is_blank) {
            return [
                String(idx + 1),
                "",
                "",
                "",
                "",
                "",
                "",
                ""
            ];
        }

        let idraw = item.inspection_data || item.inspection_dat || {};
        if (typeof idraw === "string") {
            try { idraw = JSON.parse(idraw); } catch (e) { idraw = {}; }
        }
        const anomData = item.anomaly_data || item.anomalyData || {};

        // Easting Start & End
        const eStartRaw = extractFieldValue(item, ["easting_start", "start_easting", "easting", "e_coord", "x_coord", "east"]);
        const eEndRaw = extractFieldValue(item, ["easting_end", "end_easting", "easting2", "end_e", "end_x"]);

        let eastingFormatted = "-";
        if (eStartRaw && eEndRaw && String(eStartRaw) !== String(eEndRaw)) {
            eastingFormatted = `${formatVal(eStartRaw, 2)}\n${formatVal(eEndRaw, 2)}`;
        } else if (eStartRaw) {
            eastingFormatted = formatVal(eStartRaw, 2);
        } else if (eEndRaw) {
            eastingFormatted = formatVal(eEndRaw, 2);
        }

        // Northing Start & End
        const nStartRaw = extractFieldValue(item, ["northing_start", "start_northing", "northing", "n_coord", "y_coord", "north"]);
        const nEndRaw = extractFieldValue(item, ["northing_end", "end_northing", "northing2", "end_n", "end_y"]);

        let northingFormatted = "-";
        if (nStartRaw && nEndRaw && String(nStartRaw) !== String(nEndRaw)) {
            northingFormatted = `${formatVal(nStartRaw, 2)}\n${formatVal(nEndRaw, 2)}`;
        } else if (nStartRaw) {
            northingFormatted = formatVal(nStartRaw, 2);
        } else if (nEndRaw) {
            northingFormatted = formatVal(nEndRaw, 2);
        }

        // KP Start & End / Elevation
        const kpStartRaw = extractFieldValue(item, ["kp_start", "start_kp", "kp", "fp_kp", "chainage", "location"]);
        const kpEndRaw = extractFieldValue(item, ["kp_end", "end_kp", "kp2", "end_chainage"]);

        let kpElevStr = "-";
        if (item.is_riser_anomaly) {
            const elev = item.elevation ?? idraw.elevation;
            kpElevStr = elev !== undefined && elev !== null && elev !== "" ? `${elev} m` : "Riser Elev: N/A";
        } else {
            if (kpStartRaw && kpEndRaw && String(kpStartRaw) !== String(kpEndRaw)) {
                kpElevStr = `${formatVal(kpStartRaw, 3)}\n${formatVal(kpEndRaw, 3)}`;
            } else if (kpStartRaw) {
                kpElevStr = formatVal(kpStartRaw, 3);
            } else if (kpEndRaw) {
                kpElevStr = formatVal(kpEndRaw, 3);
            }
        }

        // Event Name (handling range events like Span and Burial)
        const evtName = idraw.eventName || idraw.event_name || item.event_name || item.component_name || item.component_type || "Event";
        const evtType = (idraw.eventType || idraw.event_type || item.category || item.defect_type || "").toUpperCase();
        const evtPos = (idraw.eventPosition || idraw.event_position || idraw.position || "").toUpperCase();

        const isRangeEvent = Boolean(eEndRaw || nEndRaw || kpEndRaw || evtType.includes("SPAN") || evtType.includes("BURIAL") || evtName.toUpperCase().includes("SPAN") || evtName.toUpperCase().includes("BURIAL"));

        let combinedEvtName = evtName;
        if (isRangeEvent) {
            const rangeTag = evtType.includes("BURIAL") || evtName.toUpperCase().includes("BURIAL") ? "BURIAL" : "SPAN";
            const topHeader = evtName.toUpperCase().includes(rangeTag) ? evtName : "SEABED PROFILE";
            combinedEvtName = `${topHeader}    ${rangeTag} STARTS\n                  ${rangeTag} ENDS`;
        } else {
            if (evtType && !evtName.toUpperCase().includes(evtType)) {
                combinedEvtName += ` - ${evtType}`;
            }
            if (evtPos && !combinedEvtName.toUpperCase().includes(evtPos)) {
                combinedEvtName += ` (${evtPos})`;
            }
        }

        // Anomaly Code
        const anomalyCode = item.anomaly_code || item.anomaly_ref_no || item.display_ref_no || item.defect_type || item.defect_type_code || anomData.defectCode || anomData.defectType || item.category || "AN";

        // Anomaly Priority
        const priorityLabel = (item.priority || item.priority_code || anomData.priority || "P3").toUpperCase();

        // Finding / Comments Column Construction: Dimensions + Main Text + Ref No + Rectified comments
        let findingLines: string[] = [];

        const sLen = idraw.span_length || idraw.length || idraw.spanLength || anomData.spanLength;
        const sHgt = idraw.span_height || idraw.height || idraw.spanHeight || anomData.spanHeight;
        const bDep = idraw.burial_depth || idraw.depth || idraw.burialDepth || anomData.burialDepth;

        if (sLen) {
            const numLen = parseFloat(String(sLen).replace(/[^0-9.-]/g, ""));
            if (!isNaN(numLen)) {
                const ftVal = (numLen * 3.28084).toFixed(2);
                findingLines.push(`LENGTH: ${numLen.toFixed(2)}m / ${ftVal}ft`);
            } else {
                findingLines.push(`LENGTH: ${sLen}`);
            }
        }

        if (sHgt) {
            const numHgt = parseFloat(String(sHgt).replace(/[^0-9.-]/g, ""));
            if (!isNaN(numHgt)) {
                const inVal = (numHgt / 25.4).toFixed(2);
                findingLines.push(`HEIGHT: ${numHgt.toFixed(1)}mm / ${inVal}in`);
            } else {
                findingLines.push(`HEIGHT: ${sHgt}`);
            }
        }

        if (bDep) {
            const numDep = parseFloat(String(bDep).replace(/[^0-9.-]/g, ""));
            if (!isNaN(numDep)) {
                findingLines.push(`DEPTH: ${numDep.toFixed(2)}m`);
            } else {
                findingLines.push(`DEPTH: ${bDep}`);
            }
        }

        const descRaw = item.description || item.defect_description || idraw.eventDescription || idraw.findings || item.observations || anomData.description || "";
        const findRaw = idraw.finding || idraw.finding_description || item.findings || item.recommended_action || anomData.recommendedAction || "";

        let mainDesc = descRaw;
        if (findRaw && findRaw !== descRaw) {
            mainDesc = mainDesc ? `${mainDesc}. ${findRaw}` : findRaw;
        }

        const cpVal = item.cp_reading || idraw.cp_reading || idraw.cp_rdg || idraw.cp || idraw.cp_reading_mv;
        if (cpVal) {
            mainDesc += ` | CP: ${cpVal} mV`;
        }

        if (mainDesc) {
            findingLines.push(mainDesc);
        }

        const refNo = item.display_ref_no || item.anomaly_ref_no || item.ref_no || anomData.referenceNo;
        if (refNo) {
            findingLines.push(`Ref. No.: ${refNo}`);
        }

        const isRect = item.rectified || item.is_rectified || anomData.rectify;
        if (isRect) {
            const rectRemarks = item.rectified_remarks || anomData.rectifiedRemarks || (item.rectified_by ? `Rectified by ${item.rectified_by}` : "Rectified");
            findingLines.push(`[Rectified: ${rectRemarks}]`);
        }

        const findingText = findingLines.join("\n");

        return [
            String(idx + 1),
            eastingFormatted,
            northingFormatted,
            kpElevStr,
            combinedEvtName,
            anomalyCode,
            priorityLabel,
            findingText || "-"
        ];
    });

    // ── AutoTable Generation ─────────────────────────────────────────────────
    let currentY = margin + headerH + 4;
    currentY = drawSubHeaderBox(doc, currentY);

    autoTable(doc, {
        startY: currentY,
        head: [[
            "Item No.",
            "Easting (m E)",
            "Northing (m N)",
            "KP / Elevation",
            "Event Name",
            "Anomaly Code",
            "Priority",
            "Finding"
        ]],
        body: tableRows,
        theme: "grid",
        margin: { left: margin, right: margin, bottom: 25 },
        styles: {
            fontSize: 7.5,
            cellPadding: 2,
            textColor: [30, 41, 59],
            valign: "middle",
            lineWidth: 0.2,
            lineColor: [203, 213, 225]
        },
        headStyles: {
            fillColor: isPrintFriendly ? [240, 240, 240] : [31, 55, 93],
            textColor: isPrintFriendly ? [30, 41, 59] : [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7.5,
            halign: "center"
        },
        columnStyles: {
            0: { cellWidth: 12, halign: "center" },   // Item No
            1: { cellWidth: 24, halign: "center" },   // Easting
            2: { cellWidth: 24, halign: "center" },   // Northing
            3: { cellWidth: 22, halign: "center" },   // KP / Elevation
            4: { cellWidth: 32 },                     // Event Name
            5: { cellWidth: 18, halign: "center" },   // Anomaly Code
            6: { cellWidth: 18, halign: "center" },   // Priority
            7: { cellWidth: "auto" }                  // Finding
        },
        didParseCell: (data) => {
            // Apply priority colors to Priority column (index 6)
            if (data.section === "body" && data.column.index === 6) {
                const rawPriority = String(data.cell.raw || "");
                if (rawPriority && rawPriority !== "-") {
                    const style = priorityStyle(rawPriority, priorityColorMap, undefined, isPrintFriendly);
                    data.cell.styles.fillColor = style.bg;
                    data.cell.styles.textColor = style.text;
                    data.cell.styles.fontStyle = "bold";
                }
            }
        },
        didDrawPage: (data) => {
            // Draw Header on every page
            drawHeader(doc);
        }
    });

    // ── Watermark & Signatures ───────────────────────────────────────────────
    applyWatermarkAndSignaturesGlobal(doc, config);

    // Output / Return
    if (config.returnBlob) {
        return doc.output("blob");
    }

    doc.save(`${reportNo.replace(/[/\\?%*:|"<>]/g, "_")}.pdf`);
};
