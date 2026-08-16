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
    isFindingsReport?: boolean;
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
        else rgb = [0, 176, 80]; // Green default for clear visibility
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

export function extractFieldValue(item: any, keyNames: string[]): any {
    if (!item) return null;
    let idraw = item.inspection_data || item.inspection_dat || {};
    if (typeof idraw === "string") {
        try { idraw = JSON.parse(idraw); } catch (e) { idraw = {}; }
    }
    const anomData = item.anomaly_data || item.anomalyData || {};
    const isValid = (v: any) => v !== null && v !== undefined && String(v).trim() !== "" && String(v).trim() !== "-";

    for (const key of keyNames) {
        const kLower = key.toLowerCase().trim();

        // 1. Direct item properties
        for (const k of Object.keys(item)) {
            if (k.toLowerCase().trim() === kLower && isValid(item[k])) {
                return item[k];
            }
        }

        // 2. Direct idraw properties
        for (const k of Object.keys(idraw)) {
            if (k.toLowerCase().trim() === kLower && isValid(idraw[k])) {
                return idraw[k];
            }
        }

        // 3. Direct anomData properties
        for (const k of Object.keys(anomData)) {
            if (k.toLowerCase().trim() === kLower && isValid(anomData[k])) {
                return anomData[k];
            }
        }

        // 4. Nested fields array inside idraw
        if (Array.isArray(idraw.fields)) {
            for (const f of idraw.fields) {
                const fLabel = (f.label || f.name || "").toLowerCase().trim();
                if ((fLabel === kLower || fLabel.includes(kLower)) && isValid(f.value)) {
                    return f.value;
                }
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

function groupRangeAnomalies(records: any[], allRecords: any[] = []): any[] {
    const fullList = [...allRecords, ...records];
    const grouped: any[] = [];
    const processedRecordIds = new Set<string>();

    for (let i = 0; i < records.length; i++) {
        const curr = records[i];
        const currId = String(curr.insp_id || curr.id || curr.anomaly_id || `idx_${i}`);
        if (processedRecordIds.has(currId)) continue;

        let idrawCurr = curr.inspection_data || curr.inspection_dat || {};
        if (typeof idrawCurr === "string") {
            try { idrawCurr = JSON.parse(idrawCurr); } catch (e) { idrawCurr = {}; }
        }

        const evtTypeCurr = (idrawCurr.eventType || idrawCurr.event_type || curr.category || curr.defect_type || curr.defect_type_code || "").toString().toUpperCase();
        const evtPosCurr = (idrawCurr.eventPosition || idrawCurr.event_position || idrawCurr.position || "").toString().toUpperCase();
        const evtNameCurr = (idrawCurr.eventName || idrawCurr.event_name || curr.event_name || curr.description || "").toString().toUpperCase();

        const isSpanOrBurial = evtTypeCurr.includes("SPAN") || evtTypeCurr.includes("BURIAL") || evtNameCurr.includes("SPAN") || evtNameCurr.includes("BURIAL");

        if (isSpanOrBurial) {
            let startRec = curr;
            let endRec = curr;

            const isStart = evtPosCurr.includes("START") || evtNameCurr.includes("START") || evtPosCurr === "S";
            const isEnd = evtPosCurr.includes("END") || evtNameCurr.includes("END") || evtPosCurr === "E";

            // Candidate pool to find match among all records
            const pool = fullList.filter(r => {
                const rId = String(r.insp_id || r.id || "");
                const cId = String(curr.insp_id || curr.id || "");
                return !rId || !cId || rId !== cId;
            });

            if (isEnd) {
                endRec = curr;
                let bestStart: any = null;
                let bestDist = Infinity;

                const currKp = parseFloat(extractFieldValue(curr, ["kp", "fp_kp", "kp_end", "end_kp"]) || "0");
                const currInspId = curr.insp_id || curr.id || 0;

                for (const cand of pool) {
                    let idrawCand = cand.inspection_data || cand.inspection_dat || {};
                    if (typeof idrawCand === "string") { try { idrawCand = JSON.parse(idrawCand); } catch (e) { idrawCand = {}; } }

                    const evtTypeCand = (idrawCand.eventType || idrawCand.event_type || cand.category || cand.defect_type || cand.defect_type_code || cand.inspection_type_code || "").toString().toUpperCase();
                    const evtPosCand = (idrawCand.eventPosition || idrawCand.event_position || cand.position || "").toString().toUpperCase();
                    const evtNameCand = (idrawCand.eventName || idrawCand.event_name || cand.event_name || cand.description || "").toString().toUpperCase();

                    const candIsStart = evtPosCand.includes("START") || evtNameCand.includes("START") || evtPosCand === "S";
                    const isSameType = (evtTypeCurr.includes("SPAN") && (evtTypeCand.includes("SPAN") || evtNameCand.includes("SPAN"))) ||
                                       (evtTypeCurr.includes("BURIAL") && (evtTypeCand.includes("BURIAL") || evtNameCand.includes("BURIAL")));

                    const refCurr = curr.display_ref_no || curr.anomaly_ref_no || curr.ref_no;
                    const refCand = cand.display_ref_no || cand.anomaly_ref_no || cand.ref_no;
                    const isSameRef = Boolean(refCurr && refCand && refCurr === refCand);

                    if (candIsStart && (isSameType || isSameRef)) {
                        const candKp = parseFloat(extractFieldValue(cand, ["kp", "fp_kp", "kp_start", "start_kp"]) || "0");
                        const candInspId = cand.insp_id || cand.id || 0;

                        const dist = Math.abs(currKp - candKp) || Math.abs(currInspId - candInspId);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestStart = cand;
                        }
                    }
                }

                if (bestStart) {
                    startRec = bestStart;
                }
            } else if (isStart) {
                startRec = curr;
                let bestEnd: any = null;
                let bestDist = Infinity;

                const currKp = parseFloat(extractFieldValue(curr, ["kp", "fp_kp", "kp_start", "start_kp"]) || "0");
                const currInspId = curr.insp_id || curr.id || 0;

                for (const cand of pool) {
                    let idrawCand = cand.inspection_data || cand.inspection_dat || {};
                    if (typeof idrawCand === "string") { try { idrawCand = JSON.parse(idrawCand); } catch (e) { idrawCand = {}; } }

                    const evtTypeCand = (idrawCand.eventType || idrawCand.event_type || cand.category || cand.defect_type || cand.defect_type_code || cand.inspection_type_code || "").toString().toUpperCase();
                    const evtPosCand = (idrawCand.eventPosition || idrawCand.event_position || cand.position || "").toString().toUpperCase();
                    const evtNameCand = (idrawCand.eventName || idrawCand.event_name || cand.event_name || cand.description || "").toString().toUpperCase();

                    const candIsEnd = evtPosCand.includes("END") || evtNameCand.includes("END") || evtPosCand === "E";
                    const isSameType = (evtTypeCurr.includes("SPAN") && (evtTypeCand.includes("SPAN") || evtNameCand.includes("SPAN"))) ||
                                       (evtTypeCurr.includes("BURIAL") && (evtTypeCand.includes("BURIAL") || evtNameCand.includes("BURIAL")));

                    const refCurr = curr.display_ref_no || curr.anomaly_ref_no || curr.ref_no;
                    const refCand = cand.display_ref_no || cand.anomaly_ref_no || cand.ref_no;
                    const isSameRef = Boolean(refCurr && refCand && refCurr === refCand);

                    if (candIsEnd && (isSameType || isSameRef)) {
                        const candKp = parseFloat(extractFieldValue(cand, ["kp", "fp_kp", "kp_end", "end_kp"]) || "0");
                        const candInspId = cand.insp_id || cand.id || 0;

                        const dist = Math.abs(currKp - candKp) || Math.abs(currInspId - candInspId);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestEnd = cand;
                        }
                    }
                }

                if (bestEnd) {
                    endRec = bestEnd;
                }
            }

            const startId = String(startRec.insp_id || startRec.id || startRec.anomaly_id || "");
            const endId = String(endRec.insp_id || endRec.id || endRec.anomaly_id || "");
            if (startId) processedRecordIds.add(startId);
            if (endId) processedRecordIds.add(endId);
            processedRecordIds.add(currId);

            const eStart = extractFieldValue(startRec, ["easting_start", "start_easting", "easting_s", "easting", "e_coord", "x_coord", "east", "x", "EASTING"]);
            const eEnd = extractFieldValue(endRec, ["easting_end", "end_easting", "easting_e", "easting", "e_coord", "x_coord", "east", "x", "EASTING", "easting2"]);

            const nStart = extractFieldValue(startRec, ["northing_start", "start_northing", "northing_s", "northing", "n_coord", "y_coord", "north", "y", "NORTHING"]);
            const nEnd = extractFieldValue(endRec, ["northing_end", "end_northing", "northing_e", "northing", "n_coord", "y_coord", "north", "y", "NORTHING", "northing2"]);

            const kpStart = extractFieldValue(startRec, ["kp_start", "start_kp", "kp_s", "kp", "fp_kp", "chainage", "location", "KP"]);
            const kpEnd = extractFieldValue(endRec, ["kp_end", "end_kp", "kp_e", "kp", "fp_kp", "chainage", "location", "KP", "kp2"]);

            let idrawStart = startRec.inspection_data || startRec.inspection_dat || {};
            let idrawEnd = endRec.inspection_data || endRec.inspection_dat || {};
            if (typeof idrawStart === "string") { try { idrawStart = JSON.parse(idrawStart); } catch (e) { idrawStart = {}; } }
            if (typeof idrawEnd === "string") { try { idrawEnd = JSON.parse(idrawEnd); } catch (e) { idrawEnd = {}; } }

            const descStart = extractDescription(startRec);
            const descEnd = extractDescription(endRec);

            const cleanStart = descStart.replace(/^Start:\s*/i, "").replace(/^End:\s*/i, "").trim();
            const cleanEnd = descEnd.replace(/^Start:\s*/i, "").replace(/^End:\s*/i, "").trim();
            let mergedDesc = cleanStart ? `Start: ${cleanStart}` : "";
            if (cleanEnd && cleanEnd !== cleanStart) {
                if (mergedDesc) {
                    mergedDesc += `\nEnd: ${cleanEnd}`;
                } else {
                    mergedDesc = `End: ${cleanEnd}`;
                }
            }

            const hasAnom = Boolean(startRec.has_anomaly || endRec.has_anomaly || startRec.status === "Anomaly" || endRec.status === "Anomaly");
            const mainAnomRec = (endRec.has_anomaly || endRec.status === "Anomaly") ? endRec : startRec;

            const combined: any = {
                ...mainAnomRec,
                has_anomaly: hasAnom,
                status: hasAnom ? "Anomaly" : (startRec.status || endRec.status),
                easting_start: eStart,
                easting_end: eEnd,
                northing_start: nStart,
                northing_end: nEnd,
                kp_start: kpStart,
                kp_end: kpEnd,
                description: mergedDesc || curr.description,
                is_range_combined: true,
                range_type: evtTypeCurr.includes("BURIAL") || evtNameCurr.includes("BURIAL") ? "BURIAL" : "SPAN",
                inspection_data: {
                    ...idrawStart,
                    ...idrawEnd,
                    ...((curr.inspection_data && typeof curr.inspection_data === "object") ? curr.inspection_data : {}),
                    span_length: idrawStart.span_length || idrawEnd.span_length || idrawStart.length || idrawEnd.length,
                    span_height: idrawStart.span_height || idrawEnd.span_height || idrawStart.height || idrawEnd.height,
                    burial_depth: idrawStart.burial_depth || idrawEnd.burial_depth || idrawStart.depth || idrawEnd.depth
                }
            };

            grouped.push(combined);
            continue;
        }

        processedRecordIds.add(currId);
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
    let allInspectionRecords: any[] = [];

    if (recordsOverride && recordsOverride.length > 0) {
        allInspectionRecords = [...recordsOverride];
        const rangeGroupedAll = groupRangeAnomalies(recordsOverride, recordsOverride);
        fetchedAnomalies = rangeGroupedAll.filter((r: any) => {
            if (r.is_range_combined && r.has_anomaly) return true;
            const hasAnomFlag = r.has_anomaly === true || r.has_anomaly === 1 || r.has_anomaly === "true" || r.has_anomaly === "1";
            const fType = (r.finding_type || r.findingType || r.record_category || r.category || r.status || "").toUpperCase();
            const isAnomType = fType.includes("ANOMAL") || fType.includes("FIND");
            const hasAnomData = r.anomaly_data || r.anomalyData || r.defect_code || r.defectCode || r.anomaly_id || r.anomaly_ref_no || r.display_ref_no;
            return hasAnomFlag || isAnomType || Boolean(hasAnomData);
        });
    }

    // Always attempt API fetch if fetchedAnomalies is empty OR allInspectionRecords has no candidate records
    try {
        const jpId = jobPack?.id || jobPack?.jobpack_id || config.jobPackId;
        const strId = structure?.id || structure?.str_id || config.structureId;

        const baseUrl = typeof window === "undefined" ? "http://localhost:3000/api/reports/pipeline-defect-summary?" : "/api/reports/pipeline-defect-summary?";
        let url = baseUrl;
        if (jpId) url += `jobpack_id=${jpId}&`;
        if (strId) url += `structure_id=${strId}&`;
        if (sowReportNo) url += `sow_report_no=${encodeURIComponent(sowReportNo)}&`;
        if (config.prefix || config.reportNoPrefix) url += `prefix=${encodeURIComponent(config.prefix || config.reportNoPrefix || "")}&`;

        const res = await fetch(url);
        if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.length > 0) {
                const apiAnomMap = new Map<any, any>();
                for (const a of json.data) {
                    const key = String(a.id || a.insp_id || a.anomaly_id || "");
                    if (key) apiAnomMap.set(key, a);
                }

                if (fetchedAnomalies.length === 0) {
                    fetchedAnomalies = json.data;
                } else {
                    fetchedAnomalies = fetchedAnomalies.map((a: any) => {
                        const key = String(a.insp_id || a.id || a.anomaly_id || "");
                        const apiItem = apiAnomMap.get(key);
                        if (apiItem) {
                            return {
                                ...a,
                                priority: a.priority || apiItem.priority,
                                priority_color: a.priority_color || apiItem.priority_color,
                                priority_code: a.priority_code || apiItem.priority_code,
                                anomaly_code: a.anomaly_code || apiItem.anomaly_code,
                                defect_type: a.defect_type || apiItem.defect_type,
                                category: a.category || apiItem.category,
                                display_ref_no: a.display_ref_no || apiItem.display_ref_no
                            };
                        }
                        return a;
                    });
                }
            }
            if (json.all_inspection_records && json.all_inspection_records.length > 0) {
                const existingIds = new Set(allInspectionRecords.map((r: any) => r.insp_id || r.id));
                for (const r of json.all_inspection_records) {
                    const rId = r.insp_id || r.id;
                    if (!rId || !existingIds.has(rId)) {
                        allInspectionRecords.push(r);
                    }
                }
            }
            if (json.priority_colors) priorityColorMap = json.priority_colors;
            if (json.pipeline_info) pipelineInfo = { ...structure, ...json.pipeline_info };
        }
    } catch (e) {
        console.error("[PipelineDefectSummary] Error fetching data:", e);
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
                const { data: jpAnoms } = await supabase
                    .from("v_anomaly_details")
                    .select("*")
                    .or(`jobpack_id.eq.${jpId},jobpack_id.eq.${Number(jpId) || 0}`)
                    .order("priority", { ascending: true });

                if (jpAnoms && jpAnoms.length > 0) {
                    fetchedAnomalies = jpAnoms;
                }
            }
        } catch (e) {
            console.error("[PipelineDefectSummary] Direct Supabase fallback error:", e);
        }
    }

    // Always fetch full insp_records if allInspectionRecords has no candidate start/end records
    if (supabase && (allInspectionRecords.length === 0 || allInspectionRecords.length === fetchedAnomalies.length)) {
        try {
            const jpId = jobPack?.id || jobPack?.jobpack_id || config.jobPackId;
            const strId = structure?.id || structure?.str_id || config.structureId;
            if (jpId || strId) {
                let inspQuery = supabase.from("insp_records").select("*");
                if (jpId) inspQuery = inspQuery.or(`jobpack_id.eq.${jpId},jobpack_id.eq.${Number(jpId) || 0}`);
                if (strId) inspQuery = inspQuery.or(`structure_id.eq.${strId},structure_id.eq.${Number(strId) || 0}`);
                const { data: allRecs } = await inspQuery.order("insp_id", { ascending: true });
                if (allRecs && allRecs.length > 0) {
                    const existingIds = new Set(allInspectionRecords.map((r: any) => r.insp_id || r.id));
                    for (const r of allRecs) {
                        const rId = r.insp_id || r.id;
                        if (!rId || !existingIds.has(rId)) {
                            allInspectionRecords.push(r);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[PipelineDefectSummary] Candidate insp_records fetch error:", e);
        }
    }

    // Enrich allInspectionRecords with fetchedAnomalies details (priority, display_ref_no, recommended_action, etc.)
    if (fetchedAnomalies.length > 0) {
        const existingIds = new Set(allInspectionRecords.map((r: any) => String(r.insp_id || r.id || "")));
        for (const fa of fetchedAnomalies) {
            const faId = String(fa.insp_id || fa.id || "");
            if (!faId || !existingIds.has(faId)) {
                allInspectionRecords.push({ ...fa, has_anomaly: true });
            } else {
                const idx = allInspectionRecords.findIndex((r: any) => String(r.insp_id || r.id || "") === faId);
                if (idx !== -1) {
                    allInspectionRecords[idx] = {
                        ...allInspectionRecords[idx],
                        ...fa,
                        has_anomaly: true,
                        inspection_data: {
                            ...(allInspectionRecords[idx].inspection_data || {}),
                            ...(fa.inspection_data || {})
                        }
                    };
                }
            }
        }
    }

    // Group range anomalies (SPAN / BURIAL) across all records
    const groupedAll = groupRangeAnomalies(allInspectionRecords, allInspectionRecords);

    // Filter to anomalies only
    anomalies = groupedAll.filter((r: any) => {
        if (r.is_range_combined && r.has_anomaly) return true;
        const hasAnomFlag = r.has_anomaly === true || r.has_anomaly === 1 || r.has_anomaly === "true" || r.has_anomaly === "1" || r.status === "Anomaly";
        const fType = (r.finding_type || r.findingType || r.record_category || r.category || r.status || "").toUpperCase();
        const isAnomType = fType.includes("ANOMAL") || fType.includes("FIND");
        const hasAnomData = r.anomaly_data || r.anomalyData || r.defect_code || r.defectCode || r.anomaly_id || r.anomaly_ref_no || r.display_ref_no;
        return hasAnomFlag || isAnomType || Boolean(hasAnomData);
    });

    const isFindingsReport = config.isFindingsReport === true || (config.prefix && config.prefix.toUpperCase().includes("F"));

    if (isFindingsReport) {
        anomalies = anomalies.filter((r: any) => {
            if (r.is_blank) return true;
            const refNo = (r.display_ref_no || r.ref_no || r.anomaly_ref_no || r.ref_number || "").toString().toUpperCase();
            const fType = (r.finding_type || r.findingType || r.record_category || r.category || r.status || "").toUpperCase();

            // Strictly exclude Anomaly reference numbers (e.g. A-001, A-002, / A-001)
            const isAnomalyRef = /^[A]\d+|^A-/i.test(refNo) || refNo.includes("/ A-") || refNo.includes("/A-");
            if (isAnomalyRef && !refNo.includes("F-") && !refNo.includes("/ F-")) {
                return false;
            }

            return refNo.includes("F") || fType.includes("FIND");
        });
    }

    const isBlank = config.isBlankReport || config.printBlankReport || (anomalies.length === 0 && config.printBlankReport !== false);

    if (isBlank && anomalies.length === 0) {
        anomalies = Array.from({ length: 8 }, (_, i) => ({
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

    // ── Document Setup (Landscape) ──────────────────────────────────────────
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 12;
    const contentWidth = pageWidth - margin * 2; // 273mm
    const isPrintFriendly = config.printFriendly === true;
    const headerH = 14;

    // Report Number standard formatting
    const defaultPrefix = isFindingsReport ? "FSR-PL" : "DSR-PL";
    const prefix = config.reportNoPrefix || config.prefix || defaultPrefix;
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

        const logoMaxW = 20;
        const logoMaxH = 10;
        const logoPad = 2;

        if (contractorLogo) {
            drawLogo(d, contractorLogo, logoMaxW, logoMaxH, sx + logoPad, sy + logoPad, "left", "center");
        }

        const titleX = sx + contentWidth / 2;
        const reportTitle = isFindingsReport ? "FINDING SUMMARY REPORT (PIPELINE)" : "DEFECT SUMMARY REPORT (PIPELINE)";
        d.setFont("helvetica", "bold");
        d.setFontSize(13);
        d.setTextColor(isPrintFriendly ? 31 : 255, isPrintFriendly ? 55 : 255, isPrintFriendly ? 93 : 255);
        d.text(reportTitle, titleX, sy + 6, { align: "center" });

        d.setFont("helvetica", "normal");
        d.setFontSize(8.5);
        d.setTextColor(isPrintFriendly ? 70 : 200, isPrintFriendly ? 70 : 200, isPrintFriendly ? 70 : 200);
        const compDesc = companySettings.company_name || contractorName || "NASQUEST RESOURCES SDN BHD";
        d.text(compDesc.toUpperCase(), titleX, sy + 11.5, { align: "center" });

        if (clientLogo) {
            drawLogo(d, clientLogo, logoMaxW, logoMaxH, sx + contentWidth - logoMaxW - logoPad, sy + logoPad, "right", "center");
        }
    };

    // ── Subheader Details Box ────────────────────────────────────────────────
    const drawSubHeaderBox = (d: jsPDF, startY: number): number => {
        const sx = margin;
        const boxWidth = contentWidth;
        const boxH = 14;

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
        const col2X = sx + 95;
        const col3X = sx + 190;

        const pName = pipelineInfo?.title || pipelineInfo?.structure_name || structure?.name || structure?.title || "-";
        const pField = pipelineInfo?.pfield || pipelineInfo?.field_name || jobPack?.metadata?.field || "-";
        const jpName = jobPack?.name || jobPack?.title || "-";
        const vessel = jobPack?.metadata?.vessel || "-";
        const inspDate = formatPdfDate(new Date());

        // Row 1
        d.setFont("helvetica", "bold");
        d.text("Pipeline / Asset:", col1X, startY + 4.5);
        d.setFont("helvetica", "normal");
        d.text(String(pName).substring(0, 38), col1X + 28, startY + 4.5);

        d.setFont("helvetica", "bold");
        d.text("Job Pack:", col2X, startY + 4.5);
        d.setFont("helvetica", "normal");
        d.text(String(jpName).substring(0, 35), col2X + 18, startY + 4.5);

        d.setFont("helvetica", "bold");
        d.text("Date:", col3X, startY + 4.5);
        d.setFont("helvetica", "normal");
        d.text(inspDate, col3X + 12, startY + 4.5);

        // Row 2
        d.setFont("helvetica", "bold");
        d.text("Field:", col1X, startY + 10.5);
        d.setFont("helvetica", "normal");
        d.text(String(pField).substring(0, 38), col1X + 28, startY + 10.5);

        d.setFont("helvetica", "bold");
        d.text("Report No.:", col2X, startY + 10.5);
        d.setFont("helvetica", "normal");
        d.text(sowReportNo || "N/A", col2X + 20, startY + 10.5);

        d.setFont("helvetica", "bold");
        d.text("Vessel:", col3X, startY + 10.5);
        d.setFont("helvetica", "normal");
        d.text(String(vessel).substring(0, 25), col3X + 14, startY + 10.5);

        return startY + boxH + 3;
    };

    // ── Priority Statistical Summary Dashboard ────────────────────────────────
    const drawSummaryDashboard = (d: jsPDF, y: number, recordsList: any[], colorMap: ColorMap): number => {
        const counts: Record<string, number> = {};
        recordsList.forEach(a => {
            if (a.is_blank) return;
            const p = (a.priority || "P3").toUpperCase();
            counts[p] = (counts[p] || 0) + 1;
        });

        const sortedLabels = Object.keys(counts).sort((a, b) => prioritySortKey(a) - prioritySortKey(b));
        if (sortedLabels.length === 0) return y;

        const chartW = contentWidth * 0.55;
        const tableW = contentWidth * 0.40;
        const dashH = 38;
        const gap = contentWidth * 0.05;

        // Draw Section Title
        const dashTitle = isFindingsReport ? "FINDINGS STATISTICAL SUMMARY" : "ANOMALY STATISTICAL SUMMARY";
        d.setFontSize(8.5);
        d.setFont("helvetica", "bold");
        d.setFillColor(240, 243, 246);
        d.rect(margin, y, contentWidth, 6, "F");
        d.setTextColor(31, 55, 93);
        d.text(dashTitle, margin + 2, y + 4.2);
        d.setTextColor(0, 0, 0);

        // --- 1. Draw Bar Chart ---
        const chartX = margin;
        const chartY = y + 8;
        const innerH = dashH - 12;
        const barAreaW = chartW - 25;

        const maxCount = Math.max(...Object.values(counts), 5);
        const scale = innerH / maxCount;

        // Draw Axes
        d.setDrawColor(180);
        d.setLineWidth(0.2);
        d.line(chartX + 15, chartY, chartX + 15, chartY + innerH);
        d.line(chartX + 15, chartY + innerH, chartX + chartW, chartY + innerH);

        // Grid lines
        d.setLineDashPattern([1, 1], 0);
        for (let i = 1; i <= 5; i++) {
            const gy = chartY + innerH - (maxCount * (i / 5)) * scale;
            d.line(chartX + 15, gy, chartX + chartW, gy);
        }
        d.setLineDashPattern([], 0);

        const barW = Math.min(16, (barAreaW / (sortedLabels.length || 1)) * 0.6);
        const barGap = (barAreaW / (sortedLabels.length || 1)) * 0.4;

        sortedLabels.forEach((label, i) => {
            const count = counts[label];
            const { bg } = priorityStyle(label, colorMap, undefined, isPrintFriendly);
            const x = chartX + 22 + i * (barW + barGap);
            const h = count * scale;

            d.setFillColor(...bg);
            d.rect(x, chartY + innerH - h, barW, h, "F");
            d.setDrawColor(0);
            d.setLineWidth(0.1);
            d.rect(x, chartY + innerH - h, barW, h, "S");

            d.setFontSize(6.5);
            d.setTextColor(0);
            d.text(label, x + barW / 2, chartY + innerH + 3.5, { align: "center" });

            d.setFont("helvetica", "bold");
            d.text(String(count), x + barW / 2, chartY + innerH - h - 1, { align: "center" });
            d.setFont("helvetica", "normal");
        });

        // --- 2. Draw Summary Table ---
        const tableX = margin + chartW + gap;
        const tableY = y + 8;

        autoTable(d, {
            startY: tableY,
            margin: { left: tableX },
            tableWidth: tableW,
            head: [["Priority Level", "Total Count"]],
            body: sortedLabels.map(l => {
                const { bg, text } = priorityStyle(l, colorMap, undefined, isPrintFriendly);
                return [
                    { content: l.toUpperCase(), styles: { fillColor: bg, textColor: text, fontStyle: "bold" as const, halign: "left" as const } },
                    { content: String(counts[l]), styles: { halign: "center" as const, fontStyle: "bold" as const } }
                ];
            }),
            theme: "grid",
            styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
            headStyles: {
                fillColor: isPrintFriendly ? [230, 230, 230] : [31, 55, 93],
                textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
                halign: "center"
            },
        });

        return Math.max((d as any).lastAutoTable?.finalY ? (d as any).lastAutoTable.finalY + 3 : chartY + dashH + 4, chartY + dashH + 4);
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
        const eStartRaw = item.easting_start ?? extractFieldValue(item, ["start_easting", "easting_s", "easting", "e_coord", "x_coord", "east", "x", "EASTING"]);
        const eEndRaw = item.easting_end ?? extractFieldValue(item, ["end_easting", "easting_e", "easting2", "end_e", "end_x", "EASTING"]);

        // Northing Start & End
        const nStartRaw = item.northing_start ?? extractFieldValue(item, ["start_northing", "northing_s", "northing", "n_coord", "y_coord", "north", "y", "NORTHING"]);
        const nEndRaw = item.northing_end ?? extractFieldValue(item, ["end_northing", "northing_e", "northing2", "end_n", "end_y", "NORTHING"]);

        // KP Start & End / Elevation
        const kpStartRaw = item.kp_start ?? extractFieldValue(item, ["start_kp", "kp_s", "kp", "fp_kp", "chainage", "location", "KP"]);
        const kpEndRaw = item.kp_end ?? extractFieldValue(item, ["end_kp", "kp_e", "kp2", "end_chainage"]);

        // Event Name (handling range events like Span and Burial cleanly)
        const evtName = idraw.eventName || idraw.event_name || item.event_name || item.component_name || item.component_type || "Event";
        const evtType = (idraw.eventType || idraw.event_type || item.category || item.defect_type || "").toUpperCase();
        const evtPos = (idraw.eventPosition || idraw.event_position || idraw.position || "").toUpperCase();

        const isRangeEvent = Boolean(item.is_range_combined || eEndRaw || nEndRaw || kpEndRaw || evtType.includes("SPAN") || evtType.includes("BURIAL") || evtName.toUpperCase().includes("SPAN") || evtName.toUpperCase().includes("BURIAL"));

        let eastingFormatted = "-";
        if (isRangeEvent) {
            const e1 = formatVal(eStartRaw, 2);
            const e2 = formatVal(eEndRaw, 2);
            if (e1 !== "-" || e2 !== "-") {
                eastingFormatted = `\n${e1}\n${e2}`;
            }
        } else if (eStartRaw && eEndRaw && String(eStartRaw) !== String(eEndRaw)) {
            eastingFormatted = `${formatVal(eStartRaw, 2)}\n${formatVal(eEndRaw, 2)}`;
        } else if (eStartRaw) {
            eastingFormatted = formatVal(eStartRaw, 2);
        } else if (eEndRaw) {
            eastingFormatted = formatVal(eEndRaw, 2);
        }

        let northingFormatted = "-";
        if (isRangeEvent) {
            const n1 = formatVal(nStartRaw, 2);
            const n2 = formatVal(nEndRaw, 2);
            if (n1 !== "-" || n2 !== "-") {
                northingFormatted = `\n${n1}\n${n2}`;
            }
        } else if (nStartRaw && nEndRaw && String(nStartRaw) !== String(nEndRaw)) {
            northingFormatted = `${formatVal(nStartRaw, 2)}\n${formatVal(nEndRaw, 2)}`;
        } else if (nStartRaw) {
            northingFormatted = formatVal(nStartRaw, 2);
        } else if (nEndRaw) {
            northingFormatted = formatVal(nEndRaw, 2);
        }

        let kpElevStr = "-";
        if (item.is_riser_anomaly) {
            const elev = item.elevation ?? idraw.elevation;
            kpElevStr = elev !== undefined && elev !== null && elev !== "" ? `${elev} m` : "Riser Elev: N/A";
        } else if (isRangeEvent) {
            const k1 = formatVal(kpStartRaw, 3);
            const k2 = formatVal(kpEndRaw, 3);
            if (k1 !== "-" || k2 !== "-") {
                kpElevStr = `\n${k1}\n${k2}`;
            }
        } else if (kpStartRaw && kpEndRaw && String(kpStartRaw) !== String(kpEndRaw)) {
            kpElevStr = `${formatVal(kpStartRaw, 3)}\n${formatVal(kpEndRaw, 3)}`;
        } else if (kpStartRaw) {
            kpElevStr = formatVal(kpStartRaw, 3);
        } else if (kpEndRaw) {
            kpElevStr = formatVal(kpEndRaw, 3);
        }

        // Clean, left-aligned 3-line Event Name formatting for Range Events
        let combinedEvtName = evtName;
        if (isRangeEvent) {
            const rangeTag = evtType.includes("BURIAL") || evtName.toUpperCase().includes("BURIAL") ? "BURIAL" : "SPAN";
            const topHeader = evtName.toUpperCase().includes(rangeTag) ? evtName : "SEABED PROFILE";
            combinedEvtName = `${topHeader}\n${rangeTag} STARTS\n${rangeTag} ENDS`;
        } else {
            if (evtType && !evtName.toUpperCase().includes(evtType)) {
                combinedEvtName += ` - ${evtType}`;
            }
            if (evtPos && !combinedEvtName.toUpperCase().includes(evtPos)) {
                combinedEvtName += ` (${evtPos})`;
            }
        }

        // Anomaly Code Correction: Prioritize Defect Type Code / Span or Burial full naming
        let anomalyCode = item.anomaly_code || item.defect_type_code || item.defect_type || anomData.defectCode || anomData.defectType || item.category || "";
        if (isRangeEvent) {
            const isSpan = evtType.includes("SPAN") || evtName.toUpperCase().includes("SPAN") || item.range_type === "SPAN";
            const isBurial = evtType.includes("BURIAL") || evtName.toUpperCase().includes("BURIAL") || item.range_type === "BURIAL";
            if (isSpan) {
                anomalyCode = "PIPELINE SPANNING";
            } else if (isBurial) {
                anomalyCode = "PIPELINE BURIAL";
            }
        }
        if (!anomalyCode || anomalyCode.trim().toUpperCase() === "AN") {
            anomalyCode = item.defect_type_code || item.defect_type || item.defect_name || idraw.defect_type || item.category || (isRangeEvent ? "PIPELINE SPANNING" : "ANOMALY");
        }

        // Priority Label
        const priorityLabel = (item.priority || item.priority_code || anomData.priority || "P3").toUpperCase();

        // Finding / Comments Column Construction
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
                findingLines.push(`HEIGHT: ${numHgt.toFixed(2)}m`);
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

    // ── AutoTable Generation (Landscape 273mm Usable Width) ─────────────────────
    let currentY = margin + headerH + 3;
    currentY = drawSubHeaderBox(doc, currentY);

    if (!isBlank && anomalies.length > 0) {
        currentY = drawSummaryDashboard(doc, currentY, anomalies, priorityColorMap);
    }

    autoTable(doc, {
        startY: currentY,
        head: [[
            "Item No.",
            "Easting (m E)",
            "Northing (m N)",
            "KP / Elevation",
            "Event Name",
            isFindingsReport ? "Finding Code" : "Anomaly Code",
            "Priority",
            "Finding"
        ]],
        body: tableRows,
        theme: "grid",
        margin: { left: margin, right: margin, bottom: 20 },
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
            0: { cellWidth: 10, halign: "center" },   // Item No.
            1: { cellWidth: 30, halign: "center" },   // Easting (m E)
            2: { cellWidth: 30, halign: "center" },   // Northing (m N)
            3: { cellWidth: 22, halign: "center" },   // KP / Elevation
            4: { cellWidth: 48, halign: "left" },     // Event Name (Clean alignment)
            5: { cellWidth: 35, halign: "center" },   // Anomaly Code (PIPELINE SPANNING)
            6: { cellWidth: 20, halign: "center" },   // Priority
            7: { cellWidth: 78, halign: "left" }      // Finding
        },
        didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 6) {
                const rawPriority = String(data.cell.raw || "");
                if (rawPriority && rawPriority !== "-") {
                    const directColor = anomalies[data.row.index]?.priority_color;
                    const style = priorityStyle(rawPriority, priorityColorMap, directColor, isPrintFriendly);
                    data.cell.styles.fillColor = style.bg;
                    data.cell.styles.textColor = style.text;
                    data.cell.styles.fontStyle = "bold";
                }
            }
        },
        didDrawPage: (data) => {
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

/**
 * Main Generator for Finding Summary Report (Pipeline)
 */
export const generatePipelineFindingSummaryReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings = {},
    config: ReportConfig = {},
    recordsOverride?: any[]
) => {
    return generatePipelineDefectSummaryReport(
        jobPack,
        structure,
        sowReportNo,
        companySettings,
        { ...config, isFindingsReport: true, prefix: config.prefix || "FSR-PL" },
        recordsOverride
    );
};
