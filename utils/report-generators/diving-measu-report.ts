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
 * Measurement Dimensional Survey Diving (MEASU) Summary Report Generator
 * Grouped by QID, Elevation, and Dive No.
 */
export const generateDivingMEASUReport = async (
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
            d.text(`Measurement Dimensional Survey Report (Diving)`, margin + (contentWidth/2), margin + 17, { align: 'center' });

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

            // Bounding outer frame
            d.setDrawColor(...colors.darkBorder);
            d.setLineWidth(0.3);
            d.rect(margin, tableY, contentWidth, rowH * 2, 'S');
            
            return tableY + (rowH * 2) + 5;
        };

        drawHeader(doc);
        const startY = drawContext(doc, margin + 22 + 2);
        const isPF = config.printFriendly;

        // --- Helper Data Extractor Functions ---
        const extractType = (item: any, data: any): string => {
            if (item && typeof item === 'object') {
                const val = item.type ?? item.measurement_type ?? item.dim_type ?? item.dimension_type ?? item.label;
                if (val && String(val).trim() !== '' && String(val).trim().toUpperCase() !== 'N/A') return String(val).trim();
            }
            if (data && typeof data === 'object') {
                const val = data.type ?? data.measurement_type ?? data.dim_type ?? data.dimension_type ?? data.label;
                if (val && String(val).trim() !== '' && String(val).trim().toUpperCase() !== 'N/A') return String(val).trim();
            }
            return 'N/A';
        };

        const extractUnit = (item: any, data: any): string => {
            if (item && typeof item === 'object') {
                const val = item.unit ?? item.measurement_unit ?? item.dim_unit ?? item.uom;
                if (val && String(val).trim() !== '' && String(val).trim().toUpperCase() !== 'N/A') return String(val).trim();
            }
            if (data && typeof data === 'object') {
                const val = data.unit ?? data.measurement_unit ?? data.dim_unit ?? data.uom;
                if (val && String(val).trim() !== '' && String(val).trim().toUpperCase() !== 'N/A') return String(val).trim();
            }
            return 'mm';
        };

        const extractResult = (item: any, data: any): string => {
            if (item && typeof item === 'object') {
                const val = item.results ?? item.result ?? item.value ?? item.val ?? item.reading ?? 
                            item.measurement_val ?? item.measurement_result ?? item.dim_result ?? item.res;
                if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim().toUpperCase() !== 'N/A') {
                    return String(val).trim();
                }
            } else if (item != null && typeof item !== 'object' && String(item).trim() !== '') {
                return String(item).trim();
            }

            if (data && typeof data === 'object') {
                const val = data.results ?? data.result ?? data.value ?? data.val ?? data.reading ?? 
                            data.measurement_val ?? data.measurement_result ?? data.dim_result ?? data.res;
                if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim().toUpperCase() !== 'N/A') {
                    return String(val).trim();
                }
            }

            return 'N/A';
        };

        // --- 3. Group Records by QID, Elevation, and Dive No. ---
        interface GroupItem {
            groupKey: string;
            qid: string;
            elevation: string;
            elevNum: number;
            diveNo: string;
            records: any[];
        }

        const groupsMap = new Map<string, GroupItem>();

        records.forEach((r) => {
            const qid = r.structure_components?.q_id || r.q_id || r.component_qid || 'N/A';
            const elevRaw = r.elevation ?? r.verification_depth ?? r.inspection_data?.verification_depth ?? r.inspection_data?.elevation ?? null;
            const elevNum = elevRaw != null && !isNaN(parseFloat(elevRaw)) ? parseFloat(elevRaw) : 0;
            const elevVal = elevRaw != null && !isNaN(parseFloat(elevRaw)) ? `${parseFloat(elevRaw).toFixed(2)} m` : (elevRaw ? `${elevRaw} m` : 'N/A');

            const diveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                           r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                           r.dive_job_id || r.rov_job_id || r.inspection_data?.dive_no || 'N/A';

            const key = `${qid.toUpperCase()}___${elevVal}___${diveNo}`;

            if (!groupsMap.has(key)) {
                groupsMap.set(key, {
                    groupKey: key,
                    qid,
                    elevation: elevVal,
                    elevNum,
                    diveNo,
                    records: []
                });
            }

            groupsMap.get(key)!.records.push(r);
        });

        // Sort groups by elevation descending (top to bottom)
        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => b.elevNum - a.elevNum);

        // --- 4. Build Table Rows with Group Header Banners & Group Findings Footer ---
        const bodyRows: any[] = [];
        let globalItemCounter = 1;

        sortedGroups.forEach((group) => {
            // Group Header Banner Row (Spans across 4 columns)
            bodyRows.push([
                {
                    content: `QID: ${group.qid}   |   Elevation: ${group.elevation}   |   Dive No.: ${group.diveNo}`,
                    colSpan: 4,
                    styles: {
                        fillColor: isPF ? [240, 240, 240] : [241, 245, 249],
                        textColor: colors.navy,
                        fontStyle: 'bold',
                        fontSize: 8,
                        cellPadding: 3.5,
                        halign: 'left'
                    }
                }
            ]);

            const groupFindingsList: string[] = [];

            // Detail Rows under this group
            group.records.forEach((r) => {
                const data = r.inspection_data || {};
                const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || r.rectified_remarks || '';

                if (r.description && String(r.description).trim() !== '' && String(r.description).trim().toUpperCase() !== 'N/A') {
                    const desc = String(r.description).trim();
                    if (!groupFindingsList.includes(desc)) groupFindingsList.push(desc);
                } else if (data.remarks && String(data.remarks).trim() !== '') {
                    const rem = String(data.remarks).trim();
                    if (!groupFindingsList.includes(rem)) groupFindingsList.push(rem);
                }

                if (isAnomaly && anomRef) {
                    const refStr = `[Ref: ${anomRef}]`;
                    if (!groupFindingsList.includes(refStr)) groupFindingsList.push(refStr);
                }

                if (isRectified) {
                    const rectStr = `[Rectified: ${rectRem || 'Completed'}]`;
                    if (!groupFindingsList.includes(rectStr)) groupFindingsList.push(rectStr);
                }

                // Extract measurement items
                let measurementsArr: any[] = [];
                if (Array.isArray(data.measurement)) {
                    measurementsArr = data.measurement;
                } else if (Array.isArray(data.measurements)) {
                    measurementsArr = data.measurements;
                } else if (Array.isArray(data.repeater_measurement)) {
                    measurementsArr = data.repeater_measurement;
                } else if (Array.isArray(data.repeater_measurements)) {
                    measurementsArr = data.repeater_measurements;
                } else if (Array.isArray(data.dimensional_measurements)) {
                    measurementsArr = data.dimensional_measurements;
                } else {
                    measurementsArr = [data];
                }

                measurementsArr.forEach((item: any) => {
                    const mType = extractType(item, data);
                    const mUnit = extractUnit(item, data);
                    const mResult = extractResult(item, data);

                    bodyRows.push({
                        rowCells: [
                            String(globalItemCounter++),
                            mType,
                            mUnit,
                            mResult
                        ],
                        isAnomaly,
                        isRectified
                    });
                });
            });

            // Group Findings Footer Row (Placed cleanly at the end of each QID group)
            const groupFindingsText = groupFindingsList.length > 0 
                ? groupFindingsList.join('; ') 
                : 'No specific findings reported.';

            bodyRows.push([
                {
                    content: `Findings: ${groupFindingsText}`,
                    colSpan: 4,
                    styles: {
                        fillColor: isPF ? [250, 250, 250] : [248, 250, 252],
                        textColor: colors.text,
                        fontStyle: 'bold',
                        fontSize: 7.5,
                        cellPadding: 3,
                        halign: 'left',
                        lineWidth: 0.2,
                        lineColor: colors.border
                    }
                }
            ]);
        });

        // Convert bodyRows to format expected by autoTable
        const bodyForAutoTable = bodyRows.map(row => Array.isArray(row) ? row : row.rowCells);

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin, top: margin + 22 + 6, bottom: 20 },
            head: [
                ['Item No.', 'Type', 'Unit', 'Result']
            ],
            body: bodyForAutoTable,
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
                    const rowObj = bodyRows[data.row.index];
                    if (rowObj && !Array.isArray(rowObj)) {
                        if (rowObj.isAnomaly) {
                            data.cell.styles.textColor = colors.anomaly;
                            data.cell.styles.fontStyle = 'bold';
                        } else if (rowObj.isRectified) {
                            data.cell.styles.textColor = colors.rectified;
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            },
            columnStyles: {
                0: { cellWidth: 24, halign: 'center' },
                1: { cellWidth: 70, halign: 'left', fontStyle: 'bold' },
                2: { cellWidth: 30, halign: 'center' },
                3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawHeader(doc);

                // Bottom page footer bar
                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.darkBorder); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Measurement Dimensional Survey Report (Diving)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
                    margin, pageHeight - 6
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            }
        });

        // --- 5. Signatures Block ---
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
                doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.2);

                doc.setTextColor(...colors.text); doc.setFontSize(6); doc.setFont("helvetica", "normal");
                doc.text("Name:", lx + 2, sigY + 7.5);
                doc.text("Date:", lx + 2, sigY + 11);
                doc.text("Sign:", lx + 2, sigY + 15);
            };
            drawSig("PREPARED BY (INSPECTOR)", margin);
            drawSig("REVIEWED BY (SENIOR INSPECTOR)", margin + sigW);
            drawSig("APPROVED BY (CLIENT REP)", margin + (sigW * 2));
        }

        // Apply Watermark
        applyWatermarkAndSignaturesGlobal(doc, config as any);

        if (config.returnBlob) {
            return doc.output('blob');
        }

        doc.save(`Diving_MEASU_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || 'Report'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (e) {
        console.error("Diving MEASU Report Generation Error:", e);
        throw e;
    }
};
