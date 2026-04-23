import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo } from "./shared-logo";
import { createClient } from "@/utils/supabase/client";

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
 * ROV Caisson Survey Report (Portrait)
 * Columns: Item No. | QID | Elevation | Dive No. | CP | Component Condition | Coating Condition | Findings
 *
 * Data is grouped by Caisson (CS). Each CS group starts on a new page.
 * Associated components are clubbed with their parent CS QID.
 */
export const generateROVCasnReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - margin * 2;

        const supabase = createClient();

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

        // ── Pre-load logos ──────────────────────────────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        const HEADER_H = 24;

        const drawPageHeader = (d: jsPDF, caissonQid?: string) => {
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
            d.text("ROV Caisson Survey Report",                                margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`,   margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        const ROW_H = 7;
        const drawContextRow = (d: jsPDF, startY: number, groupRecords: any[]) => {
            const isPF = config.printFriendly;
            const half = contentWidth / 2;
            
            // Date range for this group
            let startDate: Date | null = null;
            let endDate:   Date | null = null;
            if (groupRecords.length > 0) {
                const dates = groupRecords
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
            drawBox("Structure:",        headerData.platformName  || "N/A", margin,        half, startY);
            drawBox("Vessel:",           headerData.vessel        || "N/A", margin + half,  half, startY);
            drawBox("Job Pack:",         headerData.jobpackName   || "N/A", margin,        half, startY + ROW_H);
            drawBox("Insp. Date Range:", dateRangeStr,                      margin + half,  half, startY + ROW_H);
            return startY + ROW_H * 2 + 4;
        };

        // ── Grouping Logic ──────────────────────────────────────────────────────
        // 1. Map all records to their parent Caisson QID if possible
        // 2. Fallback to component's own QID if it's a Caisson
        
        const caissonGroups: Record<string, any[]> = {};
        const idToQidMap: Record<number, string> = {};
        records.forEach(r => {
            const comp = r.structure_components || r.component || {};
            const metadata = comp.metadata || {};
            const typeCode = (comp.code || metadata.type || "").toUpperCase();
            if (typeCode === "CS" && comp.id && comp.q_id) {
                idToQidMap[comp.id] = comp.q_id;
            }
        });

        records.forEach(r => {
            const comp = r.structure_components || r.component || {};
            const metadata = comp.metadata || {};
            const typeCode = (comp.code || metadata.type || "").toUpperCase();
            const qid = comp.q_id || "Unknown";
            
            // Try to find parent QID
            let parentQid = metadata.parent_qid || metadata.parent_q_id;
            const parentId = metadata.parent_id || metadata.comp_id_parent;
            
            if (!parentQid && parentId && idToQidMap[parentId]) {
                parentQid = idToQidMap[parentId];
            }
            
            let groupKey = "General";
            
            if (typeCode === "CS") {
                groupKey = qid;
            } else if (parentQid) {
                groupKey = parentQid;
            } else {
                // If it starts with CS, it's likely a caisson or part of one
                const match = qid.match(/^(CS-[^-_ ]+)/);
                if (match) {
                    groupKey = match[1];
                } else if (qid.startsWith("CS")) {
                    groupKey = qid;
                }
            }
            
            if (!caissonGroups[groupKey]) caissonGroups[groupKey] = [];
            caissonGroups[groupKey].push(r);
        });
        
        const sortedCaissonQids = Object.keys(caissonGroups).sort((a, b) => {
            if (a === "General") return 1;
            if (b === "General") return -1;
            return a.localeCompare(b);
        });
        
        if (sortedCaissonQids.length === 0 && records.length > 0) {
            // Fallback for records not explicitly grouped
            caissonGroups["General"] = records;
            sortedCaissonQids.push("General");
        }

        const buildRow = (r: any, idx: number): string[] => {
            const d   = r.inspection_data || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
            const elevation = r.elevation ?? d.elevation ?? "—";

            const diveNo =
                r.insp_rov_jobs?.job_no  || r.insp_rov_jobs?.name  ||
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.rov_job_id || r.dive_job_id || "—";

            const primaryCP = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? "";
            const cpDisplay  = primaryCP !== "" && primaryCP !== null && primaryCP !== undefined
                ? `${primaryCP} mV`
                : "—";

            const compCond = d.component_condition || r.component_condition || "—";
            const coatCond = d.coating_condition || r.coating_condition || "—";

            const findingsParts: string[] = [];

            const additionals: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : [];
            additionals.forEach((a: any) => {
                const val = a.reading ?? a.cp_rdg ?? "";
                if (val !== "" && val !== null && val !== undefined) {
                    const loc = a.location ? ` @ ${a.location}` : "";
                    findingsParts.push(`Add. CP${loc}: ${val} mV`);
                }
            });

            if (r.description && r.description.trim()) {
                findingsParts.push(r.description.trim());
            }

            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
            if (anomRef) findingsParts.push(`Ref: ${anomRef}`);

            const isRectified = linkedAnom?.is_rectified || r.rectified || false;
            if (isRectified) {
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                findingsParts.push(`Rectified: ${rectRem}`);
            }

            const row = [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                cpDisplay,
                String(compCond),
                String(coatCond),
                findingsParts.length > 0 ? findingsParts.join("\n") : "—",
            ];
            return row;
        };

        // ── Generate Pages for each Caisson Group ───────────────────────────────
        sortedCaissonQids.forEach((caissonQid, groupIdx) => {
            if (groupIdx > 0) doc.addPage();
            
            const groupRecords = caissonGroups[caissonQid].sort((a, b) => {
                const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                return elB - elA;
            });

            drawPageHeader(doc);
            const startY = drawContextRow(doc, margin + HEADER_H + 2, groupRecords);

            // Sub-header for Caisson QID
            if (caissonQid && caissonQid !== "General") {
                const subH = 6;
                const subY = startY;
                doc.setFillColor(...colors.navy);
                doc.rect(margin, subY, contentWidth, subH, "F");
                doc.setTextColor(255);
                doc.setFontSize(8); doc.setFont("helvetica", "bold");
                doc.text(`CAISSON QID: ${caissonQid}`, margin + 4, subY + 4.2);
                
                // Adjust table startY
                (doc as any)._tableStartY = subY + subH + 2;
            } else {
                (doc as any)._tableStartY = startY;
            }

            autoTable(doc, {
                startY: (doc as any)._tableStartY,
                margin: { left: margin, right: margin, bottom: config.showSignatures !== false ? 35 : 15 },
                head: [[
                    { content: "Item\nNo.",       styles: { halign: "center", valign: "middle" } },
                    { content: "QID",             styles: { halign: "center", valign: "middle" } },
                    { content: "Elevation\n(m)",  styles: { halign: "center", valign: "middle" } },
                    { content: "Dive No.",        styles: { halign: "center", valign: "middle" } },
                    { content: "CP\n(mV)",        styles: { halign: "center", valign: "middle" } },
                    { content: "Component\nCondition", styles: { halign: "center", valign: "middle" } },
                    { content: "Coating\nCondition",   styles: { halign: "center", valign: "middle" } },
                    { content: "Findings",        styles: { halign: "center", valign: "middle" } }
                ]],
                body: groupRecords.map(buildRow),
                theme: "grid",
                headStyles: {
                    fillColor: config.printFriendly ? [255, 255, 255] : colors.navy,
                    textColor: config.printFriendly ? colors.navy : [255, 255, 255],
                    fontSize: 8,
                    fontStyle: "bold",
                    halign: "center",
                    valign: "middle",
                    minCellHeight: 10,
                },
                styles: {
                    fontSize: 7,
                    cellPadding: 2,
                    textColor: colors.text,
                    lineColor: colors.border,
                    overflow: "linebreak",
                },
                columnStyles: {
                    0: { cellWidth: 8,   halign: "center" },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 14,   halign: "center" },
                    3: { cellWidth: 14,   halign: "center" },
                    4: { cellWidth: 14,   halign: "center" },
                    5: { cellWidth: 18 },
                    6: { cellWidth: 18 },
                    7: { cellWidth: "auto" },
                },
                didParseCell: (data) => {
                    if (data.section !== "body") return;
                    const r = groupRecords[data.row.index];
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
                    // Footer Signatures
                    if (config.showSignatures !== false) {
                        const sigY = pageHeight - 32;
                        const sigW = contentWidth / 3;
                        const isPF = config.printFriendly;

                        const drawSigFooter = (label: string, lx: number) => {
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

                        drawSigFooter("PREPARED BY", margin);
                        drawSigFooter("REVIEWED BY", margin + sigW);
                        drawSigFooter("APPROVED BY", margin + sigW * 2);
                    }

                    // Footer Bottom Text
                    doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.text);
                    doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                    doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                    doc.text(
                        `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  ROV Caisson Survey Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
                        margin, pageHeight - 6
                    );
                    if (config.showPageNumbers !== false) {
                        doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                    }
                },
            });
        });

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Caisson_Survey_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ROV Caisson Report] Error:", err);
        throw err;
    }
};
