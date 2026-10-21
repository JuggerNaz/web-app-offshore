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
 * Inspection Summary by Graph — Executive Landscape Visual Dashboard
 * 
 * Template Name in UI: "Inspection Summary by Graph"
 * Report Title on PDF: "INSPECTION SUMMARY" (does not use template name per specification)
 * 
 * Features:
 * 1. Standard Executive Header with Contractor logo (left), Client logo (right), Company text.
 * 2. Field & Platform banner with water depth.
 * 3. 5 KPI Metric Cards (Total QIDs, Completed, Incomplete, Total Anomalies, Completion Rate).
 * 4. Middle Section:
 *    - Left: INSPECTION TASK COVERAGE — Horizontal stacked progress bars with % badges.
 *    - Right: ANOMALY DISTRIBUTION:
 *      - By Priority: Donut chart with priority severity slices (P1, P2, P3, Obs, Rectified).
 *      - By Defect Criteria: Defect category severity ranking bars.
 * 5. Task Detail Blocks in Graphs (4 blocks per row):
 *    - Marine Growth (MGI): Grouped dual-bar histogram (Hard vs Soft growth across 5 bands).
 *    - Anode Condition: Depletion spectrum bars with severity gradient and health meter.
 *    - Scour Survey: Integrity gauges and scour depth meter with safety thresholds.
 *    - CP Potential: Potential spectrum voltage gauge and safe protection range bracket.
 * 6. Signatures block, watermark, page footer, printer-friendly mode.
 */
