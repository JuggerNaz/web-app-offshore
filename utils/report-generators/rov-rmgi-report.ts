import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, getInspectionDateRange, formatReportFindingText, applyRecordCellStyling, getRecordStatusInfo, REPORT_FOOTER_APP_TEXT, extractRecordTapeNo, enrichRecordsWithTapesAndDeployments, draw3SectionHeader, drawStandardContextRow } from "./shared-logo";

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

interface ReportConfig {
    reportNoPrefix?: string;
    printFriendly?: boolean;
    jobPackId?: number;
    structureId?: number;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
    isBlankReport?: boolean;
}

// ── Coverage Extraction Helper ──────────────────────────────────────────
export const extractROVRMGICoverage = (d: any) => {
    let rawH = d.marine_growth_hard ?? d.mgi_hard_growth ?? d.mgi_hard_coverage ?? d.hard_coverage ?? d.hard_growth;
    let rawS = d.marine_growth_soft ?? d.mgi_soft_growth ?? d.mgi_soft_coverage ?? d.soft_coverage ?? d.soft_growth;

    if ((rawH === undefined || rawH === null || rawS === undefined || rawS === null) && d.marine_growth) {
        const mg = String(d.marine_growth).trim();
        const hardMatch = mg.match(/(?:hard|h)\s*[:=]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
        const softMatch = mg.match(/(?:soft|s)\s*[:=]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
        if (hardMatch && (rawH === undefined || rawH === null)) rawH = hardMatch[1];
        if (softMatch && (rawS === undefined || rawS === null)) rawS = softMatch[1];

        if ((rawH === undefined || rawH === null) && (rawS === undefined || rawS === null) && mg.includes('/')) {
            const parts = mg.split('/');
            if (parts.length === 2) {
                rawH = parts[0].trim();
                rawS = parts[1].trim();
            }
        }
    }

    const formatCov = (val: any) => {
        if (val === null || val === undefined || val === '' || val === '-' || val === '—') return '—';
        const str = String(val).trim();
        if (str === '0' || str === '0%') return '0%';
        return str.endsWith('%') ? str : `${str}%`;
    };

    return {
        h: formatCov(rawH),
        s: formatCov(rawS)
    };
};

// ── Clock Position Thickness Readings Helper ────────────────────────────
export const getROVRMGIClockReadings = (d: any) => {
    const getHardVal = (pos: string) => {
        const val = d[`mgi_hard_thickness_at_${pos}`] ?? d[`hard_thk${pos}`] ?? d[`mgi_hard_thickness_${pos}`] ?? (pos === '12' ? d.mgi_hard_thickness : null);
        if (val === null || val === undefined || val === '') return 0;
        const num = parseFloat(String(val));
        return isNaN(num) || num <= 0 ? 0 : num;
    };

    const getSoftVal = (pos: string) => {
        const val = d[`mgi_soft_thickness_at_${pos}`] ?? d[`soft_thk${pos}`] ?? d[`mgi_soft_thickness_${pos}`] ?? (pos === '12' ? d.mgi_soft_thickness : null);
        if (val === null || val === undefined || val === '') return 0;
        const num = parseFloat(String(val));
        return isNaN(num) || num <= 0 ? 0 : num;
    };

    const clockPositions = ['12', '3', '6', '9'];
    const hVals = clockPositions.map(getHardVal);
    const sVals = clockPositions.map(getSoftVal);
    const maxHard = Math.max(...hVals);

    return {
        hVals,
        sVals,
        maxHard,
        hDisplay: hVals.map(v => v > 0 ? String(v) : "—"),
        sDisplay: sVals.map(v => v > 0 ? String(v) : "—")
    };
};

// ── Elevation & Top-to-Bottom Sorting Helpers ───────────────────────────
export const getROVRMGIElevationNumber = (r: any): number => {
    const raw = r.elevation ?? r.inspection_data?.elevation ?? r.inspection_dat?.elevation;
    if (raw === null || raw === undefined || raw === "" || raw === "—" || raw === "-") return -999999;
    const str = String(raw).trim();
    if (str.toUpperCase() === "MSL") return 0;
    const num = parseFloat(str);
    return isNaN(num) ? -999999 : num;
};

export const sortROVRMGIRecords = (records: any[]): any[] => {
    return [...(records || [])].sort((a, b) => {
        const elA = getROVRMGIElevationNumber(a);
        const elB = getROVRMGIElevationNumber(b);
        if (elB !== elA) return elB - elA; // Top to bottom (highest elevation to deepest)

        const qidA = (a.structure_components?.q_id || a.component?.q_id || a.component_qid || "").toUpperCase();
        const qidB = (b.structure_components?.q_id || b.component?.q_id || b.component_qid || "").toUpperCase();
        if (qidA !== qidB) return qidA.localeCompare(qidB);

        return (Number(a.insp_id || a.id || 0)) - (Number(b.insp_id || b.id || 0));
    });
};

// ── Build Each Table Row ────────────────────────────────────────────────
export const buildROVRMGIRow = (r: any, idx: number, rowMetaItem?: any): string[] => {
    const d = r.inspection_data || r.inspection_dat || {};
    const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
    
    const rawElev = r.elevation ?? d.elevation;
    let elevationStr = "—";
    if (rawElev !== null && rawElev !== undefined && rawElev !== "" && rawElev !== "-" && rawElev !== "—") {
        const s = String(rawElev).trim();
        elevationStr = s.toLowerCase().endsWith("m") ? s : `${s} m`;
    }

    const diveNo =
        r.insp_rov_jobs?.job_no  || r.insp_rov_jobs?.name  ||
        r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
        r.rov_job_id || r.dive_job_id || "—";

    const tapeNo = extractRecordTapeNo(r);

    const { h: covH, s: covS } = extractROVRMGICoverage(d);
    const meta = rowMetaItem || getROVRMGIClockReadings(d);

    // Findings column: thickness and coverage readings are stripped out because they have dedicated columns
    const baseFinding = (r.description || d.findings || d.finding || "").trim();
    const findings = formatReportFindingText(r, baseFinding);

    return [
        String(idx + 1),
        qid,
        String(elevationStr),
        String(diveNo),
        String(tapeNo),
        covH,
        covS,
        meta.hDisplay[0], // 12H
        meta.hDisplay[1], // 3H
        meta.hDisplay[2], // 6H
        meta.hDisplay[3], // 9H
        meta.sDisplay[0], // 12S
        meta.sDisplay[1], // 3S
        meta.sDisplay[2], // 6S
        meta.sDisplay[3], // 9S
        findings,
    ];
};

/**
 * ROV Marine Growth Inspection Report (RMGI) — Landscape Standard Table
 *
 * Columns:
 * No. | Component QID | Elevation (m) | Dive No. | Tape No. |
 * Coverage %: HARD | SOFT |
 * MGI Readings (mm) - Clock Positions: HARD (12H, 3H, 6H, 9H) | SOFT (12S, 3S, 6S, 9S) |
 * Inspection Findings
 */
export const generateROVRMGIReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    try {
        records = await enrichRecordsWithTapesAndDeployments(null, records);
        records = normalizeReportRecords(records);
        if (!config.isBlankReport && (!records || records.length === 0)) {
            return null;
        }

        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;

        const colors = {
            navy:      [7,   78, 136] as [number, number, number],
            teal:      [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border:    [203, 213, 225] as [number, number, number],
            text:      [30,   41,  59] as [number, number, number],
            anomaly:   [220,  38,  38] as [number, number, number],
            rectified: [22,  163,  74] as [number, number, number],
            finding:   [124,  58, 237] as [number, number, number],
        };

        const dateRangeStr = getInspectionDateRange(records, headerData, config);

        const HEADER_H = 25;

        // ── Pre-load logos ──────────────────────────────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        // ── Synchronous page header ─────────────────────────────────────────────
        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `Marine Growth Inspection Report (ROV) - ${extraTitleInfo}` : "Marine Growth Inspection Report (ROV)",
                reportNo: (config?.reportNoPrefix || headerData?.sowReportNo) || "N/A",
                structureName: headerData.platformName ? `${headerData.platformName}${headerData.jobpackName ? ` - ${headerData.jobpackName}` : ''}` : headerData.jobpackName,
                companySettings,
                config,
                headerData,
                contractorLogoData: contractorLogo,
                clientLogoData: companyLogo,
                isPrintFriendly: config.printFriendly,
                orientation: "landscape",
                margin: 10,
                headerY: 7,
                headerH: 25,
            });
        };

        const drawContextRow = (d: jsPDF, y: number) => {
            return drawStandardContextRow(d, y, {
                structure: headerData.platformName,
                vessel: headerData.vessel,
                jobpack: headerData.jobpackName,
                dateRange: dateRangeStr,
            }, config.printFriendly, margin);
        };

        // Order by elevation from top to bottom (highest elevation to deepest), then by QID
        const sorted = sortROVRMGIRecords(records);

        const isPF = config.printFriendly;

        const rowMeta = sorted.map(r => getROVRMGIClockReadings(r.inspection_data || r.inspection_dat || {}));
        const buildRow = (r: any, idx: number): string[] => buildROVRMGIRow(r, idx, rowMeta[idx]);

        // ── Draw first page ─────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        // ── Main table ──────────────────────────────────────────────────────────
        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 4 },
            head: [
                [
                    { content: "No.", rowSpan: 3, styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "Component QID", rowSpan: 3, styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "Elevation", rowSpan: 3, styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "Dive No.", rowSpan: 3, styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "Tape No.", rowSpan: 3, styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "Coverage %", colSpan: 2, styles: { halign: "center", valign: "middle", fillColor: isPF ? [240, 240, 240] : colors.navy, textColor: isPF ? colors.navy : [255, 255, 255], cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                    { content: "MGI READINGS (mm) - CLOCK POSITIONS", colSpan: 8, styles: { halign: "center", valign: "middle", fillColor: isPF ? [240, 240, 240] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                    { content: "Inspection Findings", rowSpan: 3, styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                ],
                [
                    { content: "HARD", rowSpan: 2, styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.navy, textColor: isPF ? colors.navy : [255, 255, 255], fontSize: 6.5, cellPadding: 1, fontStyle: "bold", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "SOFT", rowSpan: 2, styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.navy, textColor: isPF ? colors.navy : [255, 255, 255], fontSize: 6.5, cellPadding: 1, fontStyle: "bold", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "HARD", colSpan: 4, styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 0.5, fontStyle: "bold", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "SOFT", colSpan: 4, styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 0.5, fontStyle: "bold", lineWidth: 0.1, lineColor: colors.border } },
                ],
                [
                    { content: "12H", styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                    { content: "3H",  styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                    { content: "6H",  styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                    { content: "9H",  styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                    { content: "12S", styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                    { content: "3S",  styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                    { content: "6S",  styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                    { content: "9S",  styles: { halign: "center", valign: "middle", fillColor: isPF ? [248, 248, 248] : colors.teal, textColor: isPF ? colors.text : [255, 255, 255], fontSize: 6, cellPadding: 1, lineWidth: 0.1, lineColor: colors.border } },
                ]
            ],
            body: sorted.length > 0 ? sorted.map(buildRow) : [[
                { content: "No marine growth observations recorded for this scope.", colSpan: 16, styles: { halign: "center", fontStyle: "italic", textColor: colors.text } }
            ]],
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 7,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                lineWidth: 0.1,
                lineColor: isPF ? colors.border : [255, 255, 255],
            },
            styles: {
                fontSize: 7,
                cellPadding: 1.8,
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak",
                lineWidth: 0.1,
            },
            columnStyles: {
                0:  { cellWidth: 10, halign: "center" },
                1:  { cellWidth: 26, halign: "left" },
                2:  { cellWidth: 18, halign: "center" },
                3:  { cellWidth: 20, halign: "center" },
                4:  { cellWidth: 20, halign: "center" },
                5:  { cellWidth: 14, halign: "center" },
                6:  { cellWidth: 14, halign: "center" },
                7:  { cellWidth: 9,  halign: "center" },
                8:  { cellWidth: 9,  halign: "center" },
                9:  { cellWidth: 9,  halign: "center" },
                10: { cellWidth: 9,  halign: "center" },
                11: { cellWidth: 9,  halign: "center" },
                12: { cellWidth: 9,  halign: "center" },
                13: { cellWidth: 9,  halign: "center" },
                14: { cellWidth: 9,  halign: "center" },
                15: { cellWidth: "auto", halign: "left" },
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = sorted[data.row.index];
                if (!r) return;

                applyRecordCellStyling(data.cell, r, isPF);

                const colIdx = data.column.index;
                // Highlight peak Hard thickness reading across clock columns 7..10 if not an anomaly
                if (colIdx >= 7 && colIdx <= 10) {
                    const rawCell = data.cell.raw as any;
                    const cellText = String(rawCell?.content ?? rawCell ?? '').trim();
                    const numericVal = parseFloat(cellText);
                    const meta = rowMeta[data.row.index];
                    if (meta && meta.maxHard > 0 && !isNaN(numericVal) && numericVal === meta.maxHard) {
                        const status = getRecordStatusInfo(r);
                        if (status.type !== 'ANOMALY') {
                            data.cell.styles.fillColor = [204, 251, 241]; // Light Teal Mint
                            data.cell.styles.textColor = [15, 118, 110];   // Dark Teal
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);

                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    REPORT_FOOTER_APP_TEXT,
                    margin, pageHeight - 6
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            },
        });

        if (config.showSignatures !== false) {
            const finalY = (doc as any).lastAutoTable?.finalY ?? (pageHeight - 50);
            let sigY = pageHeight - 38;

            // If the table ended too low, push signatures to a new page
            if (finalY > sigY - 10) {
                doc.addPage();
                drawPageHeader(doc);
                sigY = pageHeight - 38;
            }
            const sigW   = contentWidth / 3;

            const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1);
                doc.rect(lx, sigY, sigW - 4, 18);
                if (!isPF) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 4, 4.5, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(7); doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.5);
                doc.setTextColor(...colors.text); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
                doc.text("Name:", lx + 2, sigY + 10);
                if (person?.name) doc.text(person.name, lx + 14, sigY + 10);
                doc.text("Date:", lx + 2, sigY + 13.5);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 13.5);
                doc.text("Signature:", lx + 2, sigY + 17);
            };

            drawSig("PREPARED BY", margin, config?.preparedBy);
            drawSig("REVIEWED BY", margin + sigW, config?.reviewedBy);
            drawSig("APPROVED BY", margin + (sigW * 2), config?.approvedBy);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_RMGI_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ROV RMGI Report] Error:", err);
        throw err;
    }
};
