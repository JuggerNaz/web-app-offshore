import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, getInspectionDateRange, formatReportFindingText, applyRecordCellStyling, REPORT_FOOTER_APP_TEXT, draw3SectionHeader, drawStandardContextRow } from "./shared-logo";
import { createClient } from "@/utils/supabase/client";

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
 * ROV Selected Node Inspection Summary Report (Portrait)
 * Columns: Item No. | QID | Elevation | Dive No. | CP | Component Condition | Coating Condition | Findings
 */
export const generateROVSelectedNodeReport = async (
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

        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth  = doc.internal.pageSize.getWidth();
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
            finding:   [124, 58,  237] as [number, number, number],
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

        // ── Page Header ─────────────────────────────────────────────────────────
        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `SELECTED NODE REPORT (ROV) - ${extraTitleInfo}` : "SELECTED NODE REPORT (ROV)",
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

        // ── Sort records by elevation ───────────────────────────────────────────
        const sorted = [...records].sort((a, b) => {
            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elB - elA;
        });

        const isPF = config.printFriendly;

        const buildRow = (r: any, idx: number): string[] => {
            const d   = r.inspection_data || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
            
            const elevationRaw = r.elevation ?? d.elevation ?? "";
            const elevation = elevationRaw !== "" && elevationRaw !== null && elevationRaw !== undefined
                ? `${elevationRaw} m`
                : "—";

            const diveNo =
                r.insp_rov_jobs?.job_no  || r.insp_rov_jobs?.name  ||
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.rov_job_id || r.dive_job_id || "—";

            const primaryCP = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? "";
            const additionals: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : (Array.isArray(d.cp_readings) ? d.cp_readings : []);
            const additionalCPs = additionals
                .map((a: any) => a.reading ?? a.cp_rdg ?? "")
                .filter((val: any) => val !== "" && val !== null && val !== undefined);

            const cpList = [primaryCP, ...additionalCPs].filter((val: any) => val !== "" && val !== null && val !== undefined);
            const cpDisplay = cpList.length > 0
                ? cpList.map((val: any) => String(val).toLowerCase().includes("mv") ? String(val) : `${val} mV`).join("\n")
                : "—";

            const compCond = d.component_condition || r.component_condition || "—";
            const coatCond = d.coating_condition || r.coating_condition || "—";

            const findings = formatReportFindingText(r);

            return [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                cpDisplay,
                String(compCond),
                String(coatCond),
                findings,
            ];
        };

        // ── Draw first page ─────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        // ── Main table ─────────────────────────────────────────────────────────
        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 4, bottom: config.showSignatures !== false ? 35 : 15 },
            head: [[
                { content: "Item\nNo.",       styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "QID",             styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Elevation\n(m)",  styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Dive No.",        styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "CP\n(mV)",        styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Component\nCondition", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Coating\nCondition", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Findings",        styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} }
            ]],
            body: sorted.length > 0 ? sorted.map(buildRow) : [["-", "-", "-", "-", "-", "-", "-", "No selected node observations recorded for this scope."]],
            theme: "grid",
            headStyles: {fillColor: config?.printFriendly ? [255, 255, 255] : colors.navy,
                textColor: config?.printFriendly ? colors.navy : [255, 255, 255],
                fontSize: 8,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                minCellHeight: 10, lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255],},
            styles: {fontSize: 7,
                cellPadding: 2,
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak", lineWidth: 0.1,},
            columnStyles: {
                0: { cellWidth: 8,   halign: "center" },
                1: { cellWidth: 18 },
                2: { cellWidth: 14,   halign: "center" },
                3: { cellWidth: 14,   halign: "center" },
                4: { cellWidth: 14,   halign: "center" },
                5: { cellWidth: 18 },
                6: { cellWidth: 18 },
                7: { cellWidth: "auto" },
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
                // Footer Bottom Text
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
            const drawSigFooter = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1);
                doc.rect(lx, sigY, sigW - 4, 18);
                if (!config.printFriendly) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 4, 4.5, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(7); doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.5);
                doc.setTextColor(...colors.text); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.text("Name:", lx + 2, sigY + 10);
                if (person?.name) doc.text(person.name, lx + 14, sigY + 10);
                doc.text("Date:", lx + 2, sigY + 13.5);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 13.5);
                doc.text("Signature:", lx + 2, sigY + 17);
            };
            drawSigFooter("PREPARED BY", margin, config?.preparedBy);
            drawSigFooter("REVIEWED BY", margin + sigW, config?.reviewedBy);
            drawSigFooter("APPROVED BY", margin + sigW * 2, config?.approvedBy);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`ROV_Selected_Node_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ROV Selected Node Report] Error:", err);
        throw err;
    }
};
