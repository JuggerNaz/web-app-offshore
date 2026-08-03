import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal } from "./shared-logo";

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
    watermarkText?: string;
}

/**
 * Flooded Member Inspection Diving (FMD) Summary Report Generator
 */
export const generateDivingFMDReport = async (
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
            darkBorder: [148, 163, 184] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            anomaly: [220, 38, 38] as [number, number, number],
            rectified: [22, 163, 74] as [number, number, number],
        };

        // --- 1. Logos Preparation ---
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        // --- 2. Calculate Date Range ---
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (records.length > 0) {
            const dates = records.map(r => new Date(r.cr_date || r.inspection_date)).filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) {
                startDate = min(dates);
                endDate = max(dates);
            }
        }

        const dateRangeStr = startDate && endDate 
            ? `${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`
            : 'N/A';

        const drawHeader = (d: jsPDF) => {
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

            if (companyLogo)    drawLogo(d, companyLogo,    16, 16, pageWidth - margin - 20, margin + 3, 'right', 'center');
            if (contractorLogo) drawLogo(d, contractorLogo, 16, 16, margin + 4,              margin + 3, 'left',  'center');

            d.setFontSize(8); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 10, { align: 'center' });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text(`Flooded Member Inspection Report (Diving)`, margin + (contentWidth/2), margin + 17, { align: 'center' });

            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || 'N/A'}`, margin + (contentWidth/2), margin + 21, { align: 'center' });
        };

        const drawContext = (d: jsPDF, y: number) => {
            const rowH = 7;
            const tableY = y;
            const colW = contentWidth / 2;
            const isPF = config.printFriendly;
            
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border);
                d.setLineWidth(0.2); 
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, isPF ? 'S' : 'FD'); 
                
                d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold");
                d.text(label, x + 3, ty + 4.8); d.setFont("helvetica", "normal");
                d.text(String(value), x + 36, ty + 4.8);
            };

            drawBox('Structure:', headerData.platformName || 'N/A', margin, colW, tableY);
            drawBox('Vessel / Location:', headerData.vessel || 'N/A', margin + colW, colW, tableY);
            drawBox('Job Pack:', headerData.jobpackName || 'N/A', margin, colW, tableY + rowH);
            drawBox('Insp. Date Range:', dateRangeStr, margin + colW, colW, tableY + rowH);

            // Outer Bounding Box for Context Table
            d.setDrawColor(...colors.darkBorder);
            d.setLineWidth(0.3);
            d.rect(margin, tableY, contentWidth, rowH * 2, 'S');
            
            return tableY + (rowH * 2) + 5;
        };

        drawHeader(doc);
        const startY = drawContext(doc, margin + 22 + 2);
        const isPF = config.printFriendly;

        // Sort all records by elevation top to bottom (descending order)
        const sortedRecords = [...records].sort((a, b) => {
            const elevA = parseFloat(a.elevation || a.verification_depth || a.inspection_data?.verification_depth || 0) || 0;
            const elevB = parseFloat(b.elevation || b.verification_depth || b.inspection_data?.verification_depth || 0) || 0;
            return elevB - elevA;
        });

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin, top: margin + 22 + 6, bottom: 20 },
            head: [
                ['Item No.', 'QID', 'Elevation (m)', 'Dive No.', 'Flooded', 'Grouted', 'Findings']
            ],
            body: sortedRecords.map((r, idx) => {
                const itemNo = idx + 1;
                const qid = r.structure_components?.q_id || r.q_id || r.component_qid || 'N/A';
                
                const elevRaw = r.elevation ?? r.verification_depth ?? r.inspection_data?.verification_depth ?? r.inspection_data?.elevation ?? null;
                const elevVal = elevRaw != null && !isNaN(parseFloat(elevRaw)) ? `${parseFloat(elevRaw).toFixed(2)} m` : (elevRaw ? `${elevRaw} m` : 'N/A');

                const diveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                               r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                               r.dive_job_id || r.rov_job_id || r.inspection_data?.dive_no || 'N/A';

                const data = r.inspection_data || {};

                // Flooded status resolution
                const isFlooded = data.flooded === true || data.flooded === 'true' || data.flooded === 'Yes' || data.is_flooded === true || data.member_status?.toLowerCase().includes('flooded');
                const floodedStr = data.flooded !== undefined ? (isFlooded ? 'Yes' : 'No') : (data.member_status || 'N/A');

                // Grouted status resolution
                const isGrouted = data.grout === true || data.grout === 'true' || data.grout === 'Yes' || data.grouted === true || data.grouted === 'Yes';
                const groutedStr = data.grout !== undefined || data.grouted !== undefined ? (isGrouted ? 'Yes' : 'No') : 'N/A';

                // Anomaly & Rectified details
                const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || r.rectified_remarks || '';

                // Construct Findings Column
                const findingsParts: string[] = [];
                if (r.description && String(r.description).trim() !== '' && String(r.description).trim().toUpperCase() !== 'N/A') {
                    findingsParts.push(String(r.description).trim());
                } else if (data.remarks && String(data.remarks).trim() !== '') {
                    findingsParts.push(String(data.remarks).trim());
                }

                if (isAnomaly && anomRef) {
                    findingsParts.push(`[Ref: ${anomRef}]`);
                }

                if (isRectified) {
                    findingsParts.push(`[Rectified: ${rectRem || 'Completed'}]`);
                }

                return [
                    String(itemNo),
                    qid,
                    elevVal,
                    diveNo,
                    floodedStr,
                    groutedStr,
                    findingsParts.length > 0 ? findingsParts.join('\n') : 'N/A'
                ];
            }),
            theme: 'grid',
            headStyles: { 
                fillColor: isPF ? [255, 255, 255] : colors.navy, 
                textColor: isPF ? colors.navy : 255, 
                fontSize: 8, 
                fontStyle: 'bold', 
                halign: 'center',
                lineWidth: 0.3,
                lineColor: colors.border
            },
            styles: { 
                fontSize: 7.5, 
                cellPadding: 2.5, 
                textColor: colors.text, 
                lineColor: colors.border,
                lineWidth: 0.2
            },
            tableLineWidth: 0.3,
            tableLineColor: colors.darkBorder,
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const r = sortedRecords[data.row.index];
                    if (r) {
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
                }
            },
            columnStyles: {
                0: { cellWidth: 16, halign: 'center' },
                1: { cellWidth: 28, fontStyle: 'bold', halign: 'left' },
                2: { cellWidth: 22, halign: 'center' },
                3: { cellWidth: 22, halign: 'center' },
                4: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
                5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
                6: { cellWidth: 'auto', halign: 'left' }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawHeader(doc);

                // Bottom page footer bar
                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.darkBorder); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Flooded Member Inspection Report (Diving)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
                    margin, pageHeight - 6
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            }
        });

        // --- 4. Signatures Block ---
        const finalY = (doc as any).lastAutoTable?.finalY ?? (margin + 40);
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                drawHeader(doc);
                sigY = pageHeight - 38;
            }
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.2);
                doc.rect(lx, sigY, sigW - 4, 18);
                if (!config.printFriendly) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 4, 4.5, "FD");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(7); doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.5);
                doc.setTextColor(...colors.text); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
                doc.text("Name:", lx + 2, sigY + 10);
                doc.text("Date:", lx + 2, sigY + 13.5);
                doc.text("Signature:", lx + 2, sigY + 17);
            };

            drawSig('PREPARED BY', margin);
            drawSig('REVIEWED BY', margin + sigW);
            drawSig('APPROVED BY', margin + (sigW * 2));
        }

        // --- 5. Apply Watermark & Signatures ---
        applyWatermarkAndSignaturesGlobal(doc, config);

        if (config.returnBlob) return doc.output("blob");

        doc.save(`Diving_FMD_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || 'Report'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("Diving FMD Report Generation Error:", e);
        throw e;
    }
};
