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
 * Diving Magnetic Particle Inspection (MPINS) Report
 * Grouped by QID (one page per QID).
 */
export const generateDivingMPINSReport = async (
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
            d.text("Diving Magnetic Particle Inspection Report", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        const drawPageFooter = (d: jsPDF, pageNo: number) => {
            d.setFontSize(6.5); d.setFont("helvetica", "normal");
            d.setTextColor(...colors.text);
            d.setDrawColor(...colors.border); d.setLineWidth(0.2);
            d.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
            d.text(
                `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Diving MPINS Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
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
            doc.text("No records found for MPINS.", margin, margin + HEADER_H + 20);
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
                    let d = r.inspection_data || {};
                    if (Array.isArray(d)) {
                        d = d.find((item: any) => item.inspno || item._meta_status !== undefined || item.length_of_weld_inspected !== undefined) || d[d.length - 1] || {};
                    }
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

                    const fmtVal = (val: any, unit: string) => {
                        if (val === undefined || val === null || val === "" || String(val).trim() === "—") return "—";
                        return `${val} ${unit}`;
                    };

                    // Parameters Table
                    const paramFields = [
                        { label: "Magnetic Ink", value: String(d.magnetic_ink ?? "—") },
                        { label: "Surface Cond.", value: String(d.surface_condition ?? "—") },
                        { label: "Cleaning Mthd.", value: String(d.cleaning_method ?? "—") },
                        { label: "Background Cond.", value: String(d.background_condition ?? "—") },
                        { label: "Magn. Method", value: String(d.magnetic_method ?? "—") },
                        { label: "Lighting Method", value: String(d.lighting_method ?? "—") },
                        { label: "Calib. Block", value: String(d.calib_block ?? "—") },
                        { label: "Magn. Lifting Pwr", value: fmtVal(d.magnetic_lifting_power, "tonne") },
                        { label: "Orientation", value: String(d.orientation ?? "—") },
                        { label: "Indication", value: String(d.indication ?? "—") },
                        { label: "Probe", value: String(d.probe ?? "—") },
                        { label: "Burmah C Strip", value: String(d.burmah_c_strip ?? "—") },
                        { label: "Curr. in Coil (Amps)", value: fmtVal(d.current_in_coil_magnet, "") },
                        { label: "Volt. in Coil (Volts)", value: fmtVal(d.voltage_in_coil_magnet, "") },
                        { label: "Curr. Pole Spc (mm)", value: fmtVal(d.current_pole_spacing, "") },
                        { label: "Dist. from Datum (m)", value: fmtVal(d.dist_from_datum, "") },
                        { label: "Probe Size", value: String(d.probe_size ?? "—") }
                    ];

                    const paramBody = [];
                    for (let j = 0; j < paramFields.length; j += 2) {
                        const f1 = paramFields[j];
                        const f2 = paramFields[j + 1] || { label: "", value: "" };
                        paramBody.push([
                            { content: f1.label, styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                            { content: f1.value },
                            { content: f2.label, styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                            { content: f2.value }
                        ]);
                    }

                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        head: [[{ content: "INSPECTION PARAMETERS", colSpan: 4, styles: { halign: "left", fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : [255,255,255], fontSize: 7, fontStyle: "bold" } }]],
                        body: paramBody as any,
                        theme: "grid",
                        styles: { fontSize: 6.5, cellPadding: 1.5, textColor: colors.text, lineColor: colors.border },
                        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 40 }, 3: { cellWidth: 'auto' } }
                    });
                    currentY = (doc as any).lastAutoTable.finalY + 3;
            // Clock Readings Table
                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        head: [[{ content: "CLOCK READINGS", colSpan: 6, styles: { halign: "left", fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : [255,255,255], lineColor: isPF ? colors.border : [255, 255, 255], lineWidth: 0.1, fontSize: 7, fontStyle: "bold" } }]],
                        body: [
                            [
                                { content: "", styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: "3 O'Clk", styles: { fontStyle: "bold", halign: "center", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: "6 O'Clk", styles: { fontStyle: "bold", halign: "center", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: "9 O'Clk", styles: { fontStyle: "bold", halign: "center", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: "12 O'Clk", styles: { fontStyle: "bold", halign: "center", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: "Nominal", styles: { fontStyle: "bold", halign: "center", fillColor: isPF ? [255,255,255] : colors.lightGray } }
                            ],
                            [
                                { content: "Brace (mm)", styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: String(d.brace_thick_3clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.brace_thick_6clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.brace_thick_9clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.brace_thick_12clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.brace_nominal_thickness ?? "—"), styles: { halign: "center" } }
                            ],
                            [
                                { content: "Chord (mm)", styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: String(d.chord_thick_3clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.chord_thick_6clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.chord_thick_9clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.chord_thick_12clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.chord_nominal_thickness ?? "—"), styles: { halign: "center" } }
                            ],
                            [
                                { content: "CP (mV)", styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: String(d.cp_at_3clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.cp_at_6clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.cp_at_9clk ?? "—"), styles: { halign: "center" } },
                                { content: String(d.cp_at_12clk ?? "—"), styles: { halign: "center" } },
                                { content: "", styles: { halign: "center" } }
                            ]
                        ] as any,
                        theme: "grid",
                        styles: { fontSize: 6.5, cellPadding: 1.5, textColor: colors.text, lineColor: colors.border }
                    });
                    currentY = (doc as any).lastAutoTable.finalY + 3;

                    // Segment Readings Table
                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        head: [[{ content: "SEGMENT READINGS", colSpan: 5, styles: { halign: "left", fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : [255,255,255], fontSize: 7, fontStyle: "bold" } }]],
                        body: [
                            [
                                { content: "", styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: "6 - 9", styles: { fontStyle: "bold", halign: "center", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: "9 - 12", styles: { fontStyle: "bold", halign: "center", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: "12 - 3", styles: { fontStyle: "bold", halign: "center", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: "3 - 6", styles: { fontStyle: "bold", halign: "center", fillColor: isPF ? [255,255,255] : colors.lightGray } }
                            ],
                            [
                                { content: "Toe Chord", styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: String(d.toe_chord_6_9 ?? "—"), styles: { halign: "center" } },
                                { content: String(d.toe_chord_9_12 ?? "—"), styles: { halign: "center" } },
                                { content: String(d.toe_chord_12_3 ?? "—"), styles: { halign: "center" } },
                                { content: String(d.toe_chord_3_6 ?? "—"), styles: { halign: "center" } }
                            ],
                            [
                                { content: "Weld", styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: String(d.weld_6_9 ?? "—"), styles: { halign: "center" } },
                                { content: String(d.weld_9_12 ?? "—"), styles: { halign: "center" } },
                                { content: String(d.weld_12_3 ?? "—"), styles: { halign: "center" } },
                                { content: String(d.weld_3_6 ?? "—"), styles: { halign: "center" } }
                            ],
                            [
                                { content: "Toe Brace", styles: { fontStyle: "bold", fillColor: isPF ? [255,255,255] : colors.lightGray } },
                                { content: String(d.toe_brace_6_9 ?? "—"), styles: { halign: "center" } },
                                { content: String(d.toe_brace_9_12 ?? "—"), styles: { halign: "center" } },
                                { content: String(d.toe_brace_12_3 ?? "—"), styles: { halign: "center" } },
                                { content: String(d.toe_brace_3_6 ?? "—"), styles: { halign: "center" } }
                            ]
                        ] as any,
                        theme: "grid",
                        styles: { fontSize: 6.5, cellPadding: 1.5, textColor: colors.text, lineColor: colors.border }
                    });
                    currentY = (doc as any).lastAutoTable.finalY + 3;


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
                                let metaData = r.inspection_data || {};
                            if (Array.isArray(metaData)) {
                                metaData = metaData.find((item: any) => item.inspno || item._meta_status !== undefined) || metaData[metaData.length - 1] || {};
                            }
                            const metaStatus = (metaData._meta_status || "").toLowerCase();
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
        doc.save(`Diving_MPINS_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving MPINS Report] Error:", err);
        throw err;
    }
};
