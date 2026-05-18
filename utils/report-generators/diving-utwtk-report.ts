import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
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
 * Diving UT Wall Thickness Inspection (UTWTK) Report
 */
export const generateDivingUTWTKReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - margin * 2;

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            anomaly: [220, 38, 38] as [number, number, number],
            rectified: [22, 163, 74] as [number, number, number],
            finding: [124, 58, 237] as [number, number, number],
        };

        const HEADER_H = 24;

        // Pre-load logos
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) { }
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) { }
        }

        const drawPageHeader = (d: jsPDF, pageNo: number) => {
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

            if (companyLogo) drawLogo(d, companyLogo, 18, 18, pageWidth - margin - 22, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 18, 18, margin + 4, margin + 3, "left", "center");

            d.setFontSize(9); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Inspection Division", margin + contentWidth / 2, margin + 10, { align: "center" });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text("Diving UT Wall Thickness Inspection Report", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        const drawPageFooter = (d: jsPDF, pageNo: number) => {
            d.setFontSize(6.5); d.setFont("helvetica", "normal");
            d.setTextColor(...colors.text);
            d.setDrawColor(...colors.border); d.setLineWidth(0.2);
            d.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
            d.text(
                `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Diving UTWTK Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
                margin, pageHeight - 6
            );
            if (config.showPageNumbers !== false) {
                d.text(`Page ${pageNo}`, margin + contentWidth, pageHeight - 6, { align: "right" });
            }
        };

        if (records.length === 0) {
            drawPageHeader(doc, 1);
            drawPageFooter(doc, 1);
            doc.setFontSize(10);
            doc.setTextColor(...colors.text);
            doc.text("No records found for UTWTK.", margin, margin + HEADER_H + 20);
        } else {
            let pageNum = 1;
            drawPageHeader(doc, pageNum);
            
            let currentY = margin + HEADER_H + 5;
            const isPF = config.printFriendly;

            // Context Box (Structure, Vessel, Job Pack)
            doc.setDrawColor(...colors.border); doc.setLineWidth(0.1);
            if (!isPF) { doc.setFillColor(...colors.lightGray); doc.rect(margin, currentY, contentWidth, 14, "F"); }
            doc.rect(margin, currentY, contentWidth, 14, "S");
            doc.line(margin + contentWidth / 2, currentY, margin + contentWidth / 2, currentY + 14);
            doc.line(margin, currentY + 7, margin + contentWidth, currentY + 7);
            
            doc.setTextColor(...colors.text);
            doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
            
            doc.text("Structure:", margin + 2, currentY + 5);
            doc.setFont("helvetica", "normal");
            doc.text(headerData.platformName || "N/A", margin + 25, currentY + 5);

            doc.setFont("helvetica", "bold");
            doc.text("Vessel:", margin + contentWidth / 2 + 2, currentY + 5);
            doc.setFont("helvetica", "normal");
            doc.text(headerData.vessel || "N/A", margin + contentWidth / 2 + 25, currentY + 5);

            doc.setFont("helvetica", "bold");
            doc.text("Job Pack:", margin + 2, currentY + 12);
            doc.setFont("helvetica", "normal");
            doc.text(headerData.jobpackName || "N/A", margin + 25, currentY + 12);

            doc.setFont("helvetica", "bold");
            doc.text("Date:", margin + contentWidth / 2 + 2, currentY + 12);
            doc.setFont("helvetica", "normal");
            doc.text(format(new Date(), 'dd MMM yyyy'), margin + contentWidth / 2 + 25, currentY + 12);

            currentY += 18;

            // Table Data
            // Details as follows, Item No. , QID, Elevation, Dive No., clock position (group all the clock pos thickness value 12,3,6,9) , Nominal Thickness , Findings.
            const tableBody = records.map((r, index) => {
                let d = r.inspection_data || {};
                if (Array.isArray(d)) {
                    d = d.find((item: any) => item.inspno || item.ut_3_o_clock !== undefined || item._meta_status !== undefined) || d[d.length - 1] || {};
                }
                const qid = r.structure_components?.q_id || r.component?.q_id || "—";
                const elevation = r.elevation ?? d.elevation ?? "—";
                const diveNo = r.insp_dive_jobs?.job_no || "—";
                
                // Clock Position Formatting
                const getRd = (val: any, unit: any) => (val !== undefined && val !== null && val !== "") ? `${val} ${unit || 'mm'}` : "-";
                
                const rd12 = getRd(d.ut_12_o_clock, d.ut_12_o_clock_unit);
                const rd3 = getRd(d.ut_3_o_clock, d.ut_3_o_clock_unit);
                const rd6 = getRd(d.ut_6_o_clock, d.ut_6_o_clock_unit);
                const rd9 = getRd(d.ut_9_o_clock, d.ut_9_o_clock_unit);

                const nominalThk = d.nominal_thickness !== undefined && d.nominal_thickness !== null && d.nominal_thickness !== "" 
                    ? `${d.nominal_thickness} ${d.nominal_thickness_unit || 'mm'}` 
                    : "—";

                // Findings
                const parts: string[] = [];
                if (r.description?.trim()) parts.push(r.description.trim());

                const linkedAnom = r.insp_anomalies?.[0] ?? null;
                const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
                if (anomRef) parts.push(`Ref: ${anomRef}`);

                const isRectified = linkedAnom?.is_rectified || r.rectified || false;
                if (isRectified) {
                    const rectComments = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                    parts.push(`Rectified: ${rectComments}`);
                }

                const findingsText = parts.length > 0 ? parts.join("\n") : "—";

                return [
                    index + 1,
                    qid,
                    elevation !== "—" ? `${elevation} m` : "—",
                    diveNo,
                    rd12,
                    rd3,
                    rd6,
                    rd9,
                    nominalThk,
                    findingsText
                ];
            });

            autoTable(doc, {
                startY: currentY,
                margin: { left: margin, right: margin, bottom: margin + 25 },
                head: [
                    [
                        { content: "Item No.", rowSpan: 2, styles: { cellWidth: 12 } },
                        { content: "QID", rowSpan: 2, styles: { cellWidth: 25 } },
                        { content: "Elevation", rowSpan: 2, styles: { cellWidth: 16 } },
                        { content: "Dive No.", rowSpan: 2, styles: { cellWidth: 16 } },
                        { content: "Thickness Readings (o'clock)", colSpan: 4, styles: { halign: 'center' } },
                        { content: "Nominal\nThickness", rowSpan: 2, styles: { cellWidth: 16 } },
                        { content: "Findings", rowSpan: 2, styles: { cellWidth: 'auto' } }
                    ],
                    [
                        { content: "12", styles: { cellWidth: 14 } },
                        { content: "3", styles: { cellWidth: 14 } },
                        { content: "6", styles: { cellWidth: 14 } },
                        { content: "9", styles: { cellWidth: 14 } }
                    ]
                ],
                body: tableBody,
                theme: "grid",
                headStyles: {
                    fillColor: isPF ? [255, 255, 255] : colors.navy,
                    textColor: isPF ? colors.navy : [255, 255, 255],
                    lineColor: isPF ? colors.border : [255, 255, 255],
                    lineWidth: 0.1,
                    fontSize: 6.5,
                    fontStyle: "bold",
                    halign: "center",
                    valign: "middle"
                },
                styles: {
                    fontSize: 6.5,
                    cellPadding: 2,
                    textColor: colors.text,
                    lineColor: colors.border,
                    valign: "middle",
                    halign: "center"
                },
                columnStyles: {
                    9: { halign: "left" }
                },
                didParseCell: (data) => {
                    if (data.section === "body" && data.column.index === 9) {
                        const rowIndex = data.row.index;
                        const r = records[rowIndex];
                        const linkedAnom = r.insp_anomalies?.[0] ?? null;
                        const isRectified = linkedAnom?.is_rectified || r.rectified || false;
                        let metaData = r.inspection_data || {};
                        if (Array.isArray(metaData)) {
                            metaData = metaData.find((item: any) => item.inspno || item._meta_status !== undefined) || metaData[metaData.length - 1] || {};
                        }
                        const metaStatus = (metaData._meta_status || "").toLowerCase();
                        
                        if (metaStatus === "finding") data.cell.styles.textColor = colors.finding;
                        else if (r.has_anomaly) data.cell.styles.textColor = colors.anomaly;
                        else if (isRectified) data.cell.styles.textColor = colors.rectified;
                    }
                },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) {
                        pageNum = data.pageNumber;
                        drawPageHeader(doc, pageNum);
                    }
                }
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;

            // Add Signatures
            if (config.showSignatures !== false) {
                const sigH = 20;
                const sigW = contentWidth / 3;
                
                if ((doc as any).lastAutoTable.finalY > pageHeight - margin - 25 - sigH) {
                    doc.addPage();
                    pageNum++;
                    drawPageHeader(doc, pageNum);
                }

                const sigY = pageHeight - margin - 24; 

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

                drawSig("PREPARED BY", margin);
                drawSig("REVIEWED BY", margin + sigW);
                drawSig("APPROVED BY", margin + sigW * 2);
            }

            // Draw footers on all pages
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                drawPageFooter(doc, i);
            }
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`Diving_UTWTK_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving UTWTK Report] Error:", err);
        throw err;
    }
};
