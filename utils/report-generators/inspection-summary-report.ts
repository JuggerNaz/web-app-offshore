import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { 
    loadLogoWithTransparency, 
    drawLogo, 
    draw3SectionHeader,
    applyWatermarkAndSignaturesGlobal, 
    formatPdfDate, 
    REPORT_FOOTER_APP_TEXT 
} from "./shared-logo";
import { getInspectionDateRange } from "./date-range-utils";

export interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

export interface ReportConfig {
    reportNoPrefix?: string;
    printFriendly?: boolean;
    jobPackId?: number | string;
    structureId?: number | string;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
    watermark?: string | { enabled?: boolean; text?: string; transparency?: number; color?: string } | any;
    [key: string]: any;
}

const DEFECT_CRITERIA_LABELS: Record<string, string> = {
    AW: "Anode wastage (AW)",
    CP: "Cathodic potential (CP)",
    DB: "Debris (DB)",
    LI: "Lack of integrity (LI)",
    PD: "Physical damage (PD)",
    SC: "Scour (SC)",
    VS: "Variation to spec (VS)",
    CR: "Corrosion (CR)",
    MT: "Marine growth (MT)",
    CD: "Coating damage (CD)",
    MC: "Mechanical damage (MC)",
};

/**
 * Inspection Summary Report — Executive Landscape Dashboard
 * 
 * Features:
 * 1. Standard Header with Contractor logo (left), Client/Company logo (right), Company & Department text.
 * 2. Top Sub-Header Bar: Field | Structure Title & Water Depth.
 * 3. 5 Top KPI Summary Metric Cards: TOTAL QIDs, COMPLETED, INCOMPLETE, TOTAL ANOMALIES, COMPLETION RATE.
 * 4. Middle Two-Column Grid:
 *    - Left: INSPECTION TASK COVERAGE (Planned, Complete, Incomplete, Rate %)
 *    - Right: ANOMALY DISTRIBUTION (By Priority & By Defect Criteria)
 * 5. Dynamic Task-Specific Detail Blocks:
 *    - Conditionally displayed based on actual inspection data (MGI, Anode Condition, Scour Survey, FMD, CP, UTWT, etc.)
 * 6. Printer-friendly mode, watermark, page footer with App Name, Version & Page No, standard signatures.
 * 7. Filtering strictly by structure_id, jobpack_id, and sow_report_no.
 */
