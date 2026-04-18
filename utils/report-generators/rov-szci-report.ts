import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo } from "./shared-logo";

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

interface ReportConfig {
    printFriendly?: boolean;
    jobPackId?: number;
    structureId?: number;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    returnBlob?: boolean;
}

/**
 * ROV Splash Zone Inspection Summary Report (RSZCI)
 */
export const generateROVSZCIReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    try {
        const doc = new jsPDF({ orientation: "landscape" }); // Landscape for better width with clock positions
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - (margin * 2);

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number]
        };

        // --- 1. Preparation ---
        // Calculate date range
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (records.length > 0) {
            const dates = records.map(r => new Date(r.cr_date)).filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) {
                startDate = min(dates);
                endDate = max(dates);
            }
        }

        const dateRangeStr = startDate && endDate 
            ? `${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`
            : 'N/A';

        const drawHeader = async (d: jsPDF) => {
            const headerH = 22;
            d.setFillColor(...colors.navy);
            d.rect(margin, margin, contentWidth, headerH, 'F');

            // 1. Company Logo (Right)
            if (companySettings.logo_url) {
                try {
                    const logoData = await loadLogoWithTransparency(companySettings.logo_url);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, pageWidth - margin - 20, margin + 4, 'right', 'center');
                    }
                } catch (e) {}
            }

            // 2. Contractor Logo (Left)
            if (headerData.contractorLogoUrl) {
                try {
                    const logoData = await loadLogoWithTransparency(headerData.contractorLogoUrl);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, margin + 4, margin + 4, 'left', 'center');
                    }
                } catch (e) {}
            }

            d.setTextColor(255); d.setFontSize(10); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 10, { align: 'center' });
            d.setFontSize(14); d.setFont("helvetica", "bold");
            d.text(`ROV Splash Zone Inspection Report`, margin + (contentWidth/2), margin + 19, { align: 'center' });
        };

        const drawContext = (d: jsPDF, y: number) => {
            const rowH = 7;
            const tableY = y;
            const colW = contentWidth / 2;
            
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1); d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, 'F'); d.rect(x, ty, w, rowH, 'S');
                d.setTextColor(...colors.text); d.setFontSize(8); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4.5); d.setFont("helvetica", "normal");
                d.text(String(value), x + 40, ty + 4.5);
            };

            drawBox('Structure:', headerData.platformName, margin, colW, tableY);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + colW, colW, tableY);
            drawBox('Job Pack:', headerData.jobpackName, margin, colW, tableY + rowH);
            drawBox('Insp. Date Range:', dateRangeStr, margin + colW, colW, tableY + rowH);
            
            return tableY + (rowH * 2) + 5;
        };

        await drawHeader(doc);
        const startY = drawContext(doc, margin + 22 + 2);

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin },
            head: [
                [
                    { content: 'Item No.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: colors.navy } },
                    { content: 'Component QID', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: colors.navy } },
                    { content: 'CP (mV)', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: colors.navy } },
                    { content: 'Wall Thickness (mm)', colSpan: 4, styles: { halign: 'center', fillColor: colors.teal } },
                    { content: 'Nominal (mm)', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: colors.navy } },
                    { content: 'Dive No.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: colors.navy } },
                    { content: 'Findings', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: colors.navy } }
                ],
                [
                    { content: '12 o\'clock', styles: { halign: 'center', fillColor: colors.teal, fontSize: 7 } },
                    { content: '3 o\'clock', styles: { halign: 'center', fillColor: colors.teal, fontSize: 7 } },
                    { content: '6 o\'clock', styles: { halign: 'center', fillColor: colors.teal, fontSize: 7 } },
                    { content: '9 o\'clock', styles: { halign: 'center', fillColor: colors.teal, fontSize: 7 } }
                ]
            ],
            body: records.map((r, idx) => {
                const d = r.inspection_data || r.inspection_dat || {};
                const qid = r.structure_components?.q_id || 'N/A';
                const diveNo = r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                               r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                               r.rov_job_id || r.dive_job_id || 'N/A';
                
                // Construct findings
                let findingsParts: string[] = [];
                if (r.description) findingsParts.push(r.description);
                
                // Add Additional CP
                const addCP = d.cp_rdg_additional || d.cp_additional || [];
                if (Array.isArray(addCP)) {
                    addCP.forEach((item: any) => {
                        if (item.reading) findingsParts.push(`Add. CP: ${item.reading}mV${item.location ? ` (${item.location})` : ''}`);
                    });
                }

                // Add Additional UT
                const addUT = d.ut_readings_additional || d.ut_additional || [];
                if (Array.isArray(addUT)) {
                    addUT.forEach((item: any) => {
                        if (item.reading) findingsParts.push(`Add. UT: ${item.reading}mm${item.location ? ` (${item.location})` : ''}`);
                    });
                }

                const findings = findingsParts.length > 0 ? findingsParts.join('\n') : 'N/A';
                
                return [
                    idx + 1,
                    qid,
                    d.cp_rdg || d.cp || '-',
                    d.ut_12_o_clock || '-',
                    d.ut_3_o_clock || '-',
                    d.ut_6_o_clock || '-',
                    d.ut_9_o_clock || '-',
                    d.nominal_thickness || '-',
                    diveNo,
                    findings
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: colors.navy, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 7.5, cellPadding: 2, textColor: colors.text, lineColor: colors.border },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 35 },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 20, halign: 'center' },
                6: { cellWidth: 20, halign: 'center' },
                7: { cellWidth: 20, halign: 'center' },
                8: { cellWidth: 30, halign: 'center' },
                9: { cellWidth: 'auto' }
            }
        });

        // Signatures
        const sigY = pageHeight - 35;
        const sigW = contentWidth / 3;
        const drawSig = (label: string, lx: number) => {
            doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1); doc.rect(lx, sigY, sigW - 5, 15);
            doc.setFillColor(...colors.navy); doc.rect(lx, sigY, sigW - 5, 4, 'F');
            doc.setTextColor(255); doc.setFontSize(7); doc.text(label, lx + 2, sigY + 3);
            doc.setTextColor(...colors.text); doc.setFontSize(6); 
            doc.text('Name:', lx + 2, sigY + 10);
            doc.text('Date:', lx + 2, sigY + 13);
        };

        drawSig('PREPARED BY', margin);
        drawSig('REVIEWED BY', margin + sigW);
        drawSig('APPROVED BY', margin + (sigW * 2));

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_SZCI_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return true;

    } catch (e) {
        console.error("SZCI Report Error", e);
        throw e;
    }
};
