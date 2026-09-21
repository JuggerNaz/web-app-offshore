import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate } from "./shared-logo";
import { createClient } from "@/utils/supabase/client";

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

interface ReportConfig {
    reportNoPrefix?: string;
    printFriendly?: boolean;
    jobPackId?: number | string;
    structureId?: number | string;
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

/**
 * Filter helper for Diving CP Survey records (CPSURV)
 */
export const isDivingCPSURVRecord = (r: any): boolean => {
    if (!r) return false;

    // Exclude if explicitly ROV job without dive job
    if (r.rov_job_id && !r.dive_job_id) return false;
    if (r.insp_rov_jobs && !r.insp_dive_jobs && !r.dive_job_id) return false;

    const method = String(r.insp_method || r.inspection_method || r.method || r.mode || "").toUpperCase();
    if (method === "ROV") return false;

    const code = String(
        r.inspection_type?.code ||
        r.inspection_type_code ||
        r.inspection_data?.insp_type ||
        r.inspection_data?.INSP_TYPE ||
        ""
    ).toUpperCase();

    if (["CPSURV", "DCPSURV", "CPSURV_DIVE", "CPINS", "PIPECP", "CP"].includes(code)) {
        return true;
    }

    if (code.startsWith("D") && (code.includes("CP") || code.includes("SURV"))) {
        return true;
    }

    // Check inspection data presence of CP readings for diving
    const d = r.inspection_data || r.inspection_dat || {};
    const hasCP = d.cp_rdg !== undefined || d.cp_reading_mv !== undefined || d.cp !== undefined || d.cp_value !== undefined;
    if (hasCP && (r.dive_job_id || r.insp_dive_jobs || method === "DIVING" || method === "DIVE" || !r.rov_job_id)) {
        return true;
    }

    return false;
};

/**
 * Diving CP Survey Report (CPSURV) — Landscape
 *
 * Header: Dual logos, Company Info, Report Title, Report No.
 * Table Group Headers: Item No. | QID | Elevation (m) | Dive No. | Equipment / Serial No. | Cathodic Potential (mV) [Pre Dive (mV) | Post Dive (mV) | CP Value (mV)] | Findings
 */
export const generateDivingCPSURVReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    if ((!records || records.length === 0) && config.returnBlob && !config.isBlankReport) {
        return null;
    }

    try {
        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth  = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin       = 12;
        const contentWidth = pageWidth - margin * 2;

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

        // ── Fetch CPCLB Calibration Map for matching Dive No ───────────────────
        const cpclbMap = new Map<string, { preDive: string; postDive: string; equipment: string }>();

        if (!config.isBlankReport) {
            try {
                const supabase = createClient();
                let query = supabase.from("insp_records").select(`
                    *,
                    inspection_type:inspection_type_id!left(id, code, name),
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name)
                `);

                const structId = config?.structureId || headerData?.structureId;
                const jpId = config?.jobPackId || headerData?.jobPackId;
                if (structId) query = query.eq("structure_id", Number(structId));
                if (jpId) query = query.eq("jobpack_id", Number(jpId));

                const { data: cpclbData } = await query;
                if (cpclbData) {
                    for (const cr of cpclbData) {
                        const code = String(cr.inspection_type?.code || cr.inspection_type_code || "").toUpperCase();
                        if (code === "CPCLB" || code === "DCPCLB") {
                            const cd = cr.inspection_data || cr.inspection_dat || {};
                            const pre = cd.pre_dive_cp_rdg ?? cd.pre_dive ?? cd.pre_dive_reading ?? cd.pre_dive_cp ?? cd.PRE_DIVE ?? "";
                            const post = cd.post_dive_cp_rdg ?? cd.post_dive ?? cd.post_dive_reading ?? cd.post_dive_cp ?? cd.POST_DIVE ?? "";
                            const eqType = cd.calib_equipment_type || cd.equipment_type || cd.equipment || "";
                            const sNo = cd.serial_number || cd.serial_no || "";
                            const eqStr = eqType && sNo ? `${eqType} / ${sNo}` : (eqType || sNo || "");

                            const dNo = String(cr.insp_dive_jobs?.job_no || cr.insp_dive_jobs?.name || cr.dive_job_id || cd.dive_no || cd.DIVE_NO || "").trim();
                            const dId = cr.dive_job_id ? String(cr.dive_job_id) : "";

                            const entry = {
                                preDive: pre !== "" ? (String(pre).toLowerCase().includes("mv") ? String(pre) : `${pre} mV`) : "",
                                postDive: post !== "" ? (String(post).toLowerCase().includes("mv") ? String(post) : `${post} mV`) : "",
                                equipment: eqStr
                            };

                            if (dNo) cpclbMap.set(dNo.toLowerCase(), entry);
                            if (dId) cpclbMap.set(dId, entry);
                        }
                    }
                }
            } catch (err) {
                console.warn("[Diving CPSURV Report] Could not load CPCLB reference records:", err);
            }
        }

        // ── Date range ──────────────────────────────────────────────────────────
        let startDate: Date | null = null;
        let endDate:   Date | null = null;
        if (records.length > 0) {
            const dates = records
                .map(r => new Date(r.cr_date || r.created_at))
                .filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) { startDate = min(dates); endDate = max(dates); }
        }
        const dateRangeStr = startDate && endDate
            ? `${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}`
            : "N/A";

