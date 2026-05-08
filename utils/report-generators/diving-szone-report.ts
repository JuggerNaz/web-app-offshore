import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo } from "./shared-logo";

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
 * Diving Splashzone Inspection Report (SZONE) — Portrait
 * 
 * Columns: Item No. | QID | CP reading | Wall Thickness (3,6,9,12) | Nominal Thickness | Dive No. | Findings
 */
export const generateDivingSZONEReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig,
    supabase: any
): Promise<Blob | void> => {
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

        // ── Date range ──────────────────────────────────────────────────────────
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (records.length > 0) {
            const dates = records
                .map(r => new Date(r.cr_date || r.created_at))
                .filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) { startDate = min(dates); endDate = max(dates); }
        }
        const dateRangeStr = startDate && endDate
            ? `${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}`
            : "N/A";

        const HEADER_H = 24;

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

            if (companyLogo) drawLogo(d, companyLogo, 18, 18, pageWidth - margin - 22, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 18, 18, margin + 4, margin + 3, "left", "center");

            d.setFontSize(9); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Inspection Division", margin + contentWidth / 2, margin + 10, { align: "center" });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text("Diving Splashzone Inspection Report", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });
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
            drawBox("Structure:", headerData.platformName || "N/A", margin, half, y);
            drawBox("Vessel:", headerData.vessel || "N/A", margin + half, half, y);
            drawBox("Job Pack:", headerData.jobpackName || "N/A", margin, half, y + ROW_H);
            drawBox("Insp. Date Range:", dateRangeStr, margin + half, half, y + ROW_H);
            return y + ROW_H * 2 + 4;
        };

        // ── Build each table row ────────────────────────────────────────────────
        const sorted = [...records].sort((a, b) => {
            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elB - elA;
        });

        const isPF = config.printFriendly;

        const buildRow = (r: any, idx: number): string[] => {
            const d = r.inspection_data || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || "N/A";
            
            const cp = d.cp_rdg ?? d.cp ?? "—";
            const ut3 = d.ut_3_o_clock ?? "—";
            const ut6 = d.ut_6_o_clock ?? "—";
            const ut9 = d.ut_9_o_clock ?? "—";
            const ut12 = d.ut_12_o_clock ?? "—";
            
            // Robust nominal thickness and unit
            const ntVal = d.nominal_thickness || 
                          r.structure_components?.metadata?.nominal_thickness || 
                          r.structure_components?.metadata?.nom_thick || 
                          "—";
            const utUnit = d.ut_unit || 
                           r.structure_components?.metadata?.ut_unit || 
                           "mm";
            
            const nt = ntVal !== "—" ? `${ntVal} ${utUnit}` : "—";

            const diveNo =
                r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.dive_job_id || "—";

            const parts: string[] = [];
            if (r.description?.trim()) parts.push(r.description.trim());

            // Append additional CP readings
            const addCP = d.cp_rdg_additional || [];
            if (Array.isArray(addCP) && addCP.length > 0) {
                addCP.forEach((item: any) => {
                    if (item.reading) {
                        parts.push(`Add. CP: ${item.reading}mV${item.location ? ` (${item.location})` : ""}`);
                    }
                });
            }

            // Append additional UT readings
            const addUT = d.ut_readings_additional || [];
            if (Array.isArray(addUT) && addUT.length > 0) {
                addUT.forEach((item: any) => {
                    if (item.reading) {
                        parts.push(`Add. UT: ${item.reading}mm${item.location ? ` (${item.location})` : ""}`);
                    }
                });
            }

            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || "";
            if (anomRef) parts.push(`Anomaly Ref: ${anomRef}`);

            const isRectified = linkedAnom?.is_rectified || r.rectified || false;
            if (isRectified) {
                const rectComments = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                parts.push(`Rectified Comments: ${rectComments}`);
            }

            return [
                String(idx + 1),
                qid,
                String(cp),
                String(ut3),
                String(ut6),
                String(ut9),
                String(ut12),
                String(nt),
                String(diveNo),
                parts.length > 0 ? parts.join("\n") : "—",
            ];
        };

        // ── Draw ────────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin },
            head: [
                [
                    { content: "Item No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "QID", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "CP Reading\n(-mV)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Wall Thickness (mm) (o'clock)", colSpan: 4, styles: { halign: "center", valign: "middle" } },
                    { content: "Nominal\nThk (mm)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Dive No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    { content: "Findings", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                ],
                [
                    { content: "3", styles: { halign: "center" } },
                    { content: "6", styles: { halign: "center" } },
                    { content: "9", styles: { halign: "center" } },
                    { content: "12", styles: { halign: "center" } },
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
                lineColor: isPF ? colors.navy : colors.border,
                lineWidth: 0.3,
            },
            styles: {
                fontSize: 7,
                cellPadding: 1.5,
                textColor: colors.text,
                lineColor: isPF ? colors.navy : colors.border,
                lineWidth: 0.3,
                overflow: "linebreak",
            },
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 20 },
                2: { cellWidth: 16, halign: "center" },
                3: { cellWidth: 12, halign: "center" },
                4: { cellWidth: 12, halign: "center" },
                5: { cellWidth: 12, halign: "center" },
                6: { cellWidth: 12, halign: "center" },
                7: { cellWidth: 14, halign: "center" },
                8: { cellWidth: 16, halign: "center" },
                9: { cellWidth: "auto" },
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = sorted[data.row.index];
                const d = r.inspection_data || {};

                // 1. Highlight Minimum Wall Thickness
                const utCols = [3, 4, 5, 6];
                if (utCols.includes(data.column.index)) {
                    const ut3 = parseFloat(d.ut_3_o_clock);
                    const ut6 = parseFloat(d.ut_6_o_clock);
                    const ut9 = parseFloat(d.ut_9_o_clock);
                    const ut12 = parseFloat(d.ut_12_o_clock);
                    
                    const values = [ut3, ut6, ut9, ut12].filter(v => !isNaN(v));
                    if (values.length > 0) {
                        const minUT = Math.min(...values);
                        const cellVal = parseFloat(data.cell.text[0]);
                        if (!isNaN(cellVal) && cellVal === minUT) {
                            data.cell.styles.fillColor = [254, 243, 199]; // Light Amber background
                            data.cell.styles.textColor = [146, 64, 14];  // Darker Amber text
                            data.cell.styles.fontStyle = "bold";
                        }
                    }
                }

                // 2. Status Colors (Anomalies / Findings)
                const linkedAnom = r.insp_anomalies?.[0] ?? null;
                const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
                const isFinding = metaStatus === "finding";
                const isAnom = r.has_anomaly && !isFinding;
                const isRect = linkedAnom?.is_rectified || r.rectified || false;

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
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);

                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Diving Splashzone Inspection Report  |  SOW: ${headerData.sowReportNo || "N/A"}`,
                    margin, pageHeight - 6
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            },
        });

        // ── Calibration Data Retrieval ────────────────────────────────────────
        let calibRecords: any[] = [];
        
        if (supabase && config.structureId) {
            // Fetch all CPCLB/UTCLB for this structure — most reliable approach
            const { data, error } = await supabase
                .from('insp_records')
                .select(`
                    insp_id, 
                    dive_job_id, 
                    inspection_type_code, 
                    inspection_data,
                    insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name)
                `)
                .in('inspection_type_code', ['CPCLB', 'UTCLB'])
                .eq('structure_id', Number(config.structureId));
            
            if (error) {
                console.error('Calibration fetch error:', error);
            }
            calibRecords = data || [];
        } else {
            calibRecords = headerData.calibrationData || [];
        }

        const diveMap = new Map<string, any>();

        // Helper to extract a Dive Number for matching
        const getDiveNo = (record: any) => {
            if (!record) return null;
            // Try all possible dive number fields (job_no, dive_no, etc)
            return record.insp_dive_jobs?.job_no || record.insp_dive_jobs?.dive_no || record.dive_no || null;
        };

        // Identify which dives are part of this report by their number (e.g., "D001")
        const involvedDiveNos = new Set(records.map(r => getDiveNo(r)).filter(Boolean));

        // 1. First, pre-populate with involved dives from records
        involvedDiveNos.forEach(dno => {
            diveMap.set(dno, {
                dive_no: dno,
                ut: null,
                cp: null
            });
        });

        // 2. Then, fill with actual calibration records matching the same dive numbers
        calibRecords.forEach((cr: any) => {
            const dno = getDiveNo(cr);
            if (!dno || !involvedDiveNos.has(dno)) return;

            const entry = diveMap.get(dno);
            const type = String(cr.inspection_type_code || "").toUpperCase();
            if (type === "UTCLB") entry.ut = cr.inspection_data;
            if (type === "CPCLB") entry.cp = cr.inspection_data;
        });

        // 3. Build rows — use readings only as cell values
        const calibRows: any[] = [];
        // Collect UT labels from the first available UT calibration for dynamic headers
        let utLabels = ["", "", "", "", ""];
        for (const [, entry] of Array.from(diveMap.entries())) {
            if (entry.ut) {
                utLabels = [
                    entry.ut.label01 || "",
                    entry.ut.label02 || "",
                    entry.ut.label03 || "",
                    entry.ut.label04 || "",
                    entry.ut.label05 || "",
                ];
                break;
            }
        }

        for (const [dno, entry] of Array.from(diveMap.entries())) {
            if (involvedDiveNos.has(dno)) {
                const ut = entry.ut || {};
                const cp = entry.cp || {};

                calibRows.push([
                    entry.dive_no,
                    ut.calib_block || "—",
                    ut.serial_number || "—",
                    ut.reading01 || "—",
                    ut.reading02 || "—",
                    ut.reading03 || "—",
                    ut.reading04 || "—",
                    ut.reading05 || "—",
                    cp.calib_block || "—",
                    cp.serial_number || "—",
                    cp.pre_dive_cp_rdg || "—",
                    cp.post_dive_cp_rdg || "—",
                ]);
            }
        }

        // Always print the blocks if there are dives involved, even if no calib data was found
        if (involvedDiveNos.size > 0) {
            const calibHeadFill = isPF ? [255, 255, 255] as [number, number, number] : colors.navy;
            const calibHeadText = isPF ? colors.navy : [255, 255, 255] as [number, number, number];

            autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                margin: { left: margin, right: margin },
                head: [
                    [
                        { content: "", styles: { fillColor: calibHeadFill } },
                        { content: "UT CALIBRATION DATA", colSpan: 7, styles: { halign: "center", fillColor: calibHeadFill, textColor: calibHeadText } },
                        { content: "CP CALIBRATION DATA (-mV)", colSpan: 4, styles: { halign: "center", fillColor: calibHeadFill, textColor: calibHeadText } }
                    ],
                    [
                        "Dive No.:",
                        "Calib. Block", "Equip. Serial No.",
                        utLabels[0] || "—", utLabels[1] || "—", utLabels[2] || "—", utLabels[3] || "—", utLabels[4] || "—",
                        "Calib. Block", "Equip. Serial No.", "Pre", "Post"
                    ]
                ],
                body: calibRows,

                theme: "grid",
                headStyles: {
                    fillColor: calibHeadFill,
                    textColor: calibHeadText,
                    fontSize: 7,
                    fontStyle: "bold",
                    halign: "center",
                    valign: "middle",
                    lineColor: colors.border,
                    lineWidth: 0.2,
                },
                styles: {
                    fontSize: 6.5,
                    cellPadding: 2,
                    textColor: colors.text,
                    lineColor: colors.border,
                    lineWidth: 0.2,
                },
                columnStyles: {
                    0: { cellWidth: 18, halign: "center" },
                    1: { cellWidth: 22 },
                    2: { cellWidth: 22 },
                    3: { cellWidth: 11, halign: "center" },
                    4: { cellWidth: 11, halign: "center" },
                    5: { cellWidth: 11, halign: "center" },
                    6: { cellWidth: 11, halign: "center" },
                    7: { cellWidth: 11, halign: "center" },
                    8: { cellWidth: 22 },
                    9: { cellWidth: 22 },
                    10: { cellWidth: 12.5, halign: "center" },
                    11: { cellWidth: 12.5, halign: "center" },
                },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) drawPageHeader(doc);
                }
            });
        }


        if (config.showSignatures !== false) {
            const sigH = 20;
            const sigW = contentWidth / 3;
            let finalY = (doc as any).lastAutoTable?.finalY ?? (margin + HEADER_H + 20);

            // If not enough space for signature (sigH + margin), add new page
            if (finalY + sigH + 15 > pageHeight) {
                doc.addPage();
                drawPageHeader(doc);
                finalY = margin + HEADER_H + 10;
            }

            const sigY = pageHeight - 35; // Fixed position near bottom

            const drawSig = (label: string, lx: number) => {
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

            drawSig("PREPARED BY", margin);
            drawSig("REVIEWED BY", margin + sigW);
            drawSig("APPROVED BY", margin + sigW * 2);
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`Diving_SZONE_Report_${headerData.sowReportNo || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Diving SZONE Report] Error:", err);
        throw err;
    }
};
