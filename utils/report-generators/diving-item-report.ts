import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate } from "./shared-logo";

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
    watermarkText?: string;
}

/**
 * Item Inspection Report (Diving) — Portrait Mode
 * Specific for Inspection Type PL_IC
 * 
 * Columns: Item No. | QID | Elevation (m) | Dive No. | CP (-mV) | Type of Item | Description | Findings
 */
export const generateDivingItemReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
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

        // ── Filter to PL_IC records strictly if mixed ───────────────────────────
        const filteredRecords = (records || []).filter(r => {
            const code = String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase();
            return code === 'PL_IC' || code === 'ITEM' || code === '';
        });
        const targetRecords = filteredRecords.length > 0 ? filteredRecords : (records || []);

        // ── Date range calculation ──────────────────────────────────────────────
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (targetRecords.length > 0) {
            const dates = targetRecords
                .map(r => new Date(r.cr_date || r.created_at || r.inspection_date))
                .filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) {
                startDate = min(dates);
                endDate = max(dates);
            }
        }
        const dateRangeStr = startDate && endDate
            ? `${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}`
            : "N/A";

        const HEADER_H = 24;

        // ── Pre-load company and contractor logos ──────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings?.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData?.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        // ── Page Header Renderer ────────────────────────────────────────────────
        const drawPageHeader = (d: jsPDF) => {
            const isPF = config?.printFriendly;
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
            d.text(companySettings?.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings?.department_name || "Technical Inspection Division", margin + contentWidth / 2, margin + 10, { align: "center" });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text("Item Inspection Report (Diving)", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        // ── Subheader Context Box ───────────────────────────────────────────────
        const ROW_H = 7;
        const drawContextRow = (d: jsPDF, y: number) => {
            const isPF = config?.printFriendly;
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
            drawBox("Structure:", headerData?.platformName || "N/A", margin, half, y);
            drawBox("Vessel:", headerData?.vessel || "N/A", margin + half, half, y);
            drawBox("Job Pack:", headerData?.jobpackName || "N/A", margin, half, y + ROW_H);
            drawBox("Insp. Date Range:", dateRangeStr, margin + half, half, y + ROW_H);
            return y + ROW_H * 2 + 4;
        };

        // ── Build Table Rows ───────────────────────────────────────────────────
        const sorted = [...targetRecords].sort((a, b) => {
            const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
            const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
            return elB - elA; // Descending elevation
        });

        const isPF = config?.printFriendly;

        const buildRow = (r: any, idx: number): string[] => {
            const d = r.inspection_data || {};
            const comp = r.structure_components || r.component || {};
            const qid = comp.q_id || comp.qid || "N/A";
            
            // Elevation formatting with unit
            const rawElev = r.elevation ?? d.elevation;
            const elevation = (rawElev !== undefined && rawElev !== null && String(rawElev).trim() !== "") 
                ? (String(rawElev).toLowerCase().includes("m") ? String(rawElev) : `${rawElev} m`)
                : "—";

            // Dive No
            const diveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || r.dive_job_id || r.dive_no || "—";

            // Type of Item
            const itemType = d.item_type || d.type_of_item || r.item_type || "—";

            // Description
            const description = d.description || r.description || "—";

            // CP formatting (Primary + Additional stacked in CP column)
            const primaryCP = d.cp_rdg ?? d.cp_reading ?? d.cp_reading_mv ?? d.cp ?? "";
            const additionals = Array.isArray(d.cp_rdg_additional) 
                ? d.cp_rdg_additional 
                : (Array.isArray(d.cp_readings) ? d.cp_readings : []);

            const formattedPrimaryCP = (primaryCP !== "" && primaryCP !== null && primaryCP !== undefined)
                ? (String(primaryCP).toLowerCase().includes("mv") ? String(primaryCP) : `${primaryCP} mV`)
                : "";

            const additionalCPList = additionals
                .map((a: any) => a.reading ?? a.cp_rdg ?? "")
                .filter((val: any) => val !== "" && val !== null && val !== undefined)
                .map((val: any) => String(val).toLowerCase().includes("mv") ? String(val) : `${val} mV`);

            const allCPs = [formattedPrimaryCP, ...additionalCPList].filter(Boolean);
            const cpDisplay = allCPs.length > 0 ? allCPs.join("\n") : "—";

            // Findings column & Postfix handling
            const findingsParts: string[] = [];

            // 1) Main Remarks / Findings text from all possible field locations
            const mainFinding = 
                (typeof d.findings === 'string' && d.findings.trim()) ? d.findings.trim() :
                (typeof d.finding === 'string' && d.finding.trim()) ? d.finding.trim() :
                (typeof d.remarks === 'string' && d.remarks.trim()) ? d.remarks.trim() :
                (typeof r.remarks === 'string' && r.remarks.trim()) ? r.remarks.trim() :
                (typeof d.notes === 'string' && d.notes.trim()) ? d.notes.trim() :
                (typeof r.notes === 'string' && r.notes.trim()) ? r.notes.trim() :
                (typeof d.comments === 'string' && d.comments.trim()) ? d.comments.trim() :
                (typeof r.comments === 'string' && r.comments.trim()) ? r.comments.trim() :
                "";

            if (mainFinding) {
                findingsParts.push(mainFinding);
            } else if (r.description && typeof r.description === 'string' && r.description.trim() && r.description.trim() !== String(description).trim()) {
                findingsParts.push(r.description.trim());
            }

            // 2) Append full details of Additional CPs as postfix to Findings column
            additionals.forEach((a: any) => {
                const val = a.reading ?? a.cp_rdg ?? "";
                if ((val !== "" && val !== null && val !== undefined) || a.location) {
                    const loc = a.location ? ` @ ${a.location}` : "";
                    const unit = String(val).toLowerCase().includes("mv") || !val ? "" : " mV";
                    findingsParts.push(`Add. CP${loc}: ${val}${unit}`);
                }
            });

            // 3) Append Anomaly / Finding Reference No. if present
            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef = linkedAnom?.anomaly_ref_no || linkedAnom?.ref_no || r.anomaly_ref_no || "";
            if (anomRef) {
                findingsParts.push(`[Anom Ref: ${anomRef}]`);
            }

            // 4) Append Rectified comments if rectified
            const isRectified = linkedAnom?.is_rectified || r.rectified || false;
            if (isRectified) {
                const rectComments = linkedAnom?.rectified_remarks || r.rectified_comments || "N/A";
                findingsParts.push(`(Rectified: ${rectComments})`);
            }

            const findingsDisplay = findingsParts.length > 0 ? findingsParts.join("\n") : "No significant findings";

            return [
                String(idx + 1),
                qid,
                String(elevation),
                String(diveNo),
                cpDisplay,
                String(itemType),
                String(description),
                findingsDisplay
            ];
        };

        // ── Draw Document Body ────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 10 },
            head: [[
                { content: "Item\nNo.", styles: { halign: "center", valign: "middle" } },
                { content: "QID", styles: { halign: "center", valign: "middle" } },
                { content: "Elevation\n(m)", styles: { halign: "center", valign: "middle" } },
                { content: "Dive No.", styles: { halign: "center", valign: "middle" } },
                { content: "CP\n(-mV)", styles: { halign: "center", valign: "middle" } },
                { content: "Type of Item", styles: { halign: "center", valign: "middle" } },
                { content: "Description", styles: { halign: "center", valign: "middle" } },
                { content: "Findings", styles: { halign: "center", valign: "middle" } },
            ]],
            body: sorted.map(buildRow),
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 7.5,
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
                0: { cellWidth: 10, halign: "center" },  // Item No.
                1: { cellWidth: 20 },                     // QID
                2: { cellWidth: 16, halign: "center" },   // Elevation
                3: { cellWidth: 16, halign: "center" },   // Dive No.
                4: { cellWidth: 18, halign: "center" },   // CP
                5: { cellWidth: 22 },                     // Type of Item
                6: { cellWidth: 32 },                     // Description
                7: { cellWidth: "auto" },                 // Findings
            },
            didParseCell: (data) => {
                if (data.section !== "body") return;
                const r = sorted[data.row.index];
                if (!r) return;
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
                    `${companySettings?.company_name || "NasQuest Resources Sdn Bhd"}  |  Item Inspection Report (Diving)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
                    margin, pageHeight - 6
                );
                if (config?.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            },
        });

        // ── Signatory Section Footer ──────────────────────────────────────────
        if (config?.showSignatures !== false) {
            const sigH = 20;
            const sigW = contentWidth / 3;
            let finalY = (doc as any).lastAutoTable?.finalY ?? (margin + HEADER_H + 20);

            if (finalY + sigH + 15 > pageHeight) {
                doc.addPage();
                drawPageHeader(doc);
                finalY = margin + HEADER_H + 10;
            }

            const sigY = pageHeight - 35; // Fixed position near bottom

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
        if (config?.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`Diving_Item_Inspection_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
        console.error("[Item Inspection (Diving) Report] Error:", err);
        throw err;
    }
};
