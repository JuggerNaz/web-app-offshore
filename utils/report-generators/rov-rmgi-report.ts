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
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

/**
 * ROV Marine Growth Inspection Report (RMGI) — Portrait Standard
 *
 * Columns: Item No. | Elevation (m) | Dive No. | Tape No. | Findings
 */
export const generateROVRMGIReport = async (
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
            d.text("Marine Growth Inspection Report (ROV)",                             margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,                 margin + contentWidth / 2, margin + 22, { align: "center" });
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

        // Group by QID and order by QID and Elevation/Time Ascending
        const sorted = [...records].sort((a, b) => {
            const qidA = (a.structure_components?.q_id || a.component?.q_id || "").toUpperCase();
            const qidB = (b.structure_components?.q_id || b.component?.q_id || "").toUpperCase();
            if (qidA !== qidB) return qidA.localeCompare(qidB);

            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elA - elB; // ordered by Asc as requested
        });

        const isPF = config.printFriendly;

        // ── Build each table row ────────────────────────────────────────────────
        const buildRow = (r: any, idx: number): string[] => {
            const d   = r.inspection_data || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
            const elevation = r.elevation ?? d.elevation ?? "—";
            const elevationStr = elevation !== "—" ? `${elevation} m` : "—";

            const diveNo =
                r.insp_rov_jobs?.job_no  || r.insp_rov_jobs?.name  ||
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.rov_job_id || r.dive_job_id || "—";

            const tapeNo = r.insp_video_tapes?.tape_no || d.tape_no || r.tape_id || "—";

            const parts: string[] = [];

            // Add standard thickness/coverage properties if available
            const thicknessParts: string[] = [];
            const clockPositions = ['12', '3', '6', '9'];
            clockPositions.forEach(pos => {
                const hVal = d[`mgi_hard_thickness_at_${pos}`] ?? d[`mgi_hard_thickness`];
                const sVal = d[`mgi_soft_thickness_at_${pos}`] ?? d[`mgi_soft_thickness`];
                if (hVal) thicknessParts.push(`Hard ${pos}H: ${hVal} mm`);
                if (sVal) thicknessParts.push(`Soft ${pos}H: ${sVal} mm`);
            });
            if (thicknessParts.length > 0) {
                parts.push(`Readings: ${thicknessParts.join(", ")}`);
            }

            const mg = d.marine_growth ?? [
                d.marine_growth_hard ? `Hard: ${d.marine_growth_hard}` : '',
                d.marine_growth_soft ? `Soft: ${d.marine_growth_soft}` : ''
            ].filter(Boolean).join(', ');
            if (mg !== "" && mg !== null && mg !== undefined) parts.push(`Marine Growth Coverage: ${mg}`);

            if (r.description?.trim()) parts.push(r.description.trim());

            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef    = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
            if (anomRef) parts.push(`Anomaly Ref: ${anomRef}`);

            const isRectified = linkedAnom?.is_rectified || r.rectified || false;
            if (isRectified) {
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                parts.push(`Rectified Comments: ${rectRem}`);
            }

            return [
                String(idx + 1),
                qid,
                String(elevationStr),
                String(diveNo),
                String(tapeNo),
                parts.length > 0 ? parts.join("\n") : "—",
            ];
        };

        // ── Draw first page ─────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        // ── Main table ──────────────────────────────────────────────────────────
        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 4 },
            head: [[
                { content: "Item No.",        styles: { halign: "center", valign: "middle" } },
                { content: "Component QID",   styles: { halign: "center", valign: "middle" } },
                { content: "Elevation",       styles: { halign: "center", valign: "middle" } },
                { content: "Dive No.",        styles: { halign: "center", valign: "middle" } },
                { content: "Tape No.",        styles: { halign: "center", valign: "middle" } },
                { content: "Findings",        styles: { halign: "center", valign: "middle" } },
            ]],
            body: sorted.map(buildRow),
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 8,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                minCellHeight: 10,
            },
            styles: {
                fontSize: 7.5,
                cellPadding: 2.5,
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak",
            },
            columnStyles: {
                0: { cellWidth: 15,   halign: "center" },
                1: { cellWidth: 35 },
                2: { cellWidth: 22,   halign: "center" },
                3: { cellWidth: 22,   halign: "center" },
                4: { cellWidth: 22,   halign: "center" },
                5: { cellWidth: "auto" },
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
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Marine Growth Inspection Report (ROV)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
                    margin, pageHeight - 6
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            },
        });

        if (config.showSignatures !== false) {
            const finalY = (doc as any).lastAutoTable?.finalY ?? (pageHeight - 50);
            let sigY = pageHeight - 38;

            // If the table ended too low, push signatures to a new page
            if (finalY > sigY - 10) {
                doc.addPage();
                drawPageHeader(doc);
                sigY = pageHeight - 38;
            }
            const sigW   = contentWidth / 3;

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
        doc.save(`ROV_RMGI_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ROV RMGI Report] Error:", err);
        throw err;
    }
};