        const HEADER_H = 26;

        // ── Pre-load logos ──────────────────────────────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        // ── Synchronous page header ─────────────────────────────────────────────
        const drawPageHeader = (d: jsPDF) => {
            const isPF = config.printFriendly;
            if (isPF) {
                d.setDrawColor(...colors.navy); d.setLineWidth(0.5);
                d.rect(margin, margin, contentWidth, HEADER_H, "S");
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy);
                d.rect(margin, margin, contentWidth, HEADER_H, "F");
                d.setTextColor(255);
            }

            if (companyLogo)    drawLogo(d, companyLogo, 16, 16, pageWidth - margin - 20, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 16, 16, margin + 4, margin + 3, "left",  "center");

            d.setFontSize(11); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + (contentWidth / 2), margin + 6,  { align: "center" });
            d.setFontSize(8.5); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Inspection Division", margin + (contentWidth / 2), margin + 10.5, { align: "center" });
            d.setFontSize(11); d.setFont("helvetica", "bold");
            d.text("CP Survey Report (Diving)", margin + (contentWidth / 2), margin + 16.5, { align: "center" });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin + (contentWidth / 2), margin + 21, { align: "center" });
        };

        // ── Context boxes ───────────────────────────────────────────────────────
        const ROW_H = 7;
        const drawContextRow = (d: jsPDF, y: number) => {
            const isPF = config.printFriendly;
            const half = contentWidth / 2;
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1);
                if (!isPF) { d.setFillColor(...colors.lightGray); d.rect(x, ty, w, ROW_H, "F"); }
                d.rect(x, ty, w, ROW_H, "S");
                d.setTextColor(...colors.text);
                d.setFontSize(7.5); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4.8);
                d.setFont("helvetica", "normal");
                d.text(String(value), x + 36, ty + 4.8);
            };
            drawBox("Structure:",        headerData.platformName || "N/A", margin,       half, y);
            drawBox("Vessel:",           headerData.vessel       || "N/A", margin + half, half, y);
            drawBox("Job Pack:",         headerData.jobpackName  || "N/A", margin,       half, y + ROW_H);
            drawBox("Insp. Date Range:", dateRangeStr,                     margin + half, half, y + ROW_H);
            return y + ROW_H * 2 + 4;
        };

        // ── Sort records by elevation (top → bottom) ───────────────────────────
        const sorted = [...records].sort((a, b) => {
            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elB - elA;
        });

        const isPF = config.printFriendly;

        // ── Build each table row ────────────────────────────────────────────────
        const buildRow = (r: any, idx: number): string[] => {
            if (config.isBlankReport) {
                return [String(idx + 1), "", "", "", "", "", "", "", ""];
            }

            const d   = r.inspection_data || r.inspection_dat || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || d.qid || d.component_qid || "N/A";
            const elevation = r.elevation ?? d.elevation ?? "—";

            const diveNo =
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.name ||
                d.dive_no || d.DIVE_NO || r.dive_job_id || "—";

            // Lookup matching CPCLB calibration entry
            const matchedCpclb =
                cpclbMap.get(String(diveNo).toLowerCase()) ||
                (r.dive_job_id ? cpclbMap.get(String(r.dive_job_id)) : null);

            // Equipment or Serial No
            const eqType = d.calib_equipment_type || d.equipment_type || d.equipment_no || d.equipment || "";
            const sNo = d.serial_number || d.serial_no || d.probe_no || "";
            let equipmentOrSerial = eqType && sNo ? `${eqType} / ${sNo}` : (eqType || sNo || "");
            if (!equipmentOrSerial && matchedCpclb?.equipment) {
                equipmentOrSerial = matchedCpclb.equipment;
            }
            if (!equipmentOrSerial) equipmentOrSerial = "—";

            // Pre-Dive CP
            let preDive = matchedCpclb?.preDive || "";
            if (!preDive) {
                const directPre = d.pre_dive_cp_rdg ?? d.pre_dive ?? d.pre_dive_reading ?? d.pre_dive_cp ?? d.PRE_DIVE ?? "";
                if (directPre !== "" && directPre !== null && directPre !== undefined) {
                    preDive = String(directPre).toLowerCase().includes("mv") ? String(directPre) : `${directPre} mV`;
                }
            }
            if (!preDive) preDive = "—";

            // Post-Dive CP
            let postDive = matchedCpclb?.postDive || "";
            if (!postDive) {
                const directPost = d.post_dive_cp_rdg ?? d.post_dive ?? d.post_dive_reading ?? d.post_dive_cp ?? d.POST_DIVE ?? "";
                if (directPost !== "" && directPost !== null && directPost !== undefined) {
                    postDive = String(directPost).toLowerCase().includes("mv") ? String(directPost) : `${directPost} mV`;
                }
            }
            if (!postDive) postDive = "—";

            // Primary & Additional CP Values
            const primaryCP = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? d.cp_value ?? d.CP ?? d.potential ?? "";
            const additionals: any[] = Array.isArray(d.cp_rdg_additional)
                ? d.cp_rdg_additional
                : (Array.isArray(d.cp_readings) ? d.cp_readings : []);

            const additionalCPs = additionals
                .map((a: any) => a.reading ?? a.cp_rdg ?? a.value ?? "")
                .filter((val: any) => val !== "" && val !== null && val !== undefined);

            const cpList = [primaryCP, ...additionalCPs].filter((val: any) => val !== "" && val !== null && val !== undefined);
            const cpDisplay = cpList.length > 0
                ? cpList.map((val: any) => String(val).toLowerCase().includes("mv") ? String(val) : `${val} mV`).join("\n")
                : "—";

            // Findings Column: Description + Additional CP postfix details + Anomaly/Finding ref + Rectification
            const findingsParts: string[] = [];

            // 1. Description / Findings text
            if (r.description && r.description.trim()) {
                findingsParts.push(r.description.trim());
            }

            // 2. Postfix with full additional CP details
            additionals.forEach((a: any) => {
                const val = a.reading ?? a.cp_rdg ?? a.value ?? "";
                if ((val !== "" && val !== null && val !== undefined) || a.location) {
                    const loc = a.location ? ` @ ${a.location}` : "";
                    const unit = String(val).toLowerCase().includes("mv") || !val ? "" : " mV";
                    findingsParts.push(`Add. CP${loc}: ${val}${unit}`);
                }
            });

            // 3. Anomaly / Finding Reference
            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
            if (anomRef) {
                const isFindingRef = anomRef.toUpperCase().includes("F") && !anomRef.toUpperCase().includes("A");
                findingsParts.push(`${isFindingRef ? "Finding Ref" : "Anomaly Ref"}: ${anomRef}`);
            }

            // 4. Rectification Comments
            const isRectified = linkedAnom?.is_rectified || r.rectified || false;
            if (isRectified) {
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                findingsParts.push(`Rectified Comments: ${rectRem}`);
            }

            return [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                equipmentOrSerial,
                preDive,
                postDive,
                cpDisplay,
                findingsParts.length > 0 ? findingsParts.join("\n") : "—",
            ];
        };

        // ── Draw ────────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 10 },
            head: [
                [
                    { content: "Item\nNo.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Component\nQID", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Elevation\n(m)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Dive No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Equipment /\nSerial No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Cathodic Potential (mV)", colSpan: 3, styles: { halign: "center", valign: "middle" } },
                    { content: "Findings", rowSpan: 2, styles: { halign: "center", valign: "middle" } }
                ],
                [
                    { content: "Pre Dive\n(mV)", styles: { halign: "center", valign: "middle" } },
                    { content: "Post Dive\n(mV)", styles: { halign: "center", valign: "middle" } },
                    { content: "CP Value\n(mV)", styles: { halign: "center", valign: "middle" } }
                ]
            ],
            body: sorted.map(buildRow),
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 7.5,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                minCellHeight: 7,
                lineColor: colors.border,
                lineWidth: 0.1,
            },
            styles: {
                fontSize: 7,
                cellPadding: 2,
                textColor: colors.text,
                lineColor: colors.border,
                lineWidth: 0.1,
                overflow: "linebreak",
                halign: "center",
                valign: "middle",
            },
            columnStyles: {
                0: { cellWidth: 12, halign: "center" },
                1: { cellWidth: 28, halign: "left" },
                2: { cellWidth: 20, halign: "center" },
                3: { cellWidth: 20, halign: "center" },
                4: { cellWidth: 34, halign: "center" },
                5: { cellWidth: 22, halign: "center" },
                6: { cellWidth: 22, halign: "center" },
                7: { cellWidth: 24, halign: "center" },
                8: { cellWidth: "auto", halign: "left" },
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = sorted[data.row.index];
                if (!r) return;

                const linkedAnom = r.insp_anomalies?.[0] ?? null;
                const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
                const isFinding  = metaStatus === "finding";
                const isAnom     = (r.has_anomaly === true || r.is_anomaly === true || !!linkedAnom) && !isFinding;
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
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);

                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  CP Survey Report (Diving)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
                    margin, pageHeight - 6
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            },
        });

        // ── Signatures ──────────────────────────────────────────────────────────
        if (config.showSignatures !== false) {
            const sigH   = 20;
            const sigW   = contentWidth / 3;
            let finalY   = (doc as any).lastAutoTable?.finalY ?? (margin + HEADER_H + 20);

            if (finalY + sigH + 15 > pageHeight) {
                doc.addPage();
                drawPageHeader(doc);
                finalY = margin + HEADER_H + 10;
            }

            const sigY = pageHeight - 35;

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
        doc.save(`Diving_CP_Survey_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving CPSURV Report] Error:", err);
        throw err;
    }
};
