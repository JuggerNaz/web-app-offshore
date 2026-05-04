import { jsPDF } from "jspdf";
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
 * ROV UT Wall Thickness Report (RUTWT)
 */
export const generateROVUTWTReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    try {
        const doc = new jsPDF({ orientation: "landscape" });
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

            d.setFontSize(10); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 9, { align: 'center' });
            
            d.setFontSize(13); d.setFont("helvetica", "bold");
            d.text(`ROV UT Wall Thickness Report`, margin + (contentWidth/2), margin + 15, { align: 'center' });
            
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || 'N/A'}`, margin + (contentWidth/2), margin + 19, { align: 'center' });
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

        const isPF = config.printFriendly;

        // --- 2. Sorting & Mapping ---
        const sortedRecords = [...records].sort((a, b) => {
            const elevA = parseFloat(a.elevation) || 0;
            const elevB = parseFloat(b.elevation) || 0;
            return elevB - elevA; // Top to bottom
        });

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin },
            head: [
                [
                    { content: 'Item No.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } },
                    { content: 'Component QID', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } },
                    { content: 'Elevation (m)', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } },
                    { content: 'Dive No.', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } },
                    { content: 'Wall Thickness Readings (mm)', colSpan: 4, styles: { halign: 'center', fillColor: isPF ? [240,240,240] : colors.teal, textColor: isPF ? colors.text : 255 } },
                    { content: 'Nominal (mm)', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } },
                    { content: 'Findings', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } }
                ],
                [
                    { content: '12 O\'clock', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 7 } },
                    { content: '3 O\'clock', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 7 } },
                    { content: '6 O\'clock', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 7 } },
                    { content: '9 O\'clock', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 7 } }
                ]
            ],
            body: sortedRecords.map((r, idx) => {
                const d = r.inspection_data || r.inspection_dat || {};
                const qid = r.structure_components?.q_id || 'N/A';
                const diveNo = r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                               r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                               r.rov_job_id || r.dive_job_id || 'N/A';
                
                const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || '';

                // Construct findings
                let findingsParts: string[] = [];
                if (r.description) findingsParts.push(r.description);
                
                // Add Additional UT
                const addUT = d.ut_readings_additional || d.ut_additional || [];
                if (Array.isArray(addUT)) {
                    addUT.forEach((item: any) => {
                        if (item.reading) findingsParts.push(`Add. UT: ${item.reading}mm${item.location ? ` (${item.location})` : ''}`);
                    });
                }

                if (isAnomaly && anomRef) {
                    findingsParts.push(`[Reference: ${anomRef}]`);
                }
                if (isRectified) {
                    findingsParts.push(`Rectified: ${rectRem || 'N/A'}`);
                }

                const findings = findingsParts.length > 0 ? findingsParts.join('\n') : 'N/A';
                
                return [
                    idx + 1,
                    qid,
                    r.elevation || '-',
                    diveNo,
                    d.ut_12_o_clock || '-',
                    d.ut_3_o_clock || '-',
                    d.ut_6_o_clock || '-',
                    d.ut_9_o_clock || '-',
                    d.nominal_thickness || '-',
                    findings
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: colors.navy, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
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
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 35 },
                2: { cellWidth: 25, halign: 'center' },
                3: { cellWidth: 30, halign: 'center' },
                4: { cellWidth: 20, halign: 'center' },
                5: { cellWidth: 20, halign: 'center' },
                6: { cellWidth: 20, halign: 'center' },
                7: { cellWidth: 20, halign: 'center' },
                8: { cellWidth: 20, halign: 'center' },
                9: { cellWidth: 'auto' }
            }
        });

        // Signatures
        if (config.showSignatures !== false) {
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
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_UTWT_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("UTWT Report Error", e);
        throw e;
    }
};
