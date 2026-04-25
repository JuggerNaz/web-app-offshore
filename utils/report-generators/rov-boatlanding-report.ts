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
 * ROV Boatlanding Survey Report (Portrait)
 * Columns: Item No. | QID | Elevation | Dive No. | Tape No. | CP | Findings
 *
 * Data is grouped by Boatlanding (BL). Each BL group starts on a new page.
 * Associated components (like anodes, clamps attached to BL) are clubbed with their parent BL QID.
 */
export const generateROVBoatlandingReport = async (
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
            d.text("ROV Boatlanding Survey Report",                                margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`,   margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        const ROW_H = 7;
        const drawContextRow = (d: jsPDF, startY: number, groupRecords: any[]) => {
            const isPF = config.printFriendly;
            const half = contentWidth / 2;
            
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
        const idToComp: Record<number, { q_id: string, name: string, parent_id: number | null, is_bl: boolean }> = {};
        
        const addCompToMap = (c: any) => {
            if (!c || !c.id) return;
            const qid = (c.q_id || "").toUpperCase();
            const typeCode = (c.code || c.metadata?.type || "").toUpperCase();
            const compName = c.comp_name || c.name || "Boatlanding";

            // Group by Boatlanding (BL)
            const isBL = qid.startsWith("BL") || typeCode === "BL" || typeCode === "BOATLANDING";
            
            idToComp[c.id] = {
                q_id: c.q_id || `ID: ${c.id}`,
                name: compName,
                parent_id: c.metadata?.parent_id || c.metadata?.comp_id_parent || c.metadata?.parent_comp_id || c.metadata?.associated_comp_id || null,
                is_bl: isBL
            };
        };

        // 1. Build initial map from records
        records.forEach(r => {
            addCompToMap(r.structure_components);
            addCompToMap(r.component);
        });

        // 2. Load all components for the structure to resolve parents
        const effectiveStructureId = config.structureId || records.find(r => r.structure_id)?.structure_id;
        if (effectiveStructureId) {
            try {
                const { data: allComps } = await supabase
                    .from('structure_components')
                    .select('*')
                    .eq('structure_id', effectiveStructureId);
                allComps?.forEach(addCompToMap);
            } catch (e) {}
        }

        // 3. targeted fetch for any missing 'Associated' component IDs
        const missingIds = new Set<number>();
        records.forEach(r => {
            const comp = r.structure_components || r.component || {};
            const metadata = comp.metadata || {};
            const aid = metadata.associated_comp_qid || metadata.associated_comp_id || metadata.parent_id || 
                        metadata.comp_id_parent || metadata.parent_comp_id || 
                        metadata.associated_id;
            if (aid && !idToComp[Number(aid)]) missingIds.add(Number(aid));
        });

        if (missingIds.size > 0) {
            try {
                const { data: extraComps } = await supabase
                    .from('structure_components')
                    .select('*')
                    .in('id', Array.from(missingIds));
                extraComps?.forEach(addCompToMap);
            } catch (e) {}
        }

        // 4. Grouping Logic
        const blGroups: Record<number, any[]> = {};
        records.forEach(r => {
            const comp = r.structure_components || r.component || {};
            const metadata = comp.metadata || {};
            
            // Get the Parent ID (using associated_comp_qid fallback to its own id)
            const parentIdVal = metadata.associated_comp_qid || metadata.associated_comp_id || metadata.parent_id || comp.id;
            const groupId = Number(parentIdVal);

            // ONLY include if the resolved group belongs to a BL component type
            const parentInfo = idToComp[groupId];
            if (groupId && parentInfo?.is_bl) {
                if (!blGroups[groupId]) blGroups[groupId] = [];
                blGroups[groupId].push(r);
            }
        });

        // Filter and Sort by Parent QID
        const sortedParentIds = Object.keys(blGroups).map(Number).sort((a, b) => {
            const qidA = idToComp[a]?.q_id || "";
            const qidB = idToComp[b]?.q_id || "";
            return qidA.localeCompare(qidB, undefined, { numeric: true, sensitivity: 'base' });
        });

        const buildRow = (r: any, idx: number): string[] => {
            const d   = r.inspection_data || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
            const elevation = r.elevation ?? d.elevation ?? d.verification_depth ?? "—";
            
            const diveNo =
                r.insp_rov_jobs?.job_no  || r.insp_rov_jobs?.name  ||
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.rov_job_id || r.dive_job_id || "—";

            const tapeNo = r.insp_video_tapes?.tape_no || d.tape_no || r.tape_id || "—";

            const primaryCP = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? "";
            const cpDisplay  = primaryCP !== "" && primaryCP !== null && primaryCP !== undefined
                ? `${primaryCP} mV`
                : "—";

            const findingsParts: string[] = [];

            // CP Additional
            const additionals = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : [];
            additionals.forEach((a: any) => {
                const val = a.reading ?? a.cp_rdg ?? "";
                if (val !== "" && val !== null && val !== undefined) {
                    const loc = a.location ? ` @ ${a.location}` : "";
                    findingsParts.push(`Add. CP${loc}: ${val} mV`);
                }
            });

            // Findings / Description
            if (r.description && r.description.trim()) {
                findingsParts.push(r.description.trim());
            } else if (d.findings && d.findings.trim()) {
                findingsParts.push(d.findings.trim());
            }

            // Anomaly Reference
            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
            if (anomRef) findingsParts.push(`Ref: ${anomRef}`);

            // Rectification
            const isRectified = linkedAnom?.is_rectified || r.rectified || linkedAnom?.status === 'CLOSED';
            if (isRectified) {
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                findingsParts.push(`Rectified: ${rectRem}`);
            }

            return [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                String(tapeNo),
                cpDisplay,
                findingsParts.length > 0 ? findingsParts.join("\n") : "—",
            ];
        };

        // ── Generation ──────────────────────────────────────────────────────────
        sortedParentIds.forEach((parentId, groupIdx) => {
            if (groupIdx > 0) doc.addPage();
            
            const groupRecords = blGroups[parentId].sort((a, b) => {
                const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                return elB - elA;
            });

            const parentComp = idToComp[parentId];
            const rawParentQid = parentComp?.q_id || `ID: ${parentId}`;
            const displayQid = rawParentQid.replace(/[.\s,;]+$/, "").trim();
            const parentName = parentComp?.name || "Boatlanding";

            drawPageHeader(doc);
            const startY = drawContextRow(doc, margin + HEADER_H + 2, groupRecords);

            // BL Section Label (Sub-header)
            const subH = 6;
            const subY = startY;
            doc.setFillColor(...colors.navy);
            doc.rect(margin, subY, contentWidth, subH, "F");
            doc.setTextColor(255);
            doc.setFontSize(8); doc.setFont("helvetica", "bold");
            const labelText = `${parentName.toUpperCase()} (${displayQid})`;
            doc.text(labelText, margin + 4, subY + 4.2);
            
            (doc as any)._tableStartY = subY + subH + 2;

            autoTable(doc, {
                startY: (doc as any)._tableStartY,
                margin: { left: margin, right: margin, bottom: 35 },
                head: [[
                    { content: "Item No.",       styles: { halign: "center" } },
                    { content: "QID",             styles: { halign: "center" } },
                    { content: "Elevation\n(m)",  styles: { halign: "center" } },
                    { content: "Dive No.",        styles: { halign: "center" } },
                    { content: "Tape No.",        styles: { halign: "center" } },
                    { content: "CP (mV)",         styles: { halign: "center" } },
                    { content: "Findings",        styles: { halign: "center" } }
                ]],
                body: groupRecords.map(buildRow),
                theme: "grid",
                headStyles: {
                    fillColor: config.printFriendly ? [255, 255, 255] : colors.navy,
                    textColor: config.printFriendly ? colors.navy : [255, 255, 255],
                    fontSize: 8,
                    fontStyle: "bold",
                    minCellHeight: 10,
                    valign: "middle"
                },
                styles: {
                    fontSize: 7.5,
                    cellPadding: 2.5,
                    textColor: colors.text,
                    lineColor: colors.border,
                },
                columnStyles: {
                    0: { cellWidth: 12,   halign: "center" },
                    1: { cellWidth: 25 },
                    2: { cellWidth: 18,   halign: "center" },
                    3: { cellWidth: 18,   halign: "center" },
                    4: { cellWidth: 18,   halign: "center" },
                    5: { cellWidth: 18,   halign: "center" },
                    6: { cellWidth: "auto" },
                },
                didParseCell: (data) => {
                    if (data.section !== "body") return;
                    const r = groupRecords[data.row.index];
                    const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
                    const linkedAnom = r.insp_anomalies?.[0] ?? null;
                    
                    if (metaStatus === "finding") {
                        data.cell.styles.textColor = colors.finding;
                        data.cell.styles.fontStyle = "bold";
                    } else if (r.has_anomaly && metaStatus !== "finding") {
                        data.cell.styles.textColor = colors.anomaly;
                        data.cell.styles.fontStyle = "bold";
                    } else if (linkedAnom?.is_rectified || r.rectified || linkedAnom?.status === 'CLOSED') {
                        data.cell.styles.textColor = colors.rectified;
                        data.cell.styles.fontStyle = "bold";
                    }
                },
                didDrawPage: (data) => {
                    // Signatures
                    if (config.showSignatures !== false) {
                        const sigY = pageHeight - 32;
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

                    // Bottom bar
                    doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.text);
                    doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                    doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                    doc.text(
                        `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  ROV Boatlanding Survey Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
                        margin, pageHeight - 6
                    );
                    if (config.showPageNumbers !== false) {
                        doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                    }
                }
            });
        });

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Boatlanding_Survey_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ROV Boatlanding Report] Error:", err);
        throw err;
    }
};