export const generateInspectionSummaryReport = async (
    dataOrJobPack: any,
    headerDataOrStructure: any,
    companySettings: CompanySettings,
    config: ReportConfig,
    supabaseClient?: any
): Promise<Blob | void | null> => {
    try {
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();   // 297mm
        const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
        const margin = 10;                                    // 10mm Standard Margin
        const contentWidth = pageWidth - (margin * 2);        // 277mm

        const isPF = !!config?.printFriendly;

        // Structured Color Palette
        const colors = {
            navy: [7, 78, 136] as [number, number, number],         // #074E88 Brand Blue
            darkNavy: [11, 44, 77] as [number, number, number],     // #0B2C4D Dark Header
            barTrack: [226, 232, 240] as [number, number, number],  // #E2E8F0 Track
            barFill: [20, 184, 166] as [number, number, number],    // #14B8A6 Teal Fill
            border: [203, 213, 225] as [number, number, number],     // #CBD5E1 Slate 300
            cardBg: isPF ? ([255, 255, 255] as [number, number, number]) : ([248, 250, 252] as [number, number, number]),
            headerLight: [241, 245, 249] as [number, number, number],
            textDark: [15, 23, 42] as [number, number, number],     // Slate 900
            textMuted: [100, 116, 139] as [number, number, number], // Slate 500
            emerald: [16, 185, 129] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            blue: [59, 130, 246] as [number, number, number],
            amber: [245, 158, 11] as [number, number, number],
            red: [220, 38, 38] as [number, number, number],
            cyan: [6, 182, 212] as [number, number, number],
        };

        // ── 1. Resolve Filters and Raw Data ──────────────────────────────────────
        const structureId = config?.structureId || headerDataOrStructure?.structure_id || headerDataOrStructure?.id || null;
        const jobPackId = config?.jobPackId || dataOrJobPack?.jobpack_id || dataOrJobPack?.id || null;
        const sowReportNo = config?.sowReportNo || headerDataOrStructure?.sowReportNo || headerDataOrStructure?.sow_report_no || "N/A";

        let summaryData = dataOrJobPack;
        // If dataOrJobPack does not appear to be an inspection summary response, try fetching it live
        if (!summaryData || (!summaryData.records && !summaryData.sow)) {
            if (typeof window !== "undefined" && typeof fetch !== "undefined") {
                try {
                    const params = new URLSearchParams();
                    if (structureId) params.set("structure_id", String(structureId));
                    if (jobPackId) params.set("jobpack_id", String(jobPackId));
                    if (sowReportNo && sowReportNo !== "N/A" && sowReportNo !== "all") {
                        params.set("sow_report_no", String(sowReportNo));
                    }
                    const res = await fetch(`/api/inspection-summary?${params.toString()}`);
                    if (res.ok) {
                        const json = await res.json();
                        summaryData = json.data || {};
                    }
                } catch (e) {
                    console.warn("[InspectionSummaryReport] Live fetch fallback failed:", e);
                }
            }
        }

        const sow = summaryData?.sow || { total: 0, completed: 0, incomplete: 0, pending: 0, completionPct: 0 };
        const rec = summaryData?.records || { total: 0, completed: 0, incomplete: 0, anomaly: 0, finding: 0, rovCount: 0, diveCount: 0 };
        const anomalies = summaryData?.anomalies || { total: 0, byPriority: {}, byDefectType: {}, items: [] };
        const sowSummaryList: any[] = Array.isArray(summaryData?.sow_summary) ? summaryData.sow_summary : [];

        // Telemetry objects for tasks
        const mgi = summaryData?.mgi;
        const anodeGvi = summaryData?.anodeGvi;
        const scour = summaryData?.scour;
        const fmd = summaryData?.fmd;
        const cp = summaryData?.cp;
        const defectCriteria = summaryData?.defectCriteria;

        // Structure & Header Info
        const structureInfo = summaryData?.structureInfo || headerDataOrStructure || {};
        const fieldName = (headerDataOrStructure?.fieldName || headerDataOrStructure?.field || headerDataOrStructure?.pfield || summaryData?.structureInfo?.field || summaryData?.structureInfo?.fieldName || summaryData?.structureInfo?.pfield || "").trim();
        const platformName = (headerDataOrStructure?.platformName || headerDataOrStructure?.name || headerDataOrStructure?.str_name || headerDataOrStructure?.title || summaryData?.structureInfo?.name || summaryData?.structureInfo?.title || "OFFSHORE PLATFORM").trim();
        
        let rawWaterDepth = 
            headerDataOrStructure?.waterDepth ??
            headerDataOrStructure?.water_depth ??
            headerDataOrStructure?.depth ??
            headerDataOrStructure?.metadata?.water_depth ??
            headerDataOrStructure?.metadata?.waterDepth ??
            headerDataOrStructure?.metadata?.depth ??
            summaryData?.structureInfo?.waterDepth ??
            summaryData?.structureInfo?.depth ??
            summaryData?.structureInfo?.water_depth ??
            summaryData?.structureInfo?.metadata?.water_depth ??
            0;

        // Fallback fetch from /api/structures if depth was not provided but structureId is available
        if (!rawWaterDepth && structureId && typeof window !== "undefined" && typeof fetch !== "undefined") {
            try {
                const sRes = await fetch(`/api/structures/${structureId}`);
                if (sRes.ok) {
                    const sJson = await sRes.json();
                    const sData = sJson?.data || sJson;
                    if (sData?.depth !== undefined && sData?.depth !== null) {
                        rawWaterDepth = sData.depth;
                    }
                }
            } catch (_) {}
        }

        const waterDepth = rawWaterDepth ? Math.abs(Number(rawWaterDepth)) : 0;

        // ── 2. Pre-load Logos ────────────────────────────────────────────────────
        let companyLogo: any = (config as any)?.clientLogoData || (companySettings as any)?.clientLogoData || null;
        if (!companyLogo && companySettings?.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }

        // Comprehensive Contractor Logo Resolution (Config -> HeaderData -> Structure -> JobPack -> Library Fallback)
        let contractorLogoUrl = (config as any)?.contractorLogoUrl || 
                                (config as any)?.contractorLogo || 
                                (config as any)?.headerData?.contractorLogoUrl || 
                                (config as any)?.headerData?.contrLogoUrl || 
                                headerDataOrStructure?.contractorLogoUrl || 
                                headerDataOrStructure?.contrLogoUrl || 
                                headerDataOrStructure?.metadata?.contractorLogoUrl ||
                                (companySettings as any)?.contractorLogoUrl || 
                                (companySettings as any)?.contractor_logo_url || "";

        const jobPackObj = (config as any)?.jobPack || (config as any)?.headerData?.jobPack || (config as any)?.headerData?.jobpack || (dataOrJobPack?.jobpack_id ? dataOrJobPack : null);
        const contractorId = (config as any)?.contractorId || (config as any)?.headerData?.contractorId || headerDataOrStructure?.contractorId || jobPackObj?.metadata?.contrac || (jobPackObj as any)?.contractor_id;

        if (!contractorLogoUrl && contractorId && typeof window !== "undefined" && typeof fetch !== "undefined") {
            try {
                const contrRes = await fetch(`/api/libraries/contractors?id=${contractorId}`);
                if (contrRes.ok) {
                    const contrData = await contrRes.json();
                    if (contrData?.logo_url) contractorLogoUrl = contrData.logo_url;
                }
            } catch (_) {}
            if (!contractorLogoUrl) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    if (cRes.ok) {
                        const cJson = await cRes.json();
                        const cList = Array.isArray(cJson?.data) ? cJson.data : (Array.isArray(cJson) ? cJson : []);
                        const cLow = String(contractorId).toLowerCase();
                        const found = cList.find((c: any) =>
                            String(c.lib_id).toLowerCase() === cLow ||
                            String(c.id).toLowerCase() === cLow ||
                            String(c.code || "").toLowerCase() === cLow ||
                            String(c.lib_desc || "").toLowerCase() === cLow
                        );
                        if (found?.logo_url) contractorLogoUrl = found.logo_url;
                    }
                } catch (_) {}
            }
        }

        if (!contractorLogoUrl && jobPackId && typeof window !== "undefined" && typeof fetch !== "undefined") {
            try {
                const jpRes = await fetch(`/api/jobpack/${jobPackId}`);
                if (jpRes.ok) {
                    const jpData = await jpRes.json();
                    const jp = jpData?.data || jpData;
                    const cId = jp?.metadata?.contrac || jp?.contractor_id;
                    if (cId) {
                        const contrRes = await fetch(`/api/libraries/contractors?id=${cId}`);
                        if (contrRes.ok) {
                            const contrData = await contrRes.json();
                            if (contrData?.logo_url) contractorLogoUrl = contrData.logo_url;
                        }
                        if (!contractorLogoUrl) {
                            const cRes = await fetch(`/api/library/CONTR_NAM`);
                            if (cRes.ok) {
                                const cJson = await cRes.json();
                                const cList = Array.isArray(cJson?.data) ? cJson.data : (Array.isArray(cJson) ? cJson : []);
                                const cLow = String(cId).toLowerCase();
                                const found = cList.find((c: any) =>
                                    String(c.lib_id).toLowerCase() === cLow ||
                                    String(c.id).toLowerCase() === cLow ||
                                    String(c.code || "").toLowerCase() === cLow
                                );
                                if (found?.logo_url) contractorLogoUrl = found.logo_url;
                            }
                        }
                    }
                }
            } catch (_) {}
        }

        if (!contractorLogoUrl && typeof window !== "undefined" && typeof fetch !== "undefined") {
            try {
                const contrRes = await fetch('/api/libraries/contractors');
                if (contrRes.ok) {
                    const contrJson = await contrRes.json();
                    const contrList = Array.isArray(contrJson) ? contrJson : (contrJson?.data || []);
                    const found = contrList.find((c: any) => Boolean(c.logo_url));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                }
            } catch (_) {}
        }
        if (!contractorLogoUrl && typeof window !== "undefined" && typeof fetch !== "undefined") {
            try {
                const cRes = await fetch('/api/library/CONTR_NAM');
                if (cRes.ok) {
                    const cJson = await cRes.json();
                    const cList = Array.isArray(cJson?.data) ? cJson.data : (Array.isArray(cJson) ? cJson : []);
                    const found = cList.find((c: any) => Boolean(c.logo_url));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                }
            } catch (_) {}
        }

        let contractorLogo: any = (config as any)?.contractorLogoData || (headerDataOrStructure as any)?.contractorLogoData || null;
        if (!contractorLogo && contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(contractorLogoUrl); } catch (_) {}
        }

        // ── 3. Header Drawing Function (Universal Standard 3-Section Header) ─────
        const HEADER_H = 25;
        const HEADER_Y = 7;
        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `INSPECTION SUMMARY - ${extraTitleInfo}` : "INSPECTION SUMMARY",
                reportNo: sowReportNo || (config?.reportNoPrefix || headerDataOrStructure?.sowReportNo) || "N/A",
                structureName: platformName,
                companySettings,
                config,
                headerData: {
                    ...headerDataOrStructure,
                    contractorLogoUrl,
                    sowReportNo,
                    platformName,
                },
                contractorLogoData: contractorLogo,
                clientLogoData: companyLogo,
                isPrintFriendly: isPF,
                pageWidth,
                pageHeight,
                orientation: "landscape",
                margin: 10,
                headerY: HEADER_Y,
                headerH: HEADER_H,
            });
        };

        // Render Page 1 Header
        drawPageHeader(doc);

        let currentY = HEADER_Y + HEADER_H + 2.5;

        // ── 4. Sub-Header Scope Banner (Field Name, Structure Name, Jobpack Name, Inspection Date) ──
        const SUB_H = 6.5;
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        if (!isPF) {
            doc.setFillColor(...colors.headerLight);
            doc.rect(margin, currentY, contentWidth, SUB_H, "F");
        }
        doc.rect(margin, currentY, contentWidth, SUB_H, "S");

        // Resolve Jobpack Name
        let jobPackName = (config as any)?.jobpackName || 
                          (config as any)?.jobPackName || 
                          (config as any)?.jobpack || 
                          headerDataOrStructure?.jobpackName || 
                          headerDataOrStructure?.jobPackName || 
                          headerDataOrStructure?.jobpack_name || 
                          headerDataOrStructure?.jobpack || 
                          jobPackObj?.name || 
                          jobPackObj?.jobpack_name || 
                          summaryData?.jobpack?.name || 
                          summaryData?.jobPack?.name || 
                          "";

        // Resolve Inspection Date Range (start to end date)
        let inspDateRangeStr = "";
        const candidateDate = (config as any)?.dateRange || 
                             (config as any)?.inspDateRange || 
                             headerDataOrStructure?.dateRange || 
                             headerDataOrStructure?.inspDateRange || 
                             headerDataOrStructure?.date_range ||
                             headerDataOrStructure?.inspectionDateRange;

        if (candidateDate && typeof candidateDate === "string" && candidateDate.trim() && candidateDate.trim().toUpperCase() !== "N/A") {
            inspDateRangeStr = candidateDate.trim();
        } else if (summaryData?.records?.startDate && summaryData?.records?.endDate) {
            try {
                const d1 = format(new Date(summaryData.records.startDate), "dd-MMM-yyyy");
                const d2 = format(new Date(summaryData.records.endDate), "dd-MMM-yyyy");
                inspDateRangeStr = d1 === d2 ? d1 : `${d1} – ${d2}`;
            } catch (_) {
                inspDateRangeStr = `${summaryData.records.startDate} – ${summaryData.records.endDate}`;
            }
        } else if (summaryData?.records?.startDate) {
            try { inspDateRangeStr = format(new Date(summaryData.records.startDate), "dd-MMM-yyyy"); } catch (_) { inspDateRangeStr = String(summaryData.records.startDate); }
        } else {
            try {
                const calc = getInspectionDateRange(
                    summaryData?.records?.items || summaryData?.records || [],
                    headerDataOrStructure,
                    config
                );
                if (calc && calc !== "N/A") inspDateRangeStr = calc;
            } catch (_) {}
        }
        if (!inspDateRangeStr || inspDateRangeStr === "N/A") {
            if (headerDataOrStructure?.inspection_date || headerDataOrStructure?.insp_date || headerDataOrStructure?.date) {
                const singleD = headerDataOrStructure.inspection_date || headerDataOrStructure.insp_date || headerDataOrStructure.date;
                try { inspDateRangeStr = format(new Date(singleD), "dd-MMM-yyyy"); } catch (_) { inspDateRangeStr = String(singleD); }
            }
        }

        const fieldVal = fieldName ? fieldName.toUpperCase() : "--";
        const structVal = platformName ? platformName.toUpperCase() : "--";
        const jpVal = jobPackName || "--";
        const dateVal = inspDateRangeStr || "--";

        let bannerFontSize = 6.8;
        doc.setFontSize(bannerFontSize);
        const textY = currentY + 4.5;

        // Left text: Field Name: ...  |  Structure Name: ...
        const leftParts = [
            { text: "Field Name: ", bold: true, color: colors.textDark },
            { text: `${fieldVal}   `, bold: false, color: colors.navy },
            { text: "|   ", bold: false, color: colors.border },
            { text: "Structure Name: ", bold: true, color: colors.textDark },
            { text: structVal, bold: false, color: colors.navy },
        ];

        // Right text: Jobpack Name: ...  |  Inspection Date: ...
        const rightParts = [
            { text: "Jobpack Name: ", bold: true, color: colors.textDark },
            { text: `${jpVal}   `, bold: false, color: colors.navy },
            { text: "|   ", bold: false, color: colors.border },
            { text: "Inspection Date: ", bold: true, color: colors.textDark },
            { text: dateVal, bold: false, color: colors.navy },
        ];

        // Measure widths and auto-scale font if overall text is wider than available width
        let totalLeftW = leftParts.reduce((sum, p) => {
            doc.setFont("helvetica", p.bold ? "bold" : "normal");
            return sum + doc.getTextWidth(p.text);
        }, 0);

        let totalRightW = rightParts.reduce((sum, p) => {
            doc.setFont("helvetica", p.bold ? "bold" : "normal");
            return sum + doc.getTextWidth(p.text);
        }, 0);

        while ((totalLeftW + totalRightW) > (contentWidth - 8) && bannerFontSize > 4.8) {
            bannerFontSize -= 0.3;
            doc.setFontSize(bannerFontSize);
            totalLeftW = leftParts.reduce((sum, p) => {
                doc.setFont("helvetica", p.bold ? "bold" : "normal");
                return sum + doc.getTextWidth(p.text);
            }, 0);
            totalRightW = rightParts.reduce((sum, p) => {
                doc.setFont("helvetica", p.bold ? "bold" : "normal");
                return sum + doc.getTextWidth(p.text);
            }, 0);
        }

        // Render Left items
        let curLeftX = margin + 3;
        leftParts.forEach(p => {
            doc.setFont("helvetica", p.bold ? "bold" : "normal");
            doc.setTextColor(...p.color);
            doc.text(p.text, curLeftX, textY);
            curLeftX += doc.getTextWidth(p.text);
        });

        // Render Right items
        let curRightX = pageWidth - margin - 3 - totalRightW;
        rightParts.forEach(p => {
            doc.setFont("helvetica", p.bold ? "bold" : "normal");
            doc.setTextColor(...p.color);
            doc.text(p.text, curRightX, textY);
            curRightX += doc.getTextWidth(p.text);
        });

        currentY += SUB_H + 2.5;

        // ── 5. Top 5 Summary KPI Cards ───────────────────────────────────────────
        const CARD_H = 19;
        const CARD_GAP = 3;
        const CARD_W = (contentWidth - (CARD_GAP * 4)) / 5; // 52.2mm each

        const totalQidsCount = sow.total || rec.total || 0;
        const completedCount = sow.completed || rec.completed || 0;
        const incompleteCount = sow.incomplete || rec.incomplete || 0;
        const anomalyCount = anomalies.total || rec.anomaly || 0;
        
        // Accurate Completion Rate: MUST NOT treat incomplete tasks as completed!
        const compRateVal = totalQidsCount > 0 
            ? Math.round((completedCount / totalQidsCount) * 100) 
            : (sow.completedPct !== undefined ? Math.round(sow.completedPct) : (sow.completionPct !== undefined ? Math.round(sow.completionPct) : 0));
        const incRateVal = totalQidsCount > 0
            ? Math.round((incompleteCount / totalQidsCount) * 100)
            : (sow.incompletePct !== undefined ? Math.round(sow.incompletePct) : 0);

        const pendingCount = Math.max(0, totalQidsCount - completedCount - incompleteCount);
        const pendRateVal = totalQidsCount > 0
            ? Math.round((pendingCount / totalQidsCount) * 100)
            : (sow.pendingPct !== undefined ? Math.round(sow.pendingPct) : 0);

        const compRateSubtext = incompleteCount > 0
            ? `${completedCount}/${totalQidsCount} QIDs (${incRateVal}% Inc)`
            : "Completed / applicable QIDs";

        const kpiCards: Array<{
            title: string;
            value: string;
            subtext: string;
            color: [number, number, number];
        }> = [
            {
                title: "TOTAL TASKS / QIDs",
                value: totalQidsCount > 0 ? String(totalQidsCount) : "--",
                subtext: "Scoped in approved SOW",
                color: colors.navy,
            },
            {
                title: "COMPLETED",
                value: completedCount > 0 ? String(completedCount) : "--",
                subtext: "Verified completed tasks",
                color: colors.navy,
            },
            {
                title: "INCOMPLETE",
                value: incompleteCount > 0 ? String(incompleteCount) : "--",
                subtext: "Outstanding / restricted tasks",
                color: incompleteCount > 0 ? colors.amber : colors.navy,
            },
            {
                title: "TOTAL ANOMALIES",
                value: anomalyCount > 0 ? String(anomalyCount) : "--",
                subtext: "Unique anomaly IDs",
                color: anomalyCount > 0 ? colors.red : colors.navy,
            },
            {
                title: "COMPLETION RATE",
                value: totalQidsCount > 0 ? `${compRateVal} %` : "-- %",
                subtext: compRateSubtext,
                color: compRateVal >= 100 ? colors.teal : colors.navy,
            },
        ];

        kpiCards.forEach((card, idx) => {
            const cx = margin + (idx * (CARD_W + CARD_GAP));
            
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.2);
            if (!isPF) {
                doc.setFillColor(255, 255, 255);
                doc.rect(cx, currentY, CARD_W, CARD_H, "F");
            }
            doc.rect(cx, currentY, CARD_W, CARD_H, "S");

            if (idx === 4) {
                // Card 5: Pic 5 Completion Rate with Completion %, Incomplete %, Pending %, segmented bar, and legend
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                doc.text("COMPLETION RATE", cx + 3, currentY + 4.2);

                if (totalQidsCount === 0) {
                    doc.setFontSize(14);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.textMuted);
                    doc.text("-- %", cx + 3, currentY + 11.5);
                    doc.setFontSize(5.5);
                    doc.setFont("helvetica", "normal");
                    doc.text("No scope QIDs defined", cx + 3, currentY + 16.5);
                } else {
                    // Show percentages on top row
                    const hasPending = pendingCount > 0 && pendRateVal > 0;
                    doc.setFontSize(hasPending ? 8.5 : 10.5);
                    doc.setFont("helvetica", "bold");

                    let px = cx + 3;
                    // Completed % (Green)
                    doc.setTextColor(22, 163, 74);
                    const compStr = `${compRateVal}% Comp`;
                    doc.text(compStr, px, currentY + 10.2);
                    px += doc.getTextWidth(compStr) + 2;

                    // Divider
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textMuted);
                    doc.text("•", px, currentY + 10.2);
                    px += doc.getTextWidth("•") + 2;

                    // Incomplete % (Amber)
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(217, 119, 6);
                    const incStr = `${incRateVal}% Inc`;
                    doc.text(incStr, px, currentY + 10.2);
                    px += doc.getTextWidth(incStr) + 2;

                    // Pending % (if any)
                    if (hasPending) {
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(...colors.textMuted);
                        doc.text("•", px, currentY + 10.2);
                        px += doc.getTextWidth("•") + 2;

                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(100, 116, 139);
                        doc.text(`${pendRateVal}% Pend`, px, currentY + 10.2);
                    }

                    // Segmented visual progress bar
                    const barX = cx + 3;
                    const barY = currentY + 11.8;
                    const barW = CARD_W - 6;
                    const barH = 2.2;

                    doc.setFillColor(...colors.barTrack);
                    doc.roundedRect(barX, barY, barW, barH, 0.6, 0.6, "F");

                    const compBarW = Math.max(0, (barW * compRateVal) / 100);
                    const incBarW = Math.max(0, (barW * incRateVal) / 100);
                    const pendBarW = hasPending ? Math.max(0, barW - compBarW - incBarW) : 0;

                    if (compBarW > 0) {
                        doc.setFillColor(22, 163, 74); // Green
                        doc.roundedRect(barX, barY, Math.min(barW, compBarW), barH, 0.6, 0.6, "F");
                    }
                    if (incBarW > 0) {
                        doc.setFillColor(217, 119, 6); // Amber
                        doc.rect(barX + compBarW, barY, Math.min(incBarW, barW - compBarW), barH, "F");
                    }
                    if (pendBarW > 0) {
                        doc.setFillColor(148, 163, 184); // Slate
                        doc.roundedRect(barX + compBarW + incBarW, barY, pendBarW, barH, 0.6, 0.6, "F");
                    }

                    // Legend under the progress bar
                    const legY = currentY + 17.0;
                    doc.setFontSize(4.7);
                    doc.setFont("helvetica", "normal");

                    // Done item
                    let lx = cx + 3;
                    doc.setFillColor(22, 163, 74);
                    doc.rect(lx, legY - 1.6, 1.6, 1.6, "F");
                    lx += 2.4;
                    doc.setTextColor(...colors.textDark);
                    const legComp = `${completedCount} Done (${compRateVal}%)`;
                    doc.text(legComp, lx, legY - 0.3);
                    lx += doc.getTextWidth(legComp) + 3;

                    // Incomplete item
                    doc.setFillColor(217, 119, 6);
                    doc.rect(lx, legY - 1.6, 1.6, 1.6, "F");
                    lx += 2.4;
                    const legInc = `${incompleteCount} Inc (${incRateVal}%)`;
                    doc.text(legInc, lx, legY - 0.3);
                    lx += doc.getTextWidth(legInc) + 3;

                    // Pending item
                    if (hasPending && lx + 12 < cx + CARD_W) {
                        doc.setFillColor(148, 163, 184);
                        doc.rect(lx, legY - 1.6, 1.6, 1.6, "F");
                        lx += 2.4;
                        doc.text(`${pendingCount} Pend`, lx, legY - 0.3);
                    }
                }
            } else {
                // Card Title
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...card.color);
                doc.text(card.title, cx + 3, currentY + 4.2);

                // Card Value
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...card.color);
                doc.text(card.value, cx + 3, currentY + 11.5);

                // Card Subtext
                doc.setFontSize(5.5);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text(card.subtext, cx + 3, currentY + 16.5);
            }
        });

        currentY += CARD_H + 3.5;

        // ── 6. Middle Two-Column Section: Coverage & Anomaly Distribution ─────────
        const MID_H = 50;
        const COL_GAP = 4;
        const LEFT_COL_W = 153;
        const RIGHT_COL_W = contentWidth - LEFT_COL_W - COL_GAP; // 116mm

        // --- 6A. LEFT COLUMN: Inspection Task Coverage ---
        const leftX = margin;
        
        // Header Bar
        doc.setDrawColor(...colors.navy);
        doc.setLineWidth(0.2);
        if (isPF) {
            doc.rect(leftX, currentY, LEFT_COL_W, 5.5, "S");
            doc.setTextColor(...colors.navy);
        } else {
            doc.setFillColor(...colors.navy);
            doc.rect(leftX, currentY, LEFT_COL_W, 5.5, "F");
            doc.setTextColor(255);
        }
        // Parse Task Level Aggregate Statistics
        const taskStats = summaryData?.tasks || {};
        const totalRecordTasks = taskStats.total || rec.total || 0;
        const incompleteRecordTasks = taskStats.incomplete !== undefined ? taskStats.incomplete : (rec.incomplete || 0);
        const completedRecordTasks = taskStats.completed !== undefined ? taskStats.completed : Math.max(0, totalRecordTasks - incompleteRecordTasks);
        const overallTaskCompPct = totalRecordTasks > 0 ? Math.round((completedRecordTasks / totalRecordTasks) * 100) : 0;
        const overallTaskIncPct = totalRecordTasks > 0 ? Math.round((incompleteRecordTasks / totalRecordTasks) * 100) : 0;

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("INSPECTION TASK COVERAGE", leftX + 3, currentY + 3.8);

        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        if (!isPF) doc.setTextColor(220, 230, 242);
        const headerSubtext = totalRecordTasks > 0 
            ? `Tasks: ${overallTaskCompPct}% Done (${completedRecordTasks}/${totalRecordTasks}) | Inc: ${overallTaskIncPct}% (${incompleteRecordTasks})` 
            : "By task / applicable QIDs";
        doc.text(headerSubtext, leftX + LEFT_COL_W - 3, currentY + 3.8, { align: "right" });

        // Build Coverage Rows from SOW or live breakdown
        let coverageRows: any[] = [];
        if (sowSummaryList.length > 0) {
            coverageRows = sowSummaryList.map((item: any) => [
                item.inspectionName || item.name || item.taskType || "Task",
                item.totalQid !== undefined ? String(item.totalQid) : "--",
                item.completedQid !== undefined ? String(item.completedQid) : "--",
                item.incompleteQid !== undefined ? String(item.incompleteQid) : "--",
                item.completionPct ? `${item.completionPct}` : (item.completedPct || "--%"),
            ]);
        } else {
            // Build fallback rows from breakdown if sowSummary is empty
            const breakdown = rec.inspTypeBreakdown || {};
            const keys = Object.keys(breakdown);
            if (keys.length > 0) {
                coverageRows = keys.map(k => {
                    const item = breakdown[k];
                    const total = item.count || 0;
                    return [
                        item.name || k,
                        String(total),
                        String(total),
                        "0",
                        "100%"
                    ];
                });
            } else {
                // Default placeholders matching standard scope
                coverageRows = [
                    ["General Visual Inspection (GVI)", "--", "--", "--", "--%"],
                    ["Splash Zone Inspection (SZI)", "--", "--", "--", "--%"],
                    ["Scour Survey", "--", "--", "--", "--%"],
                    ["Anode Inspection", "--", "--", "--", "--%"],
                    ["CP Survey / Reading", "--", "--", "--", "--%"],
                    ["Other approved tasks", "--", "--", "--", "--%"],
                ];
            }
        }

        // Limit coverage table rows to 5 so we have space for the Overall Task Summary row
        const maxDataRows = 5;
        const visibleCoverageRows = coverageRows.slice(0, maxDataRows);
        const hasTotalSummaryRow = totalRecordTasks > 0;
        if (hasTotalSummaryRow) {
            visibleCoverageRows.push([
                "OVERALL TASK SUMMARY",
                String(totalRecordTasks),
                String(completedRecordTasks),
                String(incompleteRecordTasks),
                `${overallTaskCompPct}%`,
            ]);
        }

        (autoTable as any)(doc, {
            startY: currentY + 5.5,
            margin: { left: leftX, right: pageWidth - leftX - LEFT_COL_W },
            tableWidth: LEFT_COL_W,
            head: [["INSPECTION TASK", "PLANNED", "COMPLETE", "INCOMPLETE", "RATE"]],
            body: visibleCoverageRows,
            theme: "plain",
            styles: {
                fontSize: 6.5,
                cellPadding: 1.8,
                textColor: colors.textDark,
                lineWidth: 0.1,
                lineColor: colors.border,
            },
            headStyles: {
                fillColor: colors.headerLight,
                textColor: colors.navy,
                fontStyle: "bold",
                lineWidth: 0.1,
                drawColor: colors.border,
                halign: "left",
            },
            columnStyles: {
                0: { cellWidth: 63, fontStyle: "normal" },
                1: { cellWidth: 22, halign: "center" },
                2: { cellWidth: 22, halign: "center" },
                3: { cellWidth: 22, halign: "center" },
                4: { cellWidth: 24, halign: "center", fontStyle: "bold" },
            },
            bodyStyles: {
                lineWidth: 0.1,
                drawColor: colors.border,
            },
            didParseCell: (data: any) => {
                if (hasTotalSummaryRow && data.row.index === visibleCoverageRows.length - 1 && data.section === "body") {
                    data.cell.styles.fontStyle = "bold";
                    data.cell.styles.fillColor = [241, 245, 249];
                    if (data.column.index === 4) {
                        data.cell.styles.textColor = overallTaskCompPct >= 100 ? colors.teal : (overallTaskCompPct >= 80 ? colors.navy : colors.amber);
                    } else if (data.column.index === 3 && incompleteRecordTasks > 0) {
                        data.cell.styles.textColor = colors.amber;
                    } else {
                        data.cell.styles.textColor = colors.navy;
                    }
                }
            },
        });

        const coverageTableEnd = (doc as any).lastAutoTable?.finalY ?? (currentY + 38);
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...colors.textMuted);
        const footnote = totalRecordTasks > 0
            ? `Task counts include all individual task records across QIDs. Overall Incomplete rate: ${overallTaskIncPct}%.`
            : "Task counts can overlap when one QID has multiple inspection tasks.";
        doc.text(footnote, leftX + 1, coverageTableEnd + 3);

        // Table Grid Helper for Section 6 & 7 Blocks
        const drawTableGrid = (
            bx: number,
            by: number,
            bw: number,
            bh: number,
            colWidths: number[],
            headers: Array<{ label: string; align?: "left" | "center" | "right" }>,
            rows: Array<{ cols: Array<{ val: string; bold?: boolean; align?: "left" | "center" | "right" }> }>,
            hasBlockHeaderBanner: boolean = true
        ) => {
            const tableY = hasBlockHeaderBanner ? by + 5 : by;
            const tableH = hasBlockHeaderBanner ? bh - 5 : bh;
            const headH = 4.2;
            const rowCount = rows.length || 1;
            const rowH = (tableH - headH) / rowCount;

            // 1. Table & Row Backgrounds
            if (!isPF) {
                doc.setFillColor(255, 255, 255);
                doc.rect(bx, tableY, bw, tableH, "F");

                // Header background
                doc.setFillColor(...colors.headerLight);
                doc.rect(bx, tableY, bw, headH, "F");

                // Alternating row backgrounds
                rows.forEach((r, rIdx) => {
                    if (rIdx % 2 === 1) {
                        const rY = tableY + headH + (rIdx * rowH);
                        doc.setFillColor(...colors.headerLight);
                        doc.rect(bx, rY, bw, rowH, "F");
                    }
                });
            }

            // 2. Grid Lines (Borders and Dividers)
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.15);

            // Outer bounding box
            doc.rect(bx, tableY, bw, tableH, "S");

            // Header bottom dividing line
            doc.line(bx, tableY + headH, bx + bw, tableY + headH);

            // Horizontal row dividing lines
            rows.forEach((_, rIdx) => {
                if (rIdx < rowCount - 1) {
                    const rY = tableY + headH + (rIdx * rowH) + rowH;
                    doc.line(bx, rY, bx + bw, rY);
                }
            });

            // Vertical column dividing lines across full table height
            let vX = bx;
            for (let i = 0; i < colWidths.length - 1; i++) {
                vX += colWidths[i];
                doc.line(vX, tableY, vX, tableY + tableH);
            }

            // 3. Render Header Texts
            let curColX = bx;
            headers.forEach((h, cIdx) => {
                const cW = colWidths[cIdx];
                doc.setFontSize(5.3);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);

                const align = h.align || (cIdx === 0 ? "left" : "right");
                if (align === "center") {
                    doc.text(h.label, curColX + (cW / 2), tableY + 2.9, { align: "center" });
                } else if (align === "right") {
                    doc.text(h.label, curColX + cW - 2, tableY + 2.9, { align: "right" });
                } else {
                    doc.text(h.label, curColX + 2, tableY + 2.9);
                }
                curColX += cW;
            });

            // 4. Render Data Cells
            rows.forEach((r, rIdx) => {
                const rY = tableY + headH + (rIdx * rowH);
                const textY = rY + (rowH / 2) + 0.9;

                let cellX = bx;
                r.cols.forEach((cell, cIdx) => {
                    const cW = colWidths[cIdx];
                    doc.setFontSize(5.5);
                    doc.setFont("helvetica", cell.bold ? "bold" : "normal");
                    doc.setTextColor(...colors.textDark);

                    let displayVal = cell.val ?? "";
                    if (doc.getTextWidth(displayVal) > cW - 3) {
                        while (displayVal.length > 3 && doc.getTextWidth(displayVal + "...") > cW - 3) {
                            displayVal = displayVal.slice(0, -1);
                        }
                        displayVal = displayVal + "...";
                    }

                    const align = cell.align || (cIdx === 0 ? "left" : "right");
                    if (align === "center") {
                        doc.text(displayVal, cellX + (cW / 2), textY, { align: "center" });
                    } else if (align === "right") {
                        doc.text(displayVal, cellX + cW - 2, textY, { align: "right" });
                    } else {
                        doc.text(displayVal, cellX + 2, textY);
                    }
                    cellX += cW;
                });
            });
        };

        // --- 6B. RIGHT COLUMN: Anomaly Distribution ---
        const rightX = leftX + LEFT_COL_W + COL_GAP;

        // Header Bar
        doc.setDrawColor(...colors.navy);
        doc.setLineWidth(0.2);
        if (isPF) {
            doc.rect(rightX, currentY, RIGHT_COL_W, 5.5, "S");
            doc.setTextColor(...colors.navy);
        } else {
            doc.setFillColor(...colors.navy);
            doc.rect(rightX, currentY, RIGHT_COL_W, 5.5, "F");
            doc.setTextColor(255);
        }
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("ANOMALY DISTRIBUTION", rightX + 3, currentY + 3.8);

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        if (!isPF) doc.setTextColor(220, 230, 242);
        doc.text("By priority and defect criteria", rightX + RIGHT_COL_W - 3, currentY + 3.8, { align: "right" });

        // Container Area for Anomaly Distribution Tables
        const anomBoxY = currentY + 5.5;
        const anomBoxH = Math.max(38, coverageTableEnd - currentY);

        const prioMap = anomalies.byPriority || {};
        const normalizePriorityCount = (pMap: Record<string, number>, target: "P1" | "P2" | "P3" | "OBS"): number => {
            if (!pMap || typeof pMap !== "object") return 0;
            // 1. Direct key match check first to guarantee exact single count
            if (target === "P1") {
                if (pMap["Priority 1"] !== undefined) return Number(pMap["Priority 1"]) || 0;
                if (pMap["P1"] !== undefined) return Number(pMap["P1"]) || 0;
            } else if (target === "P2") {
                if (pMap["Priority 2"] !== undefined) return Number(pMap["Priority 2"]) || 0;
                if (pMap["P2"] !== undefined) return Number(pMap["P2"]) || 0;
            } else if (target === "P3") {
                if (pMap["Priority 3"] !== undefined) return Number(pMap["Priority 3"]) || 0;
                if (pMap["P3"] !== undefined) return Number(pMap["P3"]) || 0;
            } else if (target === "OBS") {
                if (pMap["Observation"] !== undefined) return Number(pMap["Observation"]) || 0;
                if (pMap["OBS"] !== undefined) return Number(pMap["OBS"]) || 0;
                if (pMap["OBSERVATION"] !== undefined) return Number(pMap["OBSERVATION"]) || 0;
            }

            // 2. Fallback to iterating unique entries if raw database keys were used
            let count = 0;
            Object.entries(pMap).forEach(([k, v]) => {
                const key = k.trim().toUpperCase();
                const num = Number(v) || 0;
                if (target === "P1" && (key === "1" || key === "HIGH")) {
                    count += num;
                } else if (target === "P2" && (key === "2" || key === "MEDIUM")) {
                    count += num;
                } else if (target === "P3" && (key === "3" || key === "LOW" || key === "PRIORITY 3")) {
                    count += num;
                } else if (target === "OBS" && (key === "OBSERVATION" || key === "OBS")) {
                    count += num;
                }
            });
            return count;
        };

        const p1Val = normalizePriorityCount(prioMap, "P1");
        const p2Val = normalizePriorityCount(prioMap, "P2");
        const p3Val = normalizePriorityCount(prioMap, "P3");
        const obsVal = normalizePriorityCount(prioMap, "OBS");

        // Rectified count from anomalies payload or closed anomaly items
        let rectifiedVal = anomalies?.rectified ?? anomalies?.rectifiedCount;
        if (rectifiedVal === undefined && Array.isArray(anomalies?.items)) {
            rectifiedVal = anomalies.items.filter((i: any) => 
                String(i.status || "").toUpperCase() === "CLOSED" || 
                i.is_rectified === true || 
                i.rectified === true ||
                (i.rectification && String(i.rectification).trim() !== "" && String(i.rectification).toUpperCase() !== "N/A")
            ).length;
        }
        const rectifiedCount = Number(rectifiedVal || 0);

        // Priority rows with Rectified row included, formatted in table structure
        const prioRows: Array<{ cols: Array<{ val: string; bold?: boolean; align?: "left" | "center" | "right" }> }> = [
            { cols: [{ val: "Priority 1", align: "left" as const }, { val: String(p1Val || 0), bold: p1Val > 0, align: "right" as const }] },
            { cols: [{ val: "Priority 2", align: "left" as const }, { val: String(p2Val || 0), bold: p2Val > 0, align: "right" as const }] },
            { cols: [{ val: "Priority 3", align: "left" as const }, { val: String(p3Val || 0), bold: p3Val > 0, align: "right" as const }] },
            { cols: [{ val: "Observation", align: "left" as const }, { val: String(obsVal || 0), bold: obsVal > 0, align: "right" as const }] },
            { cols: [{ val: "Rectified", align: "left" as const }, { val: String(rectifiedCount || 0), bold: rectifiedCount > 0, align: "right" as const }] },
        ];

        // Defect criteria mapping
        const defectMap = anomalies.byDefectType || {};
        const DEFECT_CODE_ALIASES: Record<string, string[]> = {
            AW: ["AW", "ANODE WASTAGE", "ANODE_WASTAGE", "ANODE WASTED", "WASTAGE"],
            CP: ["CP", "CATHODIC POTENTIAL", "CATHODIC_POTENTIAL", "CP POTENTIAL", "CP READING", "CP_READING"],
            DB: ["DB", "DEBRIS", "SEABED DEBRIS", "DEB"],
            LI: ["LI", "LACK OF INTEGRITY", "LACK_OF_INTEGRITY", "INTEGRITY"],
            PD: ["PD", "PHYSICAL DAMAGE", "PHYSICAL_DAMAGE", "DAMAGE"],
            SC: ["SC", "SCOUR", "SEABED SCOUR"],
            VS: ["VS", "VARIATION TO SPEC", "VARIATION TO SPECIFICATION", "VARIATION_TO_SPEC", "SPEC VARIATION"],
        };

        const getDefectCriteriaCount = (dMap: Record<string, number>, code: string): number => {
            if (!dMap || typeof dMap !== "object") return 0;
            // 1. Direct code lookup (e.g., AW, CP, DB, LI, PD, SC, VS)
            if (dMap[code] !== undefined) return Number(dMap[code]) || 0;

            const codeUpper = code.toUpperCase();
            for (const [k, v] of Object.entries(dMap)) {
                if (k.toUpperCase() === codeUpper) return Number(v) || 0;
            }

            // 2. Fallback: check aliases if dMap uses descriptive keys (e.g. "ANODE WASTAGE", "DEBRIS")
            let count = 0;
            const aliases = DEFECT_CODE_ALIASES[code] || [code];
            Object.entries(dMap).forEach(([k, v]) => {
                const keyUpper = k.trim().toUpperCase();
                const num = Number(v) || 0;
                if (keyUpper !== codeUpper && aliases.some(a => keyUpper === a || keyUpper.includes(a))) {
                    count += num;
                }
            });
            return count;
        };

        const defectCriteriaList = [
            { code: "AW", label: "Anode wastage (AW)" },
            { code: "CP", label: "Cathodic potential (CP)" },
            { code: "DB", label: "Debris (DB)" },
            { code: "LI", label: "Lack of integrity (LI)" },
            { code: "PD", label: "Physical damage (PD)" },
            { code: "SC", label: "Scour (SC)" },
            { code: "VS", label: "Variation to spec (VS)" },
        ];

        // Sort descending by count as requested
        const sortedDefectCriteriaList = defectCriteriaList
            .map(d => ({ ...d, count: getDefectCriteriaCount(defectMap, d.code) }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

        const defectRows: Array<{ cols: Array<{ val: string; bold?: boolean; align?: "left" | "center" | "right" }> }> = sortedDefectCriteriaList.map(d => {
            const val = d.count;
            return {
                cols: [
                    { val: d.label, align: "left" as const },
                    { val: val > 0 ? String(val) : "--", bold: val > 0, align: "right" as const }
                ]
            };
        });

        // Split inside right box: 46mm By Priority, 68mm By Defect Criteria with 2mm gap
        const prioColW = 46;
        const defectColW = RIGHT_COL_W - prioColW - 2; // 68mm

        // Block 1: BY PRIORITY Table
        drawTableGrid(
            rightX,
            anomBoxY,
            prioColW,
            anomBoxH,
            [34, 12],
            [
                { label: "BY PRIORITY", align: "left" },
                { label: "COUNT", align: "right" }
            ],
            prioRows,
            false
        );

        // Block 2: BY DEFECT CRITERIA Table
        drawTableGrid(
            rightX + prioColW + 2,
            anomBoxY,
            defectColW,
            anomBoxH,
            [54, 14],
            [
                { label: "BY DEFECT CRITERIA", align: "left" },
                { label: "COUNT", align: "right" }
            ],
            defectRows,
            false
        );

        currentY = Math.max(coverageTableEnd + 6, anomBoxY + anomBoxH + 4);

        // ── 7. Dynamic Task-Specific Detail Blocks / Sections ────────────────────
        // In accordance with the prompt:
        // "different sections for different tasks , all will be shown based on the inspection data,
        // eg, if FMD not done, dont display those details.. so based on the task done, provide those details.. as a section or block.."

        interface TaskBlockDef {
            id: string;
            title: string;
            subtitle: string;
            isDone: boolean;
            render: (bx: number, by: number, bw: number, bh: number) => void;
        }

        const drawBlockHeader = (bx: number, by: number, bw: number, title: string, subtitle: string) => {
            doc.setDrawColor(...colors.navy);
            doc.setLineWidth(0.2);
            if (isPF) {
                doc.rect(bx, by, bw, 5, "S");
                doc.setTextColor(...colors.navy);
            } else {
                doc.setFillColor(...colors.navy);
                doc.rect(bx, by, bw, 5, "F");
                doc.setTextColor(255);
            }
            doc.setFontSize(6.8);
            doc.setFont("helvetica", "bold");
            doc.text(title, bx + 2.2, by + 3.5);
            doc.setFontSize(5.2);
            doc.setFont("helvetica", "normal");
            if (!isPF) doc.setTextColor(220, 230, 242);
            doc.text(subtitle, bx + bw - 2.2, by + 3.5, { align: "right" });
        };



        const taskBlocks: TaskBlockDef[] = [];

        // 7A. Task Block: Marine Growth Coverage (Hard & Soft)
        const hasMgiRecords = Boolean(
            (mgi && (mgi.total > 0 || mgi.hasCoverageData || mgi.totalHardReadings > 0 || mgi.totalSoftReadings > 0 || (mgi.hardBands && Object.values(mgi.hardBands).some((v: any) => Number(v) > 0)))) ||
            (rec.inspTypeBreakdown && (rec.inspTypeBreakdown["RMGI"] || rec.inspTypeBreakdown["MGROW"] || rec.inspTypeBreakdown["MGI"] || rec.inspTypeBreakdown["DMGI"] || rec.inspTypeBreakdown["RGVI"]))
        );
        
        taskBlocks.push({
            id: "mgi",
            title: "MARINE GROWTH (MGI)",
            subtitle: "Hard & soft range counts",
            isDone: hasMgiRecords,
            render: (bx, by, bw, bh) => {
                drawBlockHeader(bx, by, bw, "MARINE GROWTH (MGI)", "Hard & soft counts");
                const colW = bw / 3;
                const bands = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"];
                
                let totHard = 0;
                let totSoft = 0;
                const rows: Array<{ cols: Array<{ val: string; bold?: boolean; align?: "left" | "center" | "right" }> }> = bands.map(bLabel => {
                    const hCnt = Number(mgi?.hardBands?.[bLabel] ?? 0);
                    const sCnt = Number(mgi?.softBands?.[bLabel] ?? 0);
                    totHard += hCnt;
                    totSoft += sCnt;
                    return {
                        cols: [
                            { val: bLabel, align: "left" as const },
                            { val: String(hCnt), bold: hCnt > 0, align: "center" as const },
                            { val: String(sCnt), bold: sCnt > 0, align: "center" as const }
                        ]
                    };
                });

                // Add summary total row for complete table format
                rows.push({
                    cols: [
                        { val: "Total QIDs", bold: true, align: "left" as const },
                        { val: String(mgi?.totalHardReadings || totHard), bold: true, align: "center" as const },
                        { val: String(mgi?.totalSoftReadings || totSoft), bold: true, align: "center" as const }
                    ]
                });

                drawTableGrid(
                    bx, by, bw, bh,
                    [colW, colW, colW],
                    [
                        { label: "Band", align: "left" },
                        { label: "Hard (QIDs)", align: "center" },
                        { label: "Soft (QIDs)", align: "center" }
                    ],
                    rows
                );
            }
        });

        // 7B. Task Block: Anode Condition
        const hasAnodeRecords = Boolean(anodeGvi && (anodeGvi.total > 0 || Object.keys(anodeGvi.depletionBuckets || {}).length > 0)) ||
            (rec.inspTypeBreakdown && (rec.inspTypeBreakdown["ANODE"] || rec.inspTypeBreakdown["RSANI"] || rec.inspTypeBreakdown["SANI"] || rec.inspTypeBreakdown["ANMAIN"]));

        taskBlocks.push({
            id: "anode",
            title: "ANODE CONDITION",
            subtitle: "Type & depletion",
            isDone: hasAnodeRecords,
            render: (bx, by, bw, bh) => {
                drawBlockHeader(bx, by, bw, "ANODE CONDITION", "Type & depletion");

                let anodeTypeDisplay = "--";
                if (anodeGvi?.anodeTypeStr && String(anodeGvi.anodeTypeStr).trim() !== "") {
                    anodeTypeDisplay = anodeGvi.anodeTypeStr;
                } else if (Array.isArray(anodeGvi?.anodeTypes) && anodeGvi.anodeTypes.length > 0) {
                    const cleanList = anodeGvi.anodeTypes.map((t: string) => String(t).replace(/^ANODE\s+/i, ""));
                    anodeTypeDisplay = cleanList.join(", ");
                } else if (structureInfo?.metadata?.anode_type) {
                    anodeTypeDisplay = String(structureInfo.metadata.anode_type);
                }

                const depletions = anodeGvi?.depletionBuckets || {};
                const d0 = depletions["0-25%"] ?? depletions["0–25%"] ?? 0;
                const d25 = depletions["26-50%"] ?? depletions["25-50%"] ?? depletions["25–50%"] ?? 0;
                const d50 = depletions["50-75%"] ?? depletions["50–75%"] ?? 0;
                const d75 = depletions["76-100%"] ?? depletions["75-100%"] ?? depletions["75–100%"] ?? 0;

                const col1W = Math.round(bw * 0.63);
                const col2W = bw - col1W;

                const totAnodeCount = (Number(d0) + Number(d25) + Number(d50) + Number(d75)) || anodeGvi?.total || 1;
                const pct0 = totAnodeCount > 0 ? Math.round((Number(d0) / totAnodeCount) * 100) : 0;
                const pct25 = totAnodeCount > 0 ? Math.round((Number(d25) / totAnodeCount) * 100) : 0;
                const pct50 = totAnodeCount > 0 ? Math.round((Number(d50) / totAnodeCount) * 100) : 0;
                const pct75 = totAnodeCount > 0 ? Math.round((Number(d75) / totAnodeCount) * 100) : 0;

                const healthPct = totAnodeCount > 0 ? Math.round(((Number(d0) + Number(d25)) / totAnodeCount) * 100) : 100;
                const adviceText = `Anode Health: ${healthPct}% (<50% dep.)`;

                const rows = [
                    { cols: [{ val: "Platform Anode Type", align: "left" as const }, { val: anodeTypeDisplay, bold: true, align: "right" as const }] },
                    { cols: [{ val: "0-25% Depletion", align: "left" as const }, { val: `${d0} (${pct0}%)`, bold: Number(d0) > 0, align: "right" as const }] },
                    { cols: [{ val: "26-50% Depletion", align: "left" as const }, { val: `${d25} (${pct25}%)`, bold: Number(d25) > 0, align: "right" as const }] },
                    { cols: [{ val: "50-75% Depletion", align: "left" as const }, { val: `${d50} (${pct50}%)`, bold: Number(d50) > 0, align: "right" as const }] },
                    { cols: [{ val: "76-100% Depletion", align: "left" as const }, { val: `${d75} (${pct75}%)`, bold: Number(d75) > 0, align: "right" as const }] },
                    { cols: [{ val: "Anode Health", align: "left" as const }, { val: `${healthPct}% (<50% dep.)`, bold: true, align: "right" as const }] },
                    { cols: [{ val: "Total Anodes Logged", bold: true, align: "left" as const }, { val: String(anodeGvi?.total || totAnodeCount), bold: true, align: "right" as const }] },
                ];

                drawTableGrid(
                    bx, by, bw, bh,
                    [col1W, col2W],
                    [
                        { label: "Anode Parameter", align: "left" },
                        { label: "Depletion / Type", align: "right" }
                    ],
                    rows
                );
            }
        });

        // 7C. Task Block: Scour Survey
        const hasScourRecords = Boolean(scour && (scour.total > 0 || scour.exposed > 0)) ||
            (rec.inspTypeBreakdown && (rec.inspTypeBreakdown["RSCOR"] || rec.inspTypeBreakdown["SCOUR"] || rec.inspTypeBreakdown["DSCOR"]));

        taskBlocks.push({
            id: "scour",
            title: "SCOUR SURVEY",
            subtitle: "Faces and piles",
            isDone: hasScourRecords,
            render: (bx, by, bw, bh) => {
                drawBlockHeader(bx, by, bw, "SCOUR SURVEY", "Faces and piles");

                const registeredFaces = scour?.registeredFaces || 4;
                const facesSurveyed = scour?.facesSurveyed || scour?.distinctFacesCount || (scour?.total ? Math.min(scour.total, registeredFaces) : "--");
                const pilesSurveyed = scour?.pilesSurveyed || scour?.distinctPilesCount || "--";
                const exposedPileCount = scour?.exposedCount !== undefined && scour?.exposedCount !== null ? scour.exposedCount : (scour?.exposed ?? 0);
                const scourFindings = scour?.scourFindingsCount !== undefined && scour?.scourFindingsCount !== null ? scour.scourFindingsCount : (scour?.exposed ? scour.exposed : "0");

                let maxDepthStr = "-- mm";
                let maxDepthMm = 0;
                if (scour?.maxDepthMm !== undefined && scour?.maxDepthMm !== null && scour.maxDepthMm > 0) {
                    maxDepthMm = Number(scour.maxDepthMm);
                    maxDepthStr = `${Math.round(scour.maxDepthMm)} mm`;
                } else if (scour?.maxDepth !== undefined && scour?.maxDepth !== null && Number(scour.maxDepth) > 0) {
                    const depthNum = Number(scour.maxDepth);
                    maxDepthMm = depthNum <= 10 ? Math.round(depthNum * 1000) : Math.round(depthNum);
                    maxDepthStr = `${maxDepthMm} mm`;
                } else if (scour?.maxDepthMeters !== undefined && scour?.maxDepthMeters !== null && scour.maxDepthMeters > 0) {
                    maxDepthMm = Math.round(scour.maxDepthMeters * 1000);
                    maxDepthStr = `${maxDepthMm} mm`;
                }

                const maxQid = scour?.maxDepthQid && scour.maxDepthQid !== "N/A" ? scour.maxDepthQid : "";
                const maxLoc = scour?.maxDepthLocation || scour?.maxDepthLeg || "";
                const maxInfo = [maxQid, maxLoc && maxLoc !== "N/A" ? maxLoc : ""].filter(Boolean).join(" - ");
                const maxLocClean = maxInfo ? ` (${maxInfo})` : "";

                let minDepthMm = scour?.minDepthMm !== undefined && scour?.minDepthMm !== null 
                    ? Number(scour.minDepthMm) 
                    : (scour?.minDepth ? Number(scour.minDepth) : 0);
                let minQid = scour?.minDepthQid && scour.minDepthQid !== "N/A" ? scour.minDepthQid : "";
                let minLoc = scour?.minDepthLocation || "";

                if (Array.isArray(scour?.qidReadings) && scour.qidReadings.length > 0) {
                    const posReadings = scour.qidReadings.filter((r: any) => {
                        const d = Number(r.depthMm ?? r.depth ?? 0);
                        const b = Number(r.burialPct ?? r.burial ?? 0);
                        return d > 0 && !r.isBuried && b === 0;
                    });
                    if (posReadings.length > 0 && (minDepthMm <= 0 || !minQid)) {
                        const lowest = [...posReadings].sort((a: any, b: any) => Number(a.depthMm || 0) - Number(b.depthMm || 0))[0];
                        minDepthMm = Number(lowest.depthMm);
                        minQid = lowest.qid || minQid;
                        minLoc = lowest.location || minLoc;
                    }
                }

                const minInfo = [minQid, minLoc && minLoc !== "N/A" ? minLoc : ""].filter(Boolean).join(" - ");
                const minLocClean = minInfo ? ` (${minInfo})` : "";
                const minDepthStr = minDepthMm > 0 ? `${Math.round(minDepthMm)} mm${minLocClean}` : "0 mm";

                const scourLimit = Number(
                    scour?.maxAllowableMm || 
                    scour?.maxAllowableLimit || 
                    defectCriteria?.scour?.maxAllowableMm || 
                    800
                );

                const isAnomaly = maxDepthMm > scourLimit || Number(exposedPileCount) > 0;
                let statusStr = `Normal / Safe (≤${scourLimit}mm)`;
                if (isAnomaly) {
                    statusStr = `ANOMALY: >${scourLimit}mm${maxLoc ? ` at ${maxLoc}` : ""}`;
                }

                const col1W = Math.round(bw * 0.58);
                const col2W = bw - col1W;

                const rows = [
                    { cols: [{ val: "Platform faces", align: "left" as const }, { val: `${registeredFaces} registered`, align: "right" as const }] },
                    { cols: [{ val: "Faces / Piles surveyed", align: "left" as const }, { val: `${facesSurveyed} faces / ${pilesSurveyed} piles`, align: "right" as const }] },
                    { cols: [{ val: "Exposed pile count", align: "left" as const }, { val: String(exposedPileCount || 0), bold: Number(exposedPileCount) > 0, align: "right" as const }] },
                    { cols: [{ val: "Piles with scour findings", align: "left" as const }, { val: String(scourFindings || 0), bold: Number(scourFindings) > 0, align: "right" as const }] },
                    { cols: [{ val: "Minimum scour depth", align: "left" as const }, { val: minDepthStr, align: "right" as const }] },
                    { cols: [{ val: "Maximum scour depth", align: "left" as const }, { val: `${maxDepthStr}${maxLocClean}`, bold: true, align: "right" as const }] },
                    { cols: [{ val: "Allowable depth limit", align: "left" as const }, { val: `${scourLimit} mm`, align: "right" as const }] },
                    { cols: [{ val: "Safety threshold status", align: "left" as const }, { val: statusStr, bold: isAnomaly, align: "right" as const }] },
                ];

                drawTableGrid(
                    bx, by, bw, bh,
                    [col1W, col2W],
                    [
                        { label: "Scour Parameter", align: "left" },
                        { label: "Survey Finding", align: "right" }
                    ],
                    rows
                );
            }
        });

        // 7D. Task Block: CP Readings — Conditional
        const hasCpRecords = Boolean(cp && (cp.totalCount > 0 || cp.primaryCount > 0)) ||
            (rec.inspTypeBreakdown && (rec.inspTypeBreakdown["CP"] || rec.inspTypeBreakdown["RCP"] || rec.inspTypeBreakdown["DCPSURV"]));

        if (hasCpRecords) {
            taskBlocks.push({
                id: "cp",
                title: "CP POTENTIAL READINGS",
                subtitle: "Cathodic protection stats",
                isDone: true,
                render: (bx, by, bw, bh) => {
                    drawBlockHeader(bx, by, bw, "CP POTENTIAL READINGS", "Cathodic protection stats");

                    const col1W = Math.round(bw * 0.63);
                    const col2W = bw - col1W;

                    const maxV = cp?.maxVal != null ? Number(cp.maxVal) : -854;
                    const minV = cp?.minVal != null ? Number(cp.minVal) : -1030;
                    const primaryCount = cp?.primaryCount ?? 0;
                    const additionalCount = cp?.additionalCount ?? 0;
                    const totCp = cp?.totalCount || (primaryCount + additionalCount) || (cp?.primaryCount ? cp.primaryCount : 0);

                    const cpMinAllowable = Number(cp?.minAllowableMv || defectCriteria?.cp?.minAllowableMv || -1150);
                    const cpNominalMax = Number(cp?.nominalMaxMv || cp?.maxAllowableMv || defectCriteria?.cp?.nominalMaxMv || defectCriteria?.cp?.maxAllowableMv || -800);
                    const cpCriticalMax = Number(cp?.criticalMaxMv || defectCriteria?.cp?.criticalMaxMv || -650);

                    const isCriteriaMet = minV >= cpMinAllowable && maxV <= cpNominalMax;
                    const isCriticalDefect = maxV > cpCriticalMax || minV < cpMinAllowable;
                    const isP2Caution = !isCriteriaMet && !isCriticalDefect;

                    let statusLabel = "CRITERIA MET";
                    if (isCriticalDefect) statusLabel = "CRITICAL DEFECT (P1)";
                    else if (isP2Caution) statusLabel = "P2 CAUTION (> -800mV)";

                    const rows = [
                        { cols: [{ val: "Total Readings Logged", align: "left" as const }, { val: `${totCp} readings`, bold: true, align: "right" as const }] },
                        { cols: [{ val: "Primary / Addl Readings", align: "left" as const }, { val: `${primaryCount} Pri, ${additionalCount} Addl`, align: "right" as const }] },
                        { cols: [{ val: "Recorded Min Potential", align: "left" as const }, { val: `${minV} mV`, bold: minV < cpMinAllowable, align: "right" as const }] },
                        { cols: [{ val: "Recorded Max Potential", align: "left" as const }, { val: `${maxV} mV`, bold: maxV > cpNominalMax, align: "right" as const }] },
                        { cols: [{ val: "Min Allowable Limit (P1)", align: "left" as const }, { val: `${cpMinAllowable} mV`, align: "right" as const }] },
                        { cols: [{ val: "Nominal Max Allowable (P2)", align: "left" as const }, { val: `${cpNominalMax} mV`, align: "right" as const }] },
                        { cols: [{ val: "Critical Defect Max (P1)", align: "left" as const }, { val: `${cpCriticalMax} mV`, align: "right" as const }] },
                        { cols: [{ val: "Protection Criteria Status", align: "left" as const }, { val: statusLabel, bold: true, align: "right" as const }] },
                    ];

                    drawTableGrid(
                        bx, by, bw, bh,
                        [col1W, col2W],
                        [
                            { label: "CP Parameter", align: "left" },
                            { label: "Reading Value", align: "right" }
                        ],
                        rows
                    );
                }
            });
        }

        // 7E. Task Block: Flooded Member Detection (FMD) — Conditional
        const hasFmdRecords = Boolean(fmd && fmd.total > 0) || 
            (rec.inspTypeBreakdown && (rec.inspTypeBreakdown["RFMD"] || rec.inspTypeBreakdown["FMD"] || rec.inspTypeBreakdown["DFMD"]));

        if (hasFmdRecords) {
            taskBlocks.push({
                id: "fmd",
                title: "FLOODED MEMBER DETECTION",
                subtitle: "Member integrity status",
                isDone: true,
                render: (bx, by, bw, bh) => {
                    drawBlockHeader(bx, by, bw, "FLOODED MEMBER DETECTION", "Integrity status");

                    const cond = fmd?.conditions || { dry: 0, flooded: 0, grouted: 0, inconclusive: 0 };
                    const col1W = Math.round(bw * 0.63);
                    const col2W = bw - col1W;

                    const rows = [
                        { cols: [{ val: "Members Surveyed", align: "left" as const }, { val: String(fmd?.total || 0), bold: true, align: "right" as const }] },
                        { cols: [{ val: "Dry Members", align: "left" as const }, { val: String(cond.dry || 0), align: "right" as const }] },
                        { cols: [{ val: "Flooded Members", align: "left" as const }, { val: String(cond.flooded || 0), bold: Number(cond.flooded) > 0, align: "right" as const }] },
                        { cols: [{ val: "Grouted Members", align: "left" as const }, { val: String(cond.grouted || 0), align: "right" as const }] },
                        { cols: [{ val: "Inconclusive", align: "left" as const }, { val: String(cond.inconclusive || 0), align: "right" as const }] },
                        { cols: [{ val: "Integrity Status", align: "left" as const }, { val: cond.flooded > 0 ? "Flooded" : "Intact", bold: true, align: "right" as const }] },
                    ];

                    drawTableGrid(
                        bx, by, bw, bh,
                        [col1W, col2W],
                        [
                            { label: "Integrity Status", align: "left" },
                            { label: "Member Count", align: "right" }
                        ],
                        rows
                    );
                }
            });
        }

        // 7F. Task Block: MGI Thickness Reading — Conditional if inspection data contains thickness readings
        const thkStats = mgi?.thickness || {};
        const hasThicknessRecords = Boolean(
            (thkStats.hasData && thkStats.count > 0) ||
            (mgi?.byQid && Object.values(mgi.byQid).some((arr: any) => Array.isArray(arr) && arr.length > 0)) ||
            (mgi?.total && mgi.total > 0 && ((mgi?.avg && mgi.avg > 0) || (mgi?.max && mgi.max > 0)))
        );

        if (hasThicknessRecords) {
            taskBlocks.push({
                id: "mgi_thickness",
                title: "MGI THICKNESS READINGS",
                subtitle: mgi?.profileName ? `Profile: ${mgi.profileName}` : "Measurements in mm",
                isDone: true,
                render: (bx, by, bw, bh) => {
                    const profileSubtitle = mgi?.profileName ? `Profile: ${mgi.profileName}` : "Measurements in mm";
                    drawBlockHeader(bx, by, bw, "MGI THICKNESS READINGS", profileSubtitle);

                    const maxT = thkStats.max ? `${thkStats.max} mm` : (mgi?.max ? `${mgi.max} mm` : "--");
                    const minT = thkStats.min ? `${thkStats.min} mm` : (mgi?.min ? `${mgi.min} mm` : "--");
                    const avgT = thkStats.avg ? `${thkStats.avg} mm` : (mgi?.avg ? `${mgi.avg.toFixed(1)} mm` : "--");
                    const hardAvgStr = thkStats.hardAvg ? `${thkStats.hardAvg} mm` : "--";
                    const softAvgStr = thkStats.softAvg ? `${thkStats.softAvg} mm` : "--";
                    const profileStr = mgi?.profileName || "Standard";
                    const anomaliesCount = mgi?.anomaliesCount !== undefined ? Number(mgi.anomaliesCount) : (mgi?.exceeded ? 1 : 0);

                    const col1W = Math.round(bw * 0.63);
                    const col2W = bw - col1W;

                    const rows = [
                        { cols: [{ val: "Readings Logged", align: "left" as const }, { val: String(thkStats.count || mgi?.total || 0), bold: true, align: "right" as const }] },
                        { cols: [{ val: "MGI Profile Used", align: "left" as const }, { val: profileStr, bold: true, align: "right" as const }] },
                        { cols: [{ val: "Average Thickness", align: "left" as const }, { val: avgT, bold: true, align: "right" as const }] },
                        { cols: [{ val: "Maximum Thickness", align: "left" as const }, { val: maxT, align: "right" as const }] },
                        { cols: [{ val: "Hard / Soft Avg", align: "left" as const }, { val: `${hardAvgStr} / ${softAvgStr}`, align: "right" as const }] },
                        { cols: [{ val: "Exceeding Profile", align: "left" as const }, { val: anomaliesCount > 0 ? `${anomaliesCount} (ANOMALY)` : "0 (MET)", bold: anomaliesCount > 0, align: "right" as const }] },
                    ];

                    drawTableGrid(
                        bx, by, bw, bh,
                        [col1W, col2W],
                        [
                            { label: "Thickness Metric", align: "left" },
                            { label: "Measurement", align: "right" }
                        ],
                        rows
                    );
                }
            });
        }

        // Filter active task blocks:
        // If specific task data is logged, only display blocks where isDone === true.
        // If none of the tasks have records yet (e.g. blank report preview), display the standard 4 sample blocks.
        const anyTaskHasData = taskBlocks.some(t => t.isDone);
        const activeBlocks = anyTaskHasData
            ? taskBlocks.filter(t => t.isDone)
            : taskBlocks.slice(0, 4);

        // Render Active Task Detail Blocks in a 4-Column Grid per Row
        const BLOCK_H = 37.5;
        const BLOCK_GAP = 3;
        const maxColsPerRow = 4;
        const blockW = (contentWidth - ((maxColsPerRow - 1) * BLOCK_GAP)) / maxColsPerRow;

        // Check if Row 1 fits on Page 1
        const availableSpaceOnPage1 = (pageHeight - 14) - currentY;
        if (availableSpaceOnPage1 < BLOCK_H) {
            doc.addPage();
            drawPageHeader(doc);
            currentY = HEADER_Y + HEADER_H + 3.5;
        }

        activeBlocks.forEach((block, idx) => {
            const colIdx = idx % maxColsPerRow;
            if (idx > 0 && colIdx === 0) {
                currentY += BLOCK_H + 3.5;
                if (currentY + BLOCK_H > pageHeight - 16) {
                    doc.addPage();
                    drawPageHeader(doc);
                    currentY = HEADER_Y + HEADER_H + 3.5;
                }
            }
            const bx = margin + (colIdx * (blockW + BLOCK_GAP));
            block.render(bx, currentY, blockW, BLOCK_H);
        });

        currentY += BLOCK_H + 4;

        // ── 8. Signatures Block ───────────────────────────────────────────────────
        if (config?.showSignatures !== false) {
            const sigH = 16;
            const sigW = (contentWidth - 6) / 3;
            
            // Check if signatures fit on current page; otherwise add a new page
            if (currentY + sigH > pageHeight - 16) {
                doc.addPage();
                drawPageHeader(doc);
                currentY = HEADER_Y + HEADER_H + 3.5;
            }

            const sigY = Math.max(currentY, pageHeight - 31);

            const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy);
                doc.setLineWidth(0.2);
                doc.rect(lx, sigY, sigW, sigH);

                if (!isPF) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW, 4, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(6.5);
                doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3);

                doc.setTextColor(...colors.textDark);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6);
                doc.text("Name:", lx + 2, sigY + 7.5);
                if (person?.name) doc.text(person.name, lx + 14, sigY + 7.5);

                doc.text("Date:", lx + 2, sigY + 11);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 11);

                doc.text("Signature:", lx + 2, sigY + 14.5);
            };

            drawSig("PREPARED BY", margin, config?.preparedBy);
            drawSig("REVIEWED BY", margin + sigW + 3, config?.reviewedBy);
            drawSig("APPROVED BY", margin + (sigW * 2) + 6, config?.approvedBy);
        }

        // ── 9. Page Footers with App Name, Version & Page No ──────────────────────
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.2);
            doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

            doc.setFontSize(6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.textMuted);
            doc.text(REPORT_FOOTER_APP_TEXT, margin, pageHeight - 6);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
        }

        // ── 10. Watermark & Security Application ─────────────────────────────────
        await applyWatermarkAndSignaturesGlobal(doc, config);

        // ── 11. Output Generation ────────────────────────────────────────────────
        if (config?.returnBlob) {
            return doc.output("blob");
        } else {
            const cleanSow = (sowReportNo || "SUMMARY").replace(/[\/\\]/g, "_");
            doc.save(`Inspection_Summary_Report_${cleanSow}_${format(new Date(), "yyyyMMdd")}.pdf`);
        }

    } catch (err) {
        console.error("[Inspection Summary Report] Critical Generation Error:", err);
        throw err;
    }
};
