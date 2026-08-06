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
}

/**
 * ROV Boatlanding Inspection Report (Portrait)
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
            d.text("Boatlanding Inspection Report (ROV)",                             margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,   margin + contentWidth / 2, margin + 22, { align: "center" });
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
        const idToComp: Record<number, { q_id: string, name: string, code: string, parent_id: number | null, is_bl: boolean, is_main_parent: boolean }> = {};
        const qidToCompId: Record<string, number> = {};

        const isBoatlandingOrFenderComp = (c: any): boolean => {
            if (!c) return false;
            const qid = String(c.q_id || c.qid || "").toUpperCase();
            const typeCode = String(c.code || c.type || c.metadata?.comp_type || c.metadata?.type || "").toUpperCase();
            const compName = String(c.comp_name || c.name || "").toUpperCase();

            // 1. Explicit Exclusions for non-Boatlanding components (Conductor Shield, Riser Guard, etc.)
            const excludedPrefixes = ["CS_", "CS-", "RG_", "RG-", "CU_", "CU-", "SG_", "SG-", "CD_", "CD-", "LEG_", "LEG-", "MB_", "MB-", "R_"];
            const excludedCodes = ["CS", "RG", "CU", "SG", "CD", "CON", "LEG", "MB", "RS", "JT"];
            if (excludedCodes.includes(typeCode)) return false;
            if (excludedPrefixes.some(p => qid.startsWith(p))) return false;

            // 2. Inclusion check for Boatlanding or Boat Fender (historical data)
            const isBLCode = ["BL", "BLTG", "BOATLANDING"].includes(typeCode);
            const isBFCode = ["BF", "BOATFENDER", "FENDER"].includes(typeCode);
            if (isBLCode || isBFCode) return true;

            const isBLQid = qid.startsWith("BL") || qid.startsWith("BOATLANDING") || qid.startsWith("BOAT_LANDING");
            const isBFQid = qid.startsWith("BF") || qid.startsWith("BOATFENDER") || qid.startsWith("BOAT_FENDER") || qid.startsWith("FENDER");
            if (isBLQid || isBFQid) return true;

            if (compName.includes("BOATLANDING") || compName.includes("BOAT LANDING") || compName.includes("BOAT FENDER") || compName.includes("BOATFENDER") || compName.includes("FENDER")) {
                return true;
            }

            return false;
        };

        const isMainBoatlandingParentComp = (c: any): boolean => {
            if (!c || !isBoatlandingOrFenderComp(c)) return false;
            const qid = String(c.q_id || c.qid || "").toUpperCase().trim();
            const compName = String(c.comp_name || c.name || "").toUpperCase().trim();

            // Sub-component indicators in QID or component name (e.g. BL-supp-10, BL001_AN01)
            const subKeywords = ["SUPP", "SUPPORT", "ANODE", "BRACKET", "CLAMP", "RUBBER", "BUMPER", "MEMBER", "STRUT", "BEAM", "TUBE", "LEG"];
            if (subKeywords.some(kw => qid.includes(kw) || compName.includes(kw))) {
                return false;
            }

            // Pattern check for sub-component QID suffixes like BL-supp-10, BL_supp_5, BL-an-01
            if (/^[A-Z0-9]+[-_](SUPP|AN|BR|CL|RUBBER|MEMB|M|SUB|D|V|\d{2,})/i.test(qid) && !/^(BL|BF|BOAT)[-_]?\d{1,3}$/i.test(qid)) {
                return false;
            }

            return true;
        };
        
        const addCompToMap = (c: any) => {
            if (!c || !c.id) return;
            const compName = c.comp_name || c.name || "Boatlanding";
            const isBL = isBoatlandingOrFenderComp(c);
            const isMainParent = isMainBoatlandingParentComp(c);
            const qidStr = String(c.q_id || "").trim();
            
            idToComp[Number(c.id)] = {
                q_id: qidStr || `ID: ${c.id}`,
                name: compName,
                code: String(c.code || "").toUpperCase(),
                parent_id: c.metadata?.parent_id || c.metadata?.comp_id_parent || c.metadata?.parent_comp_id || c.metadata?.associated_comp_id || null,
                is_bl: isBL,
                is_main_parent: isMainParent
            };

            if (qidStr) {
                qidToCompId[qidStr.toUpperCase()] = Number(c.id);
            }
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
            if (aid && !isNaN(Number(aid)) && !idToComp[Number(aid)]) missingIds.add(Number(aid));
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

        // 4. Grouping Logic - Group all sub-components (like BL-supp-10) under the main parent Boatlanding (like BL001)
        const blGroups: Record<number, any[]> = {};
        records.forEach(r => {
            const comp = r.structure_components || r.component || {};
            if (!comp || !comp.id) return;
            const metadata = comp.metadata || {};
            
            // Check if record component is a main parent or a sub-component
            let parentCompId: number | null = null;

            if (isMainBoatlandingParentComp(comp)) {
                parentCompId = Number(comp.id);
            } else {
                // 1. Resolve explicit metadata parent reference
                const rawRef = metadata.associated_comp_id || metadata.associated_comp_qid || metadata.parent_id || metadata.comp_id_parent || metadata.parent_comp_id || metadata.associated_id;
                if (rawRef) {
                    if (typeof rawRef === "number" && idToComp[rawRef]) {
                        parentCompId = rawRef;
                    } else {
                        const refStr = String(rawRef).toUpperCase().trim();
                        if (qidToCompId[refStr]) {
                            parentCompId = qidToCompId[refStr];
                        } else if (!isNaN(Number(refStr)) && idToComp[Number(refStr)]) {
                            parentCompId = Number(refStr);
                        }
                    }
                }

                // 2. Fallback: QID prefix matching (e.g. BL-supp-10 -> BL001 / BL01 / BL)
                if (!parentCompId) {
                    const qidStr = String(comp.q_id || comp.qid || "").toUpperCase().trim();
                    const match = qidStr.match(/^(BL|BF|BOATLANDING|BOATFENDER|FENDER)[-_]?(\d{1,3})?/i);
                    if (match) {
                        const prefixPattern = match[0].toUpperCase();
                        for (const key of Object.keys(qidToCompId)) {
                            if (key === prefixPattern || key.startsWith(prefixPattern) || prefixPattern.startsWith(key)) {
                                const cId = qidToCompId[key];
                                if (cId && idToComp[cId] && idToComp[cId].is_main_parent) {
                                    parentCompId = cId;
                                    break;
                                }
                            }
                        }
                    }
                }

                // 3. Fallback: First main parent Boatlanding/Fender found in structure
                if (!parentCompId) {
                    const firstMainParentId = Object.keys(idToComp).map(Number).find(id => idToComp[id]?.is_main_parent);
                    if (firstMainParentId) {
                        parentCompId = firstMainParentId;
                    } else {
                        parentCompId = Number(comp.id);
                    }
                }
            }

            const parentInfo = parentCompId ? idToComp[parentCompId] : null;
            const groupId = (parentCompId && (parentInfo?.is_bl || parentInfo?.is_main_parent)) ? parentCompId : Number(comp.id);

            if (groupId) {
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
            const additionals: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : (Array.isArray(d.cp_readings) ? d.cp_readings : []);
            const additionalCPs = additionals
                .map((a: any) => a.reading ?? a.cp_rdg ?? "")
                .filter((val: any) => val !== "" && val !== null && val !== undefined);

            const cpList = [primaryCP, ...additionalCPs].filter((val: any) => val !== "" && val !== null && val !== undefined);
            const cpDisplay = cpList.length > 0
                ? cpList.map((val: any) => String(val).toLowerCase().includes("mv") ? String(val) : `${val} mV`).join("\n")
                : "—";

            const findingsParts: string[] = [];

            // 1. Findings / Description
            if (r.description && r.description.trim()) {
                findingsParts.push(r.description.trim());
            } else if (d.findings && d.findings.trim()) {
                findingsParts.push(d.findings.trim());
            }

            // 2. CP Additional
            additionals.forEach((a: any) => {
                const val = a.reading ?? a.cp_rdg ?? "";
                if ((val !== "" && val !== null && val !== undefined) || a.location) {
                    const loc = a.location ? ` @ ${a.location}` : "";
                    const unit = String(val).toLowerCase().includes("mv") || !val ? "" : " mV";
                    findingsParts.push(`Add. CP${loc}: ${val}${unit}`);
                }
            });

            // 3. Anomaly Reference
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
            const parentNameRaw = parentComp?.name || "";
            const parentCode = parentComp?.code || "";

            // Format title: "BOAT FENDER" for Fender historical types, "BOATLANDING" for Boatlanding types
            const isFender = parentCode === "BF" || parentCode === "FENDER" || parentCode === "BOATFENDER" || parentNameRaw.toUpperCase().includes("FENDER");
            const groupTypeTitle = isFender ? "BOAT FENDER" : "BOATLANDING";

            drawPageHeader(doc);
            const startY = drawContextRow(doc, margin + HEADER_H + 2, groupRecords);

            // BL Section Label (Sub-header)
            const subH = 6;
            const subY = startY;
            doc.setFillColor(...colors.navy);
            doc.rect(margin, subY, contentWidth, subH, "F");
            doc.setTextColor(255);
            doc.setFontSize(8); doc.setFont("helvetica", "bold");
            const labelText = `${groupTypeTitle} (${displayQid})`;
            doc.text(labelText, margin + 4, subY + 4.2);
            
            (doc as any)._tableStartY = subY + subH + 2;

            autoTable(doc, {
                startY: (doc as any)._tableStartY,
                margin: { left: margin, right: margin, top: margin + HEADER_H + 4, bottom: 35 },
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
                    if (data.pageNumber > 1) drawPageHeader(doc);

                    // Bottom bar
                    doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.text);
                    doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                    doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                    doc.text(
                        `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Boatlanding Inspection Report (ROV)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
                        margin, pageHeight - 6
                    );
                    if (config.showPageNumbers !== false) {
                        doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                    }
                }
            });
            
            const finalY = (doc as any).lastAutoTable?.finalY ?? (doc as any)._tableStartY;
            if (config.showSignatures !== false) {
                let sigY = pageHeight - 38;
                if (finalY > sigY - 10) {
                    doc.addPage();
                    drawPageHeader(doc);
                    sigY = pageHeight - 38;
                }
                const sigW = contentWidth / 3;
                const drawSigFooter = (label: string, lx: number, person?: { name?: string; date?: string }) => {
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
                drawSigFooter("PREPARED BY", margin, config?.preparedBy);
                drawSigFooter("REVIEWED BY", margin + sigW, config?.reviewedBy);
                drawSigFooter("APPROVED BY", margin + (sigW * 2), config?.approvedBy);
            }
        });

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`ROV_Boatlanding_Inspection_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ROV Boatlanding Report] Error:", err);
        throw err;
    }
};
