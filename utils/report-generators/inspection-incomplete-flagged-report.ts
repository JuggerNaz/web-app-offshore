import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { 
    loadLogoWithTransparency, 
    applyWatermarkAndSignaturesGlobal, 
    formatPdfDate, 
    normalizeReportRecords, 
    getInspectionDateRange, 
    REPORT_FOOTER_APP_TEXT, 
    draw3SectionHeader, 
    drawStandardContextRow 
} from "./shared-logo";
import { formatInspectionTypeName, INSPECTION_TYPE_NAMES } from "@/utils/inspection-utils";

export interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

export interface ReportConfig {
    reportNoPrefix?: string;
    printFriendly?: boolean;
    jobPackId?: number;
    structureId?: number;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    returnBlob?: boolean;
    showSignatures?: boolean;
    showPageNumbers?: boolean;
    isBlankReport?: boolean;
    watermark?: {
        enabled?: boolean;
        text?: string;
        transparency?: number;
        color?: string;
    };
}

/**
 * Checks whether an inspection record is flagged as Incomplete.
 */
export const isStatusIncomplete = (r: any): boolean => {
    if (!r) return false;
    const d = r.inspection_data || r.inspection_dat || {};
    const status = String(r.status || "").trim().toUpperCase();
    const dataStatus = String(d.status || "").trim().toUpperCase();
    const metaStatus = String(d._meta_status || d.meta_status || "").trim().toUpperCase();
    const findingType = String(r.finding_type || r.findingType || d.finding_type || d.findingType || "").trim().toUpperCase();

    // 1. Explicit COMPLETED/CLOSED/APPROVED check:
    if (status === "COMPLETED" || dataStatus === "COMPLETED" || status === "CLOSED" || dataStatus === "CLOSED" || status === "APPROVED" || dataStatus === "APPROVED") {
        if (status !== "INCOMPLETE" && dataStatus !== "INCOMPLETE" && metaStatus !== "INCOMPLETE" && findingType !== "INCOMPLETE") {
            return false;
        }
    }

    // 2. Explicit INCOMPLETE status / finding type
    if (status === "INCOMPLETE" || dataStatus === "INCOMPLETE" || metaStatus === "INCOMPLETE" || findingType === "INCOMPLETE") {
        return true;
    }

    // 3. Boolean flag
    if (r.is_incomplete === true || r.is_incomplete === 1 || r.incomplete === true || r.incomplete === 1 || d.is_incomplete === true || d.is_incomplete === 1) {
        return true;
    }

    // 4. Incomplete reason provided
    const incompleteReason = String(
        r.incomplete_reason || 
        r.incompleteReason || 
        d.incomplete_reason || 
        d.incompleteReason || 
        ""
    ).trim();
    if (incompleteReason && incompleteReason.length > 0 && incompleteReason !== "-" && incompleteReason !== "—") {
        return true;
    }

    // 5. Explicit prefix in description
    const desc = String(r.description || "").trim().toUpperCase();
    if (desc.startsWith("INCOMPLETE:") || desc.startsWith("STATUS: INCOMPLETE")) {
        return true;
    }

    return false;
};

/**
 * Resolves the effective comments / reason for an incomplete inspection record.
 */
export const getIncompleteReasonOrComments = (r: any): string => {
    if (!r) return "Incomplete";
    const d = r.inspection_data || r.inspection_dat || {};
    const reason = (
        r.incomplete_reason || 
        r.incompleteReason || 
        d.incomplete_reason || 
        d.incompleteReason || 
        ""
    ).toString().trim();

    if (reason && reason !== "-" && reason !== "—") {
        return reason;
    }

    const desc = (r.description ?? d.description ?? r.findings ?? d.findings ?? d.remarks ?? "").toString().trim();
    if (desc && desc !== "-" && desc !== "—" && desc !== "No significant findings" && desc !== "N/A") {
        return desc;
    }

    return "Incomplete — Task could not be fully executed";
};

/**
 * Resolves the inspection mode ("ROV" | "DIVING") for an inspection record.
 */
