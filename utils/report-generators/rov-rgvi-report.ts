import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, getInspectionDateRange, formatReportFindingText, applyRecordCellStyling, REPORT_FOOTER_APP_TEXT, extractRecordTapeNo, enrichRecordsWithTapesAndDeployments, draw3SectionHeader, drawStandardContextRow } from "./shared-logo";

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
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
    isBlankReport?: boolean;
}

const EXCLUDED_RGVI_COMP_CODES = new Set([
    "AN", "FD", "BL", "CS", "SG", "CD", "CG", "CU", "RS", "RG", "BB",
    "ANODE", "ANOD", "RISG", "RGRD", "RISER GUARD", "SEAG", "SEA GUARD",
    "CAIS", "CAISSON GUARD", "COND", "CONDUCTOR GUARD", "BOATLANDING", "BOAT LANDING",
    "FEND", "FND", "FENDER", "BOAT BUMPER", "BOATBUMPER", "BOAT BUMBER", "BOATBUMBER"
]);

export const isExcludedFromRGVI = (r: any, compMap?: Map<string | number, any>): boolean => {
    if (!r) return false;

    // 1. Check explicit component code / type fields
    const candidates = [
        r.structure_components?.code,
        r.structure_components?.comp_type,
        r.structure_components?.component_type_code,
        r.structure_components?.component_type,
        r.component?.code,
        r.component?.comp_type,
        r.component?.component_type_code,
        r.component?.component_type,
        r.component_code,
        r.component_type_code,
        r.component_type,
        r.comp_code,
        r.comp_type,
        r.inspection_data?.component_code,
        r.inspection_data?.comp_type,
        r.inspection_data?.component_type,
        r.inspection_data?.comp_code,
        r.inspection_data?.component_type_code,
        r.inspection_data?.type,
    ];

    for (const c of candidates) {
        if (c && typeof c === "string") {
            const clean = c.trim().toUpperCase();
            if (EXCLUDED_RGVI_COMP_CODES.has(clean)) return true;
        }
    }

    // 2. Check component QID prefix and description
    const comp = r.structure_components || r.component || {};
    const qid = (
        comp.q_id ||
        comp.name ||
        r.component_qid ||
        r.component_name ||
        r.inspection_data?.component_qid ||
        r.inspection_data?.component ||
        r.inspection_data?.q_id ||
        ""
    ).toString().trim().toUpperCase();

    if (qid) {
        // Match 2-letter codes: RG, CU, SG, AN, FD, BL, CS, CD, CG, RS, BB
        const prefixMatch2 = qid.match(/^([A-Z]{2})([-_/\s\d]|$)/);
        if (prefixMatch2 && EXCLUDED_RGVI_COMP_CODES.has(prefixMatch2[1])) {
            return true;
        }
        // Match 3-6 letter codes or longer prefixes: RISG, RGRD, SEAG, CAIS, COND, ANOD, FEND, FND
        const prefixMatch3 = qid.match(/^([A-Z]{3,6})([-_/\s\d]|$)/);
        if (prefixMatch3 && EXCLUDED_RGVI_COMP_CODES.has(prefixMatch3[1])) {
            return true;
        }
        if (qid.startsWith("RG-") || qid.startsWith("RG_") || qid.startsWith("RG/") || qid.startsWith("RG ") || qid.startsWith("RISG") || qid.startsWith("RGRD")) return true;
        if (qid.startsWith("CU-") || qid.startsWith("CU_") || qid.startsWith("CU/") || qid.startsWith("CU ") || qid.startsWith("CG-") || qid.startsWith("CG_") || qid.startsWith("CG/") || qid.startsWith("CG ")) return true;
        if (qid.startsWith("SG-") || qid.startsWith("SG_") || qid.startsWith("SG/") || qid.startsWith("SG ") || qid.startsWith("SEAG")) return true;
        if (qid.startsWith("FD-") || qid.startsWith("FD_") || qid.startsWith("FD/") || qid.startsWith("FD ") || qid.startsWith("FEND") || qid.startsWith("FND") || qid.includes("BUMPER") || qid.includes("FENDER")) return true;
    }

    const metadata = comp.metadata || r.metadata || {};
    const desc = String(comp.description || metadata.description || "").trim().toUpperCase();
    if (desc.includes("FENDER") || desc.includes("BOAT BUMPER") || desc.includes("BOATBUMPER") || desc.startsWith("FEND")) {
        return true;
    }

    // 3. Resolve associations in structure components
    let currId = comp.associated_comp_id || comp.parent_id || comp.comp_id_parent || comp.parent_comp_id || comp.associated_id ||
        metadata.associated_comp_id || metadata.parent_id || metadata.comp_id_parent || metadata.parent_comp_id || metadata.associated_id || null;

    if (compMap && currId) {
        let depth = 0;
        while (currId && depth < 5) {
            depth++;
            const parentComp = compMap.get(currId) || compMap.get(String(currId)) || compMap.get(Number(currId));
            if (!parentComp) break;

            const pCode = String(parentComp.code || "").trim().toUpperCase();
            if (EXCLUDED_RGVI_COMP_CODES.has(pCode) || pCode === "FD") {
                return true;
            }

            const pQid = String(parentComp.q_id || "").trim().toUpperCase();
            if (pQid.startsWith("FD") || pQid.startsWith("FEND") || pQid.startsWith("FND") || pQid.includes("FENDER") || pQid.includes("BUMPER")) {
                return true;
            }

            const pMatch2 = pQid.match(/^([A-Z]{2})([-_/\s\d]|$)/);
            if (pMatch2 && EXCLUDED_RGVI_COMP_CODES.has(pMatch2[1])) {
                return true;
            }

            const pDesc = String(parentComp.metadata?.description || "").trim().toUpperCase();
            if (pDesc.includes("FENDER") || pDesc.includes("BOAT BUMPER") || pDesc.includes("BOATBUMPER") || pDesc.startsWith("FEND")) {
                return true;
            }

            const pMeta = parentComp.metadata || {};
            currId = pMeta.associated_comp_id || pMeta.parent_id || pMeta.comp_id_parent || pMeta.parent_comp_id || pMeta.associated_id || null;
        }
    }

    // Check if this record's component itself in compMap is associated with an FD component
    const directCompId = r.component_id || comp.id;
    if (directCompId && compMap) {
        const fullComp = compMap.get(directCompId) || compMap.get(String(directCompId)) || compMap.get(Number(directCompId));
        if (fullComp) {
            const fCode = String(fullComp.code || "").trim().toUpperCase();
            if (EXCLUDED_RGVI_COMP_CODES.has(fCode) || fCode === "FD") {
                return true;
            }
            const fMeta = fullComp.metadata || {};
            const fAssocId = fMeta.associated_comp_id || fMeta.parent_id || fMeta.comp_id_parent || fMeta.parent_comp_id || fMeta.associated_id;
            const fAssocQid = String(fMeta.associated_comp_qid || fMeta.parent_qid || "").trim().toUpperCase();
            if (fAssocQid && (fAssocQid.startsWith("FD") || fAssocQid.startsWith("FEND") || fAssocQid.startsWith("FND") || fAssocQid.includes("FENDER") || fAssocQid.includes("BUMPER"))) {
                return true;
            }
            if (fAssocId) {
                const parentOfFull = compMap.get(fAssocId) || compMap.get(String(fAssocId)) || compMap.get(Number(fAssocId));
                if (parentOfFull) {
                    const pfCode = String(parentOfFull.code || "").trim().toUpperCase();
                    if (EXCLUDED_RGVI_COMP_CODES.has(pfCode) || pfCode === "FD") {
                        return true;
                    }
                    const pfQid = String(parentOfFull.q_id || "").trim().toUpperCase();
                    if (pfQid.startsWith("FD") || pfQid.startsWith("FEND") || pfQid.startsWith("FND") || pfQid.includes("FENDER") || pfQid.includes("BUMPER")) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
};

export const formatCoverage = (val: any): string => {
    if (val === null || val === undefined || val === '' || val === '-' || val === '—') return '—';
    const str = String(val).trim();
    if (str === '0' || str === '0%') return '0%';
    if (/^[0-9]+(?:\.[0-9]+)?$/.test(str)) return `${str}%`;
    if (str.endsWith('%')) return str;
    return str;
};

export const formatDash = (val: any): string => {
    if (val === null || val === undefined) return "—";
    const str = String(val).trim();
    if (
        str === "" ||
        str === "-" ||
        str === "—" ||
        str === "--" ||
        str.toLowerCase() === "null" ||
        str.toLowerCase() === "undefined" ||
        str.toLowerCase() === "none" ||
        str.toLowerCase() === "n/a"
    ) {
        return "—";
    }
    return str;
};

export const formatCondition = (val: any): string => {
    if (val === null || val === undefined) return "N/A";
    const str = String(val).trim();
    if (
        str === "" ||
        str === "-" ||
        str === "—" ||
        str === "--" ||
        str.toLowerCase() === "null" ||
        str.toLowerCase() === "undefined" ||
        str.toLowerCase() === "none" ||
        str.toUpperCase() === "N/A"
    ) {
        return "N/A";
    }
    return str;
};

export const extractComponentCondition = (d: any, r?: any): string => {
    const raw = d?.component_condition ?? d?.general_condition ?? d?.condition ?? d?.comp_condition ?? r?.component_condition ?? r?.general_condition ?? r?.condition;
    return formatCondition(raw);
};

export const extractCoatingCondition = (d: any, r?: any): string => {
    const raw = d?.coating_condition ?? d?.coating ?? d?.coat_condition ?? r?.coating_condition ?? r?.coating;
    return formatCondition(raw);
};

export const extractHardSoftGrowth = (d: any, r?: any): { hard: string; soft: string } => {
    let rawH = d.marine_growth_hard ?? d.mgi_hard_growth ?? d.mgi_hard_coverage ?? d.hard_coverage ?? d.hard_growth ?? r?.marine_growth_hard;
    let rawS = d.marine_growth_soft ?? d.mgi_soft_growth ?? d.mgi_soft_coverage ?? d.soft_coverage ?? d.soft_growth ?? r?.marine_growth_soft;

    if ((rawH === undefined || rawH === null || rawS === undefined || rawS === null) && (d.marine_growth || r?.marine_growth)) {
        const mg = String(d.marine_growth || r?.marine_growth).trim();
        const hardMatch = mg.match(/(?:hard|h)\s*[:=]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
        const softMatch = mg.match(/(?:soft|s)\s*[:=]?\s*([0-9]+(?:\s*-\s*[0-9]+)?%?)/i);
        if (hardMatch && (rawH === undefined || rawH === null)) rawH = hardMatch[1];
        if (softMatch && (rawS === undefined || rawS === null)) rawS = softMatch[1];
    }

    return {
        hard: formatCoverage(rawH),
        soft: formatCoverage(rawS),
    };
};

/**
 * Builds the 2-row representation for an ROV RGVI record:
 * Row 1: No. (rowSpan: 2) | Component QID (rowSpan: 2) | Elevation (m) | Dive No. | Tape No. | CP (mV) | Component Condition | Coating Condition | Hard Growth (%) | Soft Growth (%)
 * Row 2: Finding: <text> (merged across 3rd through 10th col, colSpan: 8)
 */
export const buildROVRGVIRows = (r: any, idx: number, isPrintFriendly?: boolean): any[][] => {
    const d = r.inspection_data || {};
    const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
    const elevation = formatDash(r.elevation ?? d.elevation);

    const rawDiveNo =
        r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.deployment_no || r.insp_rov_jobs?.name ||
        r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.name ||
        r.dive_no || d.dive_no || d.deployment_no ||
        r.rov_job_id || r.dive_job_id;
    const diveNo = formatDash(rawDiveNo);

    const tapeNo = formatDash(extractRecordTapeNo(r));

    const cleanCPValue = (val: any): string => {
        if (val === null || val === undefined) return "";
        const s = String(val).trim();
        if (
            s === "" ||
            s === "-" ||
            s === "—" ||
            s === "--" ||
            s.toLowerCase() === "null" ||
            s.toLowerCase() === "undefined" ||
            s.toLowerCase() === "none" ||
            s.toLowerCase() === "n/a"
        ) return "";
        return s;
    };

    const primaryCP = cleanCPValue(d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? r?.cp_rdg ?? r?.cp);
    const addCPs: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : (Array.isArray(d.cp_readings) ? d.cp_readings : []);
    const additionalCPs = addCPs
        .map((a: any) => cleanCPValue(a.reading ?? a.cp_rdg ?? ""))
        .filter((val: string) => val !== "");

    const cpList = [primaryCP, ...additionalCPs].filter((val: string) => val !== "");
    const cpDisplay = cpList.length > 0
        ? cpList.map((val: string) => val.toLowerCase().includes("mv") ? val : `${val} mV`).join("\n")
        : "—";

    const compCond = extractComponentCondition(d, r);
    const coatCond = extractCoatingCondition(d, r);
    const { hard, soft } = extractHardSoftGrowth(d, r);

    // Finding text excludes marine growth and condition values (now in dedicated columns)
    const parts: string[] = [];
    const mainDesc = r.description?.trim() || d.description?.trim() || r.findings?.trim() || d.findings?.trim() || r.remarks?.trim() || d.remarks?.trim();
    if (mainDesc) parts.push(mainDesc);
    const debris = d.debris ?? "";
    if (debris) {
        const mat = d.debris_material ? ` (${d.debris_material})` : "";
        parts.push(`Debris: ${debris}${mat}`);
    }

    const baseFinding = parts.join("\n");
    const findingDisplay = formatReportFindingText(r, baseFinding || undefined);
    const rawFinding = (findingDisplay || "").trim();
    const finalFinding = rawFinding && rawFinding !== "—"
        ? (/^finding\s*:/i.test(rawFinding) ? rawFinding : `Finding: ${rawFinding}`)
        : "Finding: —";

    const row1 = [
        { content: String(idx + 1), rowSpan: 2, styles: { halign: "center", valign: "top" } },
        { content: String(qid), rowSpan: 2, styles: { halign: "left", valign: "top" } },
        String(elevation),
        String(diveNo),
        String(tapeNo),
        cpDisplay,
        String(compCond),
        String(coatCond),
        hard,
        soft
    ];

    const row2 = [
        {
            content: finalFinding,
            colSpan: 8,
            styles: {
                halign: "left",
                valign: "middle"
            }
        }
    ];

    return [row1, row2];
};

/**
 * ROV General Visual Inspection (RGVI) Report (Portrait)
 * Row 1: No. (rowSpan: 2) | Component QID (rowSpan: 2) | Elevation (m) | Dive No. | Tape No. | CP (mV) | Component Condition | Coating Condition | Hard Growth (%) | Soft Growth (%)
 * Row 2: Finding: <text> (merged across 3rd through 10th col, colSpan: 8)
 */
export const generateROVRGVIReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    try {
        records = await enrichRecordsWithTapesAndDeployments(null, records);
        records = normalizeReportRecords(records);

        // Preload structure components to resolve parent-child hierarchy for 'FD' and other components
        const effectiveStructureId = config.structureId || headerData?.structureId || records.find(r => r.structure_id)?.structure_id;
        const compMap = new Map<string | number, any>();
        if (effectiveStructureId) {
            try {
                const { createClient } = await import("@/utils/supabase/client");
                const supabase = createClient();
                const { data: allComps } = await supabase
                    .from('structure_components')
                    .select('id, q_id, code, metadata')
                    .eq('structure_id', effectiveStructureId);
                if (allComps) {
                    allComps.forEach(c => {
                        compMap.set(c.id, c);
                        compMap.set(String(c.id), c);
                        if (c.q_id) {
                            compMap.set(c.q_id.toUpperCase(), c);
                            compMap.set(String(c.q_id), c);
                        }
                    });
                }
            } catch (e) {
                console.warn("[ROV RGVI Report] Error loading structure components for FD association check:", e);
            }
        }

        // Exclude components that have dedicated report templates or are FD and its associated components
        const validRecords = (records || []).filter((r: any) => !isExcludedFromRGVI(r, compMap));

        if (!config.isBlankReport && validRecords.length === 0) {
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
            finding: [124, 58, 237] as [number, number, number],
        };

        const dateRangeStr = getInspectionDateRange(records, headerData, config);

        const HEADER_H = 25;

        // ── Pre-load logos ──────────────────────────────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) { }
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) { }
        }

        // ── Synchronous page header ─────────────────────────────────────────────
        const drawPageHeader = (d: jsPDF, extraTitleInfo?: string) => {
            draw3SectionHeader(d, {
                reportTitle: extraTitleInfo ? `General Visual Inspection Report (ROV) - ${extraTitleInfo}` : "General Visual Inspection Report (ROV)",
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

        const drawContextRow = (d: jsPDF, y: number) => {
            return drawStandardContextRow(d, y, {
                structure: headerData.platformName,
                vessel: headerData.vessel,
                jobpack: headerData.jobpackName,
                dateRange: dateRangeStr,
            }, config.printFriendly, margin);
        };

        // ── Sort by elevation (top → bottom), then inspection date, then ID ───
        const sorted = [...validRecords].sort((a, b) => {
            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            if (elB !== elA) return elB - elA;

            const dateA = a.inspection_date ? new Date(a.inspection_date).getTime() : 0;
            const dateB = b.inspection_date ? new Date(b.inspection_date).getTime() : 0;
            if (dateB !== dateA) return dateB - dateA;

            const idA = Number(a.insp_id || a.id || 0);
            const idB = Number(b.insp_id || b.id || 0);
            return idA - idB;
        });

        const isPF = config.printFriendly;

        // ── Draw first page ─────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        const bodyRows = sorted.length > 0
            ? sorted.flatMap((r, idx) => buildROVRGVIRows(r, idx, isPF))
            : [
                [
                    { content: "—", rowSpan: 2, styles: { halign: "center", valign: "top" } },
                    { content: "—", rowSpan: 2, styles: { halign: "left", valign: "top" } },
                    "—", "—", "—", "—", "N/A", "N/A", "—", "—"
                ],
                [
                    { content: "Finding: No inspection observations recorded for this scope.", colSpan: 8, styles: { halign: "left", valign: "middle" } }
                ]
            ];

        // ── Main table ──────────────────────────────────────────────────────────
        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 4 },
            head: [[
                { content: "No.", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                { content: "Component\nQID", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                { content: "Elevation\n(m)", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                { content: "Dive No.", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                { content: "Tape No.", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                { content: "CP\n(mV)", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                { content: "Component\nCondition", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                { content: "Coating\nCondition", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                { content: "Hard Growth\n(%)", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                { content: "Soft Growth\n(%)", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
            ]],
            body: bodyRows,
            theme: "grid",
            headStyles: {
                fillColor: config?.printFriendly ? [255, 255, 255] : colors.navy,
                textColor: config?.printFriendly ? colors.navy : [255, 255, 255],
                fontSize: 6.8,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                cellPadding: { top: 1.5, bottom: 1.5, left: 0.8, right: 0.8 },
                minCellHeight: 8,
                lineWidth: 0.1,
                lineColor: config?.printFriendly ? colors.border : [255, 255, 255],
            },
            styles: {
                fontSize: 6.5,
                cellPadding: { top: 1.5, bottom: 1.5, left: 0.8, right: 0.8 },
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak",
                lineWidth: 0.1,
            },
            columnStyles: {
                0: { cellWidth: 8, halign: "center", valign: "top" },
                1: { cellWidth: 23, halign: "left", valign: "top" },
                2: { cellWidth: 17, halign: "center" },
                3: { cellWidth: 14, halign: "center" },
                4: { cellWidth: 36, halign: "center" },
                5: { cellWidth: 14, halign: "center" },
                6: { cellWidth: 21, halign: "center" },
                7: { cellWidth: 21, halign: "center" },
                8: { cellWidth: 18, halign: "center" },
                9: { cellWidth: 18, halign: "center" },
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const recordIdx = Math.floor(data.row.index / 2);
                const r = sorted[recordIdx];
                if (r) {
                    applyRecordCellStyling(data.cell, r, isPF);
                }
                if (data.column.index === 0) {
                    data.cell.styles.halign = "center";
                    data.cell.styles.valign = "top";
                }
                if (data.column.index === 1) {
                    data.cell.styles.halign = "left";
                    data.cell.styles.valign = "top";
                }
                // Auto-fit font size and padding for Tape No. (col 4, top row of each record) so it stays on one line
                if (data.column.index === 4 && data.row.index % 2 === 0) {
                    const rawVal = String(data.cell.raw ?? (Array.isArray(data.cell.text) ? data.cell.text.join("") : data.cell.text) ?? "");
                    if (rawVal.length > 26) {
                        data.cell.styles.fontSize = 5.2;
                        data.cell.styles.cellPadding = 0.8;
                    } else if (rawVal.length > 20) {
                        data.cell.styles.fontSize = 5.8;
                        data.cell.styles.cellPadding = 1.0;
                    }
                }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) {
                    drawPageHeader(doc);
                }
                // Footer
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

        const finalY = (doc as any).lastAutoTable.finalY || startY;
        if (config.showSignatures !== false) {
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

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`ROV_RGVI_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[ROV RGVI Report] Error:", err);
        throw err;
    }
};
