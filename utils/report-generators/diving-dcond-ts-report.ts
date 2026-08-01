import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal } from "./shared-logo";
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
}

/**
 * Diving Conductor Topside Report (Portrait)
 * Grouped by parent Conductor (CD) component.
 * Filters for elevations >= 0.
 * Compiles GVINS, CVINS, CPSURV, UTWTK.
 */
export const generateDivingDCONDTSReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    const supabase = createClient();
    console.log("[Diving Conductor TS Report] Starting generation", { recordsCount: records?.length, config });

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

        // Filter records: elevation >= 0 and type in [GVINS, CVINS, CPSURV, UTWTK]
        const filteredRecords = records.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase();
            const validTypes = ['GVINS', 'CVINS', 'CPSURV', 'UTWTK', 'DUTWT'];
            if (!validTypes.includes(typeCode)) return false;

            const elevationVal = parseFloat(r.elevation ?? r.inspection_data?.elevation ?? 0);
            return elevationVal >= 0;
        });

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

        const HEADER_H = 24;

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

            if (companyLogo) drawLogo(d, companyLogo, 18, 18, pageWidth - margin - 22, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 18, 18, margin + 4, margin + 3, "left", "center");

            d.setFontSize(9); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Inspection Division", margin + contentWidth / 2, margin + 10, { align: "center" });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text("Conductor Inspection Topside Diving", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });
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

        // Grouping logic (group by Conductor - code CD)
        const compRegistry = new Map<number, any>();
        const qidRegistry = new Map<string, any>();
        allComps?.forEach(c => {
            compRegistry.set(c.id, c);
            qidRegistry.set(c.q_id.toUpperCase(), c);
        });

        const getGroupKey = (r: any): string => {
            const comp = r.structure_components || r.component || {};
            const metadata = comp.metadata || {};
            const qid = (comp.q_id || "Unknown").toUpperCase();

            const parentId = metadata.associated_comp_id || metadata.parent_id || metadata.comp_id_parent || metadata.parent_comp_id || metadata.associated_id;
            let parentQid = metadata.associated_comp_qid || metadata.parent_qid || metadata.parent_q_id;

            const findUltimateCDParent = (cid: number | null, depth = 0): string | null => {
                if (!cid || depth > 5) return null;
                const c = compRegistry.get(cid);
                if (!c) return null;

                const meta = c.metadata || {};
                const pId = meta.associated_comp_id || meta.parent_id || meta.comp_id_parent || meta.parent_comp_id || meta.associated_id;
                const typeCode = (c.code || "").toUpperCase();

                if (typeCode === "CD" && !pId) return c.q_id;
                return findUltimateCDParent(pId, depth + 1) || (typeCode === "CD" ? c.q_id : null);
            };

            const ultimateParent = findUltimateCDParent(parentId || comp.id);
            if (ultimateParent) return ultimateParent;
            if (parentQid) return parentQid;

            if (qid.startsWith("CD")) {
                let bestMatch = "";
                allComps?.forEach(c => {
                    const cCode = (c.code || "").toUpperCase();
                    const cQid = (c.q_id || "").toUpperCase();
                    const cMeta = c.metadata || {};
                    const cpId = cMeta.associated_comp_id || cMeta.parent_id || cMeta.comp_id_parent || cMeta.parent_comp_id || cMeta.associated_id;

                    if (cCode === "CD" && !cpId && qid.startsWith(cQid) && cQid.length > bestMatch.length) {
                        bestMatch = c.q_id;
                    }
                });
                if (bestMatch) return bestMatch;
            }

            const match = qid.match(/^(CD-[^-_ ]+)/i);
            if (match) return match[1];

            return (comp.code || "").toUpperCase() === "CD" ? qid : "General";
        };

        const conductorGroups: Record<string, any[]> = {};
        filteredRecords.forEach(r => {
            const key = getGroupKey(r).toUpperCase();
            if (!conductorGroups[key]) conductorGroups[key] = [];
            conductorGroups[key].push(r);
        });

        const sortedConductorQids = Object.keys(conductorGroups).sort((a, b) => {
            if (a === "General") return 1;
            if (b === "General") return -1;
            return a.localeCompare(b);
        });

        if (sortedConductorQids.length === 0 && filteredRecords.length > 0) {
            conductorGroups["General"] = filteredRecords;
            sortedConductorQids.push("General");
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
        sortedConductorQids.forEach((conductorQid, groupIdx) => {
            if (groupIdx > 0) doc.addPage();

            const groupRecords = conductorGroups[conductorQid].sort((a, b) => {
                const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                return elB - elA; // Top-down
            });

            drawPageHeader(doc);
            const startY = drawContextRow(doc, margin + HEADER_H + 2, groupRecords);

            let currentY = startY;

            // Sub-header for Conductor QID
            if (conductorQid && conductorQid !== "General") {
                const subH = 6;
                doc.setFillColor(...colors.navy);
                doc.rect(margin, currentY, contentWidth, subH, "F");
                doc.setTextColor(255);
                doc.setFontSize(8); doc.setFont("helvetica", "bold");
                doc.text(`CONDUCTOR QID: ${conductorQid}`, margin + 4, currentY + 4.2);
                currentY += subH + 4;
            }

            // Separate records by inspection type
            const gvinsRecs = groupRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'GVINS');
            const cvinsRecs = groupRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'CVINS');
            const cpsurvRecs = groupRecords.filter(r => (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'CPSURV');
            const utwtkRecs = groupRecords.filter(r => ['UTWTK', 'DUTWT'].includes((r.inspection_type_code || r.inspection_type?.code || '').toUpperCase()));

            const isPF = config.printFriendly;

            // 1. GVINS Block
            if (gvinsRecs.length > 0) {
                // Section Header
                doc.setTextColor(...colors.navy);
                doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
                doc.text("General Visual Inspection (GVINS)", margin, currentY);
                currentY += 2.5;

                const body = gvinsRecs.map((r, idx) => {
                    const d = r.inspection_data || {};
                    const qid = r.structure_components?.q_id || r.component?.q_id || "—";
                    const elev = r.elevation ?? d.elevation ?? "—";
                    const diveNo = r.insp_dive_jobs?.job_no || r.dive_job_id || "—";
                    const coatCond = d.coating_condition ?? "—";
                    const compCond = d.component_condition ?? "—";
                    const mg = (d.marine_growth ?? [
                        d.marine_growth_hard ? `Hard: ${d.marine_growth_hard}` : '',
                        d.marine_growth_soft ? `Soft: ${d.marine_growth_soft}` : ''
                    ].filter(Boolean).join(', ')) || "—";

                    return [
                        String(idx + 1),
                        qid,
                        String(elev),
                        String(diveNo),
                        String(coatCond),
                        String(compCond),
                        String(mg),
                        formatFindings(r)
                    ];
                });

                autoTable(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin, bottom: config.showSignatures !== false ? 35 : 15 },
                    head: [[
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "Dive No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Coating Condition", styles: { halign: "center", valign: "middle" } },
                        { content: "Component Condition", styles: { halign: "center", valign: "middle" } },
                        { content: "Marine Growth %", styles: { halign: "center", valign: "middle" } },
                        { content: "Findings", styles: { halign: "center", valign: "middle" } }
                    ]],
                    body,
                    theme: "grid",
                    headStyles: {
                        fillColor: isPF ? [255, 255, 255] : colors.navy,
                        textColor: isPF ? colors.navy : [255, 255, 255],
                        fontSize: 7,
                        fontStyle: "bold",
                    },
                    styles: {
                        fontSize: 6.5,
                        cellPadding: 1.5,
                        textColor: colors.text,
                        lineColor: colors.border,
                        overflow: "linebreak",
                    },
                    columnStyles: {
                        0: { cellWidth: 8, halign: "center" },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 15, halign: "center" },
                        3: { cellWidth: 15, halign: "center" },
                        4: { cellWidth: 22, halign: "center" },
                        5: { cellWidth: 22, halign: "center" },
                        6: { cellWidth: 20, halign: "center" },
                        7: { cellWidth: "auto" }
                    },
                    didParseCell: (data) => {
                        if (data.section === "body") {
                            const r = gvinsRecs[data.row.index];
                            applyCellColoring(data, r);
                        }
                    },
                    didDrawPage: (data) => {
                        if (data.pageNumber > 1) drawPageHeader(doc);
                    }
                });

                currentY = (doc as any).lastAutoTable.finalY + 8;
            }

            // 2. CVINS Block
            if (cvinsRecs.length > 0) {
                if (currentY > pageHeight - 35) { doc.addPage(); drawPageHeader(doc); currentY = margin + HEADER_H + 10; }
                // Section Header
                doc.setTextColor(...colors.navy);
                doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
                doc.text("Close Visual Inspection (CVINS)", margin, currentY);
                currentY += 2.5;

                const body = cvinsRecs.map((r, idx) => {
                    const d = r.inspection_data || {};
                    const qid = r.structure_components?.q_id || r.component?.q_id || "—";
                    const elev = r.elevation ?? d.elevation ?? "—";
                    const diveNo = r.insp_dive_jobs?.job_no || r.dive_job_id || "—";
                    const coatCond = d.coating_condition ?? "—";
                    const compCond = d.component_condition ?? "—";
                    const debCorr = d.debris ?? d.debris_material ?? d.corrosion ?? "—";

                    return [
                        String(idx + 1),
                        qid,
                        String(elev),
                        String(diveNo),
                        String(coatCond),
                        String(compCond),
                        String(debCorr),
                        formatFindings(r)
                    ];
                });

                autoTable(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin, bottom: config.showSignatures !== false ? 35 : 15 },
                    head: [[
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "Dive No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Coating Condition", styles: { halign: "center", valign: "middle" } },
                        { content: "Component Condition", styles: { halign: "center", valign: "middle" } },
                        { content: "Debris / Corrosion", styles: { halign: "center", valign: "middle" } },
                        { content: "Findings", styles: { halign: "center", valign: "middle" } }
                    ]],
                    body,
                    theme: "grid",
                    headStyles: {
                        fillColor: isPF ? [255, 255, 255] : colors.navy,
                        textColor: isPF ? colors.navy : [255, 255, 255],
                        fontSize: 7,
                        fontStyle: "bold",
                    },
                    styles: {
                        fontSize: 6.5,
                        cellPadding: 1.5,
                        textColor: colors.text,
                        lineColor: colors.border,
                        overflow: "linebreak",
                    },
                    columnStyles: {
                        0: { cellWidth: 8, halign: "center" },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 15, halign: "center" },
                        3: { cellWidth: 15, halign: "center" },
                        4: { cellWidth: 22, halign: "center" },
                        5: { cellWidth: 22, halign: "center" },
                        6: { cellWidth: 20, halign: "center" },
                        7: { cellWidth: "auto" }
                    },
                    didParseCell: (data) => {
                        if (data.section === "body") {
                            const r = cvinsRecs[data.row.index];
                            applyCellColoring(data, r);
                        }
                    },
                    didDrawPage: (data) => {
                        if (data.pageNumber > 1) drawPageHeader(doc);
                    }
                });

                currentY = (doc as any).lastAutoTable.finalY + 8;
            }

            // 3. CPSURV Block
            if (cpsurvRecs.length > 0) {
                if (currentY > pageHeight - 35) { doc.addPage(); drawPageHeader(doc); currentY = margin + HEADER_H + 10; }
                // Section Header
                doc.setTextColor(...colors.navy);
                doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
                doc.text("CP Survey (CPSURV)", margin, currentY);
                currentY += 2.5;

                const body = cpsurvRecs.map((r, idx) => {
                    const d = r.inspection_data || {};
                    const qid = r.structure_components?.q_id || r.component?.q_id || "—";
                    const elev = r.elevation ?? d.elevation ?? "—";
                    const diveNo = r.insp_dive_jobs?.job_no || r.dive_job_id || "—";
                    const primaryCP = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? "";
                    const additionals: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : (Array.isArray(d.cp_readings) ? d.cp_readings : []);
                    const additionalCPs = additionals
                        .map((a: any) => a.reading ?? a.cp_rdg ?? "")
                        .filter((val: any) => val !== "" && val !== null && val !== undefined);

                    const cpList = [primaryCP, ...additionalCPs].filter((val: any) => val !== "" && val !== null && val !== undefined);
                    const cpDisplay = cpList.length > 0
                        ? cpList.map((val: any) => String(val).toLowerCase().includes("mv") ? String(val) : `${val} mV`).join("\n")
                        : "—";
                    const anodeCond = d.anode_condition ?? d.component_condition ?? "—";
                    const mg = (d.marine_growth ?? [
                        d.marine_growth_hard ? `Hard: ${d.marine_growth_hard}` : '',
                        d.marine_growth_soft ? `Soft: ${d.marine_growth_soft}` : ''
                    ].filter(Boolean).join(', ')) || "—";

                    return [
                        String(idx + 1),
                        qid,
                        String(elev),
                        String(diveNo),
                        String(cpDisplay),
                        String(anodeCond),
                        String(mg),
                        formatFindings(r)
                    ];
                });

                autoTable(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin, bottom: config.showSignatures !== false ? 35 : 15 },
                    head: [[
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "Dive No.", styles: { halign: "center", valign: "middle" } },
                        { content: "CP Reading", styles: { halign: "center", valign: "middle" } },
                        { content: "Anode Condition", styles: { halign: "center", valign: "middle" } },
                        { content: "Marine Growth %", styles: { halign: "center", valign: "middle" } },
                        { content: "Findings", styles: { halign: "center", valign: "middle" } }
                    ]],
                    body,
                    theme: "grid",
                    headStyles: {
                        fillColor: isPF ? [255, 255, 255] : colors.navy,
                        textColor: isPF ? colors.navy : [255, 255, 255],
                        fontSize: 7,
                        fontStyle: "bold",
                    },
                    styles: {
                        fontSize: 6.5,
                        cellPadding: 1.5,
                        textColor: colors.text,
                        lineColor: colors.border,
                        overflow: "linebreak",
                    },
                    columnStyles: {
                        0: { cellWidth: 8, halign: "center" },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 15, halign: "center" },
                        3: { cellWidth: 15, halign: "center" },
                        4: { cellWidth: 20, halign: "center" },
                        5: { cellWidth: 22, halign: "center" },
                        6: { cellWidth: 22, halign: "center" },
                        7: { cellWidth: "auto" }
                    },
                    didParseCell: (data) => {
                        if (data.section === "body") {
                            const r = cpsurvRecs[data.row.index];
                            applyCellColoring(data, r);
                        }
                    },
                    didDrawPage: (data) => {
                        if (data.pageNumber > 1) drawPageHeader(doc);
                    }
                });

                currentY = (doc as any).lastAutoTable.finalY + 8;
            }

            // 4. UTWTK Block
            if (utwtkRecs.length > 0) {
                if (currentY > pageHeight - 35) { doc.addPage(); drawPageHeader(doc); currentY = margin + HEADER_H + 10; }
                // Section Header
                doc.setTextColor(...colors.navy);
                doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
                doc.text("UT Wall Thickness (UTWTK)", margin, currentY);
                currentY += 2.5;

                const body = utwtkRecs.map((r, idx) => {
                    const d = r.inspection_data || {};
                    const qid = r.structure_components?.q_id || r.component?.q_id || "—";
                    const elev = r.elevation ?? d.elevation ?? "—";
                    const diveNo = r.insp_dive_jobs?.job_no || r.dive_job_id || "—";

                    const getRd = (val: any, unit: any) => (val !== undefined && val !== null && val !== "") ? `${val} ${unit || 'mm'}` : "-";
                    const rd12 = getRd(d.ut_12_o_clock, d.ut_12_o_clock_unit);
                    const rd3 = getRd(d.ut_3_o_clock, d.ut_3_o_clock_unit);
                    const rd6 = getRd(d.ut_6_o_clock, d.ut_6_o_clock_unit);
                    const rd9 = getRd(d.ut_9_o_clock, d.ut_9_o_clock_unit);
                    const nominal = d.nominal_thickness !== undefined && d.nominal_thickness !== null && d.nominal_thickness !== ""
                        ? `${d.nominal_thickness} ${d.nominal_thickness_unit || 'mm'}`
                        : "—";

                    return [
                        String(idx + 1),
                        qid,
                        String(elev),
                        String(diveNo),
                        rd12,
                        rd3,
                        rd6,
                        rd9,
                        nominal,
                        formatFindings(r)
                    ];
                });

                autoTable(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin, bottom: config.showSignatures !== false ? 35 : 15 },
                    head: [
                        [
                            { content: "Item No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                            { content: "QID", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                            { content: "Elevation (m)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                            { content: "Dive No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                            { content: "Thickness Readings (o'clock)", colSpan: 4, styles: { halign: 'center' } },
                            { content: "Nominal Thickness", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                            { content: "Findings", rowSpan: 2, styles: { halign: "center", valign: "middle" } }
                        ],
                        [
                            { content: "12", styles: { halign: "center" } },
                            { content: "3", styles: { halign: "center" } },
                            { content: "6", styles: { halign: "center" } },
                            { content: "9", styles: { halign: "center" } }
                        ]
                    ],
                    body,
                    theme: "grid",
                    headStyles: {
                        fillColor: isPF ? [255, 255, 255] : colors.navy,
                        textColor: isPF ? colors.navy : [255, 255, 255],
                        fontSize: 7,
                        fontStyle: "bold",
                    },
                    styles: {
                        fontSize: 6.5,
                        cellPadding: 1.5,
                        textColor: colors.text,
                        lineColor: colors.border,
                        overflow: "linebreak",
                    },
                    columnStyles: {
                        0: { cellWidth: 8, halign: "center" },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 15, halign: "center" },
                        3: { cellWidth: 15, halign: "center" },
                        4: { cellWidth: 12, halign: "center" },
                        5: { cellWidth: 12, halign: "center" },
                        6: { cellWidth: 12, halign: "center" },
                        7: { cellWidth: 12, halign: "center" },
                        8: { cellWidth: 16, halign: "center" },
                        9: { cellWidth: "auto" }
                    },
                    didParseCell: (data) => {
                        if (data.section === "body") {
                            const r = utwtkRecs[data.row.index];
                            applyCellColoring(data, r);
                        }
                    },
                    didDrawPage: (data) => {
                        if (data.pageNumber > 1) drawPageHeader(doc);
                    }
                });

                currentY = (doc as any).lastAutoTable.finalY + 8;
            }

            // Draw Footer and Signatory Section
            const finalY = (doc as any).lastAutoTable?.finalY ?? currentY;
            if (config.showSignatures !== false) {
                let sigY = pageHeight - 38;
                if (finalY > sigY - 10) {
                    doc.addPage();
                    drawPageHeader(doc);
                    sigY = pageHeight - 38;
                }
                const sigW = contentWidth / 3;
                const drawSigFooter = (label: string, lx: number) => {
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
                    doc.text("Date:", lx + 2, sigY + 13.5);
                    doc.text("Signature:", lx + 2, sigY + 17);
                };
                drawSigFooter("PREPARED BY", margin);
                drawSigFooter("REVIEWED BY", margin + sigW);
                drawSigFooter("APPROVED BY", margin + sigW * 2);
            }

            // Footer Bottom Text
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Conductor Inspection Topside Diving  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
                    margin, pageHeight - 6
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${i}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            }
        });

        console.log("[Diving Conductor TS Report] Generation complete, returnBlob:", config?.returnBlob);
        if (config?.returnBlob !== false) {
            applyWatermarkAndSignaturesGlobal(doc, config);
            return doc.output("blob");
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`Conductor_Inspection_Topside_Diving_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving Conductor TS Report] Error:", err);
        throw err;
    }
};
