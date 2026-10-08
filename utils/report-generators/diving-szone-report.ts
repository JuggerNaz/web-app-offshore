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
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    returnBlob?: boolean;
    isBlankReport?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

/**
 * Diving Splash Zone Inspection Summary Report (Landscape)
 * Columns: Item No. | QID | CP Reading (-mV) | Wall Thickness 3, 6, 9, 12 | Nominal Thk | Dive No. | Findings
 */
export const generateDivingSZONEReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig,
    supabase?: any
): Promise<Blob | void | null> => {
    try {
        records = normalizeReportRecords(records);
        if (!config?.isBlankReport && (!records || records.length === 0)) {
            return null;
        }

        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;

        const colors = {
            navy: [7, 78, 136]  as [number, number, number],
            teal:      [20,  184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border:    [203, 213, 225] as [number, number, number],
            text:      [30,  41,  59]  as [number, number, number],
            anomaly:   [220, 38,  38]  as [number, number, number],
            rectified: [22,  163, 74]  as [number, number, number],
            finding:   [217, 119, 6] as [number, number, number],
        };

        const dateRangeStr = getInspectionDateRange(records, headerData, config);

        const HEADER_H = 25;

        // ── Pre-load logos ──────────────────────────────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        // ── Header ──────────────────────────────────────────────────────────────
        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `SPLASH ZONE INSPECTION REPORT (DIVING) - ${extraTitleInfo}` : "SPLASH ZONE INSPECTION REPORT (DIVING)",
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

        const drawContextRow = (d: jsPDF, y: number) => {
            return drawStandardContextRow(d, y, {
                structure: headerData.platformName,
                vessel: headerData.vessel,
                jobpack: headerData.jobpackName,
                dateRange: dateRangeStr,
            }, config.printFriendly, margin);
        };

        // ── Sorting & Rows ──────────────────────────────────────────────────────
        const sorted = [...records].sort((a, b) => {
            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elB - elA;
        });

        const isPF = config.printFriendly;

        const buildRow = (r: any, idx: number): string[] => {
            const d = r.inspection_data || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
            
            const primaryCP = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? "";
            const addCP: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : (Array.isArray(d.cp_readings) ? d.cp_readings : []);
            const additionalCPs = addCP
                .map((a: any) => a.reading ?? a.cp_rdg ?? "")
                .filter((val: any) => val !== "" && val !== null && val !== undefined);

            const cpList = [primaryCP, ...additionalCPs].filter((val: any) => val !== "" && val !== null && val !== undefined);
            const cpDisplay = cpList.length > 0
                ? cpList.map((val: any) => String(val).toLowerCase().includes("mv") ? String(val) : `${val} mV`).join("\n")
                : "—";

            const ut3 = d.ut_3_o_clock ?? "—";
            const ut6 = d.ut_6_o_clock ?? "—";
            const ut9 = d.ut_9_o_clock ?? "—";
            const ut12 = d.ut_12_o_clock ?? "—";
            
            // Robust nominal thickness and unit
            const ntVal = getRecordNominalThickness(r);
            const utUnit = d.ut_unit || 
                           r.structure_components?.metadata?.ut_unit || 
                           "mm";
            
            const nt = ntVal !== "-" ? `${ntVal} ${utUnit}` : "—";

            const diveNo =
                r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.dive_job_id || "—";

            const baseFinding = r.description?.trim() || "";
            const findingDisplay = formatReportFindingText(r, baseFinding);

            return [
                String(idx + 1),
                qid,
                cpDisplay,
                String(ut3),
                String(ut6),
                String(ut9),
                String(ut12),
                String(nt),
                String(diveNo),
                findingDisplay,
            ];
        };

        // ── Draw ────────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 10, bottom: config.showSignatures !== false ? 35 : 15 },
            head: [
                [
                    { content: "Item No.", rowSpan: 2, styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "QID", rowSpan: 2, styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "CP Reading\n(mV)", rowSpan: 2, styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Wall Thickness (mm) (o'clock)", colSpan: 4, styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Nominal\nThk (mm)", rowSpan: 2, styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Dive No.", rowSpan: 2, styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Findings", rowSpan: 2, styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                ],
                [
                    { content: "3", styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "6", styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "9", styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "12", styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                ]
            ],
            body: sorted.map(buildRow),
            theme: "grid",
            headStyles: {fillColor: config?.printFriendly ? [255, 255, 255] : colors.navy,
                textColor: config?.printFriendly ? colors.navy : [255, 255, 255],
                fontSize: 7.5,
                fontStyle: "bold",
                halign: "center",
                valign: "middle", lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255],},
            styles: {fontSize: 7,
                cellPadding: 2,
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak", lineWidth: 0.1,},
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 28 },
                2: { cellWidth: 20, halign: "center" },
                3: { cellWidth: 15, halign: "center" },
                4: { cellWidth: 15, halign: "center" },
                5: { cellWidth: 15, halign: "center" },
                6: { cellWidth: 15, halign: "center" },
                7: { cellWidth: 20, halign: "center" },
                8: { cellWidth: 20, halign: "center" },
                9: { cellWidth: "auto" },
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = sorted[data.row.index];
                applyRecordCellStyling(data.cell, r, isPF);
            },
            didDrawCell: (data) => {
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) {
                    drawPageHeader(doc);
                }
                // Footer
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
            },
        });

        const finalY = (doc as any).lastAutoTable?.finalY ?? startY;
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                drawPageHeader(doc);
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
        doc.save(`Diving_Splash_Zone_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving Splash Zone Report] Error:", err);
        throw err;
    }
};

// Export alias for backward compatibility with HMR / Turbopack cache
export const generateDivingSZoneReport = generateDivingSZONEReport;
