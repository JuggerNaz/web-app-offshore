import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, getInspectionDateRange, formatReportFindingText, applyRecordCellStyling, REPORT_FOOTER_APP_TEXT, extractRecordTapeNo, enrichRecordsWithTapesAndDeployments, draw3SectionHeader, drawStandardContextRow } from "./shared-logo";
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
 * ROV Caisson Survey Report (Portrait)
 * Columns: No. | QID | Elevation | Dive No. | CP | Component Condition | Coating Condition | Findings
 *
 * Data is grouped by Caisson (CS). Each CS group starts on a new page.
 * Associated components are clubbed with their parent CS QID.
 */
export const generateROVCasnReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    const supabase = createClient();
    records = await enrichRecordsWithTapesAndDeployments(supabase, records);
    records = normalizeReportRecords(records);
    console.log("[ROV Caisson Report] Starting generation", { recordsCount: records?.length, hasHeader: !!headerData, config });
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;

        const colors = {
            navy: [7, 78, 136]  as [number, number, number],
            teal:      [20,  184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border:    [203, 213, 225] as [number, number, number],
            text:      [30,  41,  59]  as [number, number, number],
            anomaly:   [220, 38,  38]  as [number, number, number],
            rectified: [22,  163, 74]  as [number, number, number],
            finding:   [217, 119, 6] as [number, number, number],
        };

        // ── Filter Records ──────────────────────────────────────────────────────
        const filteredRecords = records.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase();
            const compCode = (r.structure_components?.code || '').toUpperCase();
            return typeCode === 'RCASN' || compCode === 'CS';
        });

        if (!config.isBlankReport && filteredRecords.length === 0) {
            return null;
        }

        // ── Pre-load logos ──────────────────────────────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        // Fetch all components to build a complete QID map for grouping
        const effectiveStructureId = config.structureId || records.find(r => r.structure_id)?.structure_id;
        const { data: allComps } = effectiveStructureId 
            ? await supabase.from('structure_components').select('id, q_id, code, metadata').eq('structure_id', effectiveStructureId)
            : { data: null };
        
        const HEADER_H = 25;

        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `Caisson Survey Report (ROV) - ${extraTitleInfo}` : "Caisson Survey Report (ROV)",
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


        // ── Grouping Logic ──────────────────────────────────────────────────────
        const compRegistry = new Map<number, any>();
        const qidRegistry  = new Map<string, any>();
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

        const getGroupKey = (r: any): string => {
            const comp = r.structure_components || r.component || {};
            const metadata = comp.metadata || {};
            const qid = (comp.q_id || r.qid || r.q_id || "Unknown").toUpperCase().trim();
            
            // 1. Check explicit association in record or component metadata
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

            // 2. Look for registered root caisson components in allComps
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

            // 3. Regex extraction for base caisson pattern: CS-S1, CS-01, CS-1, CAS-1, etc.
            const match = qid.match(/^((?:CS|CASN?)[-_]?[A-Z0-9]+)/i);
            if (match) {
                const extractedBase = match[1].toUpperCase();
                if (qidRegistry.has(extractedBase)) {
                    return qidRegistry.get(extractedBase).q_id.toUpperCase().trim();
                }
                return extractedBase;
            }

            return (comp.code || "").toUpperCase() === "CS" ? qid : "General";
        };

        const caissonGroups: Record<string, any[]> = {};
        filteredRecords.forEach(r => {
            const key = getGroupKey(r).toUpperCase();
            if (!caissonGroups[key]) caissonGroups[key] = [];
            caissonGroups[key].push(r);
        });
        
        const sortedCaissonQids = Object.keys(caissonGroups).sort((a, b) => {
            if (a === "General") return 1;
            if (b === "General") return -1;
            return a.localeCompare(b);
        });
        
        if (sortedCaissonQids.length === 0) {
            if (!config?.isBlankReport) return null;
            caissonGroups["General"] = [];
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
            const tapeNo = extractRecordTapeNo(r);

            const primaryCP = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? "";
            const additionals: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : (Array.isArray(d.cp_readings) ? d.cp_readings : []);
            const additionalCPs = additionals
                .map((a: any) => a.reading ?? a.cp_rdg ?? "")
                .filter((val: any) => val !== "" && val !== null && val !== undefined);

            const cpList = [primaryCP, ...additionalCPs].filter((val: any) => val !== "" && val !== null && val !== undefined);
            const cpDisplay = cpList.length > 0
                ? cpList.map((val: any) => String(val).toLowerCase().includes("mv") ? String(val) : `${val} mV`).join("\n")
                : "—";

            const compCond = d.component_condition || d.comp_cond || d.general_condition || r.component_condition || "—";
            const coatCond = d.coating_condition || d.coat_cond || r.coating_condition || "—";

            const baseFinding = [
                r.description?.trim(),
                (d.marine_growth || d.marine_growth_hard || d.marine_growth_soft) ? `Marine Growth: ${d.marine_growth || [d.marine_growth_hard ? 'Hard: ' + d.marine_growth_hard : '', d.marine_growth_soft ? 'Soft: ' + d.marine_growth_soft : ''].filter(Boolean).join(', ')}` : '',
                d.debris ? `Debris: ${d.debris}${d.debris_material ? ' (' + d.debris_material + ')' : ''}` : ''
            ].filter(Boolean).join('\n');
            const findings = formatReportFindingText(r, baseFinding);

            return [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                cpDisplay,
                String(compCond),
                String(coatCond),
                findings,
            ];
        };

        // ── Generation ──────────────────────────────────────────────────────────
        sortedCaissonQids.forEach((caissonQid, groupIdx) => {
            if (groupIdx > 0) doc.addPage();
            
            const groupRecords = (caissonGroups[caissonQid] || []).sort((a, b) => {
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
                margin: { left: margin, right: margin, top: margin + HEADER_H + 4, bottom: config.showSignatures !== false ? 35 : 15 },
                head: [[
                    { content: "No.",       styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "QID",             styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Elevation\n(m)",  styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Dive No.",        styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "CP\n(mV)",        styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Component\nCondition", styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Coating\nCondition",   styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Findings",        styles: {halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border} }
                ]],
                body: groupRecords.length > 0
                    ? groupRecords.map(buildRow)
                    : [["-", "-", "-", "-", "-", "-", "-", "No observations recorded for this scope."]],
                theme: "grid",
                headStyles: {fillColor: config.printFriendly ? [255, 255, 255] : colors.navy,
                    textColor: config.printFriendly ? colors.navy : [255, 255, 255],
                    fontSize: 8,
                    fontStyle: "bold",
                    halign: "center",
                    valign: "middle",
                    minCellHeight: 10, lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255],},
                styles: {fontSize: 7,
                    cellPadding: 2,
                    textColor: colors.text,
                    lineColor: colors.border,
                    overflow: "linebreak", lineWidth: 0.1,},
                columnStyles: {
                    0: { cellWidth: 8,   halign: "center" },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 14,   halign: "center" },
                    3: { cellWidth: 14,   halign: "center" },
                    4: { cellWidth: 14,   halign: "center" },
                    5: { cellWidth: 18,   halign: "center" },
                    6: { cellWidth: 18,   halign: "center" },
                    7: { cellWidth: "auto" },
                },
                didParseCell: (data) => {
                    if (data.section !== "body") return;
                    const r = groupRecords[data.row.index];
                    applyRecordCellStyling(data.cell, r, config.printFriendly);
                },
                didDrawCell: (data) => {
                },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) drawPageHeader(doc);

                    // Footer Bottom Text
                    doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.text);
                    doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                    doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                    doc.text(
                        REPORT_FOOTER_APP_TEXT,
                        margin, pageHeight - 6
                    );
                    if (config.showPageNumbers !== false) {
                        doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                    }
                },
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

        // --- 8. Output ---
        console.log("[ROV Caisson Report] Generation complete, returnBlob:", config?.returnBlob);
        if (config?.returnBlob !== false) {
            console.log("[ROV Caisson Report] Returning Blob");
            applyWatermarkAndSignaturesGlobal(doc, config);
            return doc.output("blob");
        }
        
        console.log("[ROV Caisson Report] Saving PDF to file");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`ROV_Caisson_Survey_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ROV Caisson Report] Error:", err);
        throw err;
    }
};
