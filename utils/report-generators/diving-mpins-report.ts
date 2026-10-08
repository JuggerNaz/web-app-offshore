import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, formatReportFindingText, applyRecordCellStyling, REPORT_FOOTER_APP_TEXT, draw3SectionHeader, drawStandardContextRow } from "./shared-logo";

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
    returnBlob?: boolean;
    isBlankReport?: boolean;
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
): Promise<Blob | void | null> => {
    try {
        records = normalizeReportRecords(records);
        if (!config?.isBlankReport && (!records || records.length === 0)) {
            return null;
        }

        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;

        const colors = {
            navy: [7, 78, 136] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            anomaly: [220, 38, 38] as [number, number, number],
            rectified: [22, 163, 74] as [number, number, number],
            finding:   [217, 119, 6] as [number, number, number],
        };

        const HEADER_H = 25;

        // Pre-load logos
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) { }
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) { }
        }

        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string | number) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `MAGNETIC PARTICLE INSPECTION REPORT (DIVING) - ${extraTitleInfo}` : "MAGNETIC PARTICLE INSPECTION REPORT (DIVING)",
                reportNo: (config?.reportNoPrefix || headerData?.sowReportNo) || "N/A",
                structureName: headerData.platformName ? `${headerData.platformName}${headerData.jobpackName ? ` - ${headerData.jobpackName}` : ''}` : headerData.jobpackName,
                companySettings,
                config,
                headerData,
                contractorLogoData: contractorLogo,
                clientLogoData: companyLogo,
                isPrintFriendly: config.printFriendly,
                margin: 10,
                headerY: 7,
                headerH: 25,
            });
        };

        const drawPageFooter = (d: jsPDF, pageNo: number) => {
            d.setFontSize(6.5); d.setFont("helvetica", "normal");
            d.setTextColor(...colors.text);
            d.setDrawColor(...colors.border); d.setLineWidth(0.2);
            d.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
            d.text(
                REPORT_FOOTER_APP_TEXT,
                margin, pageHeight - 6
            );
            if (config.showPageNumbers !== false) {
                d.text(`Page ${pageNo}`, margin + contentWidth, pageHeight - 6, { align: "right" });
            }
        };

        // Group records by QID
        const groupedByQid: Record<string, any[]> = {};
        for (const r of (records || [])) {
            const qid = r.structure_components?.q_id || r.component?.q_id || "UNKNOWN";
            if (!groupedByQid[qid]) groupedByQid[qid] = [];
            groupedByQid[qid].push(r);
        }

        const qids = Object.keys(groupedByQid).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (qids.length === 0) {
            if (config?.returnBlob && !config?.isBlankReport) return null as any;
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
                    
                    const findingsText = formatReportFindingText(r, r.description);

                    // Record Header info
                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        body: [
                            [
                                { content: "Elevation:", styles: {fontStyle: "bold", cellWidth: 25, lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(elevation) + " m", styles: {cellWidth: 'auto', lineWidth: 0.1, lineColor: colors.border} },
                                { content: "Dive No:", styles: {fontStyle: "bold", cellWidth: 25, lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(diveNo), styles: {cellWidth: 'auto', lineWidth: 0.1, lineColor: colors.border} },
                                { content: "Date:", styles: {fontStyle: "bold", cellWidth: 25, lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(inspDate), styles: {cellWidth: 'auto', lineWidth: 0.1, lineColor: colors.border} }
                            ]
                        ],
                        theme: "grid",
                        styles: {fontSize: 7,
                            cellPadding: 2,
                            textColor: colors.text,
                            lineColor: colors.border,
                            valign: "middle", lineWidth: 0.1}
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

                    const paramBody: any[] = [];
                    for (let j = 0; j < paramFields.length; j += 2) {
                        const f1 = paramFields[j];
                        const f2 = paramFields[j + 1] || { label: "", value: "" };
                        paramBody.push([
                            { content: f1.label, styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                            { content: f1.value },
                            { content: f2.label, styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                            { content: f2.value }
                        ]);
                    }

                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        head: [[{ content: "INSPECTION PARAMETERS", colSpan: 4, styles: {halign: "left", fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : [255,255,255], fontSize: 7, fontStyle: "bold", lineWidth: 0.1, lineColor: colors.border} }]],
                        body: paramBody as any,
                        theme: "grid",
                        styles: {fontSize: 6.5, cellPadding: 1.5, textColor: colors.text, lineColor: colors.border, lineWidth: 0.1},
                        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 40 }, 3: { cellWidth: 'auto' } }
                    });
                    currentY = (doc as any).lastAutoTable.finalY + 3;
            // Clock Readings Table
                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        head: [[{ content: "CLOCK READINGS", colSpan: 6, styles: { halign: "left", fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : [255,255,255], lineColor: config?.printFriendly ? colors.border : [255, 255, 255], lineWidth: 0.1, fontSize: 7, fontStyle: "bold" } }]],
                        body: [
                            [
                                { content: "", styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: "3 O'Clk", styles: {fontStyle: "bold", halign: "center", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: "6 O'Clk", styles: {fontStyle: "bold", halign: "center", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: "9 O'Clk", styles: {fontStyle: "bold", halign: "center", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: "12 O'Clk", styles: {fontStyle: "bold", halign: "center", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: "Nominal", styles: {fontStyle: "bold", halign: "center", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} }
                            ],
                            [
                                { content: "Brace (mm)", styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.brace_thick_3clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.brace_thick_6clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.brace_thick_9clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.brace_thick_12clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.brace_nominal_thickness ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} }
                            ],
                            [
                                { content: "Chord (mm)", styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.chord_thick_3clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.chord_thick_6clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.chord_thick_9clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.chord_thick_12clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.chord_nominal_thickness ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} }
                            ],
                            [
                                { content: "CP (mV)", styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.cp_at_3clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.cp_at_6clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.cp_at_9clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.cp_at_12clk ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: "", styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} }
                            ]
                        ] as any,
                        theme: "grid",
                        styles: {fontSize: 6.5, cellPadding: 1.5, textColor: colors.text, lineColor: colors.border, lineWidth: 0.1}
                    });
                    currentY = (doc as any).lastAutoTable.finalY + 3;

                    // Segment Readings Table
                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        head: [[{ content: "SEGMENT READINGS", colSpan: 5, styles: {halign: "left", fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : [255,255,255], fontSize: 7, fontStyle: "bold", lineWidth: 0.1, lineColor: colors.border} }]],
                        body: [
                            [
                                { content: "", styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: "6 - 9", styles: {fontStyle: "bold", halign: "center", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: "9 - 12", styles: {fontStyle: "bold", halign: "center", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: "12 - 3", styles: {fontStyle: "bold", halign: "center", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: "3 - 6", styles: {fontStyle: "bold", halign: "center", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} }
                            ],
                            [
                                { content: "Toe Chord", styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.toe_chord_6_9 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.toe_chord_9_12 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.toe_chord_12_3 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.toe_chord_3_6 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} }
                            ],
                            [
                                { content: "Weld", styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.weld_6_9 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.weld_9_12 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.weld_12_3 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.weld_3_6 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} }
                            ],
                            [
                                { content: "Toe Brace", styles: {fontStyle: "bold", fillColor: config?.printFriendly ? [255,255,255] : colors.lightGray, lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.toe_brace_6_9 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.toe_brace_9_12 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.toe_brace_12_3 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                                { content: String(d.toe_brace_3_6 ?? "—"), styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} }
                            ]
                        ] as any,
                        theme: "grid",
                        styles: {fontSize: 6.5, cellPadding: 1.5, textColor: colors.text, lineColor: colors.border, lineWidth: 0.1}
                    });
                    currentY = (doc as any).lastAutoTable.finalY + 3;


                    // Render Findings at the bottom
                    autoTable(doc, {
                        startY: currentY,
                        margin: { left: margin, right: margin },
                        head: [[{ content: "FINDINGS & REMARKS", colSpan: 1, styles: {halign: "left", fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : [255,255,255], fontSize: 7, fontStyle: "bold", lineWidth: 0.1, lineColor: colors.border} }]],
                        body: [
                            [
                                { content: findingsText }
                            ]
                        ],
                        theme: "grid",
                        styles: {fontSize: 7,
                            cellPadding: 3,
                            textColor: colors.text,
                            lineColor: colors.border,
                            valign: "top", lineWidth: 0.1},
                        didParseCell: (data) => {
                            if (data.section === "body") {
                                applyRecordCellStyling(data.cell, r, isPF);
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

                drawPageFooter(doc, pageNum);
            }
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`Diving_MPINS_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving MPINS Report] Error:", err);
        throw err;
    }
};
