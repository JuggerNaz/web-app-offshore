import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, getInspectionDateRange, formatReportFindingText, applyRecordCellStyling, REPORT_FOOTER_APP_TEXT, draw3SectionHeader, drawStandardContextRow } from "./shared-logo";
import { createClient } from "@/utils/supabase/client";

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
    showPageNumbers?: boolean;
    showSignatures?: boolean;
    isBlankReport?: boolean;
}

/**
 * Caisson Inspection Underwater Report (Diving)
 * Grouped by parent Caisson (CS) component.
 * Filters for elevations < 0.
 * Compiles GVINS, CVINS, CPSURV, UTWTK.
 */
export const generateDivingDCASNUWReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | null | void> => {
    records = normalizeReportRecords(records);
    const supabase = createClient();
    console.log("[generateDivingDCASNUWReport] Starting generation", { recordsCount: records?.length, config });

    try {
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

        // Filter records
        const filteredRecords = records.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase();
            const validTypes = ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'];
            if (!validTypes.includes(typeCode)) return false;
            const elevationVal = parseFloat(r.elevation ?? r.inspection_data?.elevation ?? 0); return elevationVal < 0;
        });

        if (!config.isBlankReport && (!filteredRecords || filteredRecords.length === 0)) {
            return null;
        }

        // Pre-load logos
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        // Fetch all components to build structure registry for parent-child grouping
        const { data: allComps } = await supabase
            .from('structure_components')
            .select('id, q_id, code, name, metadata')
            .eq('structure_id', config.structureId);

        const HEADER_H = 25;

        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `Caisson Underwater Inspection Report (Diving) - ${extraTitleInfo}` : "Caisson Underwater Inspection Report (Diving)",
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

        const dateRangeStr = getInspectionDateRange(records, headerData, config);

        const drawContextRow = (d: jsPDF, y: number, groupRecords?: any[]) => {
            return drawStandardContextRow(d, y, {
                structure: headerData.platformName,
                vessel: headerData.vessel,
                jobpack: headerData.jobpackName,
                dateRange: groupRecords ? getInspectionDateRange(groupRecords, headerData, config) : dateRangeStr,
            }, config.printFriendly, margin);
        };

        // Grouping logic (strictly group by Caisson - CS)
        const compRegistry = new Map<number, any>();
        const qidRegistry = new Map<string, any>();
        allComps?.forEach(c => {
            compRegistry.set(c.id, c);
            qidRegistry.set(c.q_id.toUpperCase(), c);
        });

        const isSubPartQid = (q: string): boolean => {
            const uq = (q || "").toUpperCase();
            return uq.includes("-TERM") || uq.includes("-SUPP") || uq.includes("-GUIDE") || 
                   uq.includes("-FLG") || uq.includes("-INTAKE") || uq.includes("-DISCH") || 
                   uq.includes("-CAN") || uq.includes("-SCB") || uq.includes("-STUB") ||
                   uq.includes("-TOP") || uq.includes("-BTM") || uq.includes("-BELL") ||
                   uq.includes("TERMINAT") || uq.includes("SUPPORT");
        };

        const getGroupKey = (r: any): string | null => {
            const comp = r.structure_components || r.component || {};
            const metadata = comp.metadata || {};
            const qid = (comp.q_id || r.qid || r.q_id || "Unknown").toUpperCase().trim();

            const parentQid = (metadata.associated_comp_qid || metadata.parent_qid || metadata.parent_q_id || "").toUpperCase().trim();
            if (parentQid && parentQid !== "N/A" && parentQid !== qid) {
                const pm = parentQid.match(/^((?:CS|CASN?)[-_]?[A-Z0-9]+)/i);
                if (pm) return pm[1].toUpperCase();
                return parentQid;
            }

            const parentId = metadata.associated_comp_id || metadata.parent_id || metadata.comp_id_parent || metadata.parent_comp_id || metadata.associated_id;
            if (parentId) {
                const parentComp = compRegistry.get(parentId);
                if (parentComp && parentComp.q_id) {
                    const pQid = parentComp.q_id.toUpperCase().trim();
                    const pm = pQid.match(/^((?:CS|CASN?)[-_]?[A-Z0-9]+)/i);
                    if (pm) return pm[1].toUpperCase();
                    return pQid;
                }
            }

            let matchedRootQid: string | null = null;
            let longestRootLen = 0;
            if (allComps) {
                allComps.forEach((c: any) => {
                    const cQid = (c.q_id || "").toUpperCase().trim();
                    const cCode = (c.code || "").toUpperCase().trim();
                    if ((cCode === "CS" || cCode === "CASN" || cQid.startsWith("CS-") || cQid.startsWith("CAS-")) && !isSubPartQid(cQid)) {
                        if (qid === cQid || qid.startsWith(cQid + "-") || qid.startsWith(cQid + "_")) {
                            if (cQid.length > longestRootLen) {
                                matchedRootQid = c.q_id.toUpperCase().trim();
                                longestRootLen = cQid.length;
                            }
                        }
                    }
                });
            }
            if (matchedRootQid) return matchedRootQid;

            const match = qid.match(/^((?:CS|CASN?)[-_]?[A-Z0-9]+)/i);
            if (match) {
                const extractedBase = match[1].toUpperCase();
                if (qidRegistry.has(extractedBase)) {
                    return qidRegistry.get(extractedBase).q_id.toUpperCase().trim();
                }
                return extractedBase;
            }

            const cCode = (comp.code || comp.metadata?.type || "").toUpperCase();
            const cName = (comp.comp_name || comp.name || "").toUpperCase();
            const isCS = cCode === "CS" || cCode === "CAISSON" || qid.startsWith("CS") || cName.includes("CAISSON");

            return isCS ? qid : null;
        };

        const caissonGroups: Record<string, any[]> = {};
        filteredRecords.forEach(r => {
            const key = getGroupKey(r);
            if (!key) return; // Skip non-caisson records (e.g. weld nodes)
            const keyUpper = key.toUpperCase();
            if (!caissonGroups[keyUpper]) caissonGroups[keyUpper] = [];
            caissonGroups[keyUpper].push(r);
        });

        const sortedCaissonQids = Object.keys(caissonGroups).sort((a, b) => {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        if (sortedCaissonQids.length === 0) {
            if (config.returnBlob) return null as any;
        }

        const formatFindings = (r: any) => {
            return formatReportFindingText(r, r.description || r.inspection_data?.findings);
        };

        const parseMetaStatus = (r: any) => {
            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
            const isFinding = metaStatus === "finding";
            const isAnom = r.has_anomaly && !isFinding;
            const isRect = linkedAnom?.is_rectified || r.rectified || false;
            return { isFinding, isAnom, isRect };
        };

        const applyCellColoring = (data: any, r: any) => {
            if (data.section !== "body") return;
            applyRecordCellStyling(data.cell, r, config.printFriendly);
        };

        // Generate Pages
        sortedCaissonQids.forEach((caissonQid, groupIdx) => {
            if (groupIdx > 0) doc.addPage();

            const groupRecords = caissonGroups[caissonQid].sort((a, b) => {
                const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                return elB - elA; // Top-down
            });

            drawPageHeader(doc);
            const startY = drawContextRow(doc, margin + HEADER_H + 2, groupRecords);

            let currentY = startY;

            // Sub-header for Caisson QID
            if (caissonQid) {
                const subH = 6;
                doc.setFillColor(...colors.navy);
                doc.rect(margin, currentY, contentWidth, subH, "F");
                doc.setTextColor(255);
                doc.setFontSize(8); doc.setFont("helvetica", "bold");
                doc.text(`CAISSON QID: ${caissonQid}`, margin + 4, currentY + 4.2);
                currentY += subH + 2;
            }

            const recsGVINS = groupRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'GVINS');
            const recsCVINS = groupRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'CVINS');
            const recsCPSURV = groupRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'CPSURV');
            const recsUTWTK = groupRecords.filter(r => ['UTWTK', 'DUTWT'].includes((r.inspection_type_code || r.inspection_type?.code || '').toUpperCase()));

            const checkPageBreak = (neededHeight: number) => {
                if (currentY + neededHeight > pageHeight - 35) {
                    doc.addPage();
                    drawPageHeader(doc);
                    currentY = drawContextRow(doc, margin + HEADER_H + 2, groupRecords);
                    return true;
                }
                return false;
            };

            const drawSectionHeader = (title: string) => {
                checkPageBreak(12);
                const isPF = config.printFriendly;
                if (isPF) {
                    doc.setDrawColor(...colors.border);
                    doc.setLineWidth(0.2);
                    doc.rect(margin, currentY, contentWidth, 6, "S");
                    doc.setTextColor(...colors.navy);
                } else {
                    doc.setFillColor(...colors.navy);
                    doc.rect(margin, currentY, contentWidth, 6, "F");
                    doc.setTextColor(255, 255, 255);
                }
                doc.setFontSize(8); doc.setFont("helvetica", "bold");
                doc.text(title, margin + 2, currentY + 4.2);
                currentY += 8;
            };

            // 1. GVINS
            if (recsGVINS.length > 0) {
                drawSectionHeader("General Visual Inspection (GVINS)");
                autoTable(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin },
                    head: [["No.", "QID", "Elevation (m)", "Dive No.", "Coating Condition", "Component Condition", "Marine Growth %", "Findings"]],
                    body: recsGVINS.map((r, i) => {
                        const d = r.inspection_data || {};
                        const el = r.elevation ?? d.elevation ?? "—";
                        const diveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || r.dive_job_id || "—";
                        const mg = d.marine_growth_pct ? `${d.marine_growth_pct}%` : (d.marine_growth_coverage || d.marine_growth || "—");
                        return [
                            i + 1,
                            r.structure_components?.q_id || r.component?.q_id || "N/A",
                            el,
                            diveNo,
                            d.coating_condition || "—",
                            d.component_condition || "—",
                            mg,
                            formatFindings(r)
                        ];
                    }),
                    theme: "grid",
                    headStyles: {fillColor: colors.navy, textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center", lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255]},
                    bodyStyles: { fontSize: 6.5, textColor: colors.text },
                    columnStyles: {
                        0: { cellWidth: 12, halign: "center" },
                        1: { cellWidth: 28 },
                        2: { cellWidth: 18, halign: "center" },
                        3: { cellWidth: 16, halign: "center" },
                        4: { cellWidth: 22 },
                        5: { cellWidth: 22 },
                        6: { cellWidth: 22 },
                        7: { cellWidth: "auto" }
                    },
                    didParseCell: (data) => {
                        if (data.section === "body") applyCellColoring(data, recsGVINS[data.row.index]);
                    }
                });
                currentY = (doc as any).lastAutoTable.finalY + 4;
            }

            // 2. CVINS
            if (recsCVINS.length > 0) {
                drawSectionHeader("Close Visual Inspection (CVINS)");
                autoTable(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin },
                    head: [["No.", "QID", "Elevation (m)", "Dive No.", "Coating Condition", "Component Condition", "Debris / Corrosion", "Findings"]],
                    body: recsCVINS.map((r, i) => {
                        const d = r.inspection_data || {};
                        const el = r.elevation ?? d.elevation ?? "—";
                        const diveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || r.dive_job_id || "—";
                        const debris = d.debris_type || d.corrosion_type || d.debris_desc || "—";
                        return [
                            i + 1,
                            r.structure_components?.q_id || r.component?.q_id || "N/A",
                            el,
                            diveNo,
                            d.coating_condition || "—",
                            d.component_condition || "—",
                            debris,
                            formatFindings(r)
                        ];
                    }),
                    theme: "grid",
                    headStyles: {fillColor: colors.navy, textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center", lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255]},
                    bodyStyles: { fontSize: 6.5, textColor: colors.text },
                    columnStyles: {
                        0: { cellWidth: 12, halign: "center" },
                        1: { cellWidth: 28 },
                        2: { cellWidth: 18, halign: "center" },
                        3: { cellWidth: 16, halign: "center" },
                        4: { cellWidth: 24 },
                        5: { cellWidth: 24 },
                        6: { cellWidth: 24 },
                        7: { cellWidth: "auto" }
                    },
                    didParseCell: (data) => {
                        if (data.section === "body") applyCellColoring(data, recsCVINS[data.row.index]);
                    }
                });
                currentY = (doc as any).lastAutoTable.finalY + 4;
            }

            // 3. CPSURV
            if (recsCPSURV.length > 0) {
                drawSectionHeader("CP Survey (CPSURV)");
                autoTable(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin },
                    head: [["No.", "QID", "Elevation (m)", "Dive No.", "CP Reading", "Anode Condition", "Marine Growth %", "Findings"]],
                    body: recsCPSURV.map((r, i) => {
                        const d = r.inspection_data || {};
                        const el = r.elevation ?? d.elevation ?? "—";
                        const diveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || r.dive_job_id || "—";
                        const cp = d.cp_rdg ? `${d.cp_rdg} mV` : (d.cp_reading ? `${d.cp_reading} mV` : "—");
                        const mg = d.marine_growth_pct ? `${d.marine_growth_pct}%` : (d.marine_growth || "—");
                        return [
                            i + 1,
                            r.structure_components?.q_id || r.component?.q_id || "N/A",
                            el,
                            diveNo,
                            cp,
                            d.anode_condition || "—",
                            mg,
                            formatFindings(r)
                        ];
                    }),
                    theme: "grid",
                    headStyles: {fillColor: colors.navy, textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center", lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255]},
                    bodyStyles: { fontSize: 6.5, textColor: colors.text },
                    columnStyles: {
                        0: { cellWidth: 12, halign: "center" },
                        1: { cellWidth: 28 },
                        2: { cellWidth: 18, halign: "center" },
                        3: { cellWidth: 16, halign: "center" },
                        4: { cellWidth: 22, halign: "center" },
                        5: { cellWidth: 22 },
                        6: { cellWidth: 22 },
                        7: { cellWidth: "auto" }
                    },
                    didParseCell: (data) => {
                        if (data.section === "body") applyCellColoring(data, recsCPSURV[data.row.index]);
                    }
                });
                currentY = (doc as any).lastAutoTable.finalY + 4;
            }

            // 4. UTWTK
            if (recsUTWTK.length > 0) {
                drawSectionHeader("UT Wall Thickness (UTWTK)");
                autoTable(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin },
                    head: [
                        [
                            { content: "No.", rowSpan: 2, styles: {valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                            { content: "QID", rowSpan: 2, styles: {valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                            { content: "Elevation (m)", rowSpan: 2, styles: {valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                            { content: "Dive No.", rowSpan: 2, styles: {valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                            { content: "Thickness Readings (o'clock)", colSpan: 4, styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                            { content: "Nominal Thickness", rowSpan: 2, styles: {valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                            { content: "Findings", rowSpan: 2, styles: {valign: "middle", lineWidth: 0.1, lineColor: colors.border} }
                        ],
                        ["12", "3", "6", "9"]
                    ],
                    body: recsUTWTK.map((r, i) => {
                        const d = r.inspection_data || {};
                        const el = r.elevation ?? d.elevation ?? "—";
                        const diveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || r.dive_job_id || "—";
                        const nom = d.nominal_thickness || d.nominal_thk || d.nom_thick || "—";
                        return [
                            i + 1,
                            r.structure_components?.q_id || r.component?.q_id || "N/A",
                            el,
                            diveNo,
                            d.t1 || d.reading_12 || "-",
                            d.t2 || d.reading_3 || "-",
                            d.t3 || d.reading_6 || "-",
                            d.t4 || d.reading_9 || "-",
                            nom,
                            formatFindings(r)
                        ];
                    }),
                    theme: "grid",
                    headStyles: {fillColor: colors.navy, textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center", lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255]},
                    bodyStyles: { fontSize: 6.5, textColor: colors.text },
                    columnStyles: {
                        0: { cellWidth: 12, halign: "center" },
                        1: { cellWidth: 28 },
                        2: { cellWidth: 18, halign: "center" },
                        3: { cellWidth: 16, halign: "center" },
                        4: { cellWidth: 11, halign: "center" },
                        5: { cellWidth: 11, halign: "center" },
                        6: { cellWidth: 11, halign: "center" },
                        7: { cellWidth: 11, halign: "center" },
                        8: { cellWidth: 18, halign: "center" },
                        9: { cellWidth: "auto" }
                    },
                    didParseCell: (data) => {
                        if (data.section === "body") applyCellColoring(data, recsUTWTK[data.row.index]);
                    }
                });
                currentY = (doc as any).lastAutoTable.finalY + 4;
            }

            // Signatures
            if (config.showSignatures !== false) {
                const finalY = currentY;
                let sigY = pageHeight - 38;
                if (finalY > sigY - 10) {
                    doc.addPage();
                    drawPageHeader(doc);
                    sigY = pageHeight - 38;
                }
                const sigW = contentWidth / 3;
                const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                    doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1);
                    doc.rect(lx, sigY, sigW - 4, 18);
                    if (!config.printFriendly) {
                        doc.setFillColor(...colors.navy);
                        doc.rect(lx, sigY, sigW - 4, 4.5, "F");
                        doc.setTextColor(255);
                    } else {
                        doc.setTextColor(...colors.navy);
                    }
                    doc.setFontSize(7); doc.setFont("helvetica", "bold");
                    doc.text(label, lx + 2, sigY + 3.5);
                    doc.setTextColor(...colors.text); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
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
        });

        
        const totalPages = doc.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            const footerY = pageHeight - 5;
            doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
            doc.line(margin, footerY - 2.5, pageWidth - margin, footerY - 2.5);
            doc.setFontSize(6.5); doc.setTextColor(150, 150, 150);
            doc.setFont("helvetica", "normal");
            doc.text(REPORT_FOOTER_APP_TEXT, margin, footerY);
            if (config?.showPageNumbers !== false) {
                doc.text(`Page ${j} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
            }
        }
        (doc as any)._footerApplied = true;

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        doc.save(`Diving_Caisson_Inspection_Underwater_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[generateDivingDCASNUWReport] Error:", err);
        throw err;
    }
};
