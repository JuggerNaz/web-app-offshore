import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal , formatPdfDate } from "./shared-logo";

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
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

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
            d.text(`Flooded Member Detection Report (ROV)`, margin + (contentWidth/2), margin + 17, { align: 'center' });

            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || 'N/A'}`, margin + (contentWidth/2), margin + 21, { align: 'center' });
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

        drawHeader(doc);
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
            margin: { left: margin, right: margin, top: margin + 22 + 6 },
            head: [
                ['Component QID', 'Elevation (m)', 'Dive No.', 'Tape No.', 'Status', 'Density Value', 'Findings']
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

                const data = r.inspection_data || {};

                // 1. Primary Density & Location extraction
                const primaryDensityRaw = data.density_value ?? data.density ?? data.density_val ?? data.count_rate ?? data.count_value ?? data.reading ?? null;
                const primaryUnit = data.density_value_unit ?? data.density_unit ?? data.unit ?? (primaryDensityRaw != null && !isNaN(parseFloat(primaryDensityRaw)) ? 'g/cm³' : '');
                const primaryLocation = data.test_point_location ?? data.test_point ?? data.location ?? data.position ?? data.test_location ?? null;

                let primaryDensityStr = '';
                if (primaryDensityRaw != null && String(primaryDensityRaw).trim() !== '' && String(primaryDensityRaw).trim().toUpperCase() !== 'N/A') {
                    const valStr = String(primaryDensityRaw).trim();
                    primaryDensityStr = primaryUnit && !valStr.toLowerCase().includes(primaryUnit.toLowerCase()) 
                        ? `${valStr} ${primaryUnit}` 
                        : valStr;
                }

                // 2. Additional Density Readings Array
                const additionalArr = (
                    (Array.isArray(data.fmd_density_rdg_additional) && data.fmd_density_rdg_additional) ||
                    (Array.isArray(data.fmd_additional) && data.fmd_additional) ||
                    (Array.isArray(data.density_additional) && data.density_additional) ||
                    (Array.isArray(data.additional_readings) && data.additional_readings) ||
                    (Array.isArray(data.additional_density) && data.additional_density) ||
                    (Array.isArray(data.fmd_density_additional) && data.fmd_density_additional) ||
                    []
                );

                const densityColumnList: string[] = [];
                const locationDetailList: string[] = [];

                if (primaryDensityStr) {
                    densityColumnList.push(primaryDensityStr);
                    if (primaryLocation && String(primaryLocation).trim() !== '' && String(primaryLocation).trim().toUpperCase() !== 'N/A') {
                        locationDetailList.push(`• ${String(primaryLocation).trim()}: ${primaryDensityStr}`);
                    }
                }

                additionalArr.forEach((item: any) => {
                    if (!item) return;
                    const addDensityRaw = item.density_value ?? item.density ?? item.reading ?? item.value ?? item.count_value ?? null;
                    const addUnit = item.density_value_unit ?? item.unit ?? primaryUnit ?? '';
                    const addLocation = item.test_point_location ?? item.test_point ?? item.location ?? item.position ?? item.pos ?? null;

                    if (addDensityRaw != null && String(addDensityRaw).trim() !== '' && String(addDensityRaw).trim().toUpperCase() !== 'N/A') {
                        const valStr = String(addDensityRaw).trim();
                        const fullAddDensity = addUnit && !valStr.toLowerCase().includes(addUnit.toLowerCase())
                            ? `${valStr} ${addUnit}`
                            : valStr;

                        densityColumnList.push(fullAddDensity);

                        if (addLocation && String(addLocation).trim() !== '' && String(addLocation).trim().toUpperCase() !== 'N/A') {
                            locationDetailList.push(`• ${String(addLocation).trim()}: ${fullAddDensity}`);
                        } else {
                            locationDetailList.push(`• Reading: ${fullAddDensity}`);
                        }
                    }
                });

                const densityColValue = densityColumnList.length > 0 ? densityColumnList.join('\n') : '-';

                // Construct findings from record description and density location details
                let findingsParts: string[] = [];
                if (r.description && String(r.description).trim() !== '' && String(r.description).trim().toUpperCase() !== 'N/A') {
                    findingsParts.push(String(r.description).trim());
                }

                if (locationDetailList.length > 0) {
                    findingsParts.push(`Location & Density Details:\n${locationDetailList.join('\n')}`);
                }

                if (isAnomaly && anomRef) findingsParts.push(`[Reference: ${anomRef}]`);
                if (isRectified) findingsParts.push(`Rectified: ${rectRem || 'N/A'}`);

                return [
                    qid,
                    isNaN(depth) ? r.elevation : depth.toFixed(2),
                    diveNo,
                    tapeNo,
                    data.member_status || 'N/A',
                    densityColValue,
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
                0: { cellWidth: 26, fontStyle: 'bold', halign: 'left' },
                1: { cellWidth: 20, halign: 'center' },
                2: { cellWidth: 18, halign: 'center' },
                3: { cellWidth: 28, halign: 'left' },
                4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
                5: { cellWidth: 24, halign: 'center' },
                6: { cellWidth: 'auto', halign: 'left' }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawHeader(doc);

                // Bottom bar
                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Flooded Member Detection Report (ROV)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
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

            drawSig("PREPARED BY", margin, config?.preparedBy);
            drawSig("REVIEWED BY", margin + sigW, config?.reviewedBy);
            drawSig("APPROVED BY", margin + (sigW * 2), config?.approvedBy);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`ROV_FMD_Report_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("FMD Report Error", e);
        throw e;
    }
};
