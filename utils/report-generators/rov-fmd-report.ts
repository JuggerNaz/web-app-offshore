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
    showSignatures?: boolean;
}

/**
 * ROV FMD Inspection Summary Report
 */
export const generateROVFMDReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - (margin * 2);

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            anomaly: [220, 38, 38] as [number, number, number],
            rectified: [22, 163, 74] as [number, number, number],
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
            const isPF = config.printFriendly;
            
            if (isPF) {
                d.setDrawColor(...colors.navy);
                d.setLineWidth(0.5);
                d.rect(margin, margin, contentWidth, headerH, 'S');
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy);
                d.rect(margin, margin, contentWidth, headerH, 'F');
                d.setTextColor(255);
            }

            // 1. Company Logo (Right)
            if (companySettings.logo_url) {
                try {
                    const logoData = await loadLogoWithTransparency(companySettings.logo_url);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, pageWidth - margin - 20, margin + 3, 'right', 'center');
                    }
                } catch (e) {}
            }

            // 2. Contractor Logo (Left)
            if (headerData.contractorLogoUrl) {
                try {
                    const logoData = await loadLogoWithTransparency(headerData.contractorLogoUrl);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, margin + 4, margin + 3, 'left', 'center');
                    }
                } catch (e) {}
            }

            d.setFontSize(8); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 10, { align: 'center' });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text(`ROV Flooded Member Detection Report`, margin + (contentWidth/2), margin + 17, { align: 'center' });

            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || 'N/A'}`, margin + (contentWidth/2), margin + 21, { align: 'center' });
        };

        const drawContext = (d: jsPDF, y: number) => {
            const rowH = 7;
            const tableY = y;
            const colW = contentWidth / 2;
            const isPF = config.printFriendly;
            
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1); 
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, isPF ? 'S' : 'F'); 
                if (!isPF) d.rect(x, ty, w, rowH, 'S');
                
                d.setTextColor(...colors.text); d.setFontSize(7); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4.5); d.setFont("helvetica", "normal");
                d.text(String(value), x + 35, ty + 4.5);
            };

            drawBox('Structure:', headerData.platformName, margin, colW, tableY);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + colW, colW, tableY);
            drawBox('Job Pack:', headerData.jobpackName, margin, colW, tableY + rowH);
            drawBox('Insp. Date Range:', dateRangeStr, margin + colW, colW, tableY + rowH);
            
            return tableY + (rowH * 2) + 5;
        };

        await drawHeader(doc);
        const startY = drawContext(doc, margin + 22 + 2);

        const isPF = config.printFriendly;

        // --- 3. Sorting & Mapping ---
        const sortedRecords = [...records].sort((a, b) => {
            const elevA = parseFloat(a.elevation) || 0;
            const elevB = parseFloat(b.elevation) || 0;
            return elevB - elevA; // Top to bottom
        });

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin },
            head: [
                ['Component QID', 'Elevation (m)', 'Dive No.', 'Tape No.', 'Status', 'Findings']
            ],
            body: sortedRecords.map(r => {
                const depth = parseFloat(r.elevation);
                const qid = r.structure_components?.q_id || 'N/A';
                const diveNo = r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                               r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                               r.rov_job_id || r.dive_job_id || 'N/A';
                const tapeNo = r.insp_video_tapes?.tape_no || 'N/A';
                
                const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || '';

                // Construct findings from record description
                let findingsParts = [];
                if (r.description) findingsParts.push(r.description);
                if (isAnomaly && anomRef) findingsParts.push(`[Reference: ${anomRef}]`);
                if (isRectified) findingsParts.push(`Rectified: ${rectRem || 'N/A'}`);

                const data = r.inspection_data || {};

                return [
                    qid,
                    isNaN(depth) ? r.elevation : depth.toFixed(2),
                    diveNo,
                    tapeNo,
                    data.member_status || 'N/A',
                    findingsParts.length > 0 ? findingsParts.join('\n') : 'N/A'
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 7.5, cellPadding: 2, textColor: colors.text, lineColor: colors.border },
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const r = sortedRecords[data.row.index];
                    const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                    const isAnom = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                    const isRect = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));

                    if (isAnom) {
                        data.cell.styles.textColor = colors.anomaly;
                        data.cell.styles.fontStyle = 'bold';
                    } else if (isRect) {
                        data.cell.styles.textColor = colors.rectified;
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 22, halign: 'center' },
                2: { cellWidth: 25, halign: 'center' },
                3: { cellWidth: 35, halign: 'center' },
                4: { cellWidth: 30, halign: 'center' },
                5: { cellWidth: 'auto' }
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
        doc.save(`ROV_FMD_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("FMD Report Error", e);
        throw e;
    }
};
