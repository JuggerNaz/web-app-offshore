import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { 
    loadLogoWithTransparency, 
    drawLogo, 
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
        const margin = 12;                                    // 12mm
        const contentWidth = pageWidth - (margin * 2);        // 273mm

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
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings?.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        const contractorLogoUrl = headerDataOrStructure?.contractorLogoUrl || headerDataOrStructure?.contrLogoUrl || "";
        if (contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(contractorLogoUrl); } catch (_) {}
        }

        // ── 3. Header Drawing Function ───────────────────────────────────────────
        const HEADER_H = 24;
        const drawPageHeader = (d: jsPDF) => {
            if (isPF) {
                d.setDrawColor(...colors.navy);
                d.setLineWidth(0.4);
                d.rect(margin, margin, contentWidth, HEADER_H, "S");
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy);
                d.rect(margin, margin, contentWidth, HEADER_H, "F");
                d.setTextColor(255);
            }

            // Logos: Contractor Logo (Left), Company/Client Logo (Right)
            if (contractorLogo) {
                drawLogo(d, contractorLogo, 17, 17, margin + 4, margin + 3.5, "left", "center");
            }
            if (companyLogo) {
                drawLogo(d, companyLogo, 17, 17, pageWidth - margin - 21, margin + 3.5, "right", "center");
            }

            // Center Branding Header
            d.setFontSize(10.5);
            d.setFont("helvetica", "bold");
            d.text(companySettings?.company_name || "NasQuest Resources Sdn Bhd", margin + (contentWidth / 2), margin + 5.5, { align: "center" });

            d.setFontSize(7.5);
            d.setFont("helvetica", "normal");
            d.text(companySettings?.department_name || "Technical Inspection Division", margin + (contentWidth / 2), margin + 10, { align: "center" });

            d.setFontSize(11);
            d.setFont("helvetica", "bold");
            d.text("INSPECTION SUMMARY", margin + (contentWidth / 2), margin + 15.5, { align: "center" });

            d.setFontSize(7.5);
            d.setFont("helvetica", "normal");
            d.text(`Report No: ${sowReportNo}`, margin + (contentWidth / 2), margin + 20, { align: "center" });
        };

        // Render Page 1 Header
        drawPageHeader(doc);

        let currentY = margin + HEADER_H + 2.5;

        // ── 4. Sub-Header Platform & Depth Banner ────────────────────────────────
        const SUB_H = 6.5;
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.2);
        if (!isPF) {
            doc.setFillColor(...colors.headerLight);
            doc.rect(margin, currentY, contentWidth, SUB_H, "F");
        }
        doc.rect(margin, currentY, contentWidth, SUB_H, "S");

        // Left text: FIELD | STRUCTURE
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.textDark);
        const facilityLabel = fieldName 
            ? `${fieldName.toUpperCase()} | ${platformName.toUpperCase()}`
            : platformName.toUpperCase();
        doc.text(facilityLabel, margin + 3, currentY + 4.5);

        // Right text: Water depth (Registered anodes removed per user request)
        doc.setFont("helvetica", "normal");
        const depthText = waterDepth ? `${waterDepth} m` : "-- m";
        const metaRightStr = `Water depth: ${depthText}`;
        doc.text(metaRightStr, pageWidth - margin - 3, currentY + 4.5, { align: "right" });

        currentY += SUB_H + 2.5;

        // ── 5. Top 5 Summary KPI Cards ───────────────────────────────────────────
        const CARD_H = 19;
        const CARD_GAP = 3;
        const CARD_W = (contentWidth - (CARD_GAP * 4)) / 5; // 52.2mm each

        const totalQidsCount = sow.total || rec.total || 0;
        const completedCount = sow.completed || rec.completed || 0;
        const incompleteCount = sow.incomplete || rec.incomplete || 0;
        const anomalyCount = anomalies.total || rec.anomaly || 0;
        const compRateVal = sow.completionPct !== undefined 
            ? Math.round(sow.completionPct)
            : (totalQidsCount > 0 ? Math.round((completedCount / totalQidsCount) * 100) : 0);

        const kpiCards = [
            {
                title: "TOTAL QIDs",
                value: totalQidsCount > 0 ? String(totalQidsCount) : "--",
                subtext: "Unique in approved jobpack",
                color: colors.navy,
            },
            {
                title: "COMPLETED",
                value: completedCount > 0 ? String(completedCount) : "--",
                subtext: "Verified completed QIDs",
                color: colors.navy,
            },
            {
                title: "INCOMPLETE",
                value: incompleteCount > 0 ? String(incompleteCount) : "--",
                subtext: "Outstanding / restricted",
                color: colors.navy,
            },
            {
                title: "TOTAL ANOMALIES",
                value: anomalyCount > 0 ? String(anomalyCount) : "--",
                subtext: "Unique anomaly IDs",
                color: colors.navy,
            },
            {
                title: "COMPLETION RATE",
                value: compRateVal > 0 ? `${compRateVal} %` : "-- %",
                subtext: "Completed / applicable QIDs",
                color: colors.navy,
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
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("INSPECTION TASK COVERAGE", leftX + 3, currentY + 3.8);

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        if (!isPF) doc.setTextColor(220, 230, 242);
        doc.text("By task / applicable QIDs", leftX + LEFT_COL_W - 3, currentY + 3.8, { align: "right" });

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

        // Limit coverage table rows to 6 so it stays within middle height
        const visibleCoverageRows = coverageRows.slice(0, 6);

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
        });

        const coverageTableEnd = (doc as any).lastAutoTable?.finalY ?? (currentY + 38);
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...colors.textMuted);
        doc.text("Task counts can overlap when one QID has multiple inspection tasks.", leftX + 1, coverageTableEnd + 3);

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

        const defectRows: Array<{ cols: Array<{ val: string; bold?: boolean; align?: "left" | "center" | "right" }> }> = defectCriteriaList.map(d => {
            const val = getDefectCriteriaCount(defectMap, d.code);
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

                const rows = [
                    { cols: [{ val: "Platform Anode Type", align: "left" as const }, { val: anodeTypeDisplay, bold: true, align: "right" as const }] },
                    { cols: [{ val: "0-25% Depletion", align: "left" as const }, { val: String(d0), bold: Number(d0) > 0, align: "right" as const }] },
                    { cols: [{ val: "26-50% Depletion", align: "left" as const }, { val: String(d25), bold: Number(d25) > 0, align: "right" as const }] },
                    { cols: [{ val: "50-75% Depletion", align: "left" as const }, { val: String(d50), bold: Number(d50) > 0, align: "right" as const }] },
                    { cols: [{ val: "76-100% Depletion", align: "left" as const }, { val: String(d75), bold: Number(d75) > 0, align: "right" as const }] },
                    { cols: [{ val: "Total Anodes Logged", bold: true, align: "left" as const }, { val: String(anodeGvi?.total || 0), bold: true, align: "right" as const }] },
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
                if (scour?.maxDepthMm !== undefined && scour?.maxDepthMm !== null && scour.maxDepthMm > 0) {
                    maxDepthStr = `${Math.round(scour.maxDepthMm)} mm`;
                } else if (scour?.maxDepth !== undefined && scour?.maxDepth !== null && Number(scour.maxDepth) > 0) {
                    const depthNum = Number(scour.maxDepth);
                    const mmVal = depthNum <= 10 ? Math.round(depthNum * 1000) : Math.round(depthNum);
                    maxDepthStr = `${mmVal} mm`;
                } else if (scour?.maxDepthMeters !== undefined && scour?.maxDepthMeters !== null && scour.maxDepthMeters > 0) {
                    maxDepthStr = `${Math.round(scour.maxDepthMeters * 1000)} mm`;
                }

                const col1W = Math.round(bw * 0.63);
                const col2W = bw - col1W;

                const rows = [
                    { cols: [{ val: "Platform faces", align: "left" as const }, { val: `${registeredFaces} registered`, align: "right" as const }] },
                    { cols: [{ val: "Faces surveyed", align: "left" as const }, { val: String(facesSurveyed), align: "right" as const }] },
                    { cols: [{ val: "Piles surveyed", align: "left" as const }, { val: String(pilesSurveyed), align: "right" as const }] },
                    { cols: [{ val: "Exposed pile count", align: "left" as const }, { val: String(exposedPileCount || 0), bold: Number(exposedPileCount) > 0, align: "right" as const }] },
                    { cols: [{ val: "Piles with scour findings", align: "left" as const }, { val: String(scourFindings || 0), bold: Number(scourFindings) > 0, align: "right" as const }] },
                    { cols: [{ val: "Maximum scour depth", align: "left" as const }, { val: maxDepthStr, bold: true, align: "right" as const }] },
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

                    const rows = [
                        { cols: [{ val: "Total Readings Logged", align: "left" as const }, { val: String(cp?.totalCount || cp?.primaryCount || 0), bold: true, align: "right" as const }] },
                        { cols: [{ val: "Most Negative (Max)", align: "left" as const }, { val: cp?.maxVal != null ? `${cp.maxVal} mV` : "--", align: "right" as const }] },
                        { cols: [{ val: "Least Negative (Min)", align: "left" as const }, { val: cp?.minVal != null ? `${cp.minVal} mV` : "--", align: "right" as const }] },
                        { cols: [{ val: "ROV Logged Readings", align: "left" as const }, { val: String(cp?.primaryRov || 0), align: "right" as const }] },
                        { cols: [{ val: "Diver Logged Readings", align: "left" as const }, { val: String(cp?.primaryDive || 0), align: "right" as const }] },
                        { cols: [{ val: "Protection Criteria", align: "left" as const }, { val: "Normal (-850mV)", bold: true, align: "right" as const }] },
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
            thkStats.hasData || (thkStats.count && thkStats.count > 0) || (mgi?.avg && mgi.avg > 0) || (mgi?.max && mgi.max > 0)
        );

        if (hasThicknessRecords) {
            taskBlocks.push({
                id: "mgi_thickness",
                title: "MGI THICKNESS READINGS",
                subtitle: "Measurements in mm",
                isDone: true,
                render: (bx, by, bw, bh) => {
                    drawBlockHeader(bx, by, bw, "MGI THICKNESS READINGS", "Measurements in mm");

                    const maxT = thkStats.max ? `${thkStats.max} mm` : (mgi?.max ? `${mgi.max} mm` : "--");
                    const minT = thkStats.min ? `${thkStats.min} mm` : (mgi?.min ? `${mgi.min} mm` : "--");
                    const avgT = thkStats.avg ? `${thkStats.avg} mm` : (mgi?.avg ? `${mgi.avg.toFixed(1)} mm` : "--");
                    const hardAvgStr = thkStats.hardAvg ? `${thkStats.hardAvg} mm` : "--";
                    const softAvgStr = thkStats.softAvg ? `${thkStats.softAvg} mm` : "--";

                    const col1W = Math.round(bw * 0.63);
                    const col2W = bw - col1W;

                    const rows = [
                        { cols: [{ val: "Readings Logged", align: "left" as const }, { val: String(thkStats.count || mgi?.total || 0), bold: true, align: "right" as const }] },
                        { cols: [{ val: "Average Thickness", align: "left" as const }, { val: avgT, bold: true, align: "right" as const }] },
                        { cols: [{ val: "Maximum Thickness", align: "left" as const }, { val: maxT, align: "right" as const }] },
                        { cols: [{ val: "Minimum Thickness", align: "left" as const }, { val: minT, align: "right" as const }] },
                        { cols: [{ val: "Hard Growth (Avg)", align: "left" as const }, { val: hardAvgStr, align: "right" as const }] },
                        { cols: [{ val: "Soft Growth (Avg)", align: "left" as const }, { val: softAvgStr, align: "right" as const }] },
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
            currentY = margin + HEADER_H + 4;
        }

        activeBlocks.forEach((block, idx) => {
            const colIdx = idx % maxColsPerRow;
            if (idx > 0 && colIdx === 0) {
                currentY += BLOCK_H + 3.5;
                if (currentY + BLOCK_H > pageHeight - 16) {
                    doc.addPage();
                    drawPageHeader(doc);
                    currentY = margin + HEADER_H + 4;
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
                currentY = margin + HEADER_H + 4;
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