export const getRecordInspectionMode = (r: any): "ROV" | "DIVING" => {
    if (!r) return "ROV";

    // 1. Explicit mode or insp_method on record or inspection_type
    const explicitMethod = String(
        r.insp_method || 
        r.inspection_method || 
        r.method || 
        r.mode || 
        r.inspection_type?.mode ||
        r.inspection_type?.method ||
        ""
    ).trim().toUpperCase();

    if (explicitMethod === "DIVING" || explicitMethod === "DIVE") return "DIVING";
    if (explicitMethod === "ROV") return "ROV";

    // 2. Foreign keys to dive jobs vs rov jobs
    if (r.dive_job_id && !r.rov_job_id) return "DIVING";
    if (r.rov_job_id && !r.dive_job_id) return "ROV";
    if (r.insp_dive_jobs && !r.insp_rov_jobs && !r.rov_job_id) return "DIVING";
    if (r.insp_rov_jobs && !r.insp_dive_jobs) return "ROV";

    // 3. Inspection Type code check
    const code = String(
        r.inspection_type?.code || 
        r.inspection_type_code || 
        r.inspection_data?.insp_type || 
        r.inspection_data?.INSP_TYPE || 
        ""
    ).trim().toUpperCase();

    // Known diving codes
    const divingCodes = [
        "GVINS", "DGVI", "BSINS", "CVINS", "CLEAN", "MPINS", "UTWTK", "DUTWT", 
        "SZONE", "DSZCI", "DIVLOG", "DIVER_LOG", "DIVE_LOG", "ACFMC", "PLCO", 
        "PL_CO", "DCASN", "DCOND", "DFMD", "DMGI", "DRISI", "DJTISI", "DITISI", 
        "DSCOR", "DSWNI", "ANMAIN", "DANODE", "DCPSURV", "CPSURV_DIVE", "DMEAS", "DMSR"
    ];
    if (divingCodes.includes(code)) return "DIVING";

    // Known ROV codes
    const rovCodes = [
        "RGVI", "RCOND", "RCASN", "RRISI", "RSCOR", "RSZCI", "RMGI", "RFMD", 
        "RSWNI", "RSANI", "RWDI", "RICMI", "RBLTG", "RNAVIG", "NAVIG", "RUTWT",
        "JTISI", "ITISI", "ROVCLB", "CP", "RCP", "CPSURV_ROV"
    ];
    if (rovCodes.includes(code)) return "ROV";

    if (code.startsWith("D") && !code.startsWith("DEF")) return "DIVING";
    if (code.startsWith("R")) return "ROV";

    // 4. Inspection Type name check
    const name = String(r.inspection_type?.name || r.inspection_type_name || "").toUpperCase();
    if (name.includes("DIVING") || name.includes("DIVER")) return "DIVING";
    if (name.includes("ROV")) return "ROV";

    return "ROV";
};

/**
 * Inspection Incomplete Flagged Detail List Report (Portrait)
 * Grouped by inspection type with subheader banners, total QID counts, ordered by Elevation descending.
 * Includes Header, Footer, Logos, Page Numbers (Page X of Y), Signatures, Watermark, and Ink-Save (Print-Friendly) Mode.
 */
export const generateInspectionIncompleteFlaggedReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    try {
        records = normalizeReportRecords(records || []);
        
        // Filter strictly to incomplete records unless blank report is requested
        let incompleteRecords = config.isBlankReport ? [] : records.filter(isStatusIncomplete);

        if (!config.isBlankReport && incompleteRecords.length === 0) {
            return null;
        }

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - margin * 2;

        const colors = {
            navy: [7, 78, 136] as [number, number, number],
            darkNavy: [3, 44, 82] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            borderDark: [148, 163, 184] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            textMuted: [100, 116, 139] as [number, number, number],
            incompleteRed: [220, 38, 38] as [number, number, number],
            incompleteBg: [254, 242, 242] as [number, number, number],
        };

        const isPF = Boolean(config.printFriendly);
        const HEADER_H = 25;

        // ── Pre-load logos ──────────────────────────────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        const dateRangeStr = getInspectionDateRange(incompleteRecords, headerData, config);

        // ── Document Header ─────────────────────────────────────────────────────
        const drawPageHeader = (d: jsPDF) => {
            const baseReportNo = config?.reportNoPrefix || headerData?.sowReportNo || "N/A";
            const reportNo = baseReportNo.includes("/ INC") ? baseReportNo : `${baseReportNo} / INC`;

            draw3SectionHeader(d, {
                reportTitle: "INSPECTION INCOMPLETE FLAGGED DETAIL LIST",
                reportNo,
                structureName: headerData.platformName 
                    ? `${headerData.platformName}${headerData.jobpackName ? ` - ${headerData.jobpackName}` : ''}` 
                    : (headerData.jobpackName || "N/A"),
                companySettings,
                config,
                headerData,
                contractorLogoData: contractorLogo,
                clientLogoData: companyLogo,
                isPrintFriendly: isPF,
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
            }, isPF, margin);
        };

        // ── Blank Report Handler ────────────────────────────────────────────────
        if (config.isBlankReport) {
            drawPageHeader(doc);
            const startY = drawContextRow(doc, margin + HEADER_H + 2);

            // Subheader banner
            const subY = startY;
            const subH = 7;
            doc.setDrawColor(...colors.navy);
            doc.setLineWidth(0.2);
            if (!isPF) {
                doc.setFillColor(...colors.navy);
                doc.rect(margin, subY, contentWidth, subH, "FD");
                doc.setTextColor(255);
            } else {
                doc.rect(margin, subY, contentWidth, subH, "S");
                doc.setTextColor(...colors.navy);
            }
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.text("INSPECTION TYPE: _____________________________________________   —   TOTAL QID: ____", margin + 3, subY + 4.8);

            // Blank rows table
            const blankRows: string[][] = [];
            for (let i = 1; i <= 15; i++) {
                blankRows.push([String(i), "", "", "", ""]);
            }

            autoTable(doc, {
                startY: subY + subH + 2,
                margin: { left: margin, right: margin, top: margin + HEADER_H + 4, bottom: config.showSignatures !== false ? 38 : 15 },
                head: [[
                    { content: "Item No.",              styles: { halign: "center", valign: "middle" } },
                    { content: "QID",                   styles: { halign: "center", valign: "middle" } },
                    { content: "Elevation (m)",         styles: { halign: "center", valign: "middle" } },
                    { content: "Inspection Date",       styles: { halign: "center", valign: "middle" } },
                    { content: "Comments / Incomplete Reason", styles: { halign: "center", valign: "middle" } }
                ]],
                body: blankRows,
                theme: "grid",
                headStyles: {
                    fillColor: isPF ? [255, 255, 255] : colors.navy,
                    textColor: isPF ? colors.navy : [255, 255, 255],
                    fontSize: 8,
                    fontStyle: "bold",
                    halign: "center",
                    valign: "middle",
                    minCellHeight: 8,
                    lineWidth: 0.1,
                    lineColor: colors.borderDark,
                },
                styles: {
                    fontSize: 7.5,
                    cellPadding: 3,
                    textColor: colors.text,
                    lineColor: colors.border,
                    lineWidth: 0.1,
                    minCellHeight: 8
                },
                columnStyles: {
                    0: { cellWidth: 16, halign: "center" },
                    1: { cellWidth: 34 },
                    2: { cellWidth: 26, halign: "center" },
                    3: { cellWidth: 30, halign: "center" },
                    4: { cellWidth: "auto" }
                },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) drawPageHeader(doc);
                    doc.setFontSize(6.5);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.text);
                    doc.setDrawColor(...colors.border);
                    doc.setLineWidth(0.2);
                    doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                    doc.text(REPORT_FOOTER_APP_TEXT, margin, pageHeight - 6);
                }
            });

            // Draw Signatures on blank report
            if (config.showSignatures !== false) {
                const sigY = pageHeight - 35;
                const sigW = contentWidth / 3;
                const drawSigBox = (title: string, lx: number) => {
                    doc.setDrawColor(...colors.navy);
                    doc.setLineWidth(0.15);
                    doc.rect(lx, sigY, sigW - 3, 16);
                    if (!isPF) {
                        doc.setFillColor(...colors.navy);
                        doc.rect(lx, sigY, sigW - 3, 4, "F");
                        doc.setTextColor(255);
                    } else {
                        doc.setTextColor(...colors.navy);
                    }
                    doc.setFontSize(7);
                    doc.setFont("helvetica", "bold");
                    doc.text(title, lx + 2, sigY + 3);
                    doc.setTextColor(...colors.text);
                    doc.setFontSize(6.5);
                    doc.setFont("helvetica", "normal");
                    doc.text("Name: ________________________", lx + 2, sigY + 8);
                    doc.text("Date:   ________________________", lx + 2, sigY + 11.5);
                    doc.text("Sign:   ________________________", lx + 2, sigY + 15);
                };
                drawSigBox("PREPARED BY", margin);
                drawSigBox("REVIEWED BY", margin + sigW);
                drawSigBox("APPROVED BY", margin + sigW * 2);
            }

            applyWatermarkAndSignaturesGlobal(doc, config);
            if (config.returnBlob) return doc.output("blob");
            doc.save(`Inspection_Incomplete_Flagged_Blank_Report_${format(new Date(), "yyyyMMdd")}.pdf`);
            return null;
        }

        // ── Group Records By Inspection Type & Inspection Mode ──────────────────
        const groupsMap = new Map<string, { code: string; name: string; mode: "ROV" | "DIVING"; records: any[] }>();

        incompleteRecords.forEach(r => {
            const rawCode = (
                r.inspection_type?.code || 
                r.inspection_type_code || 
                r.inspection_type_name || 
                "GENERAL"
            ).toString().trim().toUpperCase();

            const mode = getRecordInspectionMode(r);

            let rawName = (
                r.inspection_type?.name || 
                INSPECTION_TYPE_NAMES[rawCode] || 
                formatInspectionTypeName(rawCode) || 
                rawCode
            ).toString().trim();

            // Ensure mode designation is present in the type name
            const nameUpper = rawName.toUpperCase();
            if (!nameUpper.includes("ROV") && !nameUpper.includes("DIVING")) {
                rawName = `${rawName} (${mode})`;
            }

            const groupKey = `${rawCode}__${mode}`;
            if (!groupsMap.has(groupKey)) {
                groupsMap.set(groupKey, {
                    code: rawCode,
                    name: rawName,
                    mode,
                    records: []
                });
            }
            groupsMap.get(groupKey)!.records.push(r);
        });

        // Sort groups: ROV first then DIVING, then alphabetically by inspection type code
        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
            if (a.mode !== b.mode) return a.mode.localeCompare(b.mode);
            return a.code.localeCompare(b.code);
        });

        // Sort records within each group by Elevation descending (highest elevation to lowest subsea depth)
        sortedGroups.forEach(g => {
            g.records.sort((a, b) => {
                const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? a.inspection_data?.verification_depth ?? -9999);
                const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? b.inspection_data?.verification_depth ?? -9999);
                if (!isNaN(elA) && !isNaN(elB) && elA !== elB) {
                    return elB - elA;
                }
                const qidA = String(a.structure_components?.q_id || a.component?.q_id || a.component_qid || "");
                const qidB = String(b.structure_components?.q_id || b.component?.q_id || b.component_qid || "");
                return qidA.localeCompare(qidB, undefined, { numeric: true, sensitivity: "base" });
            });
        });

        // ── Draw Report Pages ───────────────────────────────────────────────────
        drawPageHeader(doc);
        let currentY = drawContextRow(doc, margin + HEADER_H + 2);

        const buildRowData = (r: any, idx: number): string[] => {
            const comp = r.structure_components || r.component || {};
            const qid = String(comp.q_id || comp.qid || r.component_qid || `ID: ${r.component_id || r.insp_id}`).trim();

            const d = r.inspection_data || r.inspection_dat || {};
            const rawEl = r.elevation ?? d.elevation ?? d.verification_depth;
            const elevationStr = rawEl !== "" && rawEl !== null && rawEl !== undefined
                ? `${rawEl} m`
                : "—";

            const rawDate = r.inspection_date || d.inspection_date || d.date || r.created_at;
            let dateStr = "—";
            if (rawDate) {
                try {
                    dateStr = format(new Date(rawDate), "dd/MM/yyyy");
                } catch (_) {
                    dateStr = String(rawDate);
                }
            }

            const comments = getIncompleteReasonOrComments(r);

            return [
                String(idx + 1),
                qid,
                elevationStr,
                dateStr,
                comments
            ];
        };

        // Render each inspection type section
        sortedGroups.forEach((group, groupIdx) => {
            const groupTotalQIDs = group.records.length;
            const subH = 6.5;

            // Check if there is enough space on current page for Subheader + Table Header + at least 2 rows (~35mm)
            if (currentY > pageHeight - 45) {
                doc.addPage();
                drawPageHeader(doc);
                currentY = margin + HEADER_H + 4;
            } else if (groupIdx > 0) {
                currentY += 4;
            }

            // Draw Section Sub-Header Box with borders
            doc.setDrawColor(...colors.navy);
            doc.setLineWidth(0.2);
            if (!isPF) {
                doc.setFillColor(...colors.navy);
                doc.rect(margin, currentY, contentWidth, subH, "FD");
                doc.setTextColor(255);
            } else {
                doc.setFillColor(255, 255, 255);
                doc.rect(margin, currentY, contentWidth, subH, "FD");
                doc.setTextColor(...colors.navy);
            }

            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            const headerLabel = `INSPECTION TYPE: ${group.name.toUpperCase()} (${group.code})  —  TOTAL QID: ${groupTotalQIDs}`;
            doc.text(headerLabel, margin + 3, currentY + 4.5);

            currentY += subH + 1.5;

            // Render Table for this group
            autoTable(doc, {
                startY: currentY,
                margin: { left: margin, right: margin, top: margin + HEADER_H + 4, bottom: config.showSignatures !== false ? 38 : 15 },
                head: [[
                    { content: "Item No.",              styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "QID",                   styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "Elevation (m)",         styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "Inspection Date",       styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } },
                    { content: "Comments / Incomplete Reason", styles: { halign: "center", valign: "middle", lineWidth: 0.1, lineColor: colors.border } }
                ]],
                body: group.records.map(buildRowData),
                theme: "grid",
                headStyles: {
                    fillColor: isPF ? [255, 255, 255] : colors.navy,
                    textColor: isPF ? colors.navy : [255, 255, 255],
                    fontSize: 7.5,
                    fontStyle: "bold",
                    halign: "center",
                    valign: "middle",
                    minCellHeight: 7,
                    lineWidth: 0.1,
                    lineColor: isPF ? colors.border : [255, 255, 255],
                },
                styles: {
                    fontSize: 7,
                    cellPadding: 2,
                    textColor: colors.text,
                    lineColor: colors.border,
                    lineWidth: 0.1,
                    overflow: "linebreak",
                    valign: "middle",
                },
                columnStyles: {
                    0: { cellWidth: 14, halign: "center" },
                    1: { cellWidth: 32, fontStyle: "bold" },
                    2: { cellWidth: 24, halign: "center" },
                    3: { cellWidth: 26, halign: "center" },
                    4: { cellWidth: "auto" }
                },
                didParseCell: (data) => {
                    if (data.section === "body") {
                        // Alternate row fill
                        if (!isPF && data.row.index % 2 === 1) {
                            data.cell.styles.fillColor = [248, 250, 252];
                        }
                    }
                },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) {
                        drawPageHeader(doc);
                    }
                    // Footer line & App text
                    doc.setFontSize(6.5);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(...colors.text);
                    doc.setDrawColor(...colors.border);
                    doc.setLineWidth(0.2);
                    doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                    doc.text(REPORT_FOOTER_APP_TEXT, margin, pageHeight - 6);
                }
            });

            currentY = (doc as any).lastAutoTable?.finalY ?? currentY;
        });

        // ── Grand Summary Banner ────────────────────────────────────────────────
        const totalAllIncomplete = incompleteRecords.length;
        const summaryBoxH = 6;
        if (currentY > pageHeight - 45) {
            doc.addPage();
            drawPageHeader(doc);
            currentY = margin + HEADER_H + 4;
        } else {
            currentY += 4;
        }

        doc.setDrawColor(...colors.navy);
        doc.setLineWidth(0.2);
        if (!isPF) {
            doc.setFillColor(...colors.incompleteBg);
            doc.rect(margin, currentY, contentWidth, summaryBoxH, "FD");
            doc.setTextColor(...colors.incompleteRed);
        } else {
            doc.rect(margin, currentY, contentWidth, summaryBoxH, "S");
            doc.setTextColor(...colors.navy);
        }
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        const rovCount = incompleteRecords.filter(r => getRecordInspectionMode(r) === "ROV").length;
        const divingCount = incompleteRecords.filter(r => getRecordInspectionMode(r) === "DIVING").length;
        const grandSummaryText = rovCount > 0 && divingCount > 0
            ? `TOTAL INCOMPLETE FLAGGED QIDS ACROSS ALL INSPECTION TYPES: ${totalAllIncomplete}  (ROV: ${rovCount} | DIVING: ${divingCount})`
            : `TOTAL INCOMPLETE FLAGGED QIDS ACROSS ALL INSPECTION TYPES: ${totalAllIncomplete}  (INSPECTION MODE: ${rovCount > 0 ? "ROV" : "DIVING"})`;
        doc.text(grandSummaryText, margin + 3, currentY + 4.2);
        currentY += summaryBoxH;

        // ── Signatory Section at Footer ─────────────────────────────────────────
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (currentY > sigY - 6) {
                doc.addPage();
                drawPageHeader(doc);
                sigY = pageHeight - 38;
            }

            const sigW = contentWidth / 3;
            const drawSigFooter = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy);
                doc.setLineWidth(0.15);
                doc.rect(lx, sigY, sigW - 3, 18);
                if (!isPF) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 3, 4.5, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.2);

                doc.setTextColor(...colors.text);
                doc.setFontSize(6.5);
                doc.setFont("helvetica", "normal");
                doc.text("Name:", lx + 2, sigY + 8.5);
                if (person?.name) doc.text(person.name, lx + 14, sigY + 8.5);

                doc.text("Date:", lx + 2, sigY + 12);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 12);

                doc.text("Signature:", lx + 2, sigY + 15.5);
            };

            drawSigFooter("PREPARED BY", margin, config?.preparedBy);
            drawSigFooter("REVIEWED BY", margin + sigW, config?.reviewedBy);
            drawSigFooter("APPROVED BY", margin + sigW * 2, config?.approvedBy);
        }

        // ── Two-Pass Page Numbering ("Page X of Y") ─────────────────────────────
        const totalPages = doc.getNumberOfPages();
        if (config.showPageNumbers !== false) {
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(6.5);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.text(`Page ${i} of ${totalPages}`, margin + contentWidth, pageHeight - 6, { align: "right" });
            }
        }

        applyWatermarkAndSignaturesGlobal(doc, config);

        if (config.returnBlob) {
            return doc.output("blob");
        }

        const reportNoClean = (config?.reportNoPrefix || headerData?.sowReportNo || "INC").replace(/[^a-zA-Z0-9_-]/g, "_");
        doc.save(`Inspection_Incomplete_Flagged_Detail_List_${reportNoClean}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Inspection Incomplete Flagged Report] Error:", err);
        throw err;
    }
};
