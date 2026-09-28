import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal , formatPdfDate } from "./shared-logo";
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
 * Caisson Inspection Topside Report (Diving)
 * Grouped by parent Caisson (CS) component.
 * Filters for elevations >= 0.
 * Compiles GVINS, CVINS, CPSURV, UTWTK.
 */
export const generateDivingDCASNTSReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | null | void> => {
    const supabase = createClient();
    console.log("[generateDivingDCASNTSReport] Starting generation", { recordsCount: records?.length, config });

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

        // Filter records
        const filteredRecords = records.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase();
            const validTypes = ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'];
            if (!validTypes.includes(typeCode)) return false;
            const elevationVal = parseFloat(r.elevation ?? r.inspection_data?.elevation ?? 0); return elevationVal >= 0;
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

        const HEADER_H = 26;

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

            if (companyLogo) drawLogo(d, companyLogo, 16, 16, pageWidth - margin - 20, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 16, 16, margin + 4, margin + 3, "left", "center");

            d.setFontSize(11); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth / 2), margin + 6, { align: "center" });
            d.setFontSize(8.5); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth / 2), margin + 10.5, { align: "center" });
            d.setFontSize(11); d.setFont("helvetica", "bold");
            d.text("Caisson Inspection Topside Report (Diving)", margin + (contentWidth / 2), margin + 16.5, { align: "center" });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin + (contentWidth / 2), margin + 21, { align: "center" });
        };

        const ROW_H = 7;
        const drawContextRow = (d: jsPDF, startY: number, groupRecords: any[]) => {
            const isPF = config.printFriendly;
            const half = contentWidth / 2;

            let startDate: Date | null = null;
            let endDate: Date | null = null;
            if (groupRecords.length > 0) {
                const dates = groupRecords
                    .map(r => new Date(r.cr_date || r.created_at))
                    .filter(dt => !isNaN(dt.getTime()));
                if (dates.length > 0) {
                    startDate = min(dates);
                    endDate = max(dates);
                }
            }
            const dateRangeStr = startDate && endDate
                ? `${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}`
                : "N/A";

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
            drawBox("Structure:", headerData.platformName || "N/A", margin, half, startY);
            drawBox("Vessel:", headerData.vessel || "N/A", margin + half, half, startY);
            drawBox("Job Pack:", headerData.jobpackName || "N/A", margin, half, startY + ROW_H);
            drawBox("Insp. Date Range:", dateRangeStr, margin + half, half, startY + ROW_H);
            return startY + ROW_H * 2 + 4;
        };

        // Grouping logic (strictly group by Caisson - CS)
        const compRegistry = new Map<number, any>();
        const qidRegistry = new Map<string, any>();
        allComps?.forEach(c => {
            compRegistry.set(c.id, c);
            qidRegistry.set(c.q_id.toUpperCase(), c);
        });

        const getGroupKey = (r: any): string | null => {
            const comp = r.structure_components || r.component || {};
            const metadata = comp.metadata || {};
            const qid = (comp.q_id || "Unknown").toUpperCase();

            const parentId = metadata.associated_comp_id || metadata.parent_id || metadata.comp_id_parent || metadata.parent_comp_id || metadata.associated_id;
            let parentQid = metadata.associated_comp_qid || metadata.parent_qid || metadata.parent_q_id;

            const findUltimateCSParent = (cid: number | null, depth = 0): string | null => {
                if (!cid || depth > 5) return null;
                const c = compRegistry.get(cid);
                if (!c) return null;

                const meta = c.metadata || {};
                const pId = meta.associated_comp_id || meta.parent_id || meta.comp_id_parent || meta.parent_comp_id || meta.associated_id;
                const typeCode = (c.code || "").toUpperCase();

                if (typeCode === "CS" && !pId) return c.q_id;
                return findUltimateCSParent(pId, depth + 1) || (typeCode === "CS" ? c.q_id : null);
            };

            const ultimateParent = findUltimateCSParent(parentId || comp.id);
            if (ultimateParent) return ultimateParent;
            if (parentQid) return parentQid;

            if (qid.startsWith("CS")) {
                let bestMatch = "";
                allComps?.forEach(c => {
                    const cCode = (c.code || "").toUpperCase();
                    const cQid = (c.q_id || "").toUpperCase();
                    const cMeta = c.metadata || {};
                    const cpId = cMeta.associated_comp_id || cMeta.parent_id || cMeta.comp_id_parent || cMeta.parent_comp_id || cMeta.associated_id;

                    if (cCode === "CS" && !cpId && qid.startsWith(cQid) && cQid.length > bestMatch.length) {
                        bestMatch = c.q_id;
                    }
                });
                if (bestMatch) return bestMatch;
            }

            const match = qid.match(/^(CS-[^-_ ]+)/i);
            if (match) return match[1];

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
            const d = r.inspection_data || {};
            const parts: string[] = [];
            if (r.description?.trim()) {
                parts.push(r.description.trim());
            } else if (d.findings?.trim()) {
                parts.push(d.findings.trim());
            }

            // CP Additional
            const additionals: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : (Array.isArray(d.cp_readings) ? d.cp_readings : []);
            additionals.forEach((a: any) => {
                const val = a.reading ?? a.cp_rdg ?? "";
                if ((val !== "" && val !== null && val !== undefined) || a.location) {
                    const loc = a.location ? ` @ ${a.location}` : "";
                    const unit = String(val).toLowerCase().includes("mv") || !val ? "" : " mV";
                    parts.push(`Add. CP${loc}: ${val}${unit}`);
                }
            });

            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
            if (anomRef) parts.push(`Ref: ${anomRef}`);
            const isRectified = linkedAnom?.is_rectified || r.rectified || false;
            if (isRectified) {
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                parts.push(`Rectified: ${rectRem}`);
            }
            return parts.length > 0 ? parts.join("\n") : "—";
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
            const { isFinding, isAnom, isRect } = parseMetaStatus(r);
            if (isFinding) {
                data.cell.styles.textColor = colors.finding;
                data.cell.styles.fontStyle = "bold";
            } else if (isAnom) {
                data.cell.styles.textColor = colors.anomaly;
                data.cell.styles.fontStyle = "bold";
            } else if (isRect) {
                data.cell.styles.textColor = colors.rectified;
                data.cell.styles.fontStyle = "bold";
            }
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
                doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                doc.text(title, margin, currentY + 4);
                currentY += 6;
            };

            // 1. GVINS
            if (recsGVINS.length > 0) {
                drawSectionHeader("General Visual Inspection (GVINS)");
                autoTable(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin },
                    head: [["Item No.", "QID", "Elevation (m)", "Dive No.", "Coating Condition", "Component Condition", "Marine Growth %", "Findings"]],
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
                    headStyles: { fillColor: colors.navy, textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center" },
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
                    head: [["Item No.", "QID", "Elevation (m)", "Dive No.", "Coating Condition", "Component Condition", "Debris / Corrosion", "Findings"]],
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
                    headStyles: { fillColor: colors.navy, textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center" },
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
                    head: [["Item No.", "QID", "Elevation (m)", "Dive No.", "CP Reading", "Anode Condition", "Marine Growth %", "Findings"]],
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
                    headStyles: { fillColor: colors.navy, textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center" },
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
                            { content: "Item No.", rowSpan: 2, styles: { valign: "middle" } },
                            { content: "QID", rowSpan: 2, styles: { valign: "middle" } },
                            { content: "Elevation (m)", rowSpan: 2, styles: { valign: "middle" } },
                            { content: "Dive No.", rowSpan: 2, styles: { valign: "middle" } },
                            { content: "Thickness Readings (o'clock)", colSpan: 4, styles: { halign: "center" } },
                            { content: "Nominal Thickness", rowSpan: 2, styles: { valign: "middle" } },
                            { content: "Findings", rowSpan: 2, styles: { valign: "middle" } }
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
                    headStyles: { fillColor: colors.navy, textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center" },
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

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        doc.save(`Diving_Caisson_Inspection_Topside_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[generateDivingDCASNTSReport] Error:", err);
        throw err;
    }
};

export const generateDivingDCASNTopsideReport = generateDivingDCASNTSReport;
