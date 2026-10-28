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
 * ROV Boatlanding Inspection Report (Portrait)
 * Columns: No. | QID | Elevation | Dive No. | Tape No. | CP | Findings
 *
 * Data is grouped by Boatlanding (BL). Each BL group starts on a new page.
 * Associated components (like anodes, clamps attached to BL) are clubbed with their parent BL QID.
 */
export const generateROVBoatlandingReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    try {
        const supabase = createClient();
        records = await enrichRecordsWithTapesAndDeployments(supabase, records);
        records = normalizeReportRecords(records);
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

        if (!config.isBlankReport && (!records || records.length === 0)) {
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

        const HEADER_H = 25;

        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `Boatlanding Survey Report (ROV) - ${extraTitleInfo}` : "Boatlanding Survey Report (ROV)",
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
        const idToComp: Record<number, { q_id: string, name: string, code: string, parent_id: number | null, is_bl: boolean, is_main_parent: boolean }> = {};
        const qidToCompId: Record<string, number> = {};

        const isBoatlandingOrFenderComp = (c: any, compMap?: Record<number, any> | Map<any, any>): boolean => {
            if (!c) return false;
            const qid = String(c.q_id || c.qid || "").toUpperCase().trim();
            const typeCode = String(c.code || c.type || c.comp_type || c.metadata?.comp_type || c.metadata?.type || "").toUpperCase().trim();
            const inspTypeCode = String(c.inspection_type?.code || c.inspection_type_code || "").toUpperCase().trim();
            const compName = String(c.comp_name || c.name || "").toUpperCase().trim();

            // 1. Direct code check for Boatlanding or Boat Fender / FD
            const isBLCode = ["BL", "BLTG", "BOATLANDING", "RBLTG", "DBLTG"].includes(typeCode) || ["BL", "BLTG", "BOATLANDING", "RBLTG", "DBLTG"].includes(inspTypeCode);
            const isBFCode = ["BF", "BOATFENDER", "FENDER", "FD", "FND", "FEND", "BB", "BOATBUMPER", "BOAT_BUMPER"].includes(typeCode) || ["FD", "BF", "FENDER"].includes(inspTypeCode);
            if (isBLCode || isBFCode) return true;

            // 2. Explicit Exclusions for non-Boatlanding components (Conductor Shield, Riser Guard, etc.)
            const excludedPrefixes = ["CS_", "CS-", "RG_", "RG-", "CU_", "CU-", "SG_", "SG-", "CD_", "CD-", "LEG_", "LEG-", "R_"];
            const excludedCodes = ["CS", "RG", "CU", "SG", "CD", "CON", "LEG", "RS", "JT"];
            if (excludedCodes.includes(typeCode)) return false;
            if (excludedPrefixes.some(p => qid.startsWith(p))) return false;

            // 3. Direct QID check
            const isBLQid = qid.startsWith("BL") || qid.startsWith("BOATLANDING") || qid.startsWith("BOAT_LANDING");
            const isBFQid = qid.startsWith("BF") || qid.startsWith("BOATFENDER") || qid.startsWith("BOAT_FENDER") || qid.startsWith("FENDER") ||
                            qid.startsWith("FD") || qid.startsWith("FND") || qid.startsWith("FEND") ||
                            qid.includes("BUMPER") || qid.includes("FENDER");
            if (isBLQid || isBFQid) return true;

            // 4. Component Name & Description check
            if (compName.includes("BOATLANDING") || compName.includes("BOAT LANDING") || 
                compName.includes("BOAT FENDER") || compName.includes("BOATFENDER") || 
                compName.includes("FENDER") || compName.includes("BUMPER") || 
                compName.startsWith("FD")) {
                return true;
            }

            const meta = c.metadata || {};
            const desc = String(c.description || meta.description || "").toUpperCase().trim();
            if (desc.includes("FENDER") || desc.includes("BOAT BUMPER") || desc.includes("BOATBUMPER") || desc.startsWith("FEND") || desc.includes("BOATLANDING") || desc.includes("BOAT LANDING")) {
                return true;
            }

            // 5. Associated / Parent Component Check (for FD and BL associated components)
            const assocId = meta.associated_comp_id || 
                            meta.parent_id || 
                            meta.comp_id_parent || 
                            meta.parent_comp_id || 
                            meta.associated_id || null;
            const assocQid = String(
                meta.associated_comp_qid || 
                meta.parent_qid || 
                meta.parent_q_id || 
                ""
            ).trim().toUpperCase();

            if (assocQid) {
                if (assocQid.startsWith("FD") || assocQid.startsWith("FEND") || assocQid.startsWith("FND") || 
                    assocQid.includes("FENDER") || assocQid.includes("BUMPER") ||
                    assocQid.startsWith("BL") || assocQid.startsWith("BF") || 
                    assocQid.startsWith("BOATLANDING") || assocQid.startsWith("BOAT_LANDING")) {
                    return true;
                }
            }

            if (assocId && compMap) {
                let currId: any = assocId;
                let depth = 0;
                while (currId && depth < 5) {
                    depth++;
                    const parentComp = (compMap instanceof Map) ? (compMap.get(currId) || compMap.get(String(currId))) : (compMap[currId] || compMap[Number(currId)]);
                    if (!parentComp) break;

                    const pCode = String(parentComp.code || parentComp.comp_type || parentComp.metadata?.comp_type || "").trim().toUpperCase();
                    if (["FD", "FND", "FEND", "BF", "BOATFENDER", "FENDER", "BB", "BOATBUMPER", "BL", "BLTG", "BOATLANDING"].includes(pCode)) {
                        return true;
                    }
                    const pQid = String(parentComp.q_id || "").trim().toUpperCase();
                    if (pQid.startsWith("FD") || pQid.startsWith("FEND") || pQid.startsWith("FND") || 
                        pQid.includes("FENDER") || pQid.includes("BUMPER") ||
                        pQid.startsWith("BL") || pQid.startsWith("BF") || pQid.startsWith("BOATLANDING")) {
                        return true;
                    }
                    const pMeta = parentComp.metadata || {};
                    currId = pMeta.associated_comp_id || pMeta.parent_id || pMeta.comp_id_parent || pMeta.parent_comp_id || pMeta.associated_id || null;
                }
            }

            return false;
        };

        const isMainBoatlandingParentComp = (c: any): boolean => {
            if (!c || !isBoatlandingOrFenderComp(c, idToComp)) return false;
            const qid = String(c.q_id || c.qid || "").toUpperCase().trim();
            const compName = String(c.comp_name || c.name || "").toUpperCase().trim();

            // If it explicitly references a parent component, it is a sub-component, not the main parent
            const meta = c.metadata || {};
            const hasParentRef = Boolean(meta.associated_comp_id || meta.parent_id || meta.comp_id_parent || meta.parent_comp_id || meta.associated_id || meta.associated_comp_qid || meta.parent_qid);
            if (hasParentRef) {
                return false;
            }

            // Sub-component indicators in QID or component name (e.g. BL-supp-10, FD01_AN01)
            const subKeywords = ["SUPP", "SUPPORT", "ANODE", "BRACKET", "CLAMP", "RUBBER PAD", "RUBBER STRIP", "MEMBER", "STRUT", "BEAM", "TUBE", "LEG"];
            if (subKeywords.some(kw => qid.includes(kw) || compName.includes(kw))) {
                return false;
            }

            // Pattern check for sub-component QID suffixes like BL-supp-10, FD_supp_5, BL-an-01
            if (/^[A-Z0-9]+[-_](SUPP|AN|BR|CL|RUBBER|MEMB|M|SUB|D|V|\d{2,})/i.test(qid) && !/^(BL|BF|FD|FND|FEND|BOAT)[-_\/\s]?\d{1,3}$/i.test(qid)) {
                return false;
            }

            return true;
        };
        
        const addCompToMap = (c: any) => {
            if (!c || !c.id) return;
            const compName = c.comp_name || c.name || "Boatlanding";
            const qidStr = String(c.q_id || "").trim();
            const compCode = String(c.code || "").toUpperCase().trim();
            const isBL = isBoatlandingOrFenderComp(c, idToComp);
            const isMainParent = isMainBoatlandingParentComp(c);
            
            idToComp[Number(c.id)] = {
                q_id: qidStr || `ID: ${c.id}`,
                name: compName,
                code: compCode,
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
            if (r.component_id && !idToComp[Number(r.component_id)]) {
                const qid = r.component_qid || "";
                idToComp[Number(r.component_id)] = {
                    q_id: qid || `ID: ${r.component_id}`,
                    name: "Boatlanding / Fender",
                    code: qid.startsWith("FD") ? "FD" : "BL",
                    parent_id: null,
                    is_bl: true,
                    is_main_parent: !qid.includes("SUPP") && !qid.includes("ANODE")
                };
                if (qid) qidToCompId[qid.toUpperCase()] = Number(r.component_id);
            }
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
            const metadata = { ...(comp.metadata || {}), ...(r.metadata || {}) };
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

        // Re-evaluate flags now that all structure components are present in idToComp
        Object.keys(idToComp).forEach(idNumStr => {
            const numId = Number(idNumStr);
            const item = idToComp[numId];
            if (item) {
                item.is_bl = isBoatlandingOrFenderComp(item, idToComp);
                item.is_main_parent = isMainBoatlandingParentComp(item);
            }
        });

        // 4. Grouping Logic - Group all sub-components (like BL-supp-10, FD-supp-01) under the main parent Boatlanding / Fender (like BL001, FD01)
        const blGroups: Record<number, any[]> = {};
        records.forEach(r => {
            const comp = r.structure_components || r.component || {};
            const compId = comp.id || r.component_id;
            if (!comp.id && compId) comp.id = compId;
            if (!comp.q_id && r.component_qid) comp.q_id = r.component_qid;
            if (!comp.q_id && compId && idToComp[Number(compId)]?.q_id) comp.q_id = idToComp[Number(compId)].q_id;

            const metadata = { ...(comp.metadata || {}), ...(r.metadata || {}) };
            
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
                        } else if (refStr.startsWith("FD") || refStr.startsWith("BL") || refStr.startsWith("BF") || refStr.startsWith("FEND") || refStr.includes("FENDER")) {
                            // Virtual parent creation for FD or BL reference
                            let virtualId = qidToCompId[refStr];
                            if (!virtualId) {
                                let hash = 0;
                                for (let i = 0; i < refStr.length; i++) {
                                    hash = ((hash << 5) - hash) + refStr.charCodeAt(i);
                                    hash |= 0;
                                }
                                virtualId = -1 * (Math.abs(hash) || 9999);
                                qidToCompId[refStr] = virtualId;
                                idToComp[virtualId] = {
                                    q_id: refStr,
                                    name: (refStr.startsWith("FD") || refStr.startsWith("BF") || refStr.includes("FEND")) ? "Boat Fender" : "Boatlanding",
                                    code: (refStr.startsWith("FD") || refStr.startsWith("BF") || refStr.includes("FEND")) ? "FD" : "BL",
                                    parent_id: null,
                                    is_bl: true,
                                    is_main_parent: true
                                };
                            }
                            parentCompId = virtualId;
                        }
                    }
                }

                // 2. Fallback: QID prefix matching (e.g. BL-supp-10 -> BL001 / BL01 / BL, FD-supp-10 -> FD01, FEND 1-SUPP -> FEND 1)
                if (!parentCompId) {
                    const qidStr = String(comp.q_id || comp.qid || "").toUpperCase().trim();
                    const match = qidStr.match(/^(BL|BF|FD|FND|FEND|BOATLANDING|BOATFENDER|FENDER)[-_\/\s]?(\d{1,3})?/i);
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
                    } else if (comp.id) {
                        parentCompId = Number(comp.id);
                    }
                }
            }

            const parentInfo = parentCompId ? idToComp[parentCompId] : null;
            const groupId = (parentCompId && (parentInfo?.is_bl || parentInfo?.is_main_parent)) ? parentCompId : Number(comp.id || r.insp_id);

            if (groupId) {
                const groupComp = idToComp[groupId];
                if (groupComp?.is_bl || groupComp?.is_main_parent || isBoatlandingOrFenderComp(comp, idToComp)) {
                    if (!blGroups[groupId]) blGroups[groupId] = [];
                    blGroups[groupId].push(r);
                }
            }
        });

        // Filter and Sort by Parent QID
        let sortedParentIds = Object.keys(blGroups).map(Number).sort((a, b) => {
            const qidA = idToComp[a]?.q_id || "";
            const qidB = idToComp[b]?.q_id || "";
            return qidA.localeCompare(qidB, undefined, { numeric: true, sensitivity: 'base' });
        });

        if (sortedParentIds.length === 0) {
            if (!config?.isBlankReport) return null;
            sortedParentIds = [0];
            blGroups[0] = [];
        }

        const buildRow = (r: any, idx: number): string[] => {
            const d   = r.inspection_data || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || r.component_qid || (r.component_id && idToComp[r.component_id]?.q_id) || "N/A";
            const elevation = r.elevation ?? d.elevation ?? d.verification_depth ?? "—";

            
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

            const findingParts: string[] = [];
            const rDesc = r.description?.trim();
            const dFindings = d.findings?.trim();
            const dDesc = d.description?.trim();
            if (rDesc) findingParts.push(rDesc);
            if (dFindings && !findingParts.includes(dFindings)) findingParts.push(dFindings);
            if (dDesc && !findingParts.includes(dDesc)) findingParts.push(dDesc);
            if (d.marine_growth || d.marine_growth_hard || d.marine_growth_soft) {
                findingParts.push(`Marine Growth: ${d.marine_growth || [d.marine_growth_hard ? 'Hard: ' + d.marine_growth_hard : '', d.marine_growth_soft ? 'Soft: ' + d.marine_growth_soft : ''].filter(Boolean).join(', ')}`);
            }
            if (d.component_condition || d.general_condition) {
                findingParts.push(`Component Condition: ${d.component_condition || d.general_condition}`);
            }
            if (d.coating_condition) {
                findingParts.push(`Coating Condition: ${d.coating_condition}`);
            }
            if (d.debris) {
                findingParts.push(`Debris: ${d.debris}${d.debris_material ? ' (' + d.debris_material + ')' : ''}`);
            }
            const baseFinding = findingParts.join('\n');
            const findings = formatReportFindingText(r, baseFinding);

            return [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                String(tapeNo),
                cpDisplay,
                findings,
            ];
        };

        // ── Generation ──────────────────────────────────────────────────────────
        sortedParentIds.forEach((parentId, groupIdx) => {
            if (groupIdx > 0) doc.addPage();
            
            const groupRecords = (blGroups[parentId] || []).sort((a, b) => {
                const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                return elB - elA;
            });

            const parentComp = idToComp[parentId];
            const rawParentQid = parentComp?.q_id || `ID: ${parentId}`;
            const displayQid = rawParentQid.replace(/[.\s,;]+$/, "").trim();
            const parentNameRaw = parentComp?.name || "";
            const parentCode = parentComp?.code || "";

            // Format title: "BOAT FENDER" for Fender historical/FD types, "BOATLANDING" for Boatlanding types
            const isFender = ["BF", "FD", "FND", "FEND", "FENDER", "BOATFENDER", "BB", "BOATBUMPER"].includes(parentCode) || 
                             parentNameRaw.toUpperCase().includes("FENDER") || 
                             parentNameRaw.toUpperCase().includes("BUMPER") || 
                             displayQid.startsWith("FD") || 
                             displayQid.startsWith("BF");
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
                    { content: "No.",       styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "QID",             styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Elevation\n(m)",  styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Dive No.",        styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Tape No.",        styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "CP (mV)",         styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} },
                    { content: "Findings",        styles: {halign: "center", lineWidth: 0.1, lineColor: colors.border} }
                ]],
                body: groupRecords.length > 0
                    ? groupRecords.map(buildRow)
                    : [["-", "-", "-", "-", "-", "-", "No observations recorded for this scope."]],
                theme: "grid",
                headStyles: {fillColor: config.printFriendly ? [255, 255, 255] : colors.navy,
                    textColor: config.printFriendly ? colors.navy : [255, 255, 255],
                    fontSize: 8,
                    fontStyle: "bold",
                    minCellHeight: 10,
                    valign: "middle", lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255]},
                styles: {fontSize: 7.5,
                    cellPadding: 2.5,
                    textColor: colors.text,
                    lineColor: colors.border, lineWidth: 0.1,},
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
                applyRecordCellStyling(data.cell, r, config.printFriendly);
            },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) drawPageHeader(doc);

                    // Bottom bar
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
