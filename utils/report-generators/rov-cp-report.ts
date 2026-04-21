import jsPDF from "jspdf";
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
}

/**
 * ROV CP Survey Report (Portrait)
 * Columns: Item No. | Component QID | Elevation | Dive No. | Tape No. | CP (mV) | Findings
 *
 * CP column shows primary CP reading; additional CP readings are appended to Findings
 * together with their location labels.
 * Anomaly reference number and rectification comments are appended to Findings when present.
 */
export const generateROVCPReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
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
            if (dates.length > 0) {
                startDate = min(dates);
                endDate   = max(dates);
            }
        }
        const dateRangeStr = startDate && endDate
            ? `${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}`
            : "N/A";

        const HEADER_H = 24;

        // ── Pre-load logos (async, once) ────────────────────────────────────────
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
                d.setDrawColor(...colors.navy);
                d.setLineWidth(0.5);
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
            d.setFontSize(13);  d.setFont("helvetica", "bold");
            d.text("ROV CP Survey Report",                                margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`,   margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        // ── Context info boxes ─────────────────────────────────────────────────
        const ROW_H = 7;

        const drawContextRow = (d: jsPDF, startY: number) => {
            const isPF = config.printFriendly;
            const half = contentWidth / 2;
            const drawBox = (label: string, value: string, x: number, w: number, y: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1);
                if (!isPF) { d.setFillColor(...colors.lightGray); d.rect(x, y, w, ROW_H, "F"); }
                d.rect(x, y, w, ROW_H, "S");
                d.setTextColor(...colors.text);
                d.setFontSize(7.5); d.setFont("helvetica", "bold");
                d.text(label, x + 2, y + 4.8);
                d.setFont("helvetica", "normal");
                d.text(String(value), x + 36, y + 4.8);
            };
            drawBox("Structure:",        headerData.platformName  || "N/A", margin,        half, startY);
            drawBox("Vessel:",           headerData.vessel        || "N/A", margin + half,  half, startY);
            drawBox("Job Pack:",         headerData.jobpackName   || "N/A", margin,        half, startY + ROW_H);
            drawBox("Insp. Date Range:", dateRangeStr,                      margin + half,  half, startY + ROW_H);
            return startY + ROW_H * 2 + 4;
        };

        // ── Sort records by elevation (top → bottom) ───────────────────────────
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
                r.insp_rov_jobs?.job_no  || r.insp_rov_jobs?.name  ||
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.rov_job_id || r.dive_job_id || "—";

            const tapeNo = r.insp_video_tapes?.tape_no || d.tape_no || r.tape_id || "—";

            const primaryCP = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? "";
            const cpDisplay  = primaryCP !== "" && primaryCP !== null && primaryCP !== undefined
                ? `${primaryCP} mV`
                : "—";

            const findingsParts: string[] = [];

            const additionals: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : [];
            additionals.forEach((a: any) => {
                const val = a.reading ?? a.cp_rdg ?? "";
                if (val !== "" && val !== null && val !== undefined) {
                    const loc = a.location ? ` @ ${a.location}` : "";
                    findingsParts.push(`Add. CP${loc}: ${val} mV`);
                }
            });

            if (r.description && r.description.trim()) {
                findingsParts.push(r.description.trim());
            }

            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
            if (anomRef) findingsParts.push(`Ref: ${anomRef}`);

            const isRectified = linkedAnom?.is_rectified || r.rectified || false;
            if (isRectified) {
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                findingsParts.push(`Rectified: ${rectRem}`);
            }

            return [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                String(tapeNo),
                cpDisplay,
                findingsParts.length > 0 ? findingsParts.join("\n") : "—",
            ];
        };

        // ── Draw first page ─────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        // ── Main table ─────────────────────────────────────────────────────────
        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin },
            head: [[
                { content: "Item\nNo.",       styles: { halign: "center", valign: "middle" } },
                { content: "Component\nQID",  styles: { halign: "center", valign: "middle" } },
                { content: "Elevation\n(m)",  styles: { halign: "center", valign: "middle" } },
                { content: "Dive No.",         styles: { halign: "center", valign: "middle" } },
                { content: "Tape No.",         styles: { halign: "center", valign: "middle" } },
                { content: "CP (mV)",          styles: { halign: "center", valign: "middle" } },
                { content: "Findings",         styles: { halign: "center", valign: "middle" } },
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
                0: { cellWidth: 11,   halign: "center" },
                1: { cellWidth: 28 },
                2: { cellWidth: 18,   halign: "center" },
                3: { cellWidth: 20,   halign: "center" },
                4: { cellWidth: 18,   halign: "center" },
                5: { cellWidth: 20,   halign: "center" },
                6: { cellWidth: "auto" },
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
            // Sync callback — logos already preloaded above
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
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  ROV CP Survey Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
                    margin, pageHeight - 6
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            },
        });

        // ── Signature block ─────────────────────────────────────────────────────
        const finalY = (doc as any).lastAutoTable?.finalY ?? (pageHeight - 50);
        const sigY   = Math.min(finalY + 8, pageHeight - 38);
        const sigW   = contentWidth / 3;

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

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_CP_Survey_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ROV CP Report] Error:", err);
        throw err;
    }
};
