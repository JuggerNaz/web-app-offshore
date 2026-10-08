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
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
    isBlankReport?: boolean;
}

/**
 * ROV Anode Inspection Report (component_type: AN)
 */
export const generateROVAnodeReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    try {
        records = normalizeReportRecords(records);
        if (!config.isBlankReport && (!records || records.length === 0) && !config.returnBlob) {
            return null;
        }

        const isPF = config.printFriendly;
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
            finding:   [217, 119, 6] as [number, number, number]
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
                reportTitle: extraTitleInfo ? `ANODE INSPECTION REPORT (ROV) - ${extraTitleInfo}` : "ANODE INSPECTION REPORT (ROV)",
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

        // --- 2. Data Sorting & Mapping ---
        const sortedRecords = [...records].sort((a, b) => {
            const elevA = parseFloat(a.elevation) || 0;
            const elevB = parseFloat(b.elevation) || 0;
            return elevB - elevA; // Top to bottom (descending order)
        });

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin, top: margin + headerH + 6, bottom: config.showSignatures !== false ? 35 : 15 },
            head: [[
                'Item No.', 'QID', 'Elevation (m)', 'Depletion (%)', 
                'Anode CP (mV)', 'Anode Type', 'Anomaly', 'Dive No.', 'Findings'
            ]],
            body: sortedRecords.length > 0 ? sortedRecords.map((r, idx) => {
                const d = r.inspection_data || r.inspection_dat || {};
                const qid = r.structure_components?.q_id || r.component?.q_id || 'N/A';
                const elev = r.elevation ?? d.elevation ?? '-';
                
                // Formulate Depletion
                const depl = d.depletion_percent ?? d.anode_depletion ?? d.depletion;
                const depletion = depl !== undefined && depl !== null && depl !== '' ? (String(depl).includes('%') ? String(depl) : `${depl}%`) : '-';

                // Formulate CP
                const cpVal = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? '';
                const rawAddCPs = d.cp_rdg_additional || d.cp_additional || d.cp_readings || [];
                const addCPs = Array.isArray(rawAddCPs) ? rawAddCPs.map((cr: any) => cr.reading ?? cr.cp_rdg ?? '').filter((v: any) => v !== undefined && v !== null && v !== '') : [];
                const cpList = [cpVal, ...addCPs].filter(Boolean);
                const cp = cpList.length > 0 ? cpList.map(v => String(v).toLowerCase().includes('mv') ? String(v) : `${v} mV`).join('\n') : '-';

                // Formulate Anode Type from inspection form fields (anode_type / anodeType / etc.)
                const candidateType = d.anode_type ?? d.anodeType ?? d.anode_typ ?? d.an_type ?? d["Anode Type"] ?? d["anode type"] ?? d.anode_type_name;
                let anodeType = '-';
                if (candidateType !== undefined && candidateType !== null && String(candidateType).trim() !== '') {
                    const str = String(candidateType).trim();
                    if (str.toUpperCase() !== 'AN' && str.toUpperCase() !== 'ANODE') {
                        anodeType = str;
                    }
                }
                if (anodeType === '-') {
                    const compMeta = r.structure_components?.metadata || r.component?.metadata || {};
                    const metaType = compMeta.anode_type ?? compMeta.anodeType ?? compMeta.thetype ?? compMeta.anode_type_name ?? compMeta.type;
                    if (metaType !== undefined && metaType !== null && String(metaType).trim() !== '') {
                        const str = String(metaType).trim();
                        if (str.toUpperCase() !== 'AN' && str.toUpperCase() !== 'ANODE') {
                            anodeType = str;
                        }
                    }
                }
                
                // Linked anomaly
                const linkedAnomaly = (r.insp_anomalies && r.insp_anomalies.length > 0) ? r.insp_anomalies[0] : null;
                const isAnomaly = r.has_anomaly || !!linkedAnomaly;
                const isDefect = d.is_defect || r.is_defect;
                const isRectified = linkedAnomaly ? linkedAnomaly.is_rectified : (r.rectified || false);
                const anomalyRef = linkedAnomaly?.anomaly_ref_no || r.anomaly_ref_no || '';
                const rectifiedComments = linkedAnomaly?.rectified_remarks || linkedAnomaly?.rectified_remar || r.rectified_comments || '';

                const diveNo = r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                               r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                               r.rov_job_id || r.dive_job_id || 'N/A';

                const findings = formatReportFindingText(r, r.description);

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
            }) : [
                ["-", "-", "-", "-", "-", "-", "-", "-", "No anode observations recorded for this scope."]
            ],
            theme: 'grid',
            headStyles: {fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, fontSize: 8, fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255]},
            styles: {fontSize: 7, cellPadding: 2, textColor: colors.text, lineColor: colors.border, lineWidth: 0.1},
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
                if (data.section !== "body") return;
                const r = sortedRecords[data.row.index];
                applyRecordCellStyling(data.cell, r, config.printFriendly);
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

        if (config.showSignatures !== false) {
            const sigY = pageHeight - 34;
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
        doc.save(`ROV_Anode_Report_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("Anode Report Error", e);
        throw e;
    }
};
