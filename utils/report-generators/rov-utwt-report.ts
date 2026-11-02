import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, getRecordNominalThickness, getInspectionDateRange, formatReportFindingText, applyRecordCellStyling, REPORT_FOOTER_APP_TEXT, draw3SectionHeader, drawStandardContextRow } from "./shared-logo";

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
    showSignatures?: boolean;
    showPageNumbers?: boolean;
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

export const buildROVUTWTRow = (r: any, idx: number): (string | number)[] => {
    const d = r.inspection_data || r.inspection_dat || {};
    const qid = r.structure_components?.q_id || r.component?.q_id || 'N/A';
    const diveNo = r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                   r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                   r.rov_job_id || r.dive_job_id || 'N/A';

    // Marine Growth Hard / Soft coverage extraction
    let rawH = d.marine_growth_hard ?? d.mgi_hard_growth ?? d.mgi_hard_coverage ?? d.hard_coverage ?? d.hard_growth ?? r.marine_growth_hard;
    let rawS = d.marine_growth_soft ?? d.mgi_soft_growth ?? d.mgi_soft_coverage ?? d.soft_coverage ?? d.soft_growth ?? r.marine_growth_soft;

    if ((rawH === undefined || rawH === null || rawS === undefined || rawS === null) && (d.marine_growth || r.marine_growth)) {
        const mg = String(d.marine_growth || r.marine_growth).trim();
        const hardMatch = mg.match(/(?:hard|h)\s*[:=]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
        const softMatch = mg.match(/(?:soft|s)\s*[:=]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
        if (hardMatch && (rawH === undefined || rawH === null)) rawH = hardMatch[1];
        if (softMatch && (rawS === undefined || rawS === null)) rawS = softMatch[1];
    }

    const ut12 = d.ut_12_o_clock ?? d.ut_12 ?? d['12_o_clock'] ?? d.ut_reading_12 ?? '-';
    const ut3  = d.ut_3_o_clock ?? d.ut_3 ?? d['3_o_clock'] ?? d.ut_reading_3 ?? '-';
    const ut6  = d.ut_6_o_clock ?? d.ut_6 ?? d['6_o_clock'] ?? d.ut_reading_6 ?? '-';
    const ut9  = d.ut_9_o_clock ?? d.ut_9 ?? d['9_o_clock'] ?? d.ut_reading_9 ?? '-';

    // Construct findings
    const findings = formatReportFindingText(r);

    return [
        idx + 1,
        qid,
        r.elevation || d.elevation || '-',
        diveNo,
        formatCoverage(rawH),
        formatCoverage(rawS),
        ut12,
        ut3,
        ut6,
        ut9,
        getRecordNominalThickness(r),
        findings
    ];
};

/**
 * ROV UT Wall Thickness Inspection Report (RUTWT)
 */
export const generateROVUTWTReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    try {
        records = normalizeReportRecords(records);
        if (!config.isBlankReport && (!records || records.length === 0)) {
            return null;
        }

        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        const colors = {
            navy: [7, 78, 136] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            anomaly: [220, 38, 38] as [number, number, number],
            rectified: [22, 163, 74] as [number, number, number],
        };

        // --- 1. Preparation ---
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        const dateRangeStr = getInspectionDateRange(records, headerData, config);

        const headerH = 25;
        const drawHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `UT Wall Thickness Inspection Report (ROV) - ${extraTitleInfo}` : "UT Wall Thickness Inspection Report (ROV)",
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

        const drawContext = (d: jsPDF, y: number) => {
            return drawStandardContextRow(d, y, {
                structure: headerData.platformName,
                vessel: headerData.vessel,
                jobpack: headerData.jobpackName,
                dateRange: dateRangeStr,
            }, config.printFriendly, margin);
        };

        drawHeader(doc);
        const startY = drawContext(doc, margin + headerH + 2);

        const isPF = config.printFriendly;

        // --- 2. Sorting & Mapping ---
        const safeRecords = records || [];
        const sortedRecords = [...safeRecords].sort((a, b) => {
            const elevA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elevB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elevB - elevA; // Top to bottom
        });

        const bodyRows = sortedRecords.length > 0 ? sortedRecords.map(buildROVUTWTRow) : [
            ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "No UT wall thickness observations recorded for this scope."]
        ];

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin, top: margin + headerH + 6 },
            head: [
                [
                    { content: 'Item No.', rowSpan: 2, styles: {halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, lineWidth: 0.1, lineColor: colors.border} },
                    { content: 'Component QID', rowSpan: 2, styles: {halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, lineWidth: 0.1, lineColor: colors.border} },
                    { content: 'Elevation\n(m)', rowSpan: 2, styles: {halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, lineWidth: 0.1, lineColor: colors.border} },
                    { content: 'Dive No.', rowSpan: 2, styles: {halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, lineWidth: 0.1, lineColor: colors.border} },
                    { content: 'Hard Growth\n(%)', rowSpan: 2, styles: {halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, lineWidth: 0.1, lineColor: colors.border} },
                    { content: 'Soft Growth\n(%)', rowSpan: 2, styles: {halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, lineWidth: 0.1, lineColor: colors.border} },
                    { content: 'Wall Thickness Readings (mm)', colSpan: 4, styles: {halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? [240,240,240] : colors.teal, textColor: config?.printFriendly ? colors.text : 255, lineWidth: 0.1, lineColor: colors.border} },
                    { content: 'Nominal\n(mm)', rowSpan: 2, styles: {halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, lineWidth: 0.1, lineColor: colors.border} },
                    { content: 'Findings', rowSpan: 2, styles: {halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, lineWidth: 0.1, lineColor: colors.border} }
                ],
                [
                    { content: '12 O\'clock', styles: {halign: 'center', fillColor: config?.printFriendly ? [248,248,248] : colors.teal, textColor: config?.printFriendly ? colors.text : 255, fontSize: 7, lineWidth: 0.1, lineColor: colors.border} },
                    { content: '3 O\'clock', styles: {halign: 'center', fillColor: config?.printFriendly ? [248,248,248] : colors.teal, textColor: config?.printFriendly ? colors.text : 255, fontSize: 7, lineWidth: 0.1, lineColor: colors.border} },
                    { content: '6 O\'clock', styles: {halign: 'center', fillColor: config?.printFriendly ? [248,248,248] : colors.teal, textColor: config?.printFriendly ? colors.text : 255, fontSize: 7, lineWidth: 0.1, lineColor: colors.border} },
                    { content: '9 O\'clock', styles: {halign: 'center', fillColor: config?.printFriendly ? [248,248,248] : colors.teal, textColor: config?.printFriendly ? colors.text : 255, fontSize: 7, lineWidth: 0.1, lineColor: colors.border} }
                ]
            ],
            body: bodyRows,
            theme: 'grid',
            headStyles: {fillColor: colors.navy, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255]},
            styles: {fontSize: 7.5, cellPadding: 2, textColor: colors.text, lineColor: colors.border, lineWidth: 0.1},
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = sortedRecords[data.row.index];
                applyRecordCellStyling(data.cell, r, isPF);
            },
            columnStyles: {
                0: { cellWidth: 14, halign: 'center' },
                1: { cellWidth: 32 },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 20, halign: 'center' },
                6: { cellWidth: 17, halign: 'center' },
                7: { cellWidth: 17, halign: 'center' },
                8: { cellWidth: 17, halign: 'center' },
                9: { cellWidth: 17, halign: 'center' },
                10: { cellWidth: 20, halign: 'center' },
                11: { cellWidth: 'auto' }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawHeader(doc);

                // Bottom bar
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
            }
        });

        const finalY = (doc as any).lastAutoTable?.finalY ?? startY;
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                drawHeader(doc);
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

            drawSig('PREPARED BY', margin, config?.preparedBy);
            drawSig('REVIEWED BY', margin + sigW, config?.reviewedBy);
            drawSig('APPROVED BY', margin + (sigW * 2), config?.approvedBy);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`ROV_UT_Wall_Thickness_Inspection_Report_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("UTWT Report Error", e);
        throw e;
    }
};
