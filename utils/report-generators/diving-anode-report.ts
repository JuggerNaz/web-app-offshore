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
 * Diving Selected Anode Inspection Summary Report (Landscape)
 */
export const generateDivingAnodeReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig,
    supabase?: any
): Promise<Blob | void> => {
    try {
        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
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

        // ── Page Header ─────────────────────────────────────────────────────────
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
            d.text("Selected Anode Inspection Report (Diving)",               margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,     margin + contentWidth / 2, margin + 22, { align: "center" });
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
            const elevA = parseFloat(a.elevation) || 0;
            const elevB = parseFloat(b.elevation) || 0;
            return elevB - elevA; // Top to bottom
        });

        const buildRow = (r: any, idx: number) => {
            const d = r.inspection_data || r.inspection_dat || {};
            
            const qid = r.structure_components?.q_id || "—";
            const elev = r.elevation || "—";
            
            const diveNo =
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.name ||
                r.dive_job_id || "—";

            const isSecured = d.anode_secured_to_structure ?? d.anode_secured ?? d.secured;
            const secured = (isSecured === true || isSecured === "Yes") ? "Yes" : "No";
            const anodeType = d.anode_type || "—";

            const wLen = d.anode_length ?? d.wastage_length ?? "—";
            const wC1 = d.circumference_c1 ?? d.wastage_c1 ?? "—";
            const wC2 = d.circumference_c2 ?? d.wastage_c2 ?? "—";
            const wC3 = d.circumference_c3 ?? d.wastage_c3 ?? "—";
            const depletion = d.anode_depletion_percent !== undefined ? `${d.anode_depletion_percent}%` : (d.anode_depletion ?? "—");

            const pitDepthAvg = d.avg_pitting_depth ?? d.pitting_depth_avg ?? "—";
            const pitDepthMax = d.max_pitting_depth ?? d.pitting_depth_max ?? "—";
            const pitDiamAvg = d.avg_pitting_diameter ?? d.pitting_diameter_avg ?? "—";
            const pitDiamMax = d.max_pitting_diameter ?? d.pitting_diameter_max ?? "—";

            const cpAnode = d.anode_cp ?? d.cp_anode ?? "—";
            const cpMember = d.member_cp ?? d.cp_member_stub ?? "—";
            const cpTop = d.topstub_cp ?? d.cp_top_stub ?? "—";
            const cpBottom = d.bottomstub_cp ?? d.cp_bottom_stub ?? "—";

            const isAnomaly = r.has_anomaly === true || r.is_anomaly === true || r.component_condition === "Anomalous" || (r.description && r.description.toLowerCase().includes("anomaly")) || (r.insp_anomalies && r.insp_anomalies.length > 0);
            const isDefect = r.has_defect === true || r.is_defect === true || (r.description && r.description.toLowerCase().includes("defect"));
            
            const linkedAnomaly = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
            const isRectified = linkedAnomaly ? linkedAnomaly.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes("rectified")));
            
            const anomalyRef = linkedAnomaly?.anomaly_ref_no || r.anomaly_ref_no || r.ref_no || r.anomaly_no || d._meta_ref_no || "";
            const rectifiedComments = linkedAnomaly?.rectified_remarks || r.rectified_comments || "";

            const rawAddCPs = d.cp_rdg_additional || d.cp_readings || [];
            const findingsLines: string[] = [];
            if (r.description && r.description.trim()) findingsLines.push(r.description.trim());

            if (Array.isArray(rawAddCPs) && rawAddCPs.length > 0) {
                rawAddCPs.forEach((cr: any) => {
                    const val = cr.reading ?? cr.cp_rdg ?? '';
                    if ((val !== '' && val !== null && val !== undefined) || cr.location) {
                        const unit = String(val).toLowerCase().includes('mv') || !val ? '' : ' mV';
                        findingsLines.push(`Add. CP${cr.location ? ` @ ${cr.location}` : ''}: ${val}${unit}`);
                    }
                });
            }

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
                String(secured),
                String(anodeType),
                String(wLen),
                String(wC1),
                String(wC2),
                String(wC3),
                String(depletion),
                String(pitDepthAvg),
                String(pitDepthMax),
                String(pitDiamAvg),
                String(pitDiamMax),
                String(cpAnode),
                String(cpMember),
                String(cpTop),
                String(cpBottom),
                String(findings)
            ];
        };

        // ── Header definitions (2-tier) ─────────────────────────────────────────
        const topHeader = [
            { content: "Item\nNo.", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
            { content: "Comp QID", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
            { content: "Elev\n(m)", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
            { content: "Dive No.", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
            { content: "Secured", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
            { content: "Anode Type", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
            { content: "Length\n(mm)", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
            { content: "Circumference (mm)", colSpan: 3, styles: { halign: "center" as const } },
            { content: "Depletion\n(%)", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
            { content: "Anode Pitting (mm)", colSpan: 4, styles: { halign: "center" as const } },
            { content: "CP Values (mV)", colSpan: 4, styles: { halign: "center" as const } },
            { content: "Findings", rowSpan: 2, styles: { halign: "center" as const, valign: "middle" as const } },
        ];

        const bottomHeader = [
            "C1", "C2", "C3",
            "Depth\n(Avg)", "Depth\n(Max)", "Diam\n(Avg)", "Diam\n(Max)",
            "Anode", "Member\nStub", "Top\nStub", "Bottom\nStub"
        ].map(text => ({ content: text, styles: { halign: "center" as const, valign: "middle" as const } }));

        const isPF = config.printFriendly;

        // ── Draw first page ─────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        // ── Main table ─────────────────────────────────────────────────────────
        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 4, bottom: config.showSignatures !== false ? 35 : 15 },
            head: [topHeader, bottomHeader],
            body: sortedRecords.map(buildRow),
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 6.5,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
            },
            styles: {
                fontSize: 6.5,
                cellPadding: 1.5,
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak",
            },
            columnStyles: {
                0:  { cellWidth: 8,   halign: "center" }, // Item No
                1:  { cellWidth: 16 },                    // Comp QID
                2:  { cellWidth: 10,  halign: "center" }, // Elev
                3:  { cellWidth: 12,  halign: "center" }, // Dive No
                4:  { cellWidth: 11,  halign: "center" }, // Secured
                5:  { cellWidth: 14 },                    // Anode Type
                6:  { cellWidth: 10,  halign: "center" }, // Length
                7:  { cellWidth: 10,  halign: "center" }, // C1
                8:  { cellWidth: 10,  halign: "center" }, // C2
                9:  { cellWidth: 10,  halign: "center" }, // C3
                10: { cellWidth: 12,  halign: "center" }, // Depletion
                11: { cellWidth: 10,  halign: "center" }, // Pit Depth Avg
                12: { cellWidth: 10,  halign: "center" }, // Pit Depth Max
                13: { cellWidth: 10,  halign: "center" }, // Pit Diam Avg
                14: { cellWidth: 10,  halign: "center" }, // Pit Diam Max
                15: { cellWidth: 11,  halign: "center" }, // Anode CP
                16: { cellWidth: 11,  halign: "center" }, // Member Stub CP
                17: { cellWidth: 11,  halign: "center" }, // Top Stub CP
                18: { cellWidth: 11,  halign: "center" }, // Bottom Stub CP
                19: { cellWidth: "auto" },                // Findings
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = sortedRecords[data.row.index];
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
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Selected Anode Inspection Report (Diving)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
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
        doc.save(`Diving_Anode_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving Anode Report] Error:", err);
        throw err;
    }
};
