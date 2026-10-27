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
    allRecords?: any[];
    summaryData?: any;
    contractorLogoUrl?: string;
    contractorLogoData?: any;
    clientLogoData?: any;
    sowScope?: any;
    recordsSummary?: any;
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
 * Categorizes an incomplete reason string into standard offshore operational categories.
 */
export const categorizeIncompleteReason = (text: string): { category: string; color: [number, number, number] } => {
    const low = (text || "").toLowerCase();
    if (low.includes("burie") || low.includes("burial") || low.includes("seabed") || low.includes("mud") || low.includes("silt") || low.includes("covered") || low.includes("bml") || low.includes("soil") || low.includes("sand") || low.includes("trench")) {
        return { category: "Seabed Burial / Fully Buried", color: [220, 38, 38] }; // Crimson Red
    }
    if (low.includes("access") || low.includes("obstruct") || low.includes("clearance") || low.includes("reach") || low.includes("unreachable") || low.includes("blocked") || low.includes("clutter") || low.includes("debris") || low.includes("no access") || low.includes("congest") || low.includes("tight") || low.includes("cannot reach") || low.includes("unable to reach") || low.includes("interfere")) {
        return { category: "Access & Physical Obstruction", color: [234, 88, 12] }; // Coral
    }
    if (low.includes("marine growth") || low.includes("fouling") || low.includes("growth") || low.includes("barnacle") || low.includes("coral") || low.includes("mussel") || low.includes("seaweed")) {
        return { category: "Heavy Marine Growth / Fouling", color: [217, 119, 6] }; // Amber
    }
    if (low.includes("visibility") || low.includes("turbid") || low.includes("murky") || low.includes("clarity") || low.includes("black water") || low.includes("zero vis") || low.includes("poor vis") || low.includes("cloudy")) {
        return { category: "Poor Subsea Visibility / Turbidity", color: [14, 116, 144] }; // Cyan
    }
    if (low.includes("current") || low.includes("weather") || low.includes("sea state") || low.includes("swell") || low.includes("surge") || low.includes("wave") || low.includes("tide") || low.includes("drift")) {
        return { category: "High Current & Adverse Weather", color: [79, 70, 229] }; // Indigo
    }
    if (low.includes("equipment") || low.includes("sensor") || low.includes("tool") || low.includes("camera") || low.includes("probe") || low.includes("malfunction") || low.includes("rov limit") || low.includes("tether") || low.includes("breakdown") || low.includes("failure") || low.includes("cable")) {
        return { category: "Equipment & Tooling Constraints", color: [124, 58, 237] }; // Purple
    }
    if (low.includes("time") || low.includes("safety") || low.includes("permit") || low.includes("diver limit") || low.includes("shift") || low.includes("operational") || low.includes("curfew") || low.includes("standby") || low.includes("abort") || low.includes("simops")) {
        return { category: "Operational & Safety Constraints", color: [190, 24, 93] }; // Rose
    }
    if (low.includes("not found") || low.includes("not installed") || low.includes("not present") || low.includes("missing") || low.includes("no member") || low.includes("not applicable") || low.includes("non-existent") || low.includes("not visible")) {
        return { category: "Scope Discrepancy / Not Found", color: [107, 114, 128] }; // Gray
    }
    return { category: "Other Operational Constraints", color: [100, 116, 139] }; // Slate
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
 * Includes Executive Graphical Summary (KPI Scorecards, Tasked vs Planned Donut Chart, Reason Distribution Bar Chart with values),
 * Header, Footer, Logos, Page Numbers (Page X of Y), Signatures, Watermark, and Ink-Save (Print-Friendly) Mode.
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
            lightNavy: [14, 116, 144] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            cardBorder: [226, 232, 240] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            borderDark: [148, 163, 184] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            textMuted: [100, 116, 139] as [number, number, number],
            incompleteRed: [220, 38, 38] as [number, number, number],
            incompleteBg: [254, 242, 242] as [number, number, number],
            incompleteBorder: [252, 165, 165] as [number, number, number],
            completedTeal: [13, 148, 136] as [number, number, number],
            completedBg: [240, 253, 250] as [number, number, number],
            pendingSlate: [148, 163, 184] as [number, number, number],
            barTrack: [241, 245, 249] as [number, number, number],
            blue: [37, 99, 235] as [number, number, number],
            amber: [217, 119, 6] as [number, number, number],
            coral: [234, 88, 12] as [number, number, number],
            purple: [124, 58, 237] as [number, number, number],
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

        // ── Gather Data for Metrics & Reason Analytics ──────────────────────────
        const allRecords: any[] = headerData?.allRecords || config?.allRecords || headerData?.allWorkspaceRecords || records || [];
        let summaryData: any = headerData?.summaryData || config?.summaryData || null;

        if (!summaryData && (headerData?.structureId || config?.structureId || headerData?.jobPackId || config?.jobPackId)) {
            const sId = headerData?.structureId || config?.structureId;
            const jpId = headerData?.jobPackId || config?.jobPackId;
            const sowRep = headerData?.sowReportNo || config?.sowReportNo;
            if (typeof window !== "undefined" && typeof fetch !== "undefined") {
                try {
                    const params = new URLSearchParams();
                    if (sId) params.set("structure_id", String(sId));
                    if (jpId) params.set("jobpack_id", String(jpId));
                    if (sowRep && sowRep !== "N/A" && sowRep !== "all") {
                        params.set("sow_report_no", String(sowRep));
                    }
                    const res = await fetch(`/api/inspection-summary?${params.toString()}`);
                    if (res.ok) {
                        const json = await res.json();
                        summaryData = json.data || {};
                    }
                } catch (_) {}
            }
        }

        // Support external sowScope and recordsSummary if provided
        const externalSow = headerData?.sowScope || config?.sowScope || headerData?.sow_scope;
        if (externalSow && !summaryData?.sow) {
            if (!summaryData) summaryData = {};
            summaryData.sow = {
                total: externalSow.total,
                completed: externalSow.completed,
                incomplete: externalSow.incomplete,
                pending: externalSow.pending ?? 0,
                completionPct: externalSow.completionPct,
                completedPct: externalSow.completionPct,
                incompletePct: externalSow.total > 0 ? parseFloat(((externalSow.incomplete / externalSow.total) * 100).toFixed(1)) : 0,
                pendingPct: externalSow.total > 0 ? parseFloat((((externalSow.pending ?? 0) / externalSow.total) * 100).toFixed(1)) : 0,
            };
        }

        const externalRecs = headerData?.recordsSummary || config?.recordsSummary || headerData?.records_summary;
        if (externalRecs && !summaryData?.records) {
            if (!summaryData) summaryData = {};
            summaryData.records = {
                total: externalRecs.totalRecords,
                completed: externalRecs.completedRecords,
                incomplete: externalRecs.incompleteRecords,
            };
        }

        // Fallback: If SOW stats are still missing, query database directly via Supabase client
        if (!summaryData?.sow && (headerData?.structureId || config?.structureId || headerData?.jobPackId || config?.jobPackId)) {
            const sId = headerData?.structureId || config?.structureId;
            const jpId = headerData?.jobPackId || config?.jobPackId;
            const sowRep = headerData?.sowReportNo || config?.sowReportNo;
            try {
                const { createClient } = await import("@/utils/supabase/client");
                const supabase = createClient();
                let resolvedSowId: number | null = null;
                if (jpId) {
                    let sQuery = (supabase as any).from("u_sow").select("id, report_numbers").eq("jobpack_id", Number(jpId));
                    if (sId) sQuery = sQuery.eq("structure_id", Number(sId));
                    const { data: sowRows } = await sQuery;
                    if (sowRows && sowRows.length > 0) {
                        if (sowRep && sowRep !== "N/A" && sowRep !== "all") {
                            const m = sowRows.find((s: any) => {
                                if (Array.isArray(s.report_numbers)) {
                                    return s.report_numbers.some((rn: any) => String(rn?.number || rn || "").trim().toLowerCase() === String(sowRep).trim().toLowerCase());
                                }
                                return false;
                            });
                            resolvedSowId = m ? Number(m.id) : Number(sowRows[0].id);
                        } else {
                            resolvedSowId = Number(sowRows[0].id);
                        }
                    }
                }
                if (resolvedSowId) {
                    let allSowItems: any[] = [];
                    let from = 0;
                    while (true) {
                        const { data: itemsChunk } = await (supabase as any)
                            .from("u_sow_items")
                            .select("status, report_number")
                            .eq("sow_id", resolvedSowId)
                            .range(from, from + 999);
                        if (!itemsChunk || itemsChunk.length === 0) break;
                        allSowItems.push(...itemsChunk);
                        if (itemsChunk.length < 1000) break;
                        from += 1000;
                    }
                    const matchingSow = (sowRep && sowRep !== "N/A" && sowRep !== "all")
                        ? allSowItems.filter((i: any) => String(i.report_number || "").replace(/\s+/g, "").toLowerCase() === String(sowRep).replace(/\s+/g, "").toLowerCase())
                        : allSowItems;
                    const targetItems = matchingSow.length > 0 ? matchingSow : allSowItems;
                    const sTotal = targetItems.length;
                    const sComp = targetItems.filter((i: any) => String(i.status || "").toLowerCase() === "completed").length;
                    const sInc = targetItems.filter((i: any) => String(i.status || "").toLowerCase() === "incomplete").length;
                    const sPend = targetItems.filter((i: any) => String(i.status || "").toLowerCase() === "pending").length;
                    if (sTotal > 0) {
                        if (!summaryData) summaryData = {};
                        summaryData.sow = {
                            total: sTotal,
                            completed: sComp,
                            incomplete: sInc,
                            pending: sPend,
                            completionPct: Math.round((sComp / sTotal) * 100),
                            completedPct: parseFloat(((sComp / sTotal) * 100).toFixed(1)),
                            incompletePct: parseFloat(((sInc / sTotal) * 100).toFixed(1)),
                            pendingPct: parseFloat(((sPend / sTotal) * 100).toFixed(1)),
                        };
                    }
                }
            } catch (_) {}
        }

        const sowStats = summaryData?.sow;
        const taskStats = summaryData?.tasks;
        const recStats = summaryData?.records;

        const incompleteCount = incompleteRecords.length;

        // 1. SOW Scope Stats (Identified Work Scope) - Exact alignment with Inspection Module
        let totalPlannedSow = sowStats?.total ?? 0;
        let completedSow = sowStats?.completed;
        let incompleteSow = sowStats?.incomplete ?? incompleteCount;
        let pendingSow = sowStats?.pending;

        // 2. Inspection Records Stats (Database Inspection Records)
        let totalRecords = recStats?.total ?? (allRecords.length > 0 ? allRecords.length : 0);
        let completedRecords = recStats?.completed;
        let incompleteRecordsCount = recStats?.incomplete ?? incompleteCount;

        if (totalRecords <= 0) {
            totalRecords = totalPlannedSow > 0 ? totalPlannedSow : incompleteCount;
        }
        if (completedRecords === undefined || completedRecords < 0) {
            completedRecords = Math.max(0, totalRecords - incompleteCount);
        }

        // If no SOW stats were found in the database, fallback gracefully
        if (totalPlannedSow <= 0) {
            totalPlannedSow = totalRecords;
            completedSow = completedRecords;
            incompleteSow = incompleteRecordsCount;
            pendingSow = 0;
        } else {
            if (completedSow === undefined || completedSow < 0) {
                completedSow = Math.max(0, totalPlannedSow - incompleteSow);
            }
            if (pendingSow === undefined) {
                pendingSow = Math.max(0, totalPlannedSow - completedSow - incompleteSow);
            }
        }

        // Exact percentages matching Inspection Module
        const sowCompletedPct = totalPlannedSow > 0
            ? (sowStats?.completedPct ?? parseFloat(((completedSow / totalPlannedSow) * 100).toFixed(1)))
            : 0;
        const sowIncompletePct = totalPlannedSow > 0
            ? (sowStats?.incompletePct ?? parseFloat(((incompleteSow / totalPlannedSow) * 100).toFixed(1)))
            : 0;
        const sowPendingPct = totalPlannedSow > 0
            ? (sowStats?.pendingPct ?? parseFloat(((pendingSow / totalPlannedSow) * 100).toFixed(1)))
            : 0;

        const recordsCompletedPct = totalRecords > 0
            ? (recStats?.completionPct ?? parseFloat(((completedRecords / totalRecords) * 100).toFixed(1)))
            : 0;
        const recordsIncompletePct = totalRecords > 0
            ? (recStats?.incompletePct ?? parseFloat(((incompleteRecordsCount / totalRecords) * 100).toFixed(1)))
            : 0;

        const rovIncompleteCount = incompleteRecords.filter(r => getRecordInspectionMode(r) === "ROV").length;
        const divingIncompleteCount = incompleteRecords.filter(r => getRecordInspectionMode(r) === "DIVING").length;

        // Incomplete Reason Breakdown
        // Incomplete Reason Breakdown & Consolidation (Eliminates split/duplicate 'Other' items)
        const categoryCounts = new Map<string, { count: number; color: [number, number, number]; samples: string[] }>();
        const specificCounts = new Map<string, number>();

        incompleteRecords.forEach(r => {
            const rawReason = getIncompleteReasonOrComments(r);
            const { category, color } = categorizeIncompleteReason(rawReason);
            if (!categoryCounts.has(category)) {
                categoryCounts.set(category, { count: 0, color, samples: [] });
            }
            const catEntry = categoryCounts.get(category)!;
            catEntry.count += 1;
            if (!catEntry.samples.includes(rawReason) && catEntry.samples.length < 3) {
                catEntry.samples.push(rawReason);
            }

            let cleanSpecific = rawReason.replace(/^incomplete\s*[:-]\s*/i, "").trim();
            if (cleanSpecific.length > 55) {
                cleanSpecific = cleanSpecific.substring(0, 52) + "...";
            }
            specificCounts.set(cleanSpecific, (specificCounts.get(cleanSpecific) || 0) + 1);
        });

        const OTHER_LABEL = "Other Operational Constraints";
        let otherCombinedCount = 0;
        const namedCategories: Array<{ label: string; count: number; color: [number, number, number]; percentage: number }> = [];

        categoryCounts.forEach((val, cat) => {
            if (cat.toLowerCase().includes("other")) {
                otherCombinedCount += val.count;
            } else {
                namedCategories.push({
                    label: cat,
                    count: val.count,
                    color: val.color,
                    percentage: incompleteCount > 0 ? parseFloat(((val.count / incompleteCount) * 100).toFixed(1)) : 0
                });
            }
        });

        // Sort named categories descending by count
        namedCategories.sort((a, b) => b.count - a.count);

        // Build consolidated reasons to display (Maximum 4 bars, zero duplicate 'Other')
        const MAX_BARS = 4;
        let reasonsToDisplay: Array<{ label: string; count: number; color: [number, number, number]; percentage: number }> = [];

        // Check if all/most records share 1 to 4 distinct specific comments (e.g. 15 records all saying "Unable to inspect...")
        const specificEntries = Array.from(specificCounts.entries()).sort((a, b) => b[1] - a[1]);
        if (specificEntries.length <= 4 && specificEntries[0] && specificEntries[0][1] >= incompleteCount * 0.7 && specificEntries[0][0].length > 10) {
            reasonsToDisplay = specificEntries.map(([lbl, cnt]) => {
                const { color } = categorizeIncompleteReason(lbl);
                return {
                    label: lbl,
                    count: cnt,
                    color,
                    percentage: incompleteCount > 0 ? parseFloat(((cnt / incompleteCount) * 100).toFixed(1)) : 0
                };
            });
        } else {
            if (namedCategories.length < MAX_BARS) {
                reasonsToDisplay.push(...namedCategories);
                if (otherCombinedCount > 0) {
                    reasonsToDisplay.push({
                        label: OTHER_LABEL,
                        count: otherCombinedCount,
                        color: [100, 116, 139],
                        percentage: incompleteCount > 0 ? parseFloat(((otherCombinedCount / incompleteCount) * 100).toFixed(1)) : 0
                    });
                }
            } else if (namedCategories.length === MAX_BARS && otherCombinedCount === 0) {
                reasonsToDisplay.push(...namedCategories);
            } else {
                // namedCategories.length >= MAX_BARS or has additional other
                const topSlice = namedCategories.slice(0, MAX_BARS - 1);
                reasonsToDisplay.push(...topSlice);
                const remainingNamed = namedCategories.slice(MAX_BARS - 1).reduce((sum, c) => sum + c.count, 0);
                const totalOther = otherCombinedCount + remainingNamed;
                if (totalOther > 0) {
                    reasonsToDisplay.push({
                        label: OTHER_LABEL,
                        count: totalOther,
                        color: [100, 116, 139],
                        percentage: incompleteCount > 0 ? parseFloat(((totalOther / incompleteCount) * 100).toFixed(1)) : 0
                    });
                }
            }
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

        // Sort records within each group by Elevation descending
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

        // ── Draw Vector Donut Chart Helper ──────────────────────────────────────
        const drawDonutChart = (
            centerX: number,
            centerY: number,
            outerRadius: number,
            innerRadius: number,
            slices: Array<{ value: number; color: [number, number, number] }>,
            centerTextLine1?: string,
            centerTextLine2?: string,
            centerTextColor?: [number, number, number]
        ) => {
            const total = slices.reduce((sum, s) => sum + s.value, 0);
            if (total === 0) {
                doc.setFillColor(241, 245, 249);
                doc.circle(centerX, centerY, outerRadius, "F");
                doc.setFillColor(255, 255, 255);
                doc.circle(centerX, centerY, innerRadius, "F");
                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.15);
                doc.circle(centerX, centerY, innerRadius, "S");
                doc.circle(centerX, centerY, outerRadius, "S");
                return;
            }

            const activeSlices = slices.filter(s => s.value > 0);
            if (activeSlices.length === 1) {
                const single = activeSlices[0];
                doc.setFillColor(isPF ? 255 : single.color[0], isPF ? 255 : single.color[1], isPF ? 255 : single.color[2]);
                doc.circle(centerX, centerY, outerRadius, isPF ? "S" : "FD");
            } else {
                let currentAngle = -Math.PI / 2; // 12 o'clock
                slices.forEach(slice => {
                    if (slice.value <= 0) return;
                    const sliceAngle = (slice.value / total) * 2 * Math.PI;
                    const steps = Math.max(12, Math.floor(sliceAngle * 28));

                    doc.setFillColor(isPF ? 245 : slice.color[0], isPF ? 245 : slice.color[1], isPF ? 245 : slice.color[2]);
                    doc.setDrawColor(255, 255, 255);
                    doc.setLineWidth(0.2);

                    for (let i = 0; i < steps; i++) {
                        const a1 = currentAngle + (sliceAngle * i / steps);
                        const a2 = currentAngle + (sliceAngle * (i + 1) / steps);
                        const x1 = centerX + outerRadius * Math.cos(a1);
                        const y1 = centerY + outerRadius * Math.sin(a1);
                        const x2 = centerX + outerRadius * Math.cos(a2);
                        const y2 = centerY + outerRadius * Math.sin(a2);
                        doc.triangle(centerX, centerY, x1, y1, x2, y2, "F");
                    }
                    currentAngle += sliceAngle;
                });
            }

            // Inner cutout circle
            doc.setFillColor(255, 255, 255);
            doc.circle(centerX, centerY, innerRadius, "F");
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.15);
            doc.circle(centerX, centerY, innerRadius, "S");
            doc.circle(centerX, centerY, outerRadius, "S");

            // Center text inside donut
            if (centerTextLine1) {
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "bold");
                const cColor = centerTextColor || colors.incompleteRed;
                doc.setTextColor(...cColor);
                doc.text(centerTextLine1, centerX, centerY - (centerTextLine2 ? 0.7 : -1.2), { align: "center" });
            }
            if (centerTextLine2) {
                doc.setFontSize(4.8);
                doc.setFont("helvetica", "bold");
                const cColor = centerTextColor || colors.incompleteRed;
                doc.setTextColor(...cColor);
                doc.text(centerTextLine2, centerX, centerY + 2.5, { align: "center" });
            }
        };

        // ── Draw Report Pages ───────────────────────────────────────────────────
        drawPageHeader(doc);
        let currentY = drawContextRow(doc, margin + HEADER_H + 2);

        // ── 1. Executive Summary Header Banner ──────────────────────────────────
        const sumBannerH = 5.5;
        doc.setDrawColor(...colors.navy);
        doc.setLineWidth(0.2);
        if (!isPF) {
            doc.setFillColor(...colors.navy);
            doc.rect(margin, currentY, contentWidth, sumBannerH, "FD");
            doc.setTextColor(255);
        } else {
            doc.setFillColor(255, 255, 255);
            doc.rect(margin, currentY, contentWidth, sumBannerH, "FD");
            doc.setTextColor(...colors.navy);
        }
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text("INSPECTION INCOMPLETE EXECUTIVE SUMMARY & SCOPE ANALYTICS", margin + 3, currentY + 3.8);

        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        if (!isPF) doc.setTextColor(220, 230, 242);
        const subheaderRight = `TOTAL INCOMPLETE: ${incompleteSow} TASKS (${sowIncompletePct}% SOW)  |  COMPLETED: ${completedSow} TASKS (${sowCompletedPct}%)  |  PLANNED SOW: ${totalPlannedSow} TASKS`;
        doc.text(subheaderRight, margin + contentWidth - 3, currentY + 3.8, { align: "right" });

        currentY += sumBannerH + 2;

        // ── 2. Top 4 KPI Scorecard Cards ────────────────────────────────────────
        const cardGap = 3;
        const cardW = (contentWidth - (cardGap * 3)) / 4; // 45.25mm
        const cardH = 13.5;

        const drawKpiCard = (
            x: number,
            y: number,
            w: number,
            h: number,
            title: string,
            value: string,
            subtext: string,
            accentColor: [number, number, number]
        ) => {
            doc.setFillColor(isPF ? 255 : 248, isPF ? 255 : 250, isPF ? 255 : 252);
            doc.setDrawColor(...colors.cardBorder);
            doc.setLineWidth(0.15);
            doc.roundedRect(x, y, w, h, 1, 1, "FD");

            // Left colored accent indicator
            doc.setFillColor(...accentColor);
            doc.roundedRect(x, y, 1.8, h, 0.5, 0.5, "F");

            doc.setFontSize(5.2);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.textMuted);
            doc.text(title.toUpperCase(), x + 3.4, y + 3.2);

            doc.setFontSize(9.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...accentColor);
            doc.text(value, x + 3.4, y + 8);

            doc.setFontSize(4.8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.textMuted);
            doc.text(subtext, x + 3.4, y + 11.6);
        };

        // Card 1: Planned Scope (SOW)
        drawKpiCard(
            margin,
            currentY,
            cardW,
            cardH,
            "Planned Scope (SOW)",
            `${totalPlannedSow} Tasks`,
            "100% Identified SOW Scope",
            colors.navy
        );

        // Card 2: Completed SOW Scope
        drawKpiCard(
            margin + cardW + cardGap,
            currentY,
            cardW,
            cardH,
            "Completed SOW Scope",
            `${completedSow} Tasks`,
            `${sowCompletedPct}% of SOW (${completedRecords} Records)`,
            colors.completedTeal
        );

        // Card 3: Incomplete Flagged
        drawKpiCard(
            margin + (cardW + cardGap) * 2,
            currentY,
            cardW,
            cardH,
            "Incomplete Flagged",
            `${incompleteSow} Tasks`,
            `${sowIncompletePct}% of SOW (${incompleteRecordsCount} Records)`,
            colors.incompleteRed
        );

        // Card 4: Inspection Records
        drawKpiCard(
            margin + (cardW + cardGap) * 3,
            currentY,
            cardW,
            cardH,
            "Inspection Records",
            `${totalRecords} Records`,
            `${completedRecords} Complete · ${incompleteRecordsCount} Incomp`,
            colors.blue
        );

        currentY += cardH + 2.5;

        // ── 3. Visual Analytics (Donut Chart + Reason Distribution Chart) ────────
        const chartBoxH = 43;
        const leftBoxW = 91;
        const rightBoxW = contentWidth - leftBoxW - 3; // 96mm
        const leftBoxX = margin;
        const rightBoxX = margin + leftBoxW + 3;

        // --- 3A. LEFT BOX: Task Execution Status (Donut Chart + Metrics) ---
        doc.setFillColor(isPF ? 255 : 248, isPF ? 255 : 250, isPF ? 255 : 252);
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.15);
        doc.roundedRect(leftBoxX, currentY, leftBoxW, chartBoxH, 1, 1, "FD");

        // Sub-title bar
        doc.setFillColor(isPF ? 255 : 241, isPF ? 255 : 245, isPF ? 255 : 249);
        doc.roundedRect(leftBoxX, currentY, leftBoxW, 5.2, 1, 1, "F");
        doc.setDrawColor(...colors.border);
        doc.line(leftBoxX, currentY + 5.2, leftBoxX + leftBoxW, currentY + 5.2);

        doc.setFontSize(6.8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.navy);
        doc.text("TASK EXECUTION STATUS (SOW & RECORDS)", leftBoxX + 3, currentY + 3.6);

        // Donut Chart on Left Side of Box
        const donutCenterX = leftBoxX + 19;
        const donutCenterY = currentY + 24;
        const donutOuterR = 13.5;
        const donutInnerR = 7.5;

        const donutSlices: Array<{ value: number; color: [number, number, number] }> = [];
        if (completedSow > 0) {
            donutSlices.push({ value: completedSow, color: colors.completedTeal });
        }
        donutSlices.push({ value: incompleteSow, color: colors.incompleteRed });
        if (pendingSow > 0) {
            donutSlices.push({ value: pendingSow, color: colors.pendingSlate });
        }

        drawDonutChart(
            donutCenterX,
            donutCenterY,
            donutOuterR,
            donutInnerR,
            donutSlices,
            `${sowIncompletePct}%`,
            "INCOMPLETE",
            colors.incompleteRed
        );

        // Legend & Key Metrics on Right Side of Box
        const legX = leftBoxX + 36;
        let legY = currentY + 9.2;

        // Completed SOW row
        doc.setFillColor(...colors.completedTeal);
        doc.rect(legX, legY - 2.2, 2.5, 2.5, "F");
        doc.setFontSize(5.8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.text);
        doc.text("Completed SOW:", legX + 3.8, legY);
        doc.setFont("helvetica", "normal");
        doc.text(`${completedSow} Tasks (${sowCompletedPct}%)`, legX + 26, legY);

        // Incomplete SOW row
        legY += 5.0;
        doc.setFillColor(...colors.incompleteRed);
        doc.rect(legX, legY - 2.2, 2.5, 2.5, "F");
        doc.setFontSize(5.8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.text);
        doc.text("Incomplete SOW:", legX + 3.8, legY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.incompleteRed);
        doc.text(`${incompleteSow} Tasks (${sowIncompletePct}%)`, legX + 26, legY);

        // Pending SOW row (if applicable)
        if (pendingSow > 0) {
            legY += 5.0;
            doc.setFillColor(...colors.pendingSlate);
            doc.rect(legX, legY - 2.2, 2.5, 2.5, "F");
            doc.setFontSize(5.8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.text);
            doc.text("Pending Scope:", legX + 3.8, legY);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.textMuted);
            doc.text(`${pendingSow} Tasks (${sowPendingPct}%)`, legX + 26, legY);
        }

        // Thin divider
        legY += 4.0;
        doc.setDrawColor(...colors.cardBorder);
        doc.setLineWidth(0.1);
        doc.line(legX, legY, leftBoxX + leftBoxW - 3, legY);
        legY += 3.6;

        // Total SOW
        doc.setFontSize(5.6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.text);
        doc.text("Total Planned SOW:", legX, legY);
        doc.setFont("helvetica", "normal");
        doc.text(`${totalPlannedSow} Tasks (100%)`, legX + 26, legY);

        // Total Records
        legY += 4.0;
        doc.setFontSize(5.6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.text);
        doc.text("Total Records:", legX, legY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.textMuted);
        doc.text(`${totalRecords} (${completedRecords} Comp · ${incompleteRecordsCount} Incomp)`, legX + 26, legY);

        // Inspection Mode Breakdown
        legY += 4.0;
        doc.setFontSize(5.4);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.textMuted);
        doc.text(`Incomplete Mode:  ROV: ${rovIncompleteCount}  |  Diving: ${divingIncompleteCount}`, legX, legY);

        // --- 3B. RIGHT BOX: Incomplete Reason Distribution (Bar Chart with Values) ---
        doc.setFillColor(isPF ? 255 : 248, isPF ? 255 : 250, isPF ? 255 : 252);
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.15);
        doc.roundedRect(rightBoxX, currentY, rightBoxW, chartBoxH, 1, 1, "FD");

        // Sub-title bar
        doc.setFillColor(isPF ? 255 : 241, isPF ? 255 : 245, isPF ? 255 : 249);
        doc.roundedRect(rightBoxX, currentY, rightBoxW, 5.2, 1, 1, "F");
        doc.setDrawColor(...colors.border);
        doc.line(rightBoxX, currentY + 5.2, rightBoxX + rightBoxW, currentY + 5.2);

        doc.setFontSize(6.8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.navy);
        doc.text("INCOMPLETE REASON BREAKDOWN & ROOT CAUSES", rightBoxX + 3, currentY + 3.6);

        // Render Horizontal Bars with Values & Percentages (Consolidated 1 to 4 bars)
        const barTrackMaxW = 56;
        const numBars = reasonsToDisplay.length;
        const barRowH = numBars <= 3 ? 7.6 : 6.3;
        let barY = currentY + (numBars <= 3 ? 8.6 : 7.6);

        reasonsToDisplay.forEach((item, rIdx) => {
            // Label line
            doc.setFontSize(5.6);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.text);
            let displayLabel = `${rIdx + 1}. ${item.label}`;
            if (displayLabel.length > 50) {
                displayLabel = displayLabel.substring(0, 48) + "...";
            }
            doc.text(displayLabel, rightBoxX + 3, barY);

            barY += 1.8;

            // Background track
            doc.setFillColor(...colors.barTrack);
            doc.roundedRect(rightBoxX + 3, barY, barTrackMaxW, 2.6, 0.6, 0.6, "F");

            // Colored filled bar
            const fillWidth = Math.max(2, (item.count / incompleteCount) * barTrackMaxW);
            doc.setFillColor(...item.color);
            doc.roundedRect(rightBoxX + 3, barY, fillWidth, 2.6, 0.6, 0.6, "F");

            // Value & Percentage Text next to bar
            doc.setFontSize(5.8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.text);
            doc.text(`${item.count} Items (${item.percentage}%)`, rightBoxX + 3 + barTrackMaxW + 2.5, barY + 2.1);

            barY += barRowH - 1.8;
        });

        // Dominant Root Cause Insight Box
        const topReason = reasonsToDisplay[0];
        if (topReason) {
            const insightY = currentY + chartBoxH - 5.8;
            const insightW = rightBoxW - 5;
            doc.setFillColor(...colors.incompleteBg);
            doc.setDrawColor(...colors.incompleteBorder);
            doc.setLineWidth(0.1);
            doc.roundedRect(rightBoxX + 2.5, insightY, insightW, 4.6, 0.8, 0.8, "FD");

            doc.setFontSize(5.2);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.incompleteRed);
            const insightText = `Primary Constraint: ${topReason.label} (${topReason.percentage}% of incomplete items)`;
            let visibleInsight = insightText;
            if (doc.getTextWidth(visibleInsight) > insightW - 4) {
                doc.setFontSize(4.7);
                if (doc.getTextWidth(visibleInsight) > insightW - 4) {
                    visibleInsight = `Primary: ${topReason.label} (${topReason.percentage}%)`;
                }
            }
            doc.text(visibleInsight, rightBoxX + 4.5, insightY + 3.1);
        }

        currentY += chartBoxH + 2.5;

        // ── 4. Inspection Type Breakdown Summary Strip ──────────────────────────
        const stripH = 4.8;
        doc.setFillColor(isPF ? 255 : 241, isPF ? 255 : 245, isPF ? 255 : 249);
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.15);
        doc.roundedRect(margin, currentY, contentWidth, stripH, 0.8, 0.8, "FD");

        doc.setFontSize(5.8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.navy);
        doc.text("INCOMPLETE BY TYPE:", margin + 2.5, currentY + 3.3);

        const typeBreakdownText = sortedGroups
            .map(g => `${g.name} (${g.code}): ${g.records.length} Items (${Math.round((g.records.length / incompleteCount) * 100)}%)`)
            .join("   |   ");

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.text);
        let visibleTypeBreakdown = typeBreakdownText;
        if (doc.getTextWidth(visibleTypeBreakdown) > contentWidth - 42) {
            visibleTypeBreakdown = sortedGroups
                .map(g => `${g.code}: ${g.records.length} (${Math.round((g.records.length / incompleteCount) * 100)}%)`)
                .join("  |  ");
        }
        doc.text(visibleTypeBreakdown, margin + 32, currentY + 3.3);

        currentY += stripH + 3.5;

        // ── 5. Detailed Tables (Grouped By Inspection Type) ─────────────────────
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
            const headerLabel = `INSPECTION TYPE: ${group.name.toUpperCase()} (${group.code})  —  TOTAL INCOMPLETE: ${groupTotalQIDs} ITEMS`;
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
                        if (!isPF && data.row.index % 2 === 1) {
                            data.cell.styles.fillColor = [248, 250, 252];
                        }
                    }
                },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) {
                        drawPageHeader(doc);
                    }
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
        const grandSummaryText = rovIncompleteCount > 0 && divingIncompleteCount > 0
            ? `TOTAL INCOMPLETE FLAGGED QIDS ACROSS ALL INSPECTION TYPES: ${totalAllIncomplete}  (ROV: ${rovIncompleteCount} | DIVING: ${divingIncompleteCount})`
            : `TOTAL INCOMPLETE FLAGGED QIDS ACROSS ALL INSPECTION TYPES: ${totalAllIncomplete}  (INSPECTION MODE: ${rovIncompleteCount > 0 ? "ROV" : "DIVING"})`;
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
