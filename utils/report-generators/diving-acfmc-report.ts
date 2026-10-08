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
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
    isBlankReport?: boolean;
}

/**
 * Diving ACFMC Inspection Report (ACFMC) — Landscape
 *
 * Columns: Item No. | QID | Elevation (m) | Dive No. | Chord / Weld / Brace | Direction of Travel | Clock Position | Page | Probe No. | Findings
 */
export const generateDivingACFMCReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    records = normalizeReportRecords(records);
    if (!config.isBlankReport && (!records || records.length === 0)) {
        return null;
    }
    try {
        const doc = new jsPDF({ orientation: "landscape" });
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

        // ── Synchronous page header ─────────────────────────────────────────────
        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `ACFM INSPECTION REPORT (DIVING) - ${extraTitleInfo}` : "ACFM INSPECTION REPORT (DIVING)",
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

        // ── Build each table row ────────────────────────────────────────────────
        const sorted = [...records].sort((a, b) => {
            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elB - elA;
        });

        const isPF = config.printFriendly;

        const buildRow = (r: any, idx: number): string[] => {
            const d   = r.inspection_data || r.inspection_dat || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
            const elevation = r.elevation ?? d.elevation ?? "—";

            const diveNo =
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.name ||
                r.dive_job_id || "—";

            const chordWeldBrace = d.chord_weld_brace ?? "—";
            const directionOfTravel = d.direction_travl ?? "—";
            const clockPosition = d.clk_pos ?? "—";
            const page = d.acfmc_page ?? "—";
            const probeNo = d.probe_fl ?? d.probe_flow ?? "—";

            const findings = formatReportFindingText(r, r.description);
            return [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                String(chordWeldBrace),
                String(directionOfTravel),
                String(clockPosition),
                String(page),
                String(probeNo),
                findings,
            ];
        };

        // ── Draw ────────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 10 },
            head: [[
                { content: "Item\nNo.",             styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "QID",                   styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Elevation\n(m)",        styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Dive No.",              styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Chord / Weld / Brace",  styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Direction of Travel",   styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Clock Position",        styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Page",                  styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Probe No.",             styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                { content: "Findings",              styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
            ]],
            body: sorted.map(buildRow),
            theme: "grid",
            headStyles: {
                fillColor: config?.printFriendly ? [255, 255, 255] : colors.navy,
                textColor: config?.printFriendly ? colors.navy : [255, 255, 255],
                fontSize: 7.5,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                minCellHeight: 10,
                lineColor: colors.border,
                lineWidth: 0.1,
            },
            styles: {
                fontSize: 7,
                cellPadding: 2,
                textColor: colors.text,
                lineColor: colors.border,
                lineWidth: 0.1,
                overflow: "linebreak",
                halign: "center",
                valign: "middle",
            },
            columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 24 },
                2: { cellWidth: 18 },
                3: { cellWidth: 18 },
                4: { cellWidth: 30 },
                5: { cellWidth: 28 },
                6: { cellWidth: 22 },
                7: { cellWidth: 16 },
                8: { cellWidth: 20 },
                9: { cellWidth: "auto", halign: "left" },
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = sorted[data.row.index];
                applyRecordCellStyling(data.cell, r, isPF);
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);

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

        if (config.showSignatures !== false) {
            const sigH   = 20;
            const sigW   = contentWidth / 3;
            let finalY   = (doc as any).lastAutoTable?.finalY ?? (margin + HEADER_H + 20);
            
            // If not enough space for signature (sigH + margin), add new page
            if (finalY + sigH + 15 > pageHeight) {
                doc.addPage();
                drawPageHeader(doc);
                finalY = margin + HEADER_H + 10;
            }

            const sigY = pageHeight - 35; // Fixed position near bottom

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
        doc.save(`ACFM_Inspection_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving ACFMC Report] Error:", err);
        throw err;
    }
};
