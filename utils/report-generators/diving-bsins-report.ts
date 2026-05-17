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
 * Diving Bolted Support Inspection (BSINS) Report
 * Grouped by QID (one page per QID).
 */
export const generateDivingBSINSReport = async (
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
            d.text("Diving Bolted Support Inspection Report", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        const drawPageFooter = (d: jsPDF, pageNo: number) => {
            d.setFontSize(6.5); d.setFont("helvetica", "normal");
            d.setTextColor(...colors.text);
            d.setDrawColor(...colors.border); d.setLineWidth(0.2);
            d.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
            d.text(
                `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Diving BSINS Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
                margin, pageHeight - 6
            );
            if (config.showPageNumbers !== false) {
                d.text(`Page ${pageNo}`, margin + contentWidth, pageHeight - 6, { align: "right" });
            }
        };

        // Group records by QID
        const groupedByQid: Record<string, any[]> = {};
        for (const r of records) {
            const qid = r.structure_components?.q_id || r.component?.q_id || "UNKNOWN";
            if (!groupedByQid[qid]) groupedByQid[qid] = [];
            groupedByQid[qid].push(r);
        }

        const qids = Object.keys(groupedByQid).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (qids.length === 0) {
            // Empty report
            drawPageHeader(doc, 1);
            drawPageFooter(doc, 1);
            doc.setFontSize(10);
            doc.text("No records found for BSINS.", margin, margin + HEADER_H + 20);
        } else {
            let pageNum = 1;
            for (let i = 0; i < qids.length; i++) {
                const qid = qids[i];
                if (i > 0) {
                    doc.addPage();
                    pageNum++;
                }

                drawPageHeader(doc, pageNum);
                
                let currentY = margin + HEADER_H + 5;
                const isPF = config.printFriendly;

                // Context Box (Structure, Vessel, Job Pack, QID)
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
                doc.text("Component QID:", margin + contentWidth / 2 + 2, currentY + 12);
                doc.setFont("helvetica", "normal");
                doc.text(qid, margin + contentWidth / 2 + 25, currentY + 12);

                currentY += 18;

                const qidRecords = groupedByQid[qid].sort((a, b) => {
                    const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                    const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                    return elB - elA; // descending
                });

                for (let rIdx = 0; rIdx < qidRecords.length; rIdx++) {
                    const r = qidRecords[rIdx];
                    const d = r.inspection_data || {};
                    const elevation = r.elevation ?? d.elevation ?? "—";
                    const diveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || r.dive_job_id || "—";
                    const inspDate = r.inspection_date ? format(new Date(r.inspection_date), 'dd MMM yyyy') : "—";
                    
                    // Anomalies handling
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

                    // Record Header info
                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        body: [
                            [
                                { content: "Elevation:", styles: { fontStyle: "bold", cellWidth: 25 } },
                                { content: String(elevation) + " m", styles: { cellWidth: 'auto' } },
                                { content: "Dive No:", styles: { fontStyle: "bold", cellWidth: 25 } },
                                { content: String(diveNo), styles: { cellWidth: 'auto' } },
                                { content: "Date:", styles: { fontStyle: "bold", cellWidth: 25 } },
                                { content: String(inspDate), styles: { cellWidth: 'auto' } }
                            ]
                        ],
                        theme: "grid",
                        styles: {
                            fontSize: 7,
                            cellPadding: 2,
                            textColor: colors.text,
                            lineColor: colors.border,
                            valign: "middle"
                        }
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 3;

                    // Table Data
                    const renderGroupTable = (title: string, fields: { label: string; value: string }[]) => {
                        // We will render fields in 2 columns of key-value pairs to fit them nicely
                        const body = [];
                        for (let j = 0; j < fields.length; j += 2) {
                            const f1 = fields[j];
                            const f2 = fields[j + 1] || { label: "", value: "" };
                            body.push([
                                { content: f1.label, styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: f1.value },
                                { content: f2.label, styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: f2.value }
                            ]);
                        }

                        autoTable(doc, {
                            startY: currentY,
                            margin: { left: margin, right: margin },
                            head: [[{ content: title.toUpperCase(), colSpan: 4, styles: { halign: "left", fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : [255,255,255], fontSize: 7, fontStyle: "bold" } }]],
                            body: body as any,
                            theme: "grid",
                            styles: {
                                fontSize: 6.5,
                                cellPadding: 1.5,
                                textColor: colors.text,
                                lineColor: colors.border
                            },
                            columnStyles: {
                                0: { cellWidth: 40 },
                                1: { cellWidth: 'auto' },
                                2: { cellWidth: 40 },
                                3: { cellWidth: 'auto' }
                            }
                        });
                        currentY = (doc as any).lastAutoTable.finalY + 3;
                    };

                    const fmtVal = (val: any, unit: string) => {
                        if (val === undefined || val === null || val === "" || String(val).trim() === "—") return "—";
                        return `${val} ${unit}`;
                    };

                    const memberFields = [
                        { label: "Bolts Present", value: String(d.no_bolts_pres_memb ?? "—") },
                        { label: "Bolts Loose", value: String(d.no_bolts_loose_memb ?? "—") },
                        { label: "Bolts Missing", value: String(d.no_bolts_miss_memb ?? "—") },
                        { label: "Max Gap Top", value: fmtVal(d.max_gap_top_member, d.max_gap_top_member_unit || "mm") },
                        { label: "Max Gap Bottom", value: fmtVal(d.max_gap_bottom_member, d.max_gap_bottom_member_unit || "mm") },
                        { label: "Max Flange Misalign", value: fmtVal(d.max_flange_misalign_member, d.max_flange_misalign_member_unit || "mm") },
                        { label: "Clamp CP", value: fmtVal(d.member_clamp_cp, "mV") },
                        { label: "CP 1", value: fmtVal(d.member_cp, "mV") },
                        { label: "CP 2", value: fmtVal(d.member_cp_2, "mV") }
                    ];

                    const braceFields = [
                        { label: "Bolts Present", value: String(d.no_bolts_pres_brace ?? "—") },
                        { label: "Bolts Loose", value: String(d.no_bolts_loose_brace ?? "—") },
                        { label: "Bolts Missing", value: String(d.no_bolts_miss_brace ?? "—") },
                        { label: "Max Gap Top", value: fmtVal(d.max_gap_top_brace, d.max_gap_top_brace_unit || "mm") },
                        { label: "Max Gap Bottom", value: fmtVal(d.max_gap_bottom_brace, d.max_gap_bottom_brace_unit || "mm") },
                        { label: "Max Flange Misalign", value: fmtVal(d.max_flange_misalign_brace, d.max_flange_misalign_brace_unit || "mm") }
                    ];

                    const appFields = [
                        { label: "Clamp Type", value: String(d.appurtenance_clamp_type ?? "—") },
                        { label: "Appurtenance CP", value: fmtVal(d.appurtenance_cp, "mV") },
                        { label: "Clamp CP", value: fmtVal(d.appurtenance_clamp_cp, "mV") },
                        { label: "Stub CP", value: fmtVal(d.stub_cp, "mV") }
                    ];

                    const genFields = [
                        { label: "Coating Satisfactory", value: String(d.clamp_coating_satisfactory ?? "—") },
                        { label: "Double Nutted", value: String(d.all_bolts_double_nutted ?? "—") },
                        { label: "Liner @ Member", value: String(d.liner_present_member_end ?? "—") },
                        { label: "Earthing Wire/Bolt", value: String(d.earthing_wire_or_bolt_present ?? "—") },
                        { label: "Liner @ Component", value: String(d.liner_present_component_end ?? "—") },
                        { label: "Washers Present", value: String(d.washers_present_all_bolts ?? "—") }
                    ];

                    renderGroupTable("Member", memberFields);
                    renderGroupTable("Brace", braceFields);
                    renderGroupTable("Appurtenance", appFields);
                    renderGroupTable("General", genFields);

                    // Render Findings at the bottom
                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        head: [[{ content: "FINDINGS & REMARKS", colSpan: 1, styles: { halign: "left", fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : [255,255,255], fontSize: 7, fontStyle: "bold" } }]],
                        body: [
                            [
                                { content: findingsText }
                            ]
                        ],
                        theme: "grid",
                        styles: {
                            fontSize: 7,
                            cellPadding: 3,
                            textColor: colors.text,
                            lineColor: colors.border,
                            valign: "top"
                        },
                        didParseCell: (data) => {
                            if (data.section === "body" && parts.length > 0) {
                                const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
                                if (metaStatus === "finding") data.cell.styles.textColor = colors.finding;
                                else if (r.has_anomaly) data.cell.styles.textColor = colors.anomaly;
                                else if (isRectified) data.cell.styles.textColor = colors.rectified;
                            }
                        }
                    });
                    
                    currentY = (doc as any).lastAutoTable.finalY + 6; // extra space between records

                    // Handle page break for multiple records manually if near end
                    if (rIdx < qidRecords.length - 1 && currentY > pageHeight - 60) {
                        drawPageFooter(doc, pageNum);
                        doc.addPage();
                        pageNum++;
                        drawPageHeader(doc, pageNum);
                        currentY = margin + HEADER_H + 5;
                    }
                }

                // Signatures at the end of the page for this QID
                if (config.showSignatures !== false) {
                    const sigH = 20;
                    const sigW = contentWidth / 3;
                    
                    if (currentY + sigH > pageHeight - 15) {
                        drawPageFooter(doc, pageNum);
                        doc.addPage();
                        pageNum++;
                        drawPageHeader(doc, pageNum);
                        currentY = margin + HEADER_H + 5;
                    }

                    const sigY = pageHeight - 35; 

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

                drawPageFooter(doc, pageNum);
            }
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`Diving_BSINS_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving BSINS Report] Error:", err);
        throw err;
    }
};