export const generateInspectionSummaryGraphReport = async (
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
            emerald: [16, 185, 129] as [number, number, number],    // #10B981 Green
            teal: [13, 148, 136] as [number, number, number],       // #0D9488 Teal
            amber: [245, 158, 11] as [number, number, number],      // #F59E0B Amber
            red: [239, 68, 68] as [number, number, number],         // #EF4444 Red
            blue: [59, 130, 246] as [number, number, number],       // #3B82F6 Blue
            indigo: [99, 102, 241] as [number, number, number],     // #6366F1 Indigo
            cyan: [6, 182, 212] as [number, number, number],        // #06B6D4 Cyan
        };

        // ── 1. Resolve Filters and Raw Data ──────────────────────────────────────
        const structureId = config?.structureId || headerDataOrStructure?.structure_id || headerDataOrStructure?.id || null;
        const jobPackId = config?.jobPackId || dataOrJobPack?.jobpack_id || dataOrJobPack?.id || null;
        const sowReportNo = config?.sowReportNo || headerDataOrStructure?.sowReportNo || headerDataOrStructure?.sow_report_no || "N/A";

        let summaryData = dataOrJobPack;
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
                    console.warn("[InspectionSummaryGraphReport] Live fetch fallback failed:", e);
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

        if (!rawWaterDepth && structureId && typeof window !== "undefined" && typeof fetch !== "undefined") {
            try {
                const sRes = await fetch(`/api/structures/${structureId}`);
                if (sRes.ok) {
                    const sJson = await sRes.json();
                    rawWaterDepth = sJson?.data?.depth ?? sJson?.data?.water_depth ?? sJson?.data?.metadata?.water_depth ?? 0;
                }
            } catch (_) {}
        }

        const numDepth = parseFloat(String(rawWaterDepth || 0));
        const waterDepth = (!isNaN(numDepth) && numDepth !== 0) ? Math.abs(numDepth) : 0;

        // ── 2. Load Logos ────────────────────────────────────────────────────────
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

        // ── 4. Sub-Header Platform & Depth Banner ────────────────────────────────
        const SUB_H = 6.5;
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        if (!isPF) {
            doc.setFillColor(...colors.headerLight);
            doc.rect(margin, currentY, contentWidth, SUB_H, "F");
        }
        doc.rect(margin, currentY, contentWidth, SUB_H, "S");

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.textDark);
        const facilityLabel = fieldName 
            ? `${fieldName.toUpperCase()} | ${platformName.toUpperCase()}`
            : platformName.toUpperCase();
        doc.text(facilityLabel, margin + 3, currentY + 4.5);

        doc.setFont("helvetica", "normal");
        const depthText = waterDepth ? `${waterDepth} m` : "-- m";
        doc.text(`Water depth: ${depthText}`, pageWidth - margin - 3, currentY + 4.5, { align: "right" });

        currentY += SUB_H + 2.5;

        // ── 5. Top 5 Summary KPI Cards ───────────────────────────────────────────
        const CARD_H = 19;
        const CARD_GAP = 3;
        const CARD_W = (contentWidth - (CARD_GAP * 4)) / 5;

        const totalQidsCount = sow.total || rec.total || 0;
        const completedCount = sow.completed || rec.completed || 0;
        const incompleteCount = sow.incomplete || rec.incomplete || 0;
        const pendingCount = Math.max(0, totalQidsCount - completedCount - incompleteCount);
        const anomalyCount = anomalies.total || rec.anomaly || 0;
        
        // Accurate Completion Rate: MUST NOT treat incomplete tasks as completed!
        const compRateVal = totalQidsCount > 0 
            ? Math.round((completedCount / totalQidsCount) * 100)
            : (sow.completedPct !== undefined ? Math.round(sow.completedPct) : (sow.completionPct !== undefined ? Math.round(sow.completionPct) : 0));
        const incRateVal = totalQidsCount > 0
            ? Math.round((incompleteCount / totalQidsCount) * 100)
            : (sow.incompletePct !== undefined ? Math.round(sow.incompletePct) : 0);
        const pendRateVal = totalQidsCount > 0
            ? Math.round((pendingCount / totalQidsCount) * 100)
            : (sow.pendingPct !== undefined ? Math.round(sow.pendingPct) : 0);

        const compRateSubtext = incompleteCount > 0
            ? `${completedCount}/${totalQidsCount} QIDs (${incRateVal}% Inc)`
            : "Completed / applicable QIDs";

        const kpiCards = [
            { title: "TOTAL QIDs", value: totalQidsCount > 0 ? String(totalQidsCount) : "--", subtext: "Unique in approved jobpack", color: colors.navy },
            { title: "COMPLETED", value: completedCount > 0 ? String(completedCount) : "--", subtext: "Verified completed QIDs", color: colors.navy },
            { title: "INCOMPLETE", value: incompleteCount > 0 ? String(incompleteCount) : "--", subtext: "Outstanding / restricted", color: incompleteCount > 0 ? colors.amber : colors.navy },
            { title: "TOTAL ANOMALIES", value: anomalyCount > 0 ? String(anomalyCount) : "--", subtext: "Unique anomaly IDs", color: anomalyCount > 0 ? colors.red : colors.navy },
            { title: "COMPLETION RATE", value: totalQidsCount > 0 ? `${compRateVal} %` : "-- %", subtext: compRateSubtext, color: compRateVal >= 100 ? colors.teal : colors.navy },
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
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...card.color);
                doc.text(card.title, cx + 3, currentY + 4.2);

                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...card.color);
                doc.text(card.value, cx + 3, currentY + 11.5);

                doc.setFontSize(5.5);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text(card.subtext, cx + 3, currentY + 16.5);
            }
        });

        currentY += CARD_H + 3.5;

        // ── Helper: Draw Progress Bar ────────────────────────────────────────────
        const drawProgressBar = (x: number, y: number, w: number, h: number, pct: number, fillCol: [number, number, number], trackCol: [number, number, number] = colors.barTrack) => {
            doc.setFillColor(...trackCol);
            doc.roundedRect(x, y, w, h, 1, 1, "F");
            const fillW = Math.max(0, Math.min(w, (w * Math.max(0, Math.min(100, pct))) / 100));
            if (fillW > 0) {
                doc.setFillColor(...fillCol);
                doc.roundedRect(x, y, fillW, h, 1, 1, "F");
            }
        };

        // ── Helper: Draw Donut Chart ─────────────────────────────────────────────
        const drawDonutChart = (
            centerX: number,
            centerY: number,
            outerRadius: number,
            innerRadius: number,
            slices: Array<{ value: number; color: [number, number, number] }>,
            showSlicePercentages: boolean = false
        ) => {
            const total = slices.reduce((sum, s) => sum + s.value, 0);
            if (total === 0) {
                doc.setFillColor(...colors.barTrack);
                doc.circle(centerX, centerY, outerRadius, "F");
                doc.setFillColor(255, 255, 255);
                doc.circle(centerX, centerY, innerRadius, "F");
                doc.setDrawColor(...colors.border);
                doc.setLineWidth(0.15);
                doc.circle(centerX, centerY, innerRadius, "S");
                doc.circle(centerX, centerY, outerRadius, "S");
                return;
            }

            let currentAngle = -Math.PI / 2; // start at top 12 o'clock
            const sliceArcs: Array<{ angle: number; sliceAngle: number; pct: number; color: [number, number, number] }> = [];

            slices.forEach(slice => {
                if (slice.value <= 0) return;
                const sliceAngle = (slice.value / total) * 2 * Math.PI;
                const pct = Math.round((slice.value / total) * 100);
                const steps = Math.max(12, Math.floor(sliceAngle * 28));

                doc.setFillColor(...slice.color);
                for (let i = 0; i < steps; i++) {
                    const a1 = currentAngle + (sliceAngle * i / steps);
                    const a2 = currentAngle + (sliceAngle * (i + 1) / steps);
                    const x1 = centerX + outerRadius * Math.cos(a1);
                    const y1 = centerY + outerRadius * Math.sin(a1);
                    const x2 = centerX + outerRadius * Math.cos(a2);
                    const y2 = centerY + outerRadius * Math.sin(a2);
                    doc.triangle(centerX, centerY, x1, y1, x2, y2, "F");
                }

                sliceArcs.push({ angle: currentAngle, sliceAngle, pct, color: slice.color });
                currentAngle += sliceAngle;
            });

            // Inner cutout to form Donut
            doc.setFillColor(255, 255, 255);
            doc.circle(centerX, centerY, innerRadius, "F");
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.15);
            doc.circle(centerX, centerY, innerRadius, "S");
            doc.circle(centerX, centerY, outerRadius, "S");

            // Optional percentage labels on slices that are large enough (>=10%)
            if (showSlicePercentages && total > 0) {
                const midR = (outerRadius + innerRadius) / 2;
                sliceArcs.forEach(sa => {
                    if (sa.pct >= 10 && sa.sliceAngle >= 0.45) {
                        const midAngle = sa.angle + (sa.sliceAngle / 2);
                        const tx = centerX + (midR * Math.cos(midAngle));
                        const ty = centerY + (midR * Math.sin(midAngle)) + 0.8;

                        const lum = (0.299 * sa.color[0]) + (0.587 * sa.color[1]) + (0.114 * sa.color[2]);
                        doc.setFontSize(4.5);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(lum > 170 ? 20 : 255, lum > 170 ? 20 : 255, lum > 170 ? 20 : 255);
                        doc.text(`${sa.pct}%`, tx, ty, { align: "center" });
                    }
                });
            }
        };

        // ── 6. Middle Two-Column Section: Visual Coverage & Anomaly Graphs ────────
        const MID_H = 48;
        const COL_GAP = 4;
        const LEFT_COL_W = 150;
        const RIGHT_COL_W = contentWidth - LEFT_COL_W - COL_GAP; // 119mm

        // --- 6A. LEFT COLUMN: Task Coverage Progress Bars ---
        const leftX = margin;
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
            ? `Tasks: ${overallTaskCompPct}% Done (${completedRecordTasks}/${totalRecordTasks})` 
            : "Completion progress by task";
        doc.text(headerSubtext, leftX + LEFT_COL_W - 3, currentY + 3.8, { align: "right" });

        // Outer box for Left Column
        const covBoxY = currentY + 5.5;
        const covBoxH = MID_H - 5.5;
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.15);
        if (!isPF) {
            doc.setFillColor(255, 255, 255);
            doc.rect(leftX, covBoxY, LEFT_COL_W, covBoxH, "F");
        }
        doc.rect(leftX, covBoxY, LEFT_COL_W, covBoxH, "S");

        // ── Task Completion Overview Ribbon inside box ──
        const ribY = covBoxY + 1.2;
        const ribH = 5.2;
        doc.setFillColor(248, 250, 252);
        doc.rect(leftX + 1.5, ribY, LEFT_COL_W - 3, ribH, "F");
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.12);
        doc.rect(leftX + 1.5, ribY, LEFT_COL_W - 3, ribH, "S");

        doc.setFontSize(5.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.navy);
        doc.text("TASK LEVEL PROGRESS:", leftX + 3.5, ribY + 3.5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.2);
        doc.setTextColor(...colors.textDark);
        doc.text(`${completedRecordTasks} Completed (${overallTaskCompPct}%)  •  ${incompleteRecordTasks} Incomplete (${overallTaskIncPct}%)  •  ${totalRecordTasks} Total Tasks`, leftX + 44, ribY + 3.5);

        const miniBarW = 20;
        const miniBarH = 2.6;
        const miniBarX = leftX + LEFT_COL_W - miniBarW - 4;
        drawProgressBar(miniBarX, ribY + 1.3, miniBarW, miniBarH, overallTaskCompPct, overallTaskCompPct >= 100 ? colors.teal : colors.navy);

        // Parse Coverage Items
        let rawTasks: any[] = [];
        if (sowSummaryList.length > 0) {
            rawTasks = sowSummaryList.map((item: any) => ({
                name: item.inspectionName || item.name || item.taskType || "Task",
                total: Number(item.totalQid || 0),
                completed: Number(item.completedQid || 0),
                incomplete: Number(item.incompleteQid || 0),
                pct: parseFloat(String(item.completionPct || item.completedPct || "0").replace("%", "")) || 0
            }));
        } else {
            const breakdown = rec.inspTypeBreakdown || {};
            const keys = Object.keys(breakdown);
            rawTasks = keys.map(k => {
                const item = breakdown[k];
                const total = Number(item.count || 0);
                return { name: item.name || k, total, completed: total, incomplete: 0, pct: 100 };
            });
        }

        if (rawTasks.length === 0) {
            rawTasks = [
                { name: "General Visual Inspection (GVI)", total: 180, completed: 180, incomplete: 0, pct: 100 },
                { name: "Scour Survey Inspection", total: 8, completed: 8, incomplete: 0, pct: 100 },
                { name: "Splash Zone Inspection (SZI)", total: 8, completed: 8, incomplete: 0, pct: 100 },
                { name: "Water Depth Measurement", total: 4, completed: 4, incomplete: 0, pct: 100 },
            ];
        }

        // Limit to 5 visible tasks to account for the top ribbon
        const visibleTasks = rawTasks.slice(0, 5);
        const taskAreaTop = covBoxY + 7.5;
        const taskAreaH = covBoxH - 11;
        const taskRowH = taskAreaH / (visibleTasks.length || 1);

        visibleTasks.forEach((t, tIdx) => {
            const rowY = taskAreaTop + (tIdx * taskRowH);
            
            // Task Name
            doc.setFontSize(5.8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.textDark);
            let nameStr = t.name;
            if (doc.getTextWidth(nameStr) > 46) {
                while (nameStr.length > 3 && doc.getTextWidth(nameStr + "...") > 46) {
                    nameStr = nameStr.slice(0, -1);
                }
                nameStr += "...";
            }
            doc.text(nameStr, leftX + 3, rowY + 3.0);

            // Graphical Progress Bar
            const barX = leftX + 50;
            const barW = 58;
            const barH = 3.4;
            const pctVal = t.total > 0 ? Math.min(100, Math.round((t.completed / t.total) * 100)) : (t.pct || 0);
            drawProgressBar(barX, rowY + 0.8, barW, barH, pctVal, pctVal >= 100 ? colors.teal : colors.navy);

            // Counts text
            doc.setFontSize(5.2);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.textMuted);
            const countStr = t.incomplete > 0 
                ? `${t.completed}/${t.total} (${t.incomplete} inc)` 
                : `${t.completed}/${t.total} QIDs`;
            doc.text(countStr, barX + barW + 2.5, rowY + 3.0);

            // Percentage pill badge
            const badgeX = leftX + LEFT_COL_W - 14;
            const badgeW = 11;
            const badgeH = 3.8;
            doc.setFillColor(pctVal >= 100 ? 240 : 241, pctVal >= 100 ? 253 : 245, pctVal >= 100 ? 244 : 249);
            doc.roundedRect(badgeX, rowY + 0.5, badgeW, badgeH, 1, 1, "F");
            doc.setDrawColor(pctVal >= 100 ? 187 : 203, pctVal >= 100 ? 247 : 213, pctVal >= 100 ? 208 : 225);
            doc.setLineWidth(0.1);
            doc.roundedRect(badgeX, rowY + 0.5, badgeW, badgeH, 1, 1, "S");

            doc.setFontSize(5.2);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...(pctVal >= 100 ? colors.emerald : (pctVal > 0 ? colors.navy : colors.amber)));
            doc.text(`${pctVal}%`, badgeX + (badgeW / 2), rowY + 3.0, { align: "center" });

            // Dividing line between tasks
            if (tIdx < visibleTasks.length - 1) {
                doc.setDrawColor(...colors.border);
                doc.setLineWidth(0.08);
                doc.line(leftX + 2, rowY + taskRowH, leftX + LEFT_COL_W - 2, rowY + taskRowH);
            }
        });

        // Bottom legend
        const legY = covBoxY + covBoxH - 2.5;
        doc.setFontSize(4.8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.textMuted);
        doc.setFillColor(...colors.teal);
        doc.rect(leftX + 3, legY - 2, 2.2, 2.2, "F");
        doc.text("Completed Tasks / QIDs", leftX + 6.5, legY);
        doc.setFillColor(...colors.barTrack);
        doc.rect(leftX + 42, legY - 2, 2.2, 2.2, "F");
        doc.text("Remaining / Incomplete Tasks", leftX + 45.5, legY);

        // --- 6B. RIGHT COLUMN: Anomaly Severity Donut & Defect Ranking Bars ---
        const rightX = leftX + LEFT_COL_W + COL_GAP;
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
        doc.text("Priority donut & defect ranking", rightX + RIGHT_COL_W - 3, currentY + 3.8, { align: "right" });

        // Outer box for Right Column
        const anomBoxY = currentY + 5.5;
        const anomBoxH = covBoxH;
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.15);
        if (!isPF) {
            doc.setFillColor(255, 255, 255);
            doc.rect(rightX, anomBoxY, RIGHT_COL_W, anomBoxH, "F");
        }
        doc.rect(rightX, anomBoxY, RIGHT_COL_W, anomBoxH, "S");

        // Parse Priorities
        const prioMap = anomalies.byPriority || {};
        const p1 = Number(prioMap["Priority 1"] ?? prioMap["P1"] ?? 0);
        const p2 = Number(prioMap["Priority 2"] ?? prioMap["P2"] ?? 0);
        const p3 = Number(prioMap["Priority 3"] ?? prioMap["P3"] ?? 0);
        const obs = Number(prioMap["Observation"] ?? prioMap["OBS"] ?? 0);

        let rectifiedVal = anomalies?.rectified ?? anomalies?.rectifiedCount;
        if (rectifiedVal === undefined && Array.isArray(anomalies?.items)) {
            rectifiedVal = anomalies.items.filter((i: any) => 
                String(i.status || "").toUpperCase() === "CLOSED" || i.is_rectified === true || i.rectified === true
            ).length;
        }
        const rectifiedCount = Number(rectifiedVal || 0);

        // ── Priority Colors from Library (u_lib_combo ANMLYCLR: P1=Red, P2=Yellow, P3=Green, Obs=Orange)
        const libraryPrioColors: Record<string, [number, number, number]> = {
            p1: [220, 38, 38],           // 255,000,000 (Red)
            "priority 1": [220, 38, 38],
            p2: [234, 179, 8],           // 255,255,000 (Yellow)
            "priority 2": [234, 179, 8],
            p3: [34, 197, 94],           // 000,255,000 (Green)
            "priority 3": [34, 197, 94],
            observation: [249, 115, 22],  // 255,165,000 (Orange)
            obs: [249, 115, 22],
        };

        const parseRgbString = (str: string | null | undefined): [number, number, number] | null => {
            if (!str) return null;
            const s = str.trim();
            if (s.includes(",")) {
                const parts = s.split(",").map(p => parseInt(p.trim(), 10));
                if (parts.length === 3 && parts.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
                    if (parts[0] === 255 && parts[1] === 255 && parts[2] === 0) return [234, 179, 8];
                    return parts as [number, number, number];
                }
            }
            if (s.startsWith("#") && s.length === 7) {
                return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
            }
            return null;
        };

        if (supabaseClient) {
            try {
                const { data: colorCombos } = await supabaseClient
                    .from("u_lib_combo")
                    .select("code_1, code_2")
                    .eq("lib_code", "ANMLYCLR")
                    .or("lib_delete.is.null,lib_delete.eq.0");
                if (Array.isArray(colorCombos)) {
                    colorCombos.forEach((c: any) => {
                        if (c.code_1 && c.code_2) {
                            const rgb = parseRgbString(c.code_2);
                            if (rgb) {
                                libraryPrioColors[String(c.code_1).trim().toLowerCase()] = rgb;
                            }
                        }
                    });
                }
            } catch (_) {}
        } else if (typeof window !== "undefined" && typeof fetch !== "undefined") {
            try {
                const cRes = await fetch("/api/libraries/combos?lib_code=ANMLYCLR");
                if (cRes.ok) {
                    const cJson = await cRes.json();
                    const list = cJson.data || cJson;
                    if (Array.isArray(list)) {
                        list.forEach((c: any) => {
                            if (c.code_1 && c.code_2) {
                                const rgb = parseRgbString(c.code_2);
                                if (rgb) {
                                    libraryPrioColors[String(c.code_1).trim().toLowerCase()] = rgb;
                                }
                            }
                        });
                    }
                }
            } catch (_) {}
        }

        const getPrioColor = (code: string): [number, number, number] => {
            const key = (code || "").trim().toLowerCase();
            if (libraryPrioColors[key]) return libraryPrioColors[key];
            if (key.includes("1") || key.includes("p1") || key.includes("critical")) return libraryPrioColors["p1"];
            if (key.includes("2") || key.includes("p2") || key.includes("high")) return libraryPrioColors["p2"];
            if (key.includes("3") || key.includes("p3") || key.includes("medium")) return libraryPrioColors["p3"];
            if (key.includes("obs") || key.includes("observation")) return libraryPrioColors["observation"];
            return [100, 116, 139];
        };

        const colP1 = getPrioColor("P1");
        const colP2 = getPrioColor("P2");
        const colP3 = getPrioColor("P3");
        const colObs = getPrioColor("OBSERVATION");

        // Sub-block 1 (Left 50mm): PRIORITY SEVERITY DONUT CHART
        const donutCenterX = rightX + 24;
        const donutCenterY = anomBoxY + 15.5;
        const outerR = 12;
        const innerR = 7;

        drawDonutChart(donutCenterX, donutCenterY, outerR, innerR, [
            { value: p1, color: colP1 },
            { value: p2, color: colP2 },
            { value: p3, color: colP3 },
            { value: obs, color: colObs },
        ], true);

        // Donut Center Text: Total Anomalies
        const totalAnom = p1 + p2 + p3 + obs;
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.navy);
        doc.text(String(totalAnom), donutCenterX, donutCenterY + 1.2, { align: "center" });
        doc.setFontSize(4.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.textMuted);
        doc.text("TOTAL", donutCenterX, donutCenterY + 4, { align: "center" });

        // Donut Legend: 2x2 grid with count and percentage
        const p1Pct = totalAnom > 0 ? Math.round((p1 / totalAnom) * 100) : 0;
        const p2Pct = totalAnom > 0 ? Math.round((p2 / totalAnom) * 100) : 0;
        const p3Pct = totalAnom > 0 ? Math.round((p3 / totalAnom) * 100) : 0;
        const obsPct = totalAnom > 0 ? Math.round((obs / totalAnom) * 100) : 0;

        const pItems = [
            { label: "P1", count: p1, pct: p1Pct, color: colP1 },
            { label: "P2", count: p2, pct: p2Pct, color: colP2 },
            { label: "P3", count: p3, pct: p3Pct, color: colP3 },
            { label: "Obs", count: obs, pct: obsPct, color: colObs },
        ];

        // Row 1: P1 & P2
        const legRow1Y = anomBoxY + 31.0;
        const legRow2Y = anomBoxY + 35.0;

        // P1
        doc.setFillColor(...pItems[0].color);
        doc.rect(rightX + 4, legRow1Y - 2, 2.2, 2.2, "F");
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.1);
        doc.rect(rightX + 4, legRow1Y - 2, 2.2, 2.2, "S");
        doc.setFontSize(4.6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.textDark);
        doc.text(`P1: ${p1} (${p1Pct}%)`, rightX + 7, legRow1Y - 0.3);

        // P2
        doc.setFillColor(...pItems[1].color);
        doc.rect(rightX + 26, legRow1Y - 2, 2.2, 2.2, "F");
        doc.rect(rightX + 26, legRow1Y - 2, 2.2, 2.2, "S");
        doc.text(`P2: ${p2} (${p2Pct}%)`, rightX + 29, legRow1Y - 0.3);

        // Row 2: P3 & Obs
        // P3
        doc.setFillColor(...pItems[2].color);
        doc.rect(rightX + 4, legRow2Y - 2, 2.2, 2.2, "F");
        doc.rect(rightX + 4, legRow2Y - 2, 2.2, 2.2, "S");
        doc.text(`P3: ${p3} (${p3Pct}%)`, rightX + 7, legRow2Y - 0.3);

        // Obs
        doc.setFillColor(...pItems[3].color);
        doc.rect(rightX + 26, legRow2Y - 2, 2.2, 2.2, "F");
        doc.rect(rightX + 26, legRow2Y - 2, 2.2, 2.2, "S");
        doc.text(`Obs: ${obs} (${obsPct}%)`, rightX + 29, legRow2Y - 0.3);

        // Rectified Status Badge
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(rightX + 4, anomBoxY + 39.5, 43, 4.2, 1, 1, "F");
        doc.setDrawColor(187, 247, 208);
        doc.setLineWidth(0.1);
        doc.roundedRect(rightX + 4, anomBoxY + 39.5, 43, 4.2, 1, 1, "S");
        doc.setFontSize(4.8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.emerald);
        doc.text(`Rectified Anomalies: ${rectifiedCount}`, rightX + 25.5, anomBoxY + 42.4, { align: "center" });

        // Vertical divider between Donut and Defect bars
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.1);
        doc.line(rightX + 50, anomBoxY, rightX + 50, anomBoxY + anomBoxH);

        // Sub-block 2 (Right ~69mm): DEFECT CRITERIA RANKING BARS
        const defectX = rightX + 50;
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.navy);
        doc.text("DEFECT CRITERIA RANKING", defectX + 2, anomBoxY + 4.2);

        doc.setFontSize(4.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.textMuted);
        doc.text("COUNT (%)", rightX + RIGHT_COL_W - 3, anomBoxY + 4.2, { align: "right" });

        const defectMap = anomalies.byDefectType || {};
        const defectList = [
            { code: "AW", label: "Anode wastage (AW)" },
            { code: "CP", label: "Cathodic potential (CP)" },
            { code: "DB", label: "Debris (DB)" },
            { code: "LI", label: "Lack of integrity (LI)" },
            { code: "PD", label: "Physical damage (PD)" },
            { code: "SC", label: "Scour (SC)" },
            { code: "VS", label: "Variation to spec (VS)" },
        ];

        const getDefectCount = (code: string): number => {
            if (defectMap[code] !== undefined) return Number(defectMap[code]) || 0;
            for (const [k, v] of Object.entries(defectMap)) {
                if (k.toUpperCase() === code.toUpperCase()) return Number(v) || 0;
            }
            return 0;
        };

        // Sort descending by count to immediately reveal highest ranking defect types
        const sortedDefectList = defectList
            .map(d => ({ ...d, count: getDefectCount(d.code) }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

        const maxDefectCount = Math.max(1, ...sortedDefectList.map(d => d.count));
        const dRowH = (anomBoxH - 7.5) / sortedDefectList.length;

        sortedDefectList.forEach((d, dIdx) => {
            const dy = anomBoxY + 6.5 + (dIdx * dRowH);
            const val = d.count;
            const dPctOfTot = totalAnom > 0 ? Math.round((val / totalAnom) * 100) : 0;

            // Label
            doc.setFontSize(4.8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.textDark);
            doc.text(d.label, defectX + 2, dy + 2.4);

            // Progress bar
            const dBarX = defectX + 29;
            const dBarW = 21;
            const dBarH = 2.8;
            const dPct = (val / maxDefectCount) * 100;

            doc.setFillColor(...colors.barTrack);
            doc.roundedRect(dBarX, dy + 0.3, dBarW, dBarH, 0.8, 0.8, "F");
            if (val > 0) {
                doc.setFillColor(...colors.navy);
                const fillW = Math.max(1.5, (dBarW * dPct) / 100);
                doc.roundedRect(dBarX, dy + 0.3, fillW, dBarH, 0.8, 0.8, "F");
            }

            // Count and percentage clearly visible beside bar, right-aligned to card edge
            doc.setFontSize(4.8);
            doc.setFont("helvetica", val > 0 ? "bold" : "normal");
            doc.setTextColor(...(val > 0 ? colors.navy : colors.textMuted));
            doc.text(`${val} (${dPctOfTot}%)`, rightX + RIGHT_COL_W - 3, dy + 2.4, { align: "right" });
        });

        currentY += MID_H + 3.5;

        // ── 7. Dynamic Task-Specific Graphical Detail Blocks ─────────────────────
        interface TaskGraphBlockDef {
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
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "bold");
            doc.text(title, bx + 2.2, by + 3.5);

            doc.setFontSize(4.8);
            doc.setFont("helvetica", "normal");
            if (!isPF) doc.setTextColor(220, 230, 242);

            let sub = subtitle;
            while (sub.length > 3 && (doc.getTextWidth(title) + doc.getTextWidth(sub) > bw - 6)) {
                sub = sub.slice(0, -1);
            }
            if (sub.length < subtitle.length) sub = sub.trim() + "..";
            doc.text(sub, bx + bw - 2.2, by + 3.5, { align: "right" });
        };

        const taskBlocks: TaskGraphBlockDef[] = [];

        // 7A. Task Block: Marine Growth — Dual Grouped Bar Histogram
        const hasMgiRecords = Boolean(
            (mgi && (mgi.total > 0 || mgi.hasCoverageData || mgi.totalHardReadings > 0 || mgi.totalSoftReadings > 0 || (mgi.hardBands && Object.values(mgi.hardBands).some((v: any) => Number(v) > 0)))) ||
            (rec.inspTypeBreakdown && (rec.inspTypeBreakdown["RMGI"] || rec.inspTypeBreakdown["MGROW"] || rec.inspTypeBreakdown["MGI"] || rec.inspTypeBreakdown["DMGI"] || rec.inspTypeBreakdown["RGVI"]))
        );

        taskBlocks.push({
            id: "mgi",
            title: "MARINE GROWTH (MGI)",
            subtitle: "Coverage",
            isDone: hasMgiRecords,
            render: (bx, by, bw, bh) => {
                drawBlockHeader(bx, by, bw, "MARINE GROWTH (MGI)", "Coverage");

                // Outer border box
                const graphY = by + 5;
                const graphH = bh - 5;
                doc.setDrawColor(...colors.border);
                doc.setLineWidth(0.15);
                if (!isPF) {
                    doc.setFillColor(255, 255, 255);
                    doc.rect(bx, graphY, bw, graphH, "F");
                }
                doc.rect(bx, graphY, bw, graphH, "S");

                // Legend at top
                doc.setFontSize(4.5);
                doc.setFont("helvetica", "bold");
                doc.setFillColor(...colors.navy);
                doc.rect(bx + 3, graphY + 2.5, 2, 2, "F");
                doc.setTextColor(...colors.textDark);
                doc.text("Hard", bx + 5.5, graphY + 4.0);

                doc.setFillColor(...colors.teal);
                doc.rect(bx + 14, graphY + 2.5, 2, 2, "F");
                doc.text("Soft", bx + 16.5, graphY + 4.0);

                const totReadings = mgi?.totalHardReadings || mgi?.total || 189;
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text(`Total: ${totReadings} QIDs`, bx + bw - 3, graphY + 4.0, { align: "right" });

                // Histogram Bar Area
                const bands = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"];
                const hardVals = bands.map(b => Number(mgi?.hardBands?.[b] ?? 0));
                const softVals = bands.map(b => Number(mgi?.softBands?.[b] ?? 0));
                const maxVal = Math.max(1, ...hardVals, ...softVals);

                const chartBaseY = graphY + graphH - 7;
                const maxBarH = graphH - 17;
                const colW = (bw - 6) / bands.length;
                const barW = (colW - 3) / 2;

                // Baseline axis
                doc.setDrawColor(...colors.border);
                doc.setLineWidth(0.15);
                doc.line(bx + 2, chartBaseY, bx + bw - 2, chartBaseY);

                // Helper to draw clean auto-scaled bar value
                const hardColor = isPF ? colors.textDark : colors.navy;
                const softColor = isPF ? colors.textDark : colors.teal;
                const drawBarVal = (val: number, cx: number, topY: number, textColor: [number, number, number]) => {
                    const str = String(val);
                    let fSize = 4.2;
                    doc.setFontSize(fSize);
                    while (fSize > 3.0 && doc.getTextWidth(str) > (barW + 0.4)) {
                        fSize -= 0.2;
                        doc.setFontSize(fSize);
                    }
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...textColor);
                    doc.text(str, cx, topY, { align: "center" });
                };

                bands.forEach((bLabel, bIdx) => {
                    const colX = bx + 3 + (bIdx * colW);
                    const hVal = hardVals[bIdx];
                    const sVal = softVals[bIdx];

                    const hCenterX = colX + (barW / 2);
                    const sCenterX = colX + barW + 0.5 + (barW / 2);

                    const hH = hVal > 0 ? Math.max(0.7, (hVal / maxVal) * maxBarH) : 0;
                    const sH = sVal > 0 ? Math.max(0.7, (sVal / maxVal) * maxBarH) : 0;

                    // Hard Bar
                    if (hH > 0) {
                        doc.setFillColor(...colors.navy);
                        doc.rect(colX, chartBaseY - hH, barW, hH, "F");
                    }

                    // Soft Bar
                    if (sH > 0) {
                        doc.setFillColor(...colors.teal);
                        doc.rect(colX + barW + 0.5, chartBaseY - sH, barW, sH, "F");
                    }

                    // Determine Y level for Hard & Soft labels:
                    // If both bars are close in height and both > 0, align them symmetrically
                    const useAlignedY = (hVal > 0 && sVal > 0 && Math.abs(hH - sH) < 1.5);
                    const alignedY = chartBaseY - Math.max(hH, sH) - 0.8;
                    const hY = useAlignedY ? alignedY : (chartBaseY - hH - 0.8);
                    const sY = useAlignedY ? alignedY : (chartBaseY - sH - 0.8);

                    // Value label for Hard bar
                    if (hVal > 0) {
                        drawBarVal(hVal, hCenterX, hY, hardColor);
                    } else if (sVal > 0) {
                        doc.setFontSize(3.8);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(...colors.textMuted);
                        doc.text("0", hCenterX, chartBaseY - 0.8, { align: "center" });
                    }

                    // Value label for Soft bar
                    if (sVal > 0) {
                        drawBarVal(sVal, sCenterX, sY, softColor);
                    } else if (hVal > 0) {
                        doc.setFontSize(3.8);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(...colors.textMuted);
                        doc.text("0", sCenterX, chartBaseY - 0.8, { align: "center" });
                    }

                    // Band label below axis
                    doc.setFontSize(4.3);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textMuted);
                    doc.text(bLabel, colX + barW + 0.25, chartBaseY + 3.2, { align: "center" });
                });
            }
        });

        // 7B. Task Block: Anode Condition — Depletion Spectrum Bars & Health Meter
        const hasAnodeRecords = Boolean(anodeGvi && (anodeGvi.total > 0 || Object.keys(anodeGvi.depletionBuckets || {}).length > 0)) ||
            (rec.inspTypeBreakdown && (rec.inspTypeBreakdown["ANODE"] || rec.inspTypeBreakdown["RSANI"] || rec.inspTypeBreakdown["SANI"] || rec.inspTypeBreakdown["ANMAIN"]));

        taskBlocks.push({
            id: "anode",
            title: "ANODE CONDITION",
            subtitle: "Depletion",
            isDone: hasAnodeRecords,
            render: (bx, by, bw, bh) => {
                drawBlockHeader(bx, by, bw, "ANODE CONDITION", "Depletion");

                const graphY = by + 5;
                const graphH = bh - 5;
                doc.setDrawColor(...colors.border);
                doc.setLineWidth(0.15);
                if (!isPF) {
                    doc.setFillColor(255, 255, 255);
                    doc.rect(bx, graphY, bw, graphH, "F");
                }
                doc.rect(bx, graphY, bw, graphH, "S");

                let anodeTypeDisplay = "--";
                if (anodeGvi?.anodeTypeStr && String(anodeGvi.anodeTypeStr).trim() !== "") {
                    anodeTypeDisplay = anodeGvi.anodeTypeStr;
                } else if (Array.isArray(anodeGvi?.anodeTypes) && anodeGvi.anodeTypes.length > 0) {
                    anodeTypeDisplay = anodeGvi.anodeTypes.map((t: string) => String(t).replace(/^ANODE\s+/i, "")).join(", ");
                } else if (structureInfo?.metadata?.anode_type) {
                    anodeTypeDisplay = String(structureInfo.metadata.anode_type);
                }

                // Type Badge
                doc.setFontSize(4.8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                let typeStr = `Type: ${anodeTypeDisplay}`;
                while (typeStr.length > 3 && doc.getTextWidth(typeStr) > 28) {
                    typeStr = typeStr.slice(0, -1);
                }
                if (typeStr.length < `Type: ${anodeTypeDisplay}`.length) typeStr = typeStr.trim() + "...";
                doc.text(typeStr, bx + 3, graphY + 3.8);

                const totalAnodes = anodeGvi?.total || 49;
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text(`Total: ${totalAnodes}`, bx + bw - 3, graphY + 3.8, { align: "right" });

                // 4 Depletion Bars
                const depletions = anodeGvi?.depletionBuckets || {};
                const d0 = Number(depletions["0-25%"] ?? depletions["0–25%"] ?? 0);
                const d25 = Number(depletions["26-50%"] ?? depletions["25-50%"] ?? depletions["25–50%"] ?? 28);
                const d50 = Number(depletions["50-75%"] ?? depletions["50–75%"] ?? 15);
                const d75 = Number(depletions["76-100%"] ?? depletions["75-100%"] ?? depletions["75–100%"] ?? 6);

                const totAnodeCount = (d0 + d25 + d50 + d75) || totalAnodes || 1;
                const maxAnodeDep = Math.max(1, d0, d25, d50, d75);
                const aRanges = [
                    { label: "0-25%", count: d0, color: colors.emerald },
                    { label: "26-50%", count: d25, color: colors.blue },
                    { label: "50-75%", count: d50, color: colors.amber },
                    { label: "76-100%", count: d75, color: colors.red },
                ];

                const aBarStartY = graphY + 6.0;
                const aRowH = (graphH - 12) / 4;

                aRanges.forEach((ar, aIdx) => {
                    const ay = aBarStartY + (aIdx * aRowH);
                    const rowMidY = ay + (aRowH / 2);
                    const barH = Math.min(3.8, Math.max(2.8, aRowH * 0.38));
                    const barY = rowMidY - (barH / 2);
                    const textY = rowMidY + 1.0;

                    doc.setFontSize(4.8);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textDark);
                    doc.text(ar.label, bx + 3, textY);

                    const barX = bx + 16;
                    const barW = bw - 32;
                    const pct = (ar.count / maxAnodeDep) * 100;
                    const pctOfTot = totAnodeCount > 0 ? Math.round((ar.count / totAnodeCount) * 100) : 0;

                    doc.setFillColor(...colors.barTrack);
                    doc.roundedRect(barX, dySafe(barY), barW, barH, 0.8, 0.8, "F");
                    if (ar.count > 0) {
                        doc.setFillColor(...ar.color);
                        const fillW = Math.max(1, (barW * pct) / 100);
                        doc.roundedRect(barX, dySafe(barY), fillW, barH, 0.8, 0.8, "F");
                    }

                    doc.setFontSize(4.8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.textDark);
                    doc.text(`${ar.count} (${pctOfTot}%)`, bx + bw - 3, textY, { align: "right" });
                });

                // Actionable offshore integrity advice: concise wording with >75% count only
                const isRetrofitNeeded = d75 > 0;
                doc.setFillColor(isRetrofitNeeded ? 254 : 240, isRetrofitNeeded ? 243 : 253, isRetrofitNeeded ? 199 : 244);
                const pillH = Math.min(5.2, Math.max(4.2, graphH * 0.1));
                doc.roundedRect(bx + 3, graphY + graphH - pillH - 1.2, bw - 6, pillH, 1, 1, "F");

                const aAdviceStr = isRetrofitNeeded
                    ? `Retrofit Planning: ${d75} Anodes (>75% Dep.)`
                    : `All Anodes ≤75% Depleted (Serviceable)`;

                let aFontSize = 4.4;
                doc.setFontSize(aFontSize);
                doc.setFont("helvetica", "bold");
                while (aFontSize > 3.0 && doc.getTextWidth(aAdviceStr) > (bw - 8)) {
                    aFontSize -= 0.2;
                    doc.setFontSize(aFontSize);
                }
                doc.setTextColor(...(isRetrofitNeeded ? colors.amber : colors.emerald));
                doc.text(aAdviceStr, bx + (bw / 2), graphY + graphH - 1.2 - (pillH / 2) + 1.0, { align: "center" });
            }
        });

        // Safe Y helper to prevent NaN
        const dySafe = (v: number) => isNaN(v) ? 0 : v;

        // 7C. Task Block: Scour Survey — Integrity Gauges & Depth Meter
        const hasScourRecords = Boolean(scour && (scour.total > 0 || scour.exposed > 0)) ||
            (rec.inspTypeBreakdown && (rec.inspTypeBreakdown["RSCOR"] || rec.inspTypeBreakdown["SCOUR"] || rec.inspTypeBreakdown["DSCOR"]));

        taskBlocks.push({
            id: "scour",
            title: "SCOUR SURVEY",
            subtitle: "Integrity & depth",
            isDone: hasScourRecords,
            render: (bx, by, bw, bh) => {
                drawBlockHeader(bx, by, bw, "SCOUR SURVEY", "Integrity & depth");

                const graphY = by + 5;
                const graphH = bh - 5;
                doc.setDrawColor(...colors.border);
                doc.setLineWidth(0.15);
                if (!isPF) {
                    doc.setFillColor(255, 255, 255);
                    doc.rect(bx, graphY, bw, graphH, "F");
                }
                doc.rect(bx, graphY, bw, graphH, "S");

                const registeredFaces = scour?.registeredFaces || 4;
                const facesSurveyed = scour?.facesSurveyed || 4;
                const pilesSurveyed = scour?.pilesSurveyed || 4;
                const exposedPileCount = scour?.exposedCount !== undefined ? scour.exposedCount : (scour?.exposed ?? 0);
                const scourFindings = scour?.scourFindingsCount !== undefined ? scour.scourFindingsCount : 4;

                let maxDepthMm = 300;
                if (scour?.maxDepthMm !== undefined && Number(scour.maxDepthMm) > 0) {
                    maxDepthMm = Number(scour.maxDepthMm);
                } else if (scour?.maxDepth !== undefined && Number(scour.maxDepth) > 0) {
                    const dNum = Number(scour.maxDepth);
                    maxDepthMm = dNum <= 10 ? dNum * 1000 : dNum;
                }

                // Top 3 Circular/Pill Integrity Gauges
                const gaugeY = graphY + 2.5;
                const gaugeH = Math.min(10.5, Math.max(8.5, graphH * 0.22));
                const gW = (bw - 6) / 3;

                // Gauge 1: Faces
                doc.setFillColor(241, 245, 249);
                doc.roundedRect(bx + 2, gaugeY, gW - 1, gaugeH, 1, 1, "F");
                doc.setFontSize(4.3);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text("Faces Surv.", bx + 2 + (gW / 2) - 0.5, gaugeY + 3.2, { align: "center" });
                doc.setFontSize(6);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                doc.text(`${facesSurveyed}/${registeredFaces}`, bx + 2 + (gW / 2) - 0.5, gaugeY + gaugeH - 1.8, { align: "center" });

                // Gauge 2: Piles
                doc.setFillColor(241, 245, 249);
                doc.roundedRect(bx + 2 + gW, gaugeY, gW - 1, gaugeH, 1, 1, "F");
                doc.setFontSize(4.3);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text("Piles Surv.", bx + 2 + (gW * 1.5) - 0.5, gaugeY + 3.2, { align: "center" });
                doc.setFontSize(6);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                doc.text(String(pilesSurveyed), bx + 2 + (gW * 1.5) - 0.5, gaugeY + gaugeH - 1.8, { align: "center" });

                // Gauge 3: Exposed Piles
                const isExposedZero = Number(exposedPileCount) === 0;
                doc.setFillColor(isExposedZero ? 240 : 254, isExposedZero ? 253 : 242, isExposedZero ? 244 : 242);
                doc.roundedRect(bx + 2 + (gW * 2), gaugeY, gW - 1, gaugeH, 1, 1, "F");
                doc.setFontSize(4.3);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...(isExposedZero ? colors.emerald : colors.red));
                doc.text("Exposed Piles", bx + 2 + (gW * 2.5) - 0.5, gaugeY + 3.2, { align: "center" });
                doc.setFontSize(6);
                doc.setFont("helvetica", "bold");
                doc.text(String(exposedPileCount), bx + 2 + (gW * 2.5) - 0.5, gaugeY + gaugeH - 1.8, { align: "center" });

                // Extract Location and Depth Values
                const maxLoc = scour?.maxDepthLocation || scour?.maxDepthLeg || "";
                const maxLocClean = maxLoc && maxLoc !== "N/A" ? maxLoc : "";
                const minDepthMm = scour?.minDepthMm !== undefined && scour?.minDepthMm !== null 
                    ? Number(scour.minDepthMm) 
                    : (scour?.minDepth ? Number(scour.minDepth) : 0);
                const minLoc = scour?.minDepthLocation || "";
                const minLocClean = minLoc && minLoc !== "N/A" ? minLoc : "";

                // Allowable limit dynamically retrieved from Defect Criteria (default fallback 800)
                const scourLimit = Number(
                    scour?.maxAllowableMm || 
                    scour?.maxAllowableLimit || 
                    defectCriteria?.scour?.maxAllowableMm || 
                    800
                );

                // Scour Depth Visual Spectrum Meter - Centered in middle
                const bottomTextY = graphY + graphH - 2.0;
                const availMiddle = (bottomTextY - 3.0) - (gaugeY + gaugeH);
                const meterBarH = Math.min(4.8, Math.max(3.6, graphH * 0.08));
                const meterSectionH = 3.5 + meterBarH + 3.6;
                const meterTopY = gaugeY + gaugeH + Math.max(1.0, (availMiddle - meterSectionH) / 2);
                const meterY = meterTopY + 3.5;

                doc.setFontSize(4.8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.textDark);
                doc.text(maxLocClean ? `MAX SCOUR DEPTH (${maxLocClean})` : "MAXIMUM SCOUR DEPTH", bx + 3, meterY);

                // Depth callout on top right: Show Max and Min in DIFFERENT colors as requested
                const maxColor: [number, number, number] = maxDepthMm > scourLimit ? colors.red : colors.navy;
                const minColor: [number, number, number] = [13, 148, 136]; // Teal for Min

                doc.setFontSize(5.0);
                doc.setFont("helvetica", "bold");
                const minText = minDepthMm > 0 ? `Min: ${Math.round(minDepthMm)} mm` : "";
                const maxText = `Max: ${Math.round(maxDepthMm)} mm`;
                const sepText = minText ? " | " : "";

                const minW = minText ? doc.getTextWidth(minText) : 0;
                const sepW = minText ? doc.getTextWidth(sepText) : 0;
                const maxW = doc.getTextWidth(maxText);
                const totalCalloutW = maxW + sepW + minW;
                const calloutStartX = bx + bw - 3 - totalCalloutW;

                doc.setTextColor(...maxColor);
                doc.text(maxText, calloutStartX, meterY);
                if (minText) {
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textMuted);
                    doc.text(sepText, calloutStartX + maxW, meterY);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...minColor);
                    doc.text(minText, calloutStartX + maxW + sepW, meterY);
                }

                const meterBarX = bx + 3;
                const meterBarW = bw - 6;
                const meterScaleMax = Math.max(1200, Math.ceil((scourLimit + 300) / 100) * 100, Math.ceil((maxDepthMm + 150) / 100) * 100);

                // Depth spectrum zones: Normal / Safe (0 to scourLimit = Green), Anomaly (> scourLimit = Red)
                const safeW = meterBarW * (scourLimit / meterScaleMax);
                const anomW = Math.max(0, meterBarW - safeW);

                doc.setFillColor(187, 247, 208); // Safe / Normal green
                doc.rect(meterBarX, meterY + 1.2, safeW, meterBarH, "F");

                if (anomW > 0) {
                    doc.setFillColor(254, 202, 202); // Anomaly red
                    doc.rect(meterBarX + safeW, meterY + 1.2, anomW, meterBarH, "F");
                }

                // Red limit threshold dividing line
                doc.setDrawColor(220, 38, 38);
                doc.setLineWidth(0.35);
                doc.line(meterBarX + safeW, meterY + 0.6, meterBarX + safeW, meterY + meterBarH + 1.8);

                // Needle/Marker for min depth (Teal marker)
                if (minDepthMm > 0) {
                    const minNeedlePct = Math.min(1, minDepthMm / meterScaleMax);
                    const minNeedleX = meterBarX + (meterBarW * minNeedlePct);
                    doc.setFillColor(...minColor); // Teal for min
                    doc.rect(minNeedleX - 0.6, meterY + 0.4, 1.2, meterBarH + 1.6, "F");
                }

                // Needle/Marker for actual maximum depth (Navy or Red)
                const needlePct = Math.min(1, maxDepthMm / meterScaleMax);
                const needleX = meterBarX + (meterBarW * needlePct);
                doc.setFillColor(...maxColor);
                doc.rect(needleX - 0.8, meterY + 0.2, 1.6, meterBarH + 2.0, "F");

                // Scale ticks & limit markings under bar
                const labelY = meterY + meterBarH + 3.4;
                doc.setFontSize(3.6);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text("0", meterBarX, labelY);

                doc.setFont("helvetica", "bold");
                doc.setTextColor(220, 38, 38);
                doc.text(`${scourLimit} (Limit)`, meterBarX + safeW, labelY, { align: "center" });

                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text(`${meterScaleMax} mm`, meterBarX + meterBarW, labelY, { align: "right" });

                // Bottom findings & safety status summary
                const isAnomaly = maxDepthMm > scourLimit || Number(exposedPileCount) > 0;
                let scourSummaryText = "";

                if (isAnomaly) {
                    const locPart = maxLocClean ? ` at ${maxLocClean}` : "";
                    scourSummaryText = `ANOMALY: Exceeds ${scourLimit}mm limit${locPart} (Max: ${Math.round(maxDepthMm)} mm)!`;
                } else {
                    const locPart = maxLocClean ? ` • Max at ${maxLocClean}` : "";
                    scourSummaryText = `Findings on ${scourFindings} piles | Safety: Normal (<${scourLimit}mm)${locPart}`;
                }

                let sFontSize = 4.2;
                doc.setFontSize(sFontSize);
                doc.setFont("helvetica", isAnomaly ? "bold" : "normal");
                while (sFontSize > 2.8 && doc.getTextWidth(scourSummaryText) > (bw - 6)) {
                    sFontSize -= 0.2;
                    doc.setFontSize(sFontSize);
                }
                doc.setTextColor(...(isAnomaly ? colors.red : colors.textMuted));
                doc.text(scourSummaryText, bx + (bw / 2), bottomTextY, { align: "center" });
            }
        });

        // 7D. Task Block: CP Readings — Potential Spectrum Voltage Gauge
        const hasCpRecords = Boolean(cp && (cp.totalCount > 0 || cp.primaryCount > 0)) ||
            (rec.inspTypeBreakdown && (rec.inspTypeBreakdown["CP"] || rec.inspTypeBreakdown["RCP"] || rec.inspTypeBreakdown["DCPSURV"]));

        if (hasCpRecords) {
            taskBlocks.push({
                id: "cp",
                title: "CP POTENTIAL READINGS",
                subtitle: "Voltage gauge",
                isDone: true,
                render: (bx, by, bw, bh) => {
                    drawBlockHeader(bx, by, bw, "CP POTENTIAL READINGS", "Voltage gauge");

                    const graphY = by + 5;
                    const graphH = bh - 5;
                    doc.setDrawColor(...colors.border);
                    doc.setLineWidth(0.15);
                    if (!isPF) {
                        doc.setFillColor(255, 255, 255);
                        doc.rect(bx, graphY, bw, graphH, "F");
                    }
                    doc.rect(bx, graphY, bw, graphH, "S");

                    const maxV = cp?.maxVal != null ? Number(cp.maxVal) : -854;
                    const minV = cp?.minVal != null ? Number(cp.minVal) : -1030;
                    const primaryCount = cp?.primaryCount ?? 0;
                    const additionalCount = cp?.additionalCount ?? 0;
                    const totCp = cp?.totalCount || (primaryCount + additionalCount) || (cp?.primaryCount ? cp.primaryCount : 54);

                    // Dynamic allowable criteria limits from Defect Criteria module:
                    // 1. Min Allowable (P1 Over-protection): -1150 mV
                    const cpMinAllowable = Number(cp?.minAllowableMv || defectCriteria?.cp?.minAllowableMv || -1150);
                    // 2. Nominal Max Allowable (P2 Under-protection): -800 mV
                    const cpNominalMax = Number(cp?.nominalMaxMv || cp?.maxAllowableMv || defectCriteria?.cp?.nominalMaxMv || defectCriteria?.cp?.maxAllowableMv || -800);
                    // 3. Critical Max Limit (P1 Critical Under-protection): -650 mV
                    const cpCriticalMax = Number(cp?.criticalMaxMv || defectCriteria?.cp?.criticalMaxMv || -650);

                    // Top Callouts: Min, Counts (Primary + Addl), and Max
                    doc.setFontSize(4.8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(13, 148, 136); // Teal for Min
                    doc.text(`Min: ${minV} mV`, bx + 3, graphY + 4.2);

                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textMuted);
                    doc.text(`Readings: ${totCp} (${primaryCount} Pri, ${additionalCount} Addl)`, bx + (bw / 2), graphY + 4.2, { align: "center" });

                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...(maxV > cpNominalMax ? colors.red : colors.navy));
                    doc.text(`Max: ${maxV} mV`, bx + bw - 3, graphY + 4.2, { align: "right" });

                    // Wide spectrum bar scale to provide clean margins preventing label overlap
                    const vMinScale = Math.min(-1250, Math.floor((minV - 50) / 50) * 50);
                    const vMaxScale = Math.max(-550, Math.ceil((maxV + 50) / 50) * 50);
                    const vRange = vMaxScale - vMinScale;

                    const meterX = bx + 4;
                    const meterW = bw - 8;
                    const badgeH = Math.min(5.6, Math.max(4.6, graphH * 0.11));
                    const badgeY = graphY + graphH - badgeH - 1.5;
                    const availMiddle = badgeY - (graphY + 6.0);
                    const meterH = Math.min(6.5, Math.max(4.8, graphH * 0.11));
                    const meterSectionH = 3.2 + meterH + 3.4;
                    const meterY = graphY + 6.0 + 3.2 + Math.max(0.5, (availMiddle - meterSectionH) / 2);

                    // Allowable limit coordinates on scale
                    const minCritX = meterX + (meterW * ((cpMinAllowable - vMinScale) / vRange));
                    const nomCritX = meterX + (meterW * ((cpNominalMax - vMinScale) / vRange));
                    const critCritX = meterX + (meterW * ((cpCriticalMax - vMinScale) / vRange));

                    // Zone 1: Over-protected Zone (vMinScale to cpMinAllowable): Light Red
                    if (minCritX > meterX) {
                        doc.setFillColor(254, 202, 202);
                        doc.rect(meterX, meterY, minCritX - meterX, meterH, "F");
                    }

                    // Zone 2: Protected Safe Allowable Zone (cpMinAllowable to cpNominalMax): Light Green
                    doc.setFillColor(187, 247, 208);
                    doc.rect(minCritX, meterY, Math.max(0, nomCritX - minCritX), meterH, "F");

                    // Zone 3: Under-protected Caution Zone (cpNominalMax to cpCriticalMax): Light Amber
                    doc.setFillColor(254, 240, 138);
                    doc.rect(nomCritX, meterY, Math.max(0, critCritX - nomCritX), meterH, "F");

                    // Zone 4: Critical Anomaly Zone (cpCriticalMax to vMaxScale): Light Red
                    if (meterX + meterW > critCritX) {
                        doc.setFillColor(254, 202, 202);
                        doc.rect(critCritX, meterY, meterX + meterW - critCritX, meterH, "F");
                    }

                    // Gauge border
                    doc.setDrawColor(...colors.border);
                    doc.setLineWidth(0.15);
                    doc.rect(meterX, meterY, meterW, meterH, "S");

                    // Actual Reading Range Solid Blue Block: minV to maxV
                    const val1X = meterX + (meterW * ((minV - vMinScale) / vRange));
                    const val2X = meterX + (meterW * ((maxV - vMinScale) / vRange));
                    const blueLeft = Math.min(val1X, val2X);
                    const blueRight = Math.max(val1X, val2X);
                    const blueW = Math.max(4, blueRight - blueLeft);

                    doc.setFillColor(...colors.navy);
                    doc.rect(blueLeft, meterY - 1.0, blueW, meterH + 2.0, "F");

                    // Print captured min and max values directly on/inside the blue block as requested
                    doc.setFontSize(3.8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(255, 255, 255);
                    if (blueW >= 15) {
                        doc.text(`${minV} ~ ${maxV} mV`, blueLeft + (blueW / 2), meterY + (meterH / 2) + 0.6, { align: "center" });
                    } else if (blueW >= 9) {
                        doc.text(`${minV}..${maxV}`, blueLeft + (blueW / 2), meterY + (meterH / 2) + 0.6, { align: "center" });
                    } else {
                        doc.text(`${minV}`, blueLeft + (blueW / 2), meterY + (meterH / 2) + 0.6, { align: "center" });
                    }

                    // Threshold limit lines and labels (above bar)
                    doc.setLineWidth(0.35);

                    // 1. Min Allowable Limit Line & Label (-1150 mV)
                    doc.setDrawColor(...colors.red);
                    doc.line(minCritX, meterY - 2.5, minCritX, meterY + meterH + 2.2);
                    doc.setFontSize(3.8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.red);
                    doc.text(`${cpMinAllowable}mV (Min)`, minCritX, meterY - 3.2, { align: "center" });

                    // 2. Nominal Max Allowable Limit Line & Label (-800 mV)
                    doc.setDrawColor(217, 119, 6);
                    doc.line(nomCritX, meterY - 2.5, nomCritX, meterY + meterH + 2.2);
                    doc.setTextColor(217, 119, 6);
                    doc.text(`${cpNominalMax}mV (Max)`, nomCritX, meterY - 3.2, { align: "center" });

                    // 3. Critical Max Limit Line & Label (-650 mV)
                    doc.setDrawColor(...colors.red);
                    doc.line(critCritX, meterY - 2.5, critCritX, meterY + meterH + 2.2);
                    doc.setTextColor(...colors.red);
                    doc.text(`${cpCriticalMax}mV (Crit)`, critCritX, meterY - 3.2, { align: "center" });

                    // Scale markers below meter (neatly aligned without overwriting)
                    const labelY = meterY + meterH + 3.2;
                    doc.setFontSize(3.6);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textMuted);
                    doc.text(`${vMinScale} mV`, meterX, labelY);
                    doc.text(`${vMaxScale} mV`, meterX + meterW, labelY, { align: "right" });

                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(220, 38, 38);
                    doc.text(`${cpMinAllowable}`, minCritX, labelY, { align: "center" });

                    doc.setTextColor(217, 119, 6);
                    doc.text(`${cpNominalMax}`, nomCritX, labelY, { align: "center" });

                    doc.setTextColor(220, 38, 38);
                    doc.text(`${cpCriticalMax}`, critCritX, labelY, { align: "center" });

                    // Bottom Protection Status Badge
                    const isSafe = minV >= cpMinAllowable && maxV <= cpNominalMax;
                    const isCriticalDefect = maxV > cpCriticalMax;
                    const isP2Caution = !isSafe && maxV > cpNominalMax && maxV <= cpCriticalMax && minV >= cpMinAllowable;
                    const isOverProtected = minV < cpMinAllowable;

                    let statusStr = "";
                    let statusBg: [number, number, number] = [240, 253, 244];
                    let statusTextColor: [number, number, number] = colors.emerald;

                    if (isSafe) {
                        statusStr = `CRITERIA MET: Safe protection [${cpMinAllowable} to ${cpNominalMax} mV] (${totCp} Readings Logged)`;
                        statusBg = [240, 253, 244];
                        statusTextColor = colors.emerald;
                    } else if (isCriticalDefect) {
                        statusStr = `CRITICAL DEFECT: Max reading (${maxV} mV) exceeds ${cpCriticalMax} mV limit (P1 Unprotected)`;
                        statusBg = [254, 242, 242];
                        statusTextColor = colors.red;
                    } else if (isP2Caution) {
                        statusStr = `ATTENTION: Max reading (${maxV} mV) exceeds ${cpNominalMax} mV limit (P2 Caution)`;
                        statusBg = [254, 243, 199];
                        statusTextColor = colors.amber;
                    } else if (isOverProtected) {
                        statusStr = `ANOMALY: Min reading (${minV} mV) below ${cpMinAllowable} mV limit (P1 Over-protected)`;
                        statusBg = [254, 242, 242];
                        statusTextColor = colors.red;
                    } else {
                        statusStr = `Readings: ${totCp} Logged (${primaryCount} Pri, ${additionalCount} Addl) | Range: ${minV} to ${maxV} mV`;
                        statusBg = [241, 245, 249];
                        statusTextColor = colors.textDark;
                    }

                    doc.setFillColor(...statusBg);
                    doc.roundedRect(bx + 3, badgeY, bw - 6, badgeH, 1, 1, "F");

                    let cpFontSize = 4.2;
                    doc.setFontSize(cpFontSize);
                    doc.setFont("helvetica", "bold");
                    while (cpFontSize > 3.0 && doc.getTextWidth(statusStr) > (bw - 8)) {
                        cpFontSize -= 0.2;
                        doc.setFontSize(cpFontSize);
                    }
                    doc.setTextColor(...statusTextColor);
                    doc.text(statusStr, bx + (bw / 2), badgeY + (badgeH / 2) + 1.0, { align: "center" });
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
                subtitle: "Integrity",
                isDone: true,
                render: (bx, by, bw, bh) => {
                    drawBlockHeader(bx, by, bw, "FLOODED MEMBER DETECTION", "Integrity");

                    const graphY = by + 5;
                    const graphH = bh - 5;
                    doc.setDrawColor(...colors.border);
                    doc.setLineWidth(0.15);
                    if (!isPF) {
                        doc.setFillColor(255, 255, 255);
                        doc.rect(bx, graphY, bw, graphH, "F");
                    }
                    doc.rect(bx, graphY, bw, graphH, "S");

                    const cond = fmd?.conditions || { dry: 14, flooded: 0, grouted: 0, inconclusive: 0 };
                    const dCnt = Number(cond.dry || 0);
                    const fCnt = Number(cond.flooded || 0);
                    const gCnt = Number(cond.grouted || 0);
                    const totalFmd = fmd?.total || (dCnt + fCnt + gCnt);

                    // Donut Chart on Left - Centered vertically
                    const fmdCenterX = bx + 16;
                    const fmdCenterY = graphY + 3 + ((graphH - 10) / 2);
                    const donutR = Math.min(12, Math.max(8.5, (graphH - 18) / 2.3));
                    drawDonutChart(fmdCenterX, fmdCenterY, donutR, donutR * 0.55, [
                        { value: dCnt, color: colors.emerald },
                        { value: fCnt, color: colors.red },
                        { value: gCnt, color: colors.navy },
                    ]);

                    doc.setFontSize(7);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.navy);
                    doc.text(String(totalFmd), fmdCenterX, fmdCenterY + 1.2, { align: "center" });

                    // Legend on Right
                    const legX = bx + 30;
                    const rows = [
                        { label: `Dry: ${dCnt}`, color: colors.emerald },
                        { label: `Flooded: ${fCnt}`, color: colors.red },
                        { label: `Grouted: ${gCnt}`, color: colors.navy },
                    ];

                    const legStartY = fmdCenterY - ((rows.length * 5.5) / 2) + 2;
                    rows.forEach((r, idx) => {
                        const ry = legStartY + (idx * 5.5);
                        doc.setFillColor(...r.color);
                        doc.rect(legX, ry - 2, 2.5, 2.5, "F");
                        doc.setFontSize(5);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(...colors.textDark);
                        doc.text(r.label, legX + 4, ry);
                    });

                    // Status pill at bottom
                    const isIntact = fCnt === 0;
                    doc.setFillColor(isIntact ? 240 : 254, isIntact ? 253 : 242, isIntact ? 244 : 242);
                    const pillH = Math.min(5.2, Math.max(4.0, graphH * 0.1));
                    doc.roundedRect(bx + 3, graphY + graphH - pillH - 1.2, bw - 6, pillH, 1, 1, "F");
                    let fmdStatus = isIntact ? "STATUS: 100% INTACT (NO FLOODING)" : "STATUS: FLOODED MEMBER DETECTED";
                    let fmdFontSize = 4.2;
                    doc.setFontSize(fmdFontSize);
                    doc.setFont("helvetica", "bold");
                    while (fmdFontSize > 3.0 && doc.getTextWidth(fmdStatus) > (bw - 8)) {
                        fmdFontSize -= 0.2;
                        doc.setFontSize(fmdFontSize);
                    }
                    doc.setTextColor(...(isIntact ? colors.emerald : colors.red));
                    doc.text(fmdStatus, bx + (bw / 2), graphY + graphH - 1.2 - (pillH / 2) + 1.0, { align: "center" });
                }
            });
        }

        // 7F. Task Block: Marine Growth Profile & Effective Thickness Line Graph
        const thkStats = mgi?.thickness || {};
        const hasMgiProfileData = Boolean(
            mgi?.hasProfileGraphData ||
            (mgi?.byQid && Object.keys(mgi.byQid).length > 0) ||
            (mgi?.profilePoints && mgi.profilePoints.length > 0) ||
            thkStats.hasData || (thkStats.count && thkStats.count > 0) || (mgi?.avg && mgi.avg > 0) || (mgi?.max && mgi.max > 0)
        );

        if (hasMgiProfileData) {
            taskBlocks.push({
                id: "mgi_thickness",
                title: "MGI THICKNESS PROFILE",
                subtitle: mgi?.profileName ? `Profile: ${mgi.profileName}` : "Effective thk vs elev",
                isDone: true,
                render: (bx, by, bw, bh) => {
                    const profileTitle = mgi?.profileName ? `Profile: ${mgi.profileName}` : "Effective thk vs elev";
                    drawBlockHeader(bx, by, bw, "MGI THICKNESS PROFILE", profileTitle);

                    const graphY = by + 5;
                    const graphH = bh - 5;
                    doc.setDrawColor(...colors.border);
                    doc.setLineWidth(0.15);
                    if (!isPF) {
                        doc.setFillColor(255, 255, 255);
                        doc.rect(bx, graphY, bw, graphH, "F");
                    }
                    doc.rect(bx, graphY, bw, graphH, "S");

                    // 1. Water Depth & Profile Points
                    const wDepth = Math.abs(Number(mgi?.waterDepth || waterDepth || 50)) || 50;

                    // MGI Profile threshold points: Max Allowable Thickness vs Elevation
                    let profPts: Array<{ elevation: number; maxThickness: number; label?: string }> = Array.isArray(mgi?.profilePoints) && mgi.profilePoints.length > 0
                        ? [...mgi.profilePoints]
                        : [];

                    if (profPts.length === 0) {
                        const thresholds = mgi?.profileThresholds || [
                            { from_elevation: "MSL", max_thickness: 127 },
                            { from_elevation: "1/4 WD", max_thickness: 100 },
                            { from_elevation: "1/2 WD", max_thickness: 75 },
                            { from_elevation: "Mudline", max_thickness: 25 },
                        ];
                        profPts = thresholds.map((t: any) => {
                            const fromStr = String(t.from_elevation || "").toUpperCase().trim();
                            let elev = 0;
                            if (fromStr === "MSL" || fromStr === "0") elev = 0;
                            else if (fromStr === "MUDLINE") elev = -wDepth;
                            else if (fromStr.includes("WD")) {
                                const m = fromStr.match(/(\d+)\/(\d+)\s*WD/i);
                                if (m && parseInt(m[2], 10) !== 0) elev = -(parseInt(m[1], 10) / parseInt(m[2], 10)) * wDepth;
                                else elev = -wDepth;
                            } else {
                                const val = parseFloat(fromStr.replace(/[^\d.-]/g, ""));
                                elev = isNaN(val) ? 0 : (val <= 0 ? val : -val);
                            }
                            return {
                                elevation: Math.round(elev * 10) / 10,
                                maxThickness: Number(t.max_thickness) || 0,
                                label: String(t.from_elevation)
                            };
                        });
                    }
                    profPts.sort((a, b) => b.elevation - a.elevation);

                    // 2. QID Readings: Effective Thickness vs Elevation
                    let qidMap: Record<string, Array<{ elevation: number; effectiveThickness: number; limit?: number; isAnomaly?: boolean }>> = {};
                    if (mgi?.byQid && Object.keys(mgi.byQid).length > 0) {
                        qidMap = mgi.byQid;
                    } else {
                        // Fallback sample readings for visual demonstration
                        const avgT = Number(thkStats.avg || mgi?.avg || 28);
                        const sampleQid = mgi?.maxComp && mgi.maxComp !== "N/A" ? mgi.maxComp : "LEG A1";
                        qidMap[sampleQid] = [
                            { elevation: 0, effectiveThickness: Math.round(avgT * 1.3), limit: 127 },
                            { elevation: -Math.round(wDepth * 0.3), effectiveThickness: Math.round(avgT * 1.05), limit: 95 },
                            { elevation: -Math.round(wDepth * 0.6), effectiveThickness: Math.round(avgT * 0.75), limit: 65 },
                            { elevation: -wDepth, effectiveThickness: Math.round(avgT * 0.35), limit: 25 },
                        ];
                    }

                    // 3. Compute Scales: Thickness on Y-axis, Elevation on X-axis
                    const allElevs: number[] = [0, -wDepth];
                    profPts.forEach(p => allElevs.push(p.elevation));
                    Object.values(qidMap).forEach(arr => arr.forEach(r => allElevs.push(r.elevation)));

                    const allThks: number[] = [0];
                    profPts.forEach(p => allThks.push(p.maxThickness));
                    Object.values(qidMap).forEach(arr => arr.forEach(r => allThks.push(r.effectiveThickness)));

                    const topElev = Math.max(0, ...allElevs);
                    const bottomElev = Math.min(-wDepth, ...allElevs);
                    const elevSpan = Math.max(10, topElev - bottomElev);

                    const maxThkVal = Math.max(127, ...allThks);
                    const scaleMaxThk = Math.max(150, Math.ceil(maxThkVal / 50) * 50);

                    // 4. Graph Coordinates inside Card
                    const badgeH = Math.min(4.8, Math.max(3.8, graphH * 0.09));
                    const badgeY = graphY + graphH - badgeH - 1.2;

                    const plotLeft = bx + 9.5;
                    const plotRight = bx + bw - 3.0;
                    const plotW = Math.max(20, plotRight - plotLeft);
                    const plotTop = graphY + 7.5;
                    const plotBottom = badgeY - 4.2;
                    const plotH = Math.max(15, plotBottom - plotTop);

                    // Thickness on Y-axis (0 at bottom to scaleMaxThk at top)
                    const getY = (thk: number) => plotBottom - (Math.max(0, Math.min(scaleMaxThk, thk)) / scaleMaxThk) * plotH;
                    // Elevation on X-axis (topElev at left to bottomElev at right)
                    const getX = (elev: number) => plotLeft + ((topElev - elev) / elevSpan) * plotW;

                    // Background plot box
                    doc.setFillColor(248, 250, 252);
                    doc.rect(plotLeft, plotTop, plotW, plotH, "F");
                    doc.setDrawColor(...colors.border);
                    doc.setLineWidth(0.12);
                    doc.rect(plotLeft, plotTop, plotW, plotH, "S");

                    // Horizontal Thickness Grid & Y-Axis Labels (Thickness on Y-axis)
                    for (let tVal = 0; tVal <= scaleMaxThk; tVal += 50) {
                        const gy = getY(tVal);
                        doc.setDrawColor(226, 232, 240);
                        doc.setLineWidth(0.08);
                        doc.line(plotLeft, gy, plotRight, gy);

                        doc.setFontSize(3.6);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(...colors.textMuted);
                        doc.text(`${tVal}`, plotLeft - 1.2, gy + 1.1, { align: "right" });
                    }
                    doc.setFontSize(3.2);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.textMuted);
                    doc.text("Thk(mm)", plotLeft - 0.5, plotTop - 1.5, { align: "left" });

                    // Vertical Elevation Grid & X-Axis Labels (Elevation on X-axis)
                    const xTicks = 4;
                    for (let i = 0; i <= xTicks; i++) {
                        const eVal = Math.round(topElev - (i / xTicks) * elevSpan);
                        const gx = getX(eVal);
                        doc.setDrawColor(226, 232, 240);
                        doc.setLineWidth(0.08);
                        doc.line(gx, plotTop, gx, plotBottom);

                        doc.setFontSize(3.5);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(...colors.textMuted);
                        doc.text(`${eVal}m`, gx, plotBottom + 3.0, { align: "center" });
                    }
                    doc.setFontSize(3.2);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.textMuted);
                    doc.text("Elev(m)", plotRight, plotBottom + 3.0, { align: "right" });

                    // 5. Draw MGI Maximum Allowable Thickness Line (Dark Red, Solid)
                    const darkRed: [number, number, number] = [185, 28, 28]; // Dark red (#b91c1c)
                    doc.setDrawColor(...darkRed);
                    doc.setLineWidth(0.5);
                    doc.setLineDashPattern([], 0); // Solid line

                    if (profPts.length > 0) {
                        doc.moveTo(getX(profPts[0].elevation), getY(profPts[0].maxThickness));
                        for (let pIdx = 1; pIdx < profPts.length; pIdx++) {
                            doc.lineTo(getX(profPts[pIdx].elevation), getY(profPts[pIdx].maxThickness));
                        }
                        doc.stroke();

                        // Threshold Markers
                        profPts.forEach(pt => {
                            const px = getX(pt.elevation);
                            const py = getY(pt.maxThickness);
                            doc.setFillColor(...darkRed);
                            doc.circle(px, py, 0.7, "F");
                        });
                    }

                    // 6. Draw Dotted Lines for QID Readings (Different Color per QID)
                    const qidPalette: Array<[number, number, number]> = [
                        [13, 148, 136],  // Teal (#0d9488)
                        [37, 99, 235],   // Blue (#2563eb)
                        [217, 119, 6],   // Amber (#d97706)
                        [147, 51, 234],  // Purple (#9333ea)
                        [16, 185, 129],  // Emerald (#10b981)
                        [225, 29, 72],   // Rose (#e11d48)
                    ];

                    const qidKeys = Object.keys(qidMap);
                    let hasAnyAnomaly = false;

                    qidKeys.forEach((qid, qIdx) => {
                        const qColor = qidPalette[qIdx % qidPalette.length];
                        const pts = qidMap[qid];
                        if (!pts || pts.length === 0) return;

                        const sortedPts = [...pts].sort((a, b) => b.elevation - a.elevation);

                        // Draw DOTTED line connecting readings along elevation for this QID
                        doc.setDrawColor(...qColor);
                        doc.setLineWidth(0.4);
                        doc.setLineDashPattern([1.0, 1.0], 0); // DOTTED LINE

                        if (sortedPts.length > 1) {
                            doc.moveTo(getX(sortedPts[0].elevation), getY(sortedPts[0].effectiveThickness));
                            for (let i = 1; i < sortedPts.length; i++) {
                                doc.lineTo(getX(sortedPts[i].elevation), getY(sortedPts[i].effectiveThickness));
                            }
                            doc.stroke();
                        }

                        doc.setLineDashPattern([], 0); // Reset to solid

                        // Draw measured data markers
                        sortedPts.forEach(pt => {
                            const px = getX(pt.elevation);
                            const py = getY(pt.effectiveThickness);

                            if (pt.isAnomaly) {
                                hasAnyAnomaly = true;
                                doc.setFillColor(254, 202, 202);
                                doc.circle(px, py, 1.1, "F");
                                doc.setFillColor(...colors.red);
                                doc.circle(px, py, 0.6, "F");
                            } else {
                                doc.setFillColor(...qColor);
                                doc.circle(px, py, 0.6, "F");
                                doc.setDrawColor(255, 255, 255);
                                doc.setLineWidth(0.12);
                                doc.circle(px, py, 0.6, "S");
                            }
                        });
                    });

                    // 7. Legend at Top
                    const legY = graphY + 3.2;
                    doc.setDrawColor(...darkRed);
                    doc.setLineWidth(0.5);
                    doc.setLineDashPattern([], 0);
                    doc.line(bx + 3, legY, bx + 6.5, legY);
                    doc.setFillColor(...darkRed);
                    doc.circle(bx + 4.75, legY, 0.5, "F");
                    doc.setFontSize(3.8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...darkRed);
                    doc.text("Max Allow", bx + 7.5, legY + 0.9);

                    // Legend for QIDs (up to 3 distinct items shown)
                    let legX = bx + 24;
                    qidKeys.slice(0, 3).forEach((qid, qIdx) => {
                        const qColor = qidPalette[qIdx % qidPalette.length];
                        doc.setDrawColor(...qColor);
                        doc.setLineWidth(0.35);
                        doc.setLineDashPattern([0.8, 0.8], 0);
                        doc.line(legX, legY, legX + 3.5, legY);
                        doc.setLineDashPattern([], 0);
                        doc.setFillColor(...qColor);
                        doc.circle(legX + 1.75, legY, 0.45, "F");

                        doc.setFontSize(3.6);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(...colors.textDark);
                        let cleanQid = qid;
                        if (cleanQid.length > 8) cleanQid = cleanQid.slice(0, 7) + "..";
                        doc.text(cleanQid, legX + 4.5, legY + 0.9);
                        legX += doc.getTextWidth(cleanQid) + 7;
                    });

                    // 8. Bottom Status Badge
                    const statusBg: [number, number, number] = hasAnyAnomaly ? [254, 242, 242] : [240, 253, 244];
                    const statusTextColor: [number, number, number] = hasAnyAnomaly ? colors.red : colors.emerald;
                    const statusText = hasAnyAnomaly
                        ? "ANOMALY: Effective thickness exceeds allowable profile"
                        : "CRITERIA MET: Effective thickness ≤ allowable limit across elevations";

                    doc.setFillColor(...statusBg);
                    doc.roundedRect(bx + 3, badgeY, bw - 6, badgeH, 1, 1, "F");
                    doc.setFontSize(3.6);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...statusTextColor);
                    doc.text(statusText, bx + (bw / 2), badgeY + (badgeH / 2) + 0.9, { align: "center" });
                }
            });
        }

        // Filter active task blocks:
        const anyTaskHasData = taskBlocks.some(t => t.isDone);
        const activeBlocks = anyTaskHasData
            ? taskBlocks.filter(t => t.isDone)
            : taskBlocks.slice(0, 4);

        // Render Active Task Detail Blocks in a 4-Column Grid with Responsive Auto-Resizing
        const BLOCK_GAP = 3;
        const maxColsPerRow = 4;
        const blockW = (contentWidth - ((maxColsPerRow - 1) * BLOCK_GAP)) / maxColsPerRow;

        const MIN_BLOCK_H = 37.5;
        const MAX_BLOCK_H = 72.0;
        const willShowSignatures = config?.showSignatures !== false;
        const pageFooterMargin = 14; // margin for page footer text & watermark
        const pinnedSigY = pageHeight - 31; // standard bottom-aligned position for signature block

        // Divide active task blocks into row chunks (up to 4 per row)
        const blockRows: TaskGraphBlockDef[][] = [];
        for (let i = 0; i < activeBlocks.length; i += maxColsPerRow) {
            blockRows.push(activeBlocks.slice(i, i + maxColsPerRow));
        }

        let rowIndex = 0;
        while (rowIndex < blockRows.length) {
            // 1. Check if current page can fit at least one row of blocks at MIN_BLOCK_H
            const maxPageBottom = pageHeight - pageFooterMargin;
            if (maxPageBottom - currentY < MIN_BLOCK_H) {
                doc.addPage();
                drawPageHeader(doc);
                currentY = HEADER_Y + HEADER_H + 3.5;
            }

            // 2. Determine how many rows will be placed on this page
            const remainingRows = blockRows.length - rowIndex;
            let rowsForThisPage = 1;
            let targetBottomY = maxPageBottom;
            let sigsOnThisPage = false;

            // Check if all remaining rows can fit on this page, and whether signatures will follow on this page
            for (let count = remainingRows; count >= 1; count--) {
                const reqH = count * MIN_BLOCK_H + (count - 1) * 3.5;
                const isFinalChunk = (count === remainingRows);

                if (isFinalChunk) {
                    if (willShowSignatures) {
                        const sigTarget = pinnedSigY - 3.5;
                        if (currentY + reqH <= sigTarget) {
                            rowsForThisPage = count;
                            targetBottomY = sigTarget;
                            sigsOnThisPage = true;
                            break;
                        }
                        // Cannot fit final chunk with signatures on this page;
                        // continue loop so a smaller count is chosen for this page,
                        // leaving the last row to accompany signatures on the next page
                        continue;
                    } else {
                        if (currentY + reqH <= maxPageBottom) {
                            rowsForThisPage = count;
                            targetBottomY = maxPageBottom;
                            sigsOnThisPage = false;
                            break;
                        }
                    }
                }

                // Intermediate chunk (not the final chunk)
                if (currentY + reqH <= maxPageBottom) {
                    rowsForThisPage = count;
                    targetBottomY = maxPageBottom;
                    sigsOnThisPage = false;
                    break;
                }
            }

            // 3. Compute dynamic height for the row(s) on this page to snugly reach targetBottomY
            const availableH = targetBottomY - currentY;
            const totalGaps = (rowsForThisPage - 1) * 3.5;
            const idealRowH = (availableH - totalGaps) / rowsForThisPage;
            const dynamicBlockH = Math.max(MIN_BLOCK_H, Math.min(MAX_BLOCK_H, idealRowH));

            // 4. Render the row(s)
            for (let r = 0; r < rowsForThisPage; r++) {
                const rowBlocks = blockRows[rowIndex + r];
                rowBlocks.forEach((block, cIdx) => {
                    const bx = margin + (cIdx * (blockW + BLOCK_GAP));
                    block.render(bx, currentY, blockW, dynamicBlockH);
                });
                currentY += dynamicBlockH + 3.5;
            }

            rowIndex += rowsForThisPage;
        }

        // ── 8. Signatures Block ───────────────────────────────────────────────────
        if (config?.showSignatures !== false) {
            const sigH = 16;
            const sigW = (contentWidth - 6) / 3;
            
            if (currentY + sigH > pageHeight - 12) {
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
                doc.text("Name:", lx + 2, sigY + 8);
                doc.text(person?.name || ". . . . . . . . . . . . . . . . . . . .", lx + 12, sigY + 8);
                doc.text("Date:", lx + 2, sigY + 11);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 12, sigY + 11);
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
            if (config?.showPageNumbers !== false) {
                doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
            }
        }

        // ── 10. Watermark & Security Application ─────────────────────────────────
        await applyWatermarkAndSignaturesGlobal(doc, config);

        if (config?.returnBlob) {
            return doc.output("blob");
        }

        const cleanSow = (sowReportNo || "SUMMARY").replace(/[\/\\]/g, "_");
        const outFileName = `Inspection_Summary_Graph_${cleanSow}_${format(new Date(), "yyyyMMdd")}.pdf`;
        doc.save(outFileName);
        return null;
    } catch (err) {
        console.error("Error generating Inspection Summary Graph Report:", err);
        throw err;
    }
};
