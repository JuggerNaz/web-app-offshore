import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import {
    loadLogoWithTransparency,
    applyWatermarkAndSignaturesGlobal,
    formatPdfDate,
    normalizeReportRecords,
    getInspectionDateRange,
    applyRecordCellStyling,
    REPORT_FOOTER_APP_TEXT,
    draw3SectionHeader,
    drawStandardContextRow,
} from "./shared-logo";

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
    isBlankReport?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

/**
 * Diving UT Calibration Report (UTCLB) — Landscape
 *
 * Columns: No. | Dive No. | Equipment Type | Serial No. | Calibration Block | [Calibration Readings 1..N] | Probe
 */
export const generateDivingUTCLBReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
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
        const contentWidth = pageWidth - margin * 2; // 277mm on A4 landscape

        const colors = {
            navy: [7, 78, 136] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            anomaly: [220, 38, 38] as [number, number, number],
            rectified: [22, 163, 74] as [number, number, number],
            finding: [217, 119, 6] as [number, number, number],
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
                reportTitle: extraTitleInfo ? `UT Calibration Report (Diving) - ${extraTitleInfo}` : "UT Calibration Report (Diving)",
                reportNo: (config?.reportNoPrefix || headerData?.sowReportNo) || "N/A",
                structureName: headerData.platformName
                    ? `${headerData.platformName}${headerData.jobpackName ? ` - ${headerData.jobpackName}` : ""}`
                    : headerData.jobpackName,
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
            return drawStandardContextRow(
                d,
                y,
                {
                    structure: headerData.platformName,
                    vessel: headerData.vessel,
                    jobpack: headerData.jobpackName,
                    dateRange: dateRangeStr,
                },
                config.printFriendly,
                margin
            );
        };

        // ── Determine Dynamic Columns for Calibration Step Labels ──────────────
        let maxLabels = 0;
        let activeLabels: string[] = [];
        for (const r of records || []) {
            const d = r.inspection_data || {};
            let count = 0;
            const currentLabels: string[] = [];
            for (let i = 1; i <= 6; i++) {
                const l = d[`label0${i}`];
                if (l !== undefined && l !== null && String(l).trim() !== "") {
                    count++;
                    currentLabels.push(String(l).trim());
                }
            }
            if (count > maxLabels) {
                maxLabels = count;
                activeLabels = currentLabels;
            }
        }

        if (maxLabels === 0) {
            if (config?.isBlankReport) {
                maxLabels = 5;
                activeLabels = ["5", "10", "15", "20", "25"];
            } else {
                maxLabels = 1;
                activeLabels = ["Reading"];
            }
        }

        const isPF = config.printFriendly;

        // ── Build each table row ────────────────────────────────────────────────
        const buildRow = (r: any, idx: number): string[] => {
            const d = r.inspection_data || {};

            const diveNo =
                r.insp_dive_jobs?.job_no ||
                r.insp_dive_jobs?.name ||
                r.dive_job_id ||
                "—";

            const equipmentType = d.calib_equipment_type || "—";
            const serialNo = d.serial_number || "—";
            const calBlock = d.calib_block ?? d.calibration_block ?? d.cal_block ?? "—";

            const probeParts: any[] = [];
            if (d.probe) probeParts.push(d.probe);
            if (d.probe_size) probeParts.push(d.probe_size);
            if (d.probe_frequency) probeParts.push(d.probe_frequency);
            const probeStr = probeParts.length > 0 ? probeParts.join(", ") : "—";

            const row = [
                String(idx + 1),
                String(diveNo),
                String(equipmentType),
                String(serialNo),
                String(calBlock),
            ];

            for (let i = 1; i <= maxLabels; i++) {
                const reading = d[`reading0${i}`];
                row.push(reading !== undefined && reading !== null && String(reading).trim() !== "" ? String(reading).trim() : "—");
            }

            row.push(probeStr);
            return row;
        };

        const bodyRows =
            records && records.length > 0
                ? records.map(buildRow)
                : config?.isBlankReport
                ? Array.from({ length: 10 }, () => Array(6 + maxLabels).fill(""))
                : [];

        // ── 2-Tier Header Definitions (Landscape) ───────────────────────────────
        const headerBorderColor = isPF ? colors.border : ([255, 255, 255] as [number, number, number]);
        const hdrStyle = {
            halign: "center" as const,
            valign: "middle" as const,
            lineWidth: 0.1,
            lineColor: headerBorderColor,
        };

        const topHeader: any[] = [
            { content: "No.", rowSpan: 2, styles: hdrStyle },
            { content: "Dive No.", rowSpan: 2, styles: hdrStyle },
            { content: "Equipment\nType", rowSpan: 2, styles: hdrStyle },
            { content: "Serial No.", rowSpan: 2, styles: hdrStyle },
            { content: "Calibration\nBlock", rowSpan: 2, styles: hdrStyle },
            { content: "Calibration Readings (mm)", colSpan: maxLabels, styles: hdrStyle },
            { content: "Probe", rowSpan: 2, styles: hdrStyle },
        ];

        const bottomHeader: any[] = [];
        for (let i = 0; i < maxLabels; i++) {
            bottomHeader.push({
                content: activeLabels[i] || `Reading ${i + 1}`,
                styles: hdrStyle,
            });
        }

        // ── Auto-Sized & Auto-Aligned Landscape Column Widths (277mm total) ────
        // Fixed base columns sum = 11 + 32 + 30 + 26 + 44 = 143mm
        // Remaining 134mm shared cleanly between dynamic readings + Probe ("auto")
        const readingColWidth = Math.max(15, Math.min(22, Math.floor(90 / maxLabels)));
        const columnStyles: Record<number, any> = {
            0: { cellWidth: 11, halign: "center", valign: "middle" }, // No.
            1: { cellWidth: 32, halign: "center", valign: "middle" }, // Dive No.
            2: { cellWidth: 30, halign: "center", valign: "middle" }, // Equipment Type
            3: { cellWidth: 26, halign: "center", valign: "middle" }, // Serial No.
            4: { cellWidth: 44, halign: "center", valign: "middle" }, // Calibration Block
        };

        let colIdx = 5;
        for (let i = 0; i < maxLabels; i++) {
            columnStyles[colIdx] = {
                cellWidth: readingColWidth,
                halign: "center",
                valign: "middle",
            };
            colIdx++;
        }
        // Probe column automatically fills remaining landscape width
        columnStyles[colIdx] = { cellWidth: "auto", halign: "center", valign: "middle" };

        // ── Draw ────────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 10, bottom: config.showSignatures !== false ? 38 : 15 },
            head: [topHeader, bottomHeader],
            body: bodyRows,
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 7.5,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                cellPadding: 2,
                lineWidth: 0.1,
                lineColor: headerBorderColor,
            },
            styles: {
                fontSize: 7.5,
                cellPadding: 2.2,
                textColor: colors.text,
                lineColor: colors.border,
                halign: "center",
                valign: "middle",
                overflow: "linebreak",
                lineWidth: 0.1,
            },
            columnStyles,
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = (records || [])[data.row.index];
                if (r) applyRecordCellStyling(data.cell, r, isPF);
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);

                doc.setFontSize(6.5);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border);
                doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(REPORT_FOOTER_APP_TEXT, margin, pageHeight - 6);
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            },
        });

        if (config.showSignatures !== false) {
            const sigH = 20;
            const sigW = contentWidth / 3;
            const finalY = (doc as any).lastAutoTable?.finalY ?? (margin + HEADER_H + 20);

            if (finalY + sigH + 15 > pageHeight) {
                doc.addPage();
                drawPageHeader(doc);
            }

            const sigY = pageHeight - 35;

            const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy);
                doc.setLineWidth(0.1);
                doc.rect(lx, sigY, sigW - 4, 18);
                if (!isPF) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 4, 4.5, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.5);
                doc.setTextColor(...colors.text);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6.5);
                doc.text("Name:", lx + 2, sigY + 10);
                if (person?.name) doc.text(person.name, lx + 14, sigY + 10);
                doc.text("Date:", lx + 2, sigY + 13.5);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 13.5);
                doc.text("Signature:", lx + 2, sigY + 17);
            };

            drawSig("PREPARED BY", margin, config?.preparedBy);
            drawSig("REVIEWED BY", margin + sigW, config?.reviewedBy);
            drawSig("APPROVED BY", margin + sigW * 2, config?.approvedBy);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        doc.save(
            `Diving_UT_Calibration_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`
        );
    } catch (err) {
        console.error("[Diving UT Calibration Report] Error:", err);
        throw err;
    }
};
