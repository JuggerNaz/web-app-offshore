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

/**
 * ROV Splash Zone Inspection Summary Report (RSZCI)
 */
export const generateROVSZCIReport = async (
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
            white: [255, 255, 255] as [number, number, number],
            pfTealBg: [230, 230, 230] as [number, number, number],
            pfClockBg: [248, 248, 248] as [number, number, number],
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
                reportTitle: extraTitleInfo ? `Splash Zone Inspection Report (ROV) - ${extraTitleInfo}` : "Splash Zone Inspection Report (ROV)",
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
        const currentY = drawContext(doc, margin + headerH + 2);

        const isPF = config.printFriendly;

        // --- 3. Sorting & Mapping ---
        const getRecordElev = (r: any): number => {
            const d = r.inspection_data || r.inspection_dat || {};
            const val = r.elevation ?? d.elevation ?? r.elev ?? d.elev;
            const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
            return isNaN(num) ? 0 : num;
        };

        const sortedRecords = [...records].sort((a, b) => {
            const elevA = getRecordElev(a);
            const elevB = getRecordElev(b);
            if (elevB !== elevA) {
                return elevB - elevA; // Top to bottom
            }
            const qidA = a.structure_components?.q_id || a.component?.q_id || a.component_qid || a.qid || '';
            const qidB = b.structure_components?.q_id || b.component?.q_id || b.component_qid || b.qid || '';
            if (qidA !== qidB) {
                return qidA.localeCompare(qidB);
            }
            return (b.insp_id || 0) - (a.insp_id || 0);
        });

        const formatGrowthPercent = (val: any): string => {
            if (val === undefined || val === null || val === '') return '-';
            const s = String(val).trim();
            if (s === '-' || s.toUpperCase() === 'N/A' || s.toUpperCase() === 'NONE') return '-';
            if (s.includes('%')) return s;
            const num = parseFloat(s);
            if (!isNaN(num)) return `${num}%`;
            return s;
        };

        const extractMarineGrowth = (d: any, r?: any) => {
            let rawHard = d?.marine_growth_hard ?? d?.hard_growth ?? d?.mgi_hard_growth ?? d?.mgi_hard_coverage ?? d?.hard_coverage ?? d?.mg_hard ?? r?.marine_growth_hard ?? r?.hard_growth;
            let rawSoft = d?.marine_growth_soft ?? d?.soft_growth ?? d?.mgi_soft_growth ?? d?.mgi_soft_coverage ?? d?.soft_coverage ?? d?.mg_soft ?? r?.marine_growth_soft ?? r?.soft_growth;

            if ((rawHard === undefined || rawHard === null || rawHard === '') && (rawSoft === undefined || rawSoft === null || rawSoft === '') && (d?.marine_growth || r?.marine_growth)) {
                const mgStr = String(d?.marine_growth || r?.marine_growth).trim();
                const lower = mgStr.toLowerCase();
                
                const hMatch = lower.match(/hard\s*[:=-]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
                if (hMatch) rawHard = hMatch[1];
                
                const sMatch = lower.match(/soft\s*[:=-]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
                if (sMatch) rawSoft = sMatch[1];

                if (!hMatch && !sMatch) {
                    if (lower.startsWith('hard:')) {
                        rawHard = mgStr.split(':').pop()?.replace(/coverage/i, '').trim();
                    } else if (lower.startsWith('soft:')) {
                        rawSoft = mgStr.split(':').pop()?.replace(/coverage/i, '').trim();
                    }
                }
            }

            return {
                hard: formatGrowthPercent(rawHard),
                soft: formatGrowthPercent(rawSoft)
            };
        };

        const topHeader: any[] = [
            { content: 'No.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Component QID', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Elevation (m)', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'CP (mV)', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Wall Thickness (mm)', colSpan: 4, styles: { halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? colors.pfTealBg : colors.teal, textColor: config?.printFriendly ? colors.text : 255, lineWidth: 0.1, lineColor: colors.border } },
            { content: 'Nominal (mm)', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Marine Growth (%)', colSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Component Condition', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Coating Condition', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Dive No.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Findings', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
        ];

        const bottomHeader: any[] = [
            { content: "12 o'clock", styles: { halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? colors.pfClockBg : colors.teal, textColor: config?.printFriendly ? colors.text : 255, fontSize: 7, lineWidth: 0.1, lineColor: colors.border } },
            { content: "3 o'clock", styles: { halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? colors.pfClockBg : colors.teal, textColor: config?.printFriendly ? colors.text : 255, fontSize: 7, lineWidth: 0.1, lineColor: colors.border } },
            { content: "6 o'clock", styles: { halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? colors.pfClockBg : colors.teal, textColor: config?.printFriendly ? colors.text : 255, fontSize: 7, lineWidth: 0.1, lineColor: colors.border } },
            { content: "9 o'clock", styles: { halign: 'center', valign: 'middle', fillColor: config?.printFriendly ? colors.pfClockBg : colors.teal, textColor: config?.printFriendly ? colors.text : 255, fontSize: 7, lineWidth: 0.1, lineColor: colors.border } },
            { content: 'Hard', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
            { content: 'Soft', styles: { halign: 'center', valign: 'middle', fontSize: 7 } }
        ];

        const bodyRows = sortedRecords.length > 0 ? sortedRecords.map((r, idx) => {
            const d = r.inspection_data || r.inspection_dat || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || r.component_qid || r.qid || d.q_id || d.qid || 'N/A';
            const elevVal = r.elevation ?? d.elevation ?? r.elev ?? d.elev;
            const elevDisplay = (elevVal !== undefined && elevVal !== null && String(elevVal).trim() !== '' && String(elevVal).trim() !== '-')
                ? String(elevVal).trim()
                : '-';

            const diveNo = r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                           r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                           r.dive_no || r.deployment_no || d.dive_no || d.deployment_no ||
                           r.rov_job_id || r.dive_job_id || 'N/A';
            
            const rawCP = d.cp_rdg ?? d.cp ?? d.cp_reading ?? d.cp_reading_mv ?? d.cprdg ?? d.cp_value ?? r.cp_reading ?? r.cp ?? '';
            const primaryCP = rawCP !== undefined && rawCP !== null && rawCP !== '' && rawCP !== '-' ? String(rawCP) : '';
            const addCP = d.cp_rdg_additional || d.cp_additional || d.cp_readings || [];
            const additionalCPs = Array.isArray(addCP)
                ? addCP.map((cr: any) => cr.reading ?? cr.cp_rdg ?? '').filter((v: any) => v !== undefined && v !== null && v !== '' && v !== '-')
                : [];
            const cpList = [primaryCP, ...additionalCPs].filter(Boolean);
            const cpDisplay = cpList.length > 0 ? cpList.map(val => String(val)).join('\n') : '-';

            const ut12 = d.ut_12_o_clock ?? d.ut_12 ?? d.ut12 ?? d.ut_12_oclock ?? d.wt_12 ?? d.wall_thickness_12 ?? d.reading_12 ?? d.clock_12 ?? d.readings?.clock_12 ?? d.readings?.['12'] ?? d.ut_readings?.['12'];
            const ut3  = d.ut_3_o_clock ?? d.ut_3 ?? d.ut3 ?? d.ut_3_oclock ?? d.wt_3 ?? d.wall_thickness_3 ?? d.reading_3 ?? d.clock_3 ?? d.readings?.clock_3 ?? d.readings?.['3'] ?? d.ut_readings?.['3'];
            const ut6  = d.ut_6_o_clock ?? d.ut_6 ?? d.ut6 ?? d.ut_6_oclock ?? d.wt_6 ?? d.wall_thickness_6 ?? d.reading_6 ?? d.clock_6 ?? d.readings?.clock_6 ?? d.readings?.['6'] ?? d.ut_readings?.['6'];
            const ut9  = d.ut_9_o_clock ?? d.ut_9 ?? d.ut9 ?? d.ut_9_oclock ?? d.wt_9 ?? d.wall_thickness_9 ?? d.reading_9 ?? d.clock_9 ?? d.readings?.clock_9 ?? d.readings?.['9'] ?? d.ut_readings?.['9'];

            const fmtUT = (val: any) => (val !== undefined && val !== null && val !== '' && val !== '-' ? String(val) : '-');

            const mg = extractMarineGrowth(d, r);

            const compCond = d.component_condition || d.comp_condition || d.comp_cond || r.component_condition || d.condition || '-';
            const coatCond = d.coating_condition || d.coat_condition || d.coat_cond || r.coating_condition || '-';

            const findings = formatReportFindingText(r);
            
            return [
                idx + 1,
                qid,
                elevDisplay,
                cpDisplay,
                fmtUT(ut12),
                fmtUT(ut3),
                fmtUT(ut6),
                fmtUT(ut9),
                getRecordNominalThickness(r),
                mg.hard,
                mg.soft,
                compCond,
                coatCond,
                diveNo,
                findings
            ];
        }) : [
            ["-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "No splash zone observations recorded for this scope."]
        ];

        autoTable(doc, {
            startY: currentY,
            margin: { left: margin, right: margin, top: margin + headerH + 6 },
            head: [topHeader, bottomHeader],
            body: bodyRows,
            theme: 'grid',
            headStyles: {
                fillColor: config?.printFriendly ? colors.white : colors.navy,
                textColor: config?.printFriendly ? colors.navy : 255,
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center',
                lineWidth: 0.1,
                lineColor: config?.printFriendly ? colors.border : colors.white
            },
            styles: {fontSize: 7, cellPadding: 1.5, textColor: colors.text, lineColor: colors.border, lineWidth: 0.1},
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const r = sortedRecords[data.row.index];
                    applyRecordCellStyling(data.cell, r, isPF);
                }
            },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' }, // No.
                1: { cellWidth: 26 },                   // Component QID
                2: { cellWidth: 16, halign: 'center' }, // Elevation (m)
                3: { cellWidth: 15, halign: 'center' }, // CP (mV)
                4: { cellWidth: 13, halign: 'center' }, // 12 o'clock
                5: { cellWidth: 13, halign: 'center' }, // 3 o'clock
                6: { cellWidth: 13, halign: 'center' }, // 6 o'clock
                7: { cellWidth: 13, halign: 'center' }, // 9 o'clock
                8: { cellWidth: 15, halign: 'center' }, // Nominal (mm)
                9: { cellWidth: 13, halign: 'center' }, // Hard (%)
                10: { cellWidth: 13, halign: 'center' },// Soft (%)
                11: { cellWidth: 20, halign: 'center' },// Component Condition
                12: { cellWidth: 20, halign: 'center' },// Coating Condition
                13: { cellWidth: 18, halign: 'center' },// Dive No.
                14: { cellWidth: 'auto' }               // Findings
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

        const finalY = (doc as any).lastAutoTable?.finalY ?? currentY;
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
        doc.save(`ROV_SZCI_Report_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("SZCI Report Error", e);
        throw e;
    }
};
