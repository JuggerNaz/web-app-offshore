import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo , applyWatermarkAndSignaturesGlobal } from "./shared-logo";

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
 * Diving Splash Zone Inspection Summary Report (Landscape)
 * Columns: Item No. | QID | CP Reading (-mV) | Wall Thickness 3, 6, 9, 12 | Nominal Thk | Dive No. | Findings
 */
export const generateDivingSZONEReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig,
    supabase?: any
): Promise<Blob | void> => {
    try {
        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
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
            d.text("Splash Zone Inspection Report (Diving)",                   margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,     margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        // ── Context box ─────────────────────────────────────────────────────────
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
            const ntVal = d.nominal_thickness || 
                          r.structure_components?.metadata?.nominal_thickness || 
                          r.structure_components?.metadata?.nom_thick || 
                          "—";
            const utUnit = d.ut_unit || 
                           r.structure_components?.metadata?.ut_unit || 
                           "mm";
            
            const nt = ntVal !== "—" ? `${ntVal} ${utUnit}` : "—";

            const diveNo =
                r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.dive_job_id || "—";

            const parts: string[] = [];
            if (r.description?.trim()) parts.push(r.description.trim());

            // Append additional CP readings
            if (Array.isArray(addCP) && addCP.length > 0) {
                addCP.forEach((item: any) => {
                    const val = item.reading ?? item.cp_rdg ?? "";
                    if ((val !== "" && val !== null && val !== undefined) || item.location) {
                        const loc = item.location ? ` @ ${item.location}` : "";
                        const unit = String(val).toLowerCase().includes("mv") || !val ? "" : " mV";
                        parts.push(`Add. CP${loc}: ${val}${unit}`);
                    }
                });
            }

            // Append additional UT readings
            const addUT = d.ut_readings_additional || [];
            if (Array.isArray(addUT) && addUT.length > 0) {
                addUT.forEach((item: any) => {
                    if (item.reading) {
                        parts.push(`Add. UT: ${item.reading}mm${item.location ? ` (${item.location})` : ""}`);
                    }
                });
            }

            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
            if (anomRef) parts.push(`Anomaly Ref: ${anomRef}`);

            const isRectified = linkedAnom?.is_rectified || r.rectified || false;
            if (isRectified) {
                const rectComments = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                parts.push(`Rectified Comments: ${rectComments}`);
            }

            return [
                String(idx + 1),
                qid,
                String(cpDisplay),
                String(ut3),
                String(ut6),
                String(ut9),
                String(ut12),
                String(nt),
                String(diveNo),
                parts.length > 0 ? parts.join("\n") : "—",
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
                    { content: "Item No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "QID", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "CP Reading\n(mV)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Wall Thickness (mm) (o'clock)", colSpan: 4, styles: { halign: "center", valign: "middle" } },
                    { content: "Nominal\nThk (mm)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Dive No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Findings", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                ],
                [
                    { content: "3", styles: { halign: "center" } },
                    { content: "6", styles: { halign: "center" } },
                    { content: "9", styles: { halign: "center" } },
                    { content: "12", styles: { halign: "center" } },
                ]
            ],
            body: sorted.map(buildRow),
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 7.5,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
            },
            styles: {
                fontSize: 7,
                cellPadding: 2,
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak",
            },
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
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Splash Zone Report (Diving)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
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
