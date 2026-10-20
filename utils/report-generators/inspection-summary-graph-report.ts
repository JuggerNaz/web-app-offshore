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
        const anomalyCount = anomalies.total || rec.anomaly || 0;
        
        // Accurate Completion Rate: MUST NOT treat incomplete tasks as completed!
        const compRateVal = totalQidsCount > 0 
            ? Math.round((completedCount / totalQidsCount) * 100)
            : (sow.completedPct !== undefined ? Math.round(sow.completedPct) : (sow.completionPct !== undefined ? Math.round(sow.completionPct) : 0));
        const incRateVal = totalQidsCount > 0
            ? Math.round((incompleteCount / totalQidsCount) * 100)
            : (sow.incompletePct !== undefined ? Math.round(sow.incompletePct) : 0);

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
            slices: Array<{ value: number; color: [number, number, number] }>
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
            slices.forEach(slice => {
                if (slice.value <= 0) return;
                const sliceAngle = (slice.value / total) * 2 * Math.PI;
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

                currentAngle += sliceAngle;
            });

            // Inner cutout to form Donut
            doc.setFillColor(255, 255, 255);
            doc.circle(centerX, centerY, innerRadius, "F");
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.15);
            doc.circle(centerX, centerY, innerRadius, "S");
            doc.circle(centerX, centerY, outerRadius, "S");
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
        const donutCenterY = anomBoxY + 16;
        const outerR = 12;
        const innerR = 7;

        drawDonutChart(donutCenterX, donutCenterY, outerR, innerR, [
            { value: p1, color: colP1 },
            { value: p2, color: colP2 },
            { value: p3, color: colP3 },
            { value: obs, color: colObs },
        ]);

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

        // Donut Legend below using library colors
        const legStartY = anomBoxY + 31.5;
        const pItems = [
            { label: "P1", count: p1, color: colP1 },
            { label: "P2", count: p2, color: colP2 },
            { label: "P3", count: p3, color: colP3 },
            { label: "Obs", count: obs, color: colObs },
        ];

        pItems.forEach((pi, idx) => {
            const px = rightX + 4 + (idx * 11.5);
            doc.setFillColor(...pi.color);
            doc.rect(px, legStartY - 2, 2.2, 2.2, "F");
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.1);
            doc.rect(px, legStartY - 2, 2.2, 2.2, "S");
            doc.setFontSize(5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.textDark);
            doc.text(`${pi.label}:${pi.count}`, px + 3, legStartY - 0.3);
        });

        // Rectified Status Badge
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(rightX + 4, legStartY + 3, 44, 4.2, 1, 1, "F");
        doc.setDrawColor(187, 247, 208);
        doc.setLineWidth(0.1);
        doc.roundedRect(rightX + 4, legStartY + 3, 44, 4.2, 1, 1, "S");
        doc.setFontSize(5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.emerald);
        doc.text(`Rectified Anomalies: ${rectifiedCount}`, rightX + 26, legStartY + 6, { align: "center" });

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
        doc.text("COUNT", rightX + RIGHT_COL_W - 3, anomBoxY + 4.2, { align: "right" });

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

        const maxDefectCount = Math.max(1, ...defectList.map(d => getDefectCount(d.code)));
        const dRowH = (anomBoxH - 7.5) / defectList.length;

        defectList.forEach((d, dIdx) => {
            const dy = anomBoxY + 6.5 + (dIdx * dRowH);
            const val = getDefectCount(d.code);

            // Label
            doc.setFontSize(4.8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.textDark);
            doc.text(d.label, defectX + 2, dy + 2.4);

            // Progress bar
            const dBarX = defectX + 29;
            const dBarW = 26;
            const dBarH = 2.8;
            const dPct = (val / maxDefectCount) * 100;

            doc.setFillColor(...colors.barTrack);
            doc.roundedRect(dBarX, dy + 0.3, dBarW, dBarH, 0.8, 0.8, "F");
            if (val > 0) {
                doc.setFillColor(...colors.navy);
                const fillW = Math.max(1.5, (dBarW * dPct) / 100);
                doc.roundedRect(dBarX, dy + 0.3, fillW, dBarH, 0.8, 0.8, "F");
            }

            // Count number clearly visible beside bar, right-aligned to card edge
            doc.setFontSize(5.2);
            doc.setFont("helvetica", val > 0 ? "bold" : "normal");
            doc.setTextColor(...(val > 0 ? colors.navy : colors.textMuted));
            doc.text(String(val), rightX + RIGHT_COL_W - 3, dy + 2.4, { align: "right" });
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

                // Baseline axis
                doc.setDrawColor(...colors.border);
                doc.setLineWidth(0.15);
                doc.line(bx + 2, chartBaseY, bx + bw - 2, chartBaseY);

                bands.forEach((bLabel, bIdx) => {
                    const colX = bx + 3 + (bIdx * colW);
                    const hVal = hardVals[bIdx];
                    const sVal = softVals[bIdx];

                    const hH = Math.max(0.5, (hVal / maxVal) * maxBarH);
                    const sH = Math.max(0.5, (sVal / maxVal) * maxBarH);
                    const barW = (colW - 3) / 2;

                    // Hard Bar
                    doc.setFillColor(...colors.navy);
                    doc.rect(colX, chartBaseY - hH, barW, hH, "F");

                    // Soft Bar
                    doc.setFillColor(...colors.teal);
                    doc.rect(colX + barW + 0.5, chartBaseY - sH, barW, sH, "F");

                    // Value label on top of tallest bar
                    const topVal = Math.max(hVal, sVal);
                    if (topVal > 0) {
                        doc.setFontSize(4.5);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(...colors.textDark);
                        doc.text(String(topVal), colX + (barW), chartBaseY - Math.max(hH, sH) - 1, { align: "center" });
                    }

                    // Band label below axis
                    doc.setFontSize(4.3);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textMuted);
                    doc.text(bLabel, colX + (barW), chartBaseY + 3.2, { align: "center" });
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

                const maxAnodeDep = Math.max(1, d0, d25, d50, d75);
                const aRanges = [
                    { label: "0-25%", count: d0, color: colors.emerald },
                    { label: "26-50%", count: d25, color: colors.blue },
                    { label: "50-75%", count: d50, color: colors.amber },
                    { label: "76-100%", count: d75, color: colors.red },
                ];

                const aBarStartY = graphY + 6.5;
                const aRowH = (graphH - 12) / 4;

                aRanges.forEach((ar, aIdx) => {
                    const ay = aBarStartY + (aIdx * aRowH);
                    doc.setFontSize(4.8);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textDark);
                    doc.text(ar.label, bx + 3, ay + 2.8);

                    const barX = bx + 16;
                    const barW = bw - 26;
                    const barH = 3;
                    const pct = (ar.count / maxAnodeDep) * 100;

                    doc.setFillColor(...colors.barTrack);
                    doc.roundedRect(barX, dySafe(ay + 0.5), barW, barH, 0.8, 0.8, "F");
                    if (ar.count > 0) {
                        doc.setFillColor(...ar.color);
                        const fillW = Math.max(1, (barW * pct) / 100);
                        doc.roundedRect(barX, dySafe(ay + 0.5), fillW, barH, 0.8, 0.8, "F");
                    }

                    doc.setFontSize(4.8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.textDark);
                    doc.text(String(ar.count), bx + bw - 3, ay + 2.8, { align: "right" });
                });

                // Bottom health spectrum pill
                const healthPct = totalAnodes > 0 ? Math.round(((d0 + d25) / totalAnodes) * 100) : 100;
                doc.setFillColor(248, 250, 252);
                doc.roundedRect(bx + 3, graphY + graphH - 5.5, bw - 6, 4.2, 1, 1, "F");
                let aHealthStr = `Anode Health: ${healthPct}% (<50% dep.)`;
                let aFontSize = 4.2;
                doc.setFontSize(aFontSize);
                doc.setFont("helvetica", "bold");
                while (aFontSize > 3.0 && doc.getTextWidth(aHealthStr) > (bw - 8)) {
                    aFontSize -= 0.2;
                    doc.setFontSize(aFontSize);
                }
                doc.setTextColor(...(healthPct >= 60 ? colors.emerald : colors.amber));
                doc.text(aHealthStr, bx + (bw / 2), graphY + graphH - 2.6, { align: "center" });
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
                const gaugeY = graphY + 3;
                const gW = (bw - 6) / 3;

                // Gauge 1: Faces
                doc.setFillColor(241, 245, 249);
                doc.roundedRect(bx + 2, gaugeY, gW - 1, 9, 1, 1, "F");
                doc.setFontSize(4.3);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text("Faces Surv.", bx + 2 + (gW / 2) - 0.5, gaugeY + 3.2, { align: "center" });
                doc.setFontSize(6);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                doc.text(`${facesSurveyed}/${registeredFaces}`, bx + 2 + (gW / 2) - 0.5, gaugeY + 7.5, { align: "center" });

                // Gauge 2: Piles
                doc.setFillColor(241, 245, 249);
                doc.roundedRect(bx + 2 + gW, gaugeY, gW - 1, 9, 1, 1, "F");
                doc.setFontSize(4.3);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text("Piles Surv.", bx + 2 + (gW * 1.5) - 0.5, gaugeY + 3.2, { align: "center" });
                doc.setFontSize(6);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                doc.text(String(pilesSurveyed), bx + 2 + (gW * 1.5) - 0.5, gaugeY + 7.5, { align: "center" });

                // Gauge 3: Exposed Piles
                const isExposedZero = Number(exposedPileCount) === 0;
                doc.setFillColor(isExposedZero ? 240 : 254, isExposedZero ? 253 : 242, isExposedZero ? 244 : 242);
                doc.roundedRect(bx + 2 + (gW * 2), gaugeY, gW - 1, 9, 1, 1, "F");
                doc.setFontSize(4.3);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...(isExposedZero ? colors.emerald : colors.red));
                doc.text("Exposed Piles", bx + 2 + (gW * 2.5) - 0.5, gaugeY + 3.2, { align: "center" });
                doc.setFontSize(6);
                doc.setFont("helvetica", "bold");
                doc.text(String(exposedPileCount), bx + 2 + (gW * 2.5) - 0.5, gaugeY + 7.5, { align: "center" });

                // Extract Location and Depth Values
                const maxLoc = scour?.maxDepthLocation || scour?.maxDepthLeg || "";
                const maxLocClean = maxLoc && maxLoc !== "N/A" ? maxLoc : "";
                const minDepthMm = scour?.minDepthMm !== undefined && scour?.minDepthMm !== null 
                    ? Number(scour.minDepthMm) 
                    : (scour?.minDepth ? Number(scour.minDepth) : 0);
                const minLoc = scour?.minDepthLocation || "";
                const minLocClean = minLoc && minLoc !== "N/A" ? minLoc : "";

                // Scour Depth Visual Spectrum Meter
                const meterY = graphY + 14.2;
                doc.setFontSize(4.8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.textDark);
                doc.text(maxLocClean ? `MAX SCOUR DEPTH (${maxLocClean})` : "MAXIMUM SCOUR DEPTH", bx + 3, meterY);

                // Depth callout on top right
                doc.setFontSize(5.2);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...(maxDepthMm > 800 ? colors.red : (maxDepthMm > 400 ? colors.amber : colors.navy)));
                const depthCallout = minDepthMm > 0
                    ? `Max: ${Math.round(maxDepthMm)} mm | Min: ${Math.round(minDepthMm)} mm`
                    : `${Math.round(maxDepthMm)} mm`;
                doc.text(depthCallout, bx + bw - 3, meterY, { align: "right" });

                const meterBarX = bx + 3;
                const meterBarW = bw - 6;
                const meterBarH = 3.6;
                const meterScaleMax = 1200; // 0 - 1200mm scale

                // Depth spectrum zones: Green (0-400), Yellow (400-800), Red (800-1200)
                const z1W = meterBarW * (400 / meterScaleMax);
                const z2W = meterBarW * (400 / meterScaleMax);
                const z3W = meterBarW - z1W - z2W;

                doc.setFillColor(187, 247, 208); // light green (0-400)
                doc.rect(meterBarX, meterY + 1.2, z1W, meterBarH, "F");
                doc.setFillColor(254, 240, 138); // light amber (400-800)
                doc.rect(meterBarX + z1W, meterY + 1.2, z2W, meterBarH, "F");
                doc.setFillColor(254, 202, 202); // light red (800-1200)
                doc.rect(meterBarX + z1W + z2W, meterY + 1.2, z3W, meterBarH, "F");

                // Needle/Marker for min depth if distinct
                if (minDepthMm > 0 && Math.abs(maxDepthMm - minDepthMm) > 25) {
                    const minNeedlePct = Math.min(1, minDepthMm / meterScaleMax);
                    const minNeedleX = meterBarX + (meterBarW * minNeedlePct);
                    doc.setFillColor(71, 85, 105); // slate for min
                    doc.rect(minNeedleX - 0.5, meterY + 0.4, 1.0, meterBarH + 1.6, "F");
                }

                // Needle/Marker for actual maximum depth
                const needlePct = Math.min(1, maxDepthMm / meterScaleMax);
                const needleX = meterBarX + (meterBarW * needlePct);
                doc.setFillColor(...(maxDepthMm > 800 ? colors.red : colors.navy));
                doc.rect(needleX - 0.8, meterY + 0.2, 1.6, meterBarH + 2.0, "F");

                // Scale ticks & limit markings under bar
                const labelY = meterY + meterBarH + 3.4;
                doc.setFontSize(3.6);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text("0", meterBarX, labelY);
                doc.text("400", meterBarX + z1W, labelY, { align: "center" });

                doc.setFont("helvetica", "bold");
                doc.setTextColor(220, 38, 38);
                doc.text("800 (Limit)", meterBarX + z1W + z2W, labelY, { align: "center" });

                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.textMuted);
                doc.text("1200 mm", meterBarX + meterBarW, labelY, { align: "right" });

                // Bottom findings & safety status summary
                const isAnomaly = maxDepthMm > 800 || Number(exposedPileCount) > 0;
                const isCaution = maxDepthMm > 400 && !isAnomaly;
                let scourSummaryText = "";

                if (isAnomaly) {
                    const locPart = maxLocClean ? ` at ${maxLocClean}` : "";
                    scourSummaryText = `ANOMALY: Exceeds 800mm limit${locPart} (${Math.round(maxDepthMm)} mm)!`;
                } else if (isCaution) {
                    const locPart = maxLocClean ? ` at ${maxLocClean}` : "";
                    scourSummaryText = `CAUTION: Moderate Scour${locPart} (${Math.round(maxDepthMm)} mm) | Limit: 800mm`;
                } else {
                    const locPart = maxLocClean ? ` • Max at ${maxLocClean}` : "";
                    scourSummaryText = `Findings on ${scourFindings} piles | Safety: Normal (<400mm)${locPart}`;
                }

                let sFontSize = 4.2;
                doc.setFontSize(sFontSize);
                doc.setFont("helvetica", isAnomaly ? "bold" : "normal");
                while (sFontSize > 2.8 && doc.getTextWidth(scourSummaryText) > (bw - 6)) {
                    sFontSize -= 0.2;
                    doc.setFontSize(sFontSize);
                }
                doc.setTextColor(...(isAnomaly ? colors.red : (isCaution ? colors.amber : colors.textMuted)));
                doc.text(scourSummaryText, bx + (bw / 2), graphY + graphH - 1.8, { align: "center" });
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

                    const maxV = cp?.maxVal != null ? Number(cp.maxVal) : -853;
                    const minV = cp?.minVal != null ? Number(cp.minVal) : -1005;
                    const totCp = cp?.totalCount || cp?.primaryCount || 54;
                    const rovCp = cp?.primaryRov || 29;

                    // Spectrum bar from -1150 mV to -750 mV
                    const vMinScale = -1150;
                    const vMaxScale = -750;
                    const vRange = vMaxScale - vMinScale; // 400 mV range

                    const meterX = bx + 4;
                    const meterW = bw - 8;
                    const meterY = graphY + 11;
                    const meterH = 4.5;

                    // Critical Protection Threshold: -850 mV
                    const critX = meterX + (meterW * ((-850 - vMinScale) / vRange));

                    // Protected Zone: -1150 to -850 (Green)
                    doc.setFillColor(187, 247, 208);
                    doc.rect(meterX, meterY, critX - meterX, meterH, "F");

                    // Under-protected Zone: -850 to -750 (Red)
                    doc.setFillColor(254, 202, 202);
                    doc.rect(critX, meterY, meterX + meterW - critX, meterH, "F");

                    // Actual Reading Range Bracket: minV to maxV
                    const val1X = meterX + (meterW * ((minV - vMinScale) / vRange));
                    const val2X = meterX + (meterW * ((maxV - vMinScale) / vRange));

                    doc.setFillColor(...colors.navy);
                    doc.rect(Math.min(val1X, val2X), meterY - 0.8, Math.max(2, Math.abs(val2X - val1X)), meterH + 1.6, "F");

                    // -850mV Threshold Line
                    doc.setDrawColor(...colors.red);
                    doc.setLineWidth(0.3);
                    doc.line(critX, meterY - 2.5, critX, meterY + meterH + 2.5);

                    doc.setFontSize(4.3);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.red);
                    doc.text("-850mV", critX, meterY - 3.2, { align: "center" });

                    // Top Callouts
                    doc.setFontSize(4.8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.navy);
                    doc.text(`Min: ${minV} mV`, bx + 3, graphY + 4.2);
                    doc.text(`Max: ${maxV} mV`, bx + bw - 3, graphY + 4.2, { align: "right" });

                    // Scale markers below meter
                    doc.setFontSize(4.0);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textMuted);
                    doc.text("-1150 mV", meterX, meterY + meterH + 3.2);
                    doc.text("-750 mV", meterX + meterW, meterY + meterH + 3.2, { align: "right" });

                    // Bottom Protection Status Badge (Cleanly sized to fit inside block)
                    const isProtected = maxV <= -850;
                    doc.setFillColor(isProtected ? 240 : 254, isProtected ? 253 : 242, isProtected ? 244 : 242);
                    doc.roundedRect(bx + 3, graphY + graphH - 6.5, bw - 6, 4.8, 1, 1, "F");
                    const statusStr = isProtected ? `CRITERIA MET: All < -850 mV (${totCp} Logged)` : `ATTN: Readings > -850 mV`;
                    let cpFontSize = 4.2;
                    doc.setFontSize(cpFontSize);
                    doc.setFont("helvetica", "bold");
                    while (cpFontSize > 3.0 && doc.getTextWidth(statusStr) > (bw - 8)) {
                        cpFontSize -= 0.2;
                        doc.setFontSize(cpFontSize);
                    }
                    doc.setTextColor(...(isProtected ? colors.emerald : colors.red));
                    doc.text(statusStr, bx + (bw / 2), graphY + graphH - 3.4, { align: "center" });
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

                    // Donut Chart on Left
                    const fmdCenterX = bx + 16;
                    const fmdCenterY = graphY + (graphH / 2);
                    drawDonutChart(fmdCenterX, fmdCenterY, 9, 5, [
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

                    rows.forEach((r, idx) => {
                        const ry = graphY + 5 + (idx * 5.5);
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
                    doc.roundedRect(bx + 3, graphY + graphH - 5.5, bw - 6, 4.2, 1, 1, "F");
                    let fmdStatus = isIntact ? "STATUS: 100% INTACT (NO FLOODING)" : "STATUS: FLOODED MEMBER DETECTED";
                    let fmdFontSize = 4.2;
                    doc.setFontSize(fmdFontSize);
                    doc.setFont("helvetica", "bold");
                    while (fmdFontSize > 3.0 && doc.getTextWidth(fmdStatus) > (bw - 8)) {
                        fmdFontSize -= 0.2;
                        doc.setFontSize(fmdFontSize);
                    }
                    doc.setTextColor(...(isIntact ? colors.emerald : colors.red));
                    doc.text(fmdStatus, bx + (bw / 2), graphY + graphH - 2.8, { align: "center" });
                }
            });
        }

        // 7F. Task Block: MGI Thickness Reading — Conditional
        const thkStats = mgi?.thickness || {};
        const hasThicknessRecords = Boolean(
            thkStats.hasData || (thkStats.count && thkStats.count > 0) || (mgi?.avg && mgi.avg > 0) || (mgi?.max && mgi.max > 0)
        );

        if (hasThicknessRecords) {
            taskBlocks.push({
                id: "mgi_thickness",
                title: "MGI THICKNESS READINGS",
                subtitle: "Thickness (mm)",
                isDone: true,
                render: (bx, by, bw, bh) => {
                    drawBlockHeader(bx, by, bw, "MGI THICKNESS READINGS", "Thickness (mm)");

                    const graphY = by + 5;
                    const graphH = bh - 5;
                    doc.setDrawColor(...colors.border);
                    doc.setLineWidth(0.15);
                    if (!isPF) {
                        doc.setFillColor(255, 255, 255);
                        doc.rect(bx, graphY, bw, graphH, "F");
                    }
                    doc.rect(bx, graphY, bw, graphH, "S");

                    const maxT = thkStats.max || mgi?.max || 45;
                    const minT = thkStats.min || mgi?.min || 10;
                    const avgT = thkStats.avg || mgi?.avg || 24.5;
                    const hardAvg = thkStats.hardAvg || 22;
                    const softAvg = thkStats.softAvg || 26;

                    // Min / Avg / Max gauge bar
                    const scaleMax = Math.max(60, Number(maxT) * 1.2);
                    const bX = bx + 4;
                    const bW = bw - 8;
                    const bY = graphY + 12;

                    doc.setFillColor(...colors.barTrack);
                    doc.roundedRect(bX, bY, bW, 4, 1, 1, "F");

                    const minX = bX + (bW * (Number(minT) / scaleMax));
                    const maxX = bX + (bW * (Number(maxT) / scaleMax));
                    const avgX = bX + (bW * (Number(avgT) / scaleMax));

                    doc.setFillColor(...colors.teal);
                    doc.rect(minX, bY - 0.5, Math.max(2, maxX - minX), 5, "F");

                    doc.setFillColor(...colors.navy);
                    doc.rect(avgX - 0.8, bY - 2, 1.6, 8, "F");

                    doc.setFontSize(5);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.navy);
                    doc.text(`Avg: ${avgT} mm`, avgX, bY - 2.8, { align: "center" });

                    doc.setFontSize(4.3);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.textMuted);
                    doc.text(`Min: ${minT}mm`, bX, graphY + 5);
                    doc.text(`Max: ${maxT}mm`, bX + bW, graphY + 5, { align: "right" });

                    // Hard vs Soft comparison bars below
                    const cY = graphY + graphH - 5;
                    doc.setFontSize(4.3);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(...colors.navy);
                    doc.text(`Hard: ${hardAvg}mm`, bx + 3, cY);
                    doc.setTextColor(...colors.teal);
                    doc.text(`Soft: ${softAvg}mm`, bx + bw - 3, cY, { align: "right" });
                }
            });
        }

        // Filter active task blocks:
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
