import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, getInspectionDateRange, formatReportFindingText, applyRecordCellStyling, REPORT_FOOTER_APP_TEXT, draw3SectionHeader, drawStandardContextRow } from "./shared-logo";

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
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
    isBlankReport?: boolean;
}

export const formatCoverage = (val: any): string => {
    if (val === null || val === undefined || val === '' || val === '-' || val === '—') return '—';
    const str = String(val).trim();
    if (str === '0' || str === '0%') return '0%';
    if (/^[0-9]+(?:\.[0-9]+)?$/.test(str)) return `${str}%`;
    if (str.endsWith('%')) return str;
    return str;
};

export const extractHardSoftGrowth = (d: any, r?: any): { hard: string; soft: string } => {
    let rawH = d.marine_growth_hard ?? d.mgi_hard_growth ?? d.mgi_hard_coverage ?? d.hard_coverage ?? d.hard_growth ?? r?.marine_growth_hard;
    let rawS = d.marine_growth_soft ?? d.mgi_soft_growth ?? d.mgi_soft_coverage ?? d.soft_coverage ?? d.soft_growth ?? r?.marine_growth_soft;

    if ((rawH === undefined || rawH === null || rawS === undefined || rawS === null) && (d.marine_growth || r?.marine_growth)) {
        const mg = String(d.marine_growth || r?.marine_growth).trim();
        const hardMatch = mg.match(/(?:hard|h)\s*[:=]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
        const softMatch = mg.match(/(?:soft|s)\s*[:=]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
        if (hardMatch && (rawH === undefined || rawH === null)) rawH = hardMatch[1];
        if (softMatch && (rawS === undefined || rawS === null)) rawS = softMatch[1];
    }

    return {
        hard: formatCoverage(rawH),
        soft: formatCoverage(rawS),
    };
};

/**
 * Builds the 2-row representation for a Diving GVINS record:
 * Row 1: No. (rowSpan: 2) | Component QID | Elevation (m) | Dive No. | Component Condition | Coating Condition | Hard Growth (%) | Soft Growth (%)
 * Row 2: Finding (label at 2nd col) | Findings Text (merged across 3rd through 8th col)
 */
export const buildDivingGVINSRows = (r: any, idx: number, isPrintFriendly?: boolean): any[][] => {
    const d   = r.inspection_data || {};
    const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
    const elevation = r.elevation ?? d.elevation ?? "—";

    const diveNo =
        r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
        r.dive_job_id || "—";

    const compCond  = d.component_condition ?? d.general_condition ?? d.condition ?? "—";
    const coatCond  = d.coating_condition ?? d.coating ?? "—";
    const { hard, soft } = extractHardSoftGrowth(d, r);

    // Finding text excludes marine growth and condition values (now in dedicated columns)
    const mainDesc = r.description?.trim() || d.description?.trim() || r.findings?.trim() || d.findings?.trim() || r.remarks?.trim() || d.remarks?.trim();
    const findings = formatReportFindingText(r, mainDesc || undefined);

    const row1 = [
        { content: String(idx + 1), rowSpan: 2, styles: { halign: "center", valign: "middle" } },
        qid,
        String(elevation),
        String(diveNo),
        String(compCond),
        String(coatCond),
        hard,
        soft
    ];

    const row2 = [
        { 
            content: "Finding", 
            styles: { 
                halign: "center", 
                valign: "middle", 
                fontStyle: "bold",
                fillColor: isPrintFriendly ? [248, 248, 248] : [240, 244, 248]
            } 
        },
        { 
            content: findings, 
            colSpan: 6, 
            styles: { 
                halign: "left", 
                valign: "middle" 
            } 
        }
    ];

    return [row1, row2];
};

/**
 * Diving General Visual Inspection (GVINS) Report (Portrait)
 * Row 1: No. | Component QID | Elevation (m) | Dive No. | Component Condition | Coating Condition | Hard Growth (%) | Soft Growth (%)
 * Row 2: Finding (2nd col) | Merged finding observations (3rd through 8th col)
 */
export const generateDivingGVINSReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    records = normalizeReportRecords(records);
    if (!config.isBlankReport && (!records || records.length === 0)) {
        return null;
    }
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;

        const colors = {
            navy: [7, 78, 136]  as [number, number, number],
            teal:      [20,  184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border:    [203, 213, 225] as [number, number, number],
            text:      [30,  41,  59]  as [number, number, number],
            anomaly:   [220, 38,  38]  as [number, number, number],
            rectified: [22,  163, 74]  as [number, number, number],
            finding:   [217, 119, 6] as [number, number, number],
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
                reportTitle: extraTitleInfo ? `General Visual Inspection Report (Diving) - ${extraTitleInfo}` : "General Visual Inspection Report (Diving)",
                reportNo: (config?.reportNoPrefix || headerData?.sowReportNo) || "N/A",
                structureName: headerData.platformName ? `${headerData.platformName}${headerData.jobpackName ? ` - ${headerData.jobpackName}` : ''}` : headerData.jobpackName,
                companySettings,
                config,
                headerData,
                contractorLogoData: contractorLogo,
                clientLogoData: companyLogo,
                isPrintFriendly: config.printFriendly,
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

        // ── Sort records ────────────────────────────────────────────────────────
        const sorted = [...records].sort((a, b) => {
            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            if (elB !== elA) return elB - elA;

            const dateA = a.inspection_date ? new Date(a.inspection_date).getTime() : 0;
            const dateB = b.inspection_date ? new Date(b.inspection_date).getTime() : 0;
            if (dateB !== dateA) return dateB - dateA;

            const idA = Number(a.insp_id || a.id || 0);
            const idB = Number(b.insp_id || b.id || 0);
            return idA - idB;
        });

        const isPF = config.printFriendly;

        // ── Draw ────────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        const bodyRows = sorted.length > 0
            ? sorted.flatMap((r, idx) => buildDivingGVINSRows(r, idx, isPF))
            : [
                [
                    { content: "—", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    "—", "—", "—", "—", "—", "—", "—"
                ],
                [
                    { content: "Finding", styles: { halign: "center", valign: "middle", fontStyle: "bold" } },
                    { content: "No inspection observations recorded for this scope.", colSpan: 6, styles: { halign: "left", valign: "middle" } }
                ]
            ];

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 4 },
            head: [[
                { content: "No.", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Component\nQID", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Elevation\n(m)", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Dive No.", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Component\nCondition", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Coating\nCondition", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Hard Growth\n(%)", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Soft Growth\n(%)", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
            ]],
            body: bodyRows,
            theme: "grid",
            headStyles: {
                fillColor: config?.printFriendly ? [255, 255, 255] : colors.navy,
                textColor: config?.printFriendly ? colors.navy : [255, 255, 255],
                fontSize: 7.2,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                cellPadding: 1.8,
                minCellHeight: 8,
                lineWidth: 0.1,
                lineColor: config?.printFriendly ? colors.border : [255, 255, 255],
            },
            styles: {
                fontSize: 6.8,
                cellPadding: 1.8,
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak",
                lineWidth: 0.1,
            },
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 32, halign: "center" },
                2: { cellWidth: 18, halign: "center" },
                3: { cellWidth: 18, halign: "center" },
                4: { cellWidth: 32, halign: "center" },
                5: { cellWidth: 32, halign: "center" },
                6: { cellWidth: 24, halign: "center" },
                7: { cellWidth: 24, halign: "center" },
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const recordIdx = Math.floor(data.row.index / 2);
                const r = sorted[recordIdx];
                if (r) {
                    applyRecordCellStyling(data.cell, r, isPF);
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

        const finalY = (doc as any).lastAutoTable?.finalY ?? startY;
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                drawPageHeader(doc);
                sigY = pageHeight - 38;
            }
            const sigW = contentWidth / 3;
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
        doc.save(`Diving_GVINS_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving GVINS Report] Error:", err);
        throw err;
    }
};
