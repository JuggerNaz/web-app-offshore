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
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

/**
 * ROV Anode Inspection Report (RGVI + component_type: AN)
 */
export const generateROVAnodeReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    try {
        const isPF = config.printFriendly;
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
            anomaly: [239, 68, 68] as [number, number, number],
            rectified: [34, 197, 94] as [number, number, number]
        };

        // --- 1. Preparation ---
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
            const da = d as any;
            const headerH = 22;
            const isPF = config.printFriendly;
            
            if (isPF) {
                da.setDrawColor(...colors.navy);
                da.setLineWidth(0.5);
                da.rect(margin, margin, contentWidth, headerH, 'S');
                da.setTextColor(...colors.navy);
            } else {
                da.setFillColor(...colors.navy);
                da.rect(margin, margin, contentWidth, headerH, 'F');
                da.setTextColor(255);
            }

            if (companySettings.logo_url) {
                try {
                    const logoData = await loadLogoWithTransparency(companySettings.logo_url);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, pageWidth - margin - 20, margin + 4, 'right', 'center');
                    }
                } catch (e) {}
            }

            if (headerData.contractorLogoUrl) {
                try {
                    const logoData = await loadLogoWithTransparency(headerData.contractorLogoUrl);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, margin + 4, margin + 4, 'left', 'center');
                    }
                } catch (e) {}
            }

            da.setFontSize(10); da.setFont("helvetica", "bold");
            da.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            da.setFontSize(7); da.setFont("helvetica", "normal");
            da.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 10, { align: 'center' });
            da.setFontSize(14); da.setFont("helvetica", "bold");
            da.text(`ROV Anode Inspection Report`, margin + (contentWidth/2), margin + 17, { align: 'center' });

            da.setFontSize(8); da.setFont("helvetica", "normal");
            da.text(`SOW Report No: ${headerData.sowReportNo || 'N/A'}`, margin + (contentWidth/2), margin + 21, { align: 'center' });
        };

        const drawContext = (d: jsPDF, y: number) => {
            const da = d as any;
            const rowH = 7;
            const tableY = y;
            const colW = contentWidth / 2;
            const isPF = config.printFriendly;
            
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                da.setDrawColor(...colors.border); da.setLineWidth(0.1); 
                if (!isPF) da.setFillColor(...colors.lightGray);
                da.rect(x, ty, w, rowH, isPF ? 'S' : 'F'); 
                if (!isPF) da.rect(x, ty, w, rowH, 'S');
                
                da.setTextColor(...colors.text); da.setFontSize(8); da.setFont("helvetica", "bold");
                da.text(label, x + 2, ty + 4.5); da.setFont("helvetica", "normal");
                da.text(String(value), x + 40, ty + 4.5);
            };

            drawBox('Structure:', headerData.platformName, margin, colW, tableY);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + colW, colW, tableY);
            drawBox('Job Pack:', headerData.jobpackName, margin, colW, tableY + rowH);
            drawBox('Insp. Date Range:', dateRangeStr, margin + colW, colW, tableY + rowH);
            
            return tableY + (rowH * 2) + 5;
        };

        await drawHeader(doc);
        const startY = drawContext(doc, margin + 22 + 2);

        // --- 2. Data Sorting & Mapping ---
        const sortedRecords = [...records].sort((a, b) => {
            const elevA = parseFloat(a.elevation) || 0;
            const elevB = parseFloat(b.elevation) || 0;
            return elevB - elevA; // Top to bottom (descending order)
        });

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin },
            head: [[
                'Item No.', 'QID', 'Elevation (m)', 'Depletion (%)', 
                'Anode CP (mV)', 'Anode Type', 'Anomaly', 'Dive No.', 'Findings'
            ]],
            body: sortedRecords.map((r, idx) => {
                const d = r.inspection_data || r.inspection_dat || {};
                const qid = r.structure_components?.q_id || 'N/A';
                const elev = r.elevation || '-';
                const depletion = d.anode_depletion_percent !== undefined ? `${d.anode_depletion_percent}%` : (d.anode_depletion || '-');
                const cp = d.cp_reading_mv || d.cp_rdg || '-';
                const anodeType = d.anode_type || '-';
                
                const isAnomaly = r.has_anomaly === true || r.is_anomaly === true || r.component_condition === 'Anomalous' || (r.description && r.description.toLowerCase().includes('anomaly')) || (r.insp_anomalies && r.insp_anomalies.length > 0);
                const isDefect = r.has_defect === true || r.is_defect === true || (r.description && r.description.toLowerCase().includes('defect'));
                
                // Get linked anomaly data if exists
                const linkedAnomaly = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                const isRectified = linkedAnomaly ? linkedAnomaly.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                
                const anomalyRef = linkedAnomaly?.anomaly_ref_no || linkedAnomaly?.anomaly_ref_n || r.anomaly_ref_no || r.ref_no || r.anomaly_no || (d._meta_ref_no) || '';
                const rectifiedComments = linkedAnomaly?.rectified_remarks || linkedAnomaly?.rectified_remar || r.rectified_comments || '';

                const diveNo = r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                               r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                               r.rov_job_id || r.dive_job_id || 'N/A';

                const findingsLines: string[] = [];
                if (r.description) findingsLines.push(r.description);
                if ((isAnomaly || isDefect) && anomalyRef) {
                    findingsLines.push(`[Reference: ${anomalyRef}]`);
                }
                if (isRectified) {
                    findingsLines.push(`Rectified: ${rectifiedComments || 'N/A'}`);
                }

                const findings = findingsLines.length > 0 ? findingsLines.join('\n') : 'No significant findings';

                return [
                    idx + 1,
                    qid,
                    elev,
                    depletion,
                    cp,
                    anodeType,
                    (isAnomaly || isDefect) ? 'Yes' : 'No',
                    diveNo,
                    findings
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 7, cellPadding: 2, textColor: colors.text, lineColor: colors.border },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 35 },
                2: { cellWidth: 22, halign: 'center' },
                3: { cellWidth: 22, halign: 'center' },
                4: { cellWidth: 22, halign: 'center' },
                5: { cellWidth: 25 },
                6: { cellWidth: 18, halign: 'center' },
                7: { cellWidth: 25, halign: 'center' },
                8: { cellWidth: 'auto' }
            },
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const r = sortedRecords[data.row.index];
                    const linkedAnomaly = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                    
                    const isAnomaly = r.has_anomaly === true || r.is_anomaly === true || r.component_condition === 'Anomalous' || (r.description && r.description.toLowerCase().includes('anomaly')) || !!linkedAnomaly;
                    const isDefect = r.has_defect === true || r.is_defect === true || (r.description && r.description.toLowerCase().includes('defect'));
                    const isRectified = linkedAnomaly ? linkedAnomaly.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                    
                    if (isAnomaly || isDefect) {
                        data.cell.styles.textColor = colors.anomaly;
                        data.cell.styles.fontStyle = 'bold';
                    } else if (isRectified) {
                        data.cell.styles.textColor = colors.rectified;
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
            });

        if (config.showSignatures !== false) {
            const sigY = pageHeight - 35;
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number) => {
                const da = doc as any;
                const isPF = config.printFriendly;
                da.setDrawColor(...colors.navy); da.setLineWidth(0.1); da.rect(lx, sigY, sigW - 5, 15, 'S');
                if (!isPF) {
                    da.setFillColor(...colors.navy); da.rect(lx, sigY, sigW - 5, 4, 'F');
                    da.setTextColor(255);
                } else {
                    da.setTextColor(...colors.navy);
                }
                da.setFontSize(7); da.text(label, lx + 2, sigY + 3);
                da.setTextColor(...colors.text); da.setFontSize(6); 
                da.text('Name:', lx + 2, sigY + 10);
                da.text('Date:', lx + 2, sigY + 13);
            };

            drawSig('PREPARED BY', margin);
            drawSig('REVIEWED BY', margin + sigW);
            drawSig('APPROVED BY', margin + (sigW * 2));
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Anode_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("Anode Report Error", e);
        throw e;
    }
};
