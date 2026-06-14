import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal } from "./shared-logo";

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
 * Diving Anode Maintenance Inspection Report (ANMAIN) — Landscape
 */
export const generateDivingANMAINReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    try {
        const doc = new jsPDF({ orientation: "landscape" });
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
            d.setFontSize(14);  d.setFont("helvetica", "bold");
            d.text("Anode Maintenance Inspection Report",                  margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`,     margin + contentWidth / 2, margin + 22, { align: "center" });
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

        // ── Data Sorting & Mapping ──────────────────────────────────────────────
        const sortedRecords = [...records].sort((a, b) => {
            const elevA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elevB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elevB - elevA; // Top to bottom
        });

        const buildRow = (r: any, idx: number) => {
            const d = r.inspection_data || r.inspection_dat || {};
            
            const qid = r.structure_components?.q_id || r.component?.q_id || "—";
            const elevVal = r.elevation ?? d.elevation;
            const elev = (elevVal !== undefined && elevVal !== null && elevVal !== "") ? `${elevVal} m` : "—";
            
            const diveNo =
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.name ||
                r.dive_job_id || "—";

            const anodeType = d.anode_type || "—";
            
            let instDateStr = "—";
            if (d.installed_date) {
                try {
                    instDateStr = format(new Date(d.installed_date), "dd MMM yyyy");
                } catch (_) {
                    instDateStr = String(d.installed_date);
                }
            }
            
            const replacedInstalled = d.replaced === true ? "Replaced" : "Installed";
            const position = d.position || "—";
            const life = d.life !== undefined && d.life !== null && d.life !== "" ? `${d.life} Years` : "—";
            const installedType = d.installed_type || "—";

            const isAnomaly = r.has_anomaly === true || r.is_anomaly === true || r.component_condition === "Anomalous" || (r.description && r.description.toLowerCase().includes("anomaly")) || (r.insp_anomalies && r.insp_anomalies.length > 0);
            const isDefect = r.has_defect === true || r.is_defect === true || (r.description && r.description.toLowerCase().includes("defect"));
            
            const linkedAnomaly = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
            const isRectified = linkedAnomaly ? linkedAnomaly.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes("rectified")));
            
            const anomalyRef = linkedAnomaly?.anomaly_ref_no || r.anomaly_ref_no || r.ref_no || r.anomaly_no || d._meta_ref_no || "";
            const rectifiedComments = linkedAnomaly?.rectified_remarks || r.rectified_comments || "";

            const findingsLines: string[] = [];
            if (r.description) findingsLines.push(r.description);
            if ((isAnomaly || isDefect) && anomalyRef) {
                findingsLines.push(`[Ref: ${anomalyRef}]`);
            }
            if (isRectified) {
                findingsLines.push(`Rectified: ${rectifiedComments || "N/A"}`);
            }

            const findings = findingsLines.length > 0 ? findingsLines.join("\n") : "—";

            return [
                String(idx + 1),
                String(qid),
                String(elev),
                String(diveNo),
                String(anodeType),
                String(instDateStr),
                String(replacedInstalled),
                String(position),
                String(life),
                String(installedType),
                String(findings)
            ];
        };

        const isPF = config.printFriendly;

        // ── Draw ────────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 10 },
            head: [[
                { content: "Item No.",       styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Component QID",  styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Elevation",      styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Dive No.",       styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Anode Type",     styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Installed Date", styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Replaced/Installed", styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Position",       styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Life",           styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Installed Type", styles: { halign: "center" as const, valign: "middle" as const } },
                { content: "Findings",       styles: { halign: "center" as const, valign: "middle" as const } }
            ]],
            body: sortedRecords.map(buildRow),
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 8,
                fontStyle: "bold",
                halign: "center" as const,
                valign: "middle" as const,
                lineColor: colors.border,
                lineWidth: 0.1,
            },
            styles: {
                fontSize: 7.5,
                cellPadding: 2.5,
                textColor: colors.text,
                lineColor: colors.border,
                lineWidth: 0.1,
                overflow: "linebreak",
                halign: "center" as const,
                valign: "middle" as const
            },
            columnStyles: {
                0: { cellWidth: 15 },  // Item No.
                1: { cellWidth: 32 },  // QID
                2: { cellWidth: 20 },  // Elev
                3: { cellWidth: 18 },  // Dive No.
                4: { cellWidth: 22 },  // Anode Type
                5: { cellWidth: 25 },  // Installed Date
                6: { cellWidth: 28 },  // Replaced/Installed
                7: { cellWidth: 20 },  // Position
                8: { cellWidth: 18 },  // Life
                9: { cellWidth: 22 },  // Installed Type
                10: { cellWidth: "auto", halign: "left" as const } // Findings
            },
            didParseCell: (data) => {
                if (data.section === "body") {
                    const r = sortedRecords[data.row.index];
                    const linkedAnomaly = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                    const isAnomaly = r.has_anomaly === true || r.is_anomaly === true || r.component_condition === "Anomalous" || (r.description && r.description.toLowerCase().includes("anomaly")) || !!linkedAnomaly;
                    const isDefect = r.has_defect === true || r.is_defect === true || (r.description && r.description.toLowerCase().includes("defect"));
                    const isRectified = linkedAnomaly ? linkedAnomaly.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes("rectified")));
                    
                    if (isAnomaly || isDefect) {
                        data.cell.styles.textColor = colors.anomaly;
                        data.cell.styles.fontStyle = "bold";
                    } else if (isRectified) {
                        data.cell.styles.textColor = colors.rectified;
                        data.cell.styles.fontStyle = "bold";
                    }
                }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);

                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Anode Maintenance Inspection Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
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
            
            if (finalY + sigH + 15 > pageHeight) {
                doc.addPage();
                drawPageHeader(doc);
            }

            const sigY = pageHeight - 38; // Fixed position near bottom

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

        applyWatermarkAndSignaturesGlobal(doc, config);

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`Anode_Maintenance_Inspection_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ANMAIN Report] Error:", err);
        throw err;
    }
};
