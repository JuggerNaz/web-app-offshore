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
 * Diving General Visual Inspection Report (GVINS) — Portrait
 *
 * Columns: Item No. | QID | Elevation | Dive No. | Coating Condition | Component Condition | Marine Growth % | Findings
 */
export const generateDivingGVINSReport = async (
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
            d.text("Diving General Visual Inspection Report",                          margin + contentWidth / 2, margin + 17, { align: "center" });
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

        // ── Build each table row ────────────────────────────────────────────────
        const sorted = [...records].sort((a, b) => {
            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elB - elA;
        });

        const isPF = config.printFriendly;

        const buildRow = (r: any, idx: number): string[] => {
            const d   = r.inspection_data || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
            const elevation = r.elevation ?? d.elevation ?? "—";

            const diveNo =
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.dive_job_id || "—";

            const coatingCond   = d.coating_condition ?? "—";
            const componentCond = d.component_condition ?? "—";
            const mgPercent     = d.marine_growth ?? d.marine_growth_hard ?? "—";

            const parts: string[] = [];
            if (r.description?.trim()) parts.push(r.description.trim());

            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef    = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
            if (anomRef) parts.push(`Anomaly Ref: ${anomRef}`);

            const isRectified = linkedAnom?.is_rectified || r.rectified || false;
            if (isRectified) {
                const rectComments = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                parts.push(`Rectified Comments: ${rectComments}`);
            }

            return [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                String(coatingCond),
                String(componentCond),
                String(mgPercent),
                parts.length > 0 ? parts.join("\n") : "—",
            ];
        };

        // ── Draw ────────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin },
            head: [[
                { content: "Item\nNo.",       styles: { halign: "center", valign: "middle" } },
                { content: "QID",             styles: { halign: "center", valign: "middle" } },
                { content: "Elevation\n(m)",   styles: { halign: "center", valign: "middle" } },
                { content: "Dive No.",         styles: { halign: "center", valign: "middle" } },
                { content: "Coating\nCondition", styles: { halign: "center", valign: "middle" } },
                { content: "Component\nCondition", styles: { halign: "center", valign: "middle" } },
                { content: "Marine\nGrowth %", styles: { halign: "center", valign: "middle" } },
                { content: "Findings",         styles: { halign: "center", valign: "middle" } },
            ]],
            body: sorted.map(buildRow),
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 7.5,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                minCellHeight: 10,
            },
            styles: {
                fontSize: 7,
                cellPadding: 2,
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak",
            },
            columnStyles: {
                0: { cellWidth: 10,  halign: "center" },
                1: { cellWidth: 22 },
                2: { cellWidth: 16,  halign: "center" },
                3: { cellWidth: 18,  halign: "center" },
                4: { cellWidth: 20,  halign: "center" },
                5: { cellWidth: 20,  halign: "center" },
                6: { cellWidth: 16,  halign: "center" },
                7: { cellWidth: "auto" },
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = sorted[data.row.index];
                const linkedAnom = r.insp_anomalies?.[0] ?? null;
                const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
                const isFinding  = metaStatus === "finding";
                const isAnom     = r.has_anomaly && !isFinding;
                const isRect     = linkedAnom?.is_rectified || r.rectified || false;

                if (isFinding) {
                    data.cell.styles.textColor = colors.finding;
                    data.cell.styles.fontStyle  = "bold";
                } else if (isAnom) {
                    data.cell.styles.textColor = colors.anomaly;
                    data.cell.styles.fontStyle  = "bold";
                } else if (isRect) {
                    data.cell.styles.textColor = colors.rectified;
                    data.cell.styles.fontStyle  = "bold";
                }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);

                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Diving General Visual Inspection Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
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
        doc.save(`Diving_GVINS_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving GVINS Report] Error:", err);
        throw err;
    }
};
