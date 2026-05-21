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
    approvedBy?: { name: string; date: string };
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

/**
 * Diving UT Calibration Report (UTCLB) — Portrait
 *
 * Columns: Item No. | Dive No. | Equipment Type | Serial no. | Calibration Block | [Labels 1-6] | Probe
 */
export const generateDivingUTCLBReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin       = 12;
        const contentWidth = pageWidth - margin * 2;

        const colors = {
            navy:      [31,  55,  93]  as [number, number, number],
            teal:      [20,  184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border:    [203, 213, 225] as [number, number, number],
            text:      [30,  41,  59]  as [number, number, number],
            anomaly:   [220, 38,  38]  as [number, number, number],
            rectified: [22,  163, 74]  as [number, number, number],
            finding:   [124, 58,  237] as [number, number, number],
        };

        // ── Date range ──────────────────────────────────────────────────────────
        let startDate: Date | null = null;
        let endDate:   Date | null = null;
        if (records.length > 0) {
            const dates = records
                .map(r => new Date(r.cr_date || r.created_at))
                .filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) { startDate = min(dates); endDate = max(dates); }
        }
        const dateRangeStr = startDate && endDate
            ? `${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}`
            : "N/A";

        const HEADER_H = 24;

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
        const drawPageHeader = (d: jsPDF) => {
            const isPF = config.printFriendly;
            if (isPF) {
                d.setDrawColor(...colors.navy); d.setLineWidth(0.5);
                d.rect(margin, margin, contentWidth, HEADER_H, "S");
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy);
                d.rect(margin, margin, contentWidth, HEADER_H, "F");
                d.setTextColor(255);
            }

            if (companyLogo)    drawLogo(d, companyLogo,    18, 18, pageWidth - margin - 22, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 18, 18, margin + 4,              margin + 3, "left",  "center");

            d.setFontSize(9);   d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6,  { align: "center" });
            d.setFontSize(7);   d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Inspection Division",  margin + contentWidth / 2, margin + 10, { align: "center" });
            d.setFontSize(12);  d.setFont("helvetica", "bold");
            d.text("Diving UT Calibration Report",                          margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`,                 margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        // ── Context boxes ───────────────────────────────────────────────────────
        const ROW_H = 7;
        const drawContextRow = (d: jsPDF, y: number) => {
            const isPF = config.printFriendly;
            const half = contentWidth / 2;
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1);
                if (!isPF) { d.setFillColor(...colors.lightGray); d.rect(x, ty, w, ROW_H, "F"); }
                d.rect(x, ty, w, ROW_H, "S");
                d.setTextColor(...colors.text);
                d.setFontSize(7.5); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4.8);
                d.setFont("helvetica", "normal");
                d.text(String(value), x + 36, ty + 4.8);
            };
            drawBox("Structure:",        headerData.platformName || "N/A", margin,       half, y);
            drawBox("Vessel:",           headerData.vessel       || "N/A", margin + half, half, y);
            drawBox("Job Pack:",         headerData.jobpackName  || "N/A", margin,       half, y + ROW_H);
            drawBox("Insp. Date Range:", dateRangeStr,                     margin + half, half, y + ROW_H);
            return y + ROW_H * 2 + 4;
        };

        // ── Determine Dynamic Columns for Labels ──────────────────────────────
        // Find the record with the most populated labels (up to 6)
        let maxLabels = 0;
        let activeLabels: string[] = [];
        for (const r of records) {
            const d = r.inspection_data || {};
            let count = 0;
            const currentLabels: string[] = [];
            for (let i = 1; i <= 6; i++) {
                const l = d[`label0${i}`];
                if (l && l.trim() !== '') {
                    count++;
                    currentLabels.push(l.trim());
                }
            }
            if (count > maxLabels) {
                maxLabels = count;
                activeLabels = currentLabels;
            }
        }
        
        // Ensure at least one label if there are no labels in any record to avoid empty columns
        if (maxLabels === 0) {
            maxLabels = 1;
            activeLabels = ["Reading"];
        }

        // ── Build each table row ────────────────────────────────────────────────
        const isPF = config.printFriendly;

        const buildRow = (r: any, idx: number): string[] => {
            const d = r.inspection_data || {};
            
            const diveNo =
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.dive_job_id || "—";

            const equipmentType = d.calib_equipment_type || "—";
            const serialNo = d.serial_number || "—";
            const calBlock = d.calib_block ?? d.calibration_block ?? d.cal_block ?? "—";
            
            const probeParts = [];
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

            // Add readings corresponding to active labels
            for (let i = 1; i <= maxLabels; i++) {
                const reading = d[`reading0${i}`];
                row.push(reading !== undefined && reading !== null && reading !== '' ? String(reading) : "—");
            }

            row.push(probeStr);

            return row;
        };

        // ── Header definitions ──────────────────────────────────────────────────
        const headerRow: any[] = [
            { content: "Item\nNo.",        styles: { halign: "center", valign: "middle" } },
            { content: "Dive No.",         styles: { halign: "center", valign: "middle" } },
            { content: "Equipment\nType",  styles: { halign: "center", valign: "middle" } },
            { content: "Serial No.",       styles: { halign: "center", valign: "middle" } },
            { content: "Calibration\nBlock",styles: { halign: "center", valign: "middle" } },
        ];
        
        for (let i = 0; i < maxLabels; i++) {
            headerRow.push({ content: activeLabels[i] || `Reading ${i+1}`, styles: { halign: "center", valign: "middle" } });
        }
        
        headerRow.push({ content: "Probe", styles: { halign: "center", valign: "middle" } });

        // Calculate dynamic column widths
        const baseColumns = {
            0: { cellWidth: 10,  halign: "center" }, // Item No
            1: { cellWidth: 16,  halign: "center" }, // Dive No
            2: { cellWidth: 18,  halign: "center" }, // Eq Type
            3: { cellWidth: 18,  halign: "center" }, // S/N
            4: { cellWidth: 20,  halign: "center" }, // Cal Block
        };
        
        const columnStyles: any = { ...baseColumns };
        
        let currentColIdx = Object.keys(baseColumns).length;
        
        // Reading columns
        for (let i = 0; i < maxLabels; i++) {
            columnStyles[currentColIdx] = { cellWidth: 16, halign: "center" };
            currentColIdx++;
        }
        
        // Probe column (Auto to fill remaining space since Findings is removed)
        columnStyles[currentColIdx] = { cellWidth: "auto", halign: "center" };
        currentColIdx++;

        // ── Draw ────────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 10 },
            head: [headerRow],
            body: records.map(buildRow),
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 6.5,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                minCellHeight: 10,
                lineColor: colors.border,
                lineWidth: 0.1,
            },
            styles: {
                fontSize: 6.5,
                cellPadding: 2,
                textColor: colors.text,
                lineColor: colors.border,
                lineWidth: 0.1,
                overflow: "linebreak",
            },
            columnStyles,
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);

                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Diving UT Calibration Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
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

            const drawSig = (label: string, lx: number) => {
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
                doc.text("Date:", lx + 2, sigY + 13.5);
                doc.text("Signature:", lx + 2, sigY + 17);
            };

            drawSig("PREPARED BY",  margin);
            drawSig("REVIEWED BY",  margin + sigW);
            drawSig("APPROVED BY",  margin + sigW * 2);
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`Diving_UT_Calibration_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving UT Calibration Report] Error:", err);
        throw err;
    }
};
