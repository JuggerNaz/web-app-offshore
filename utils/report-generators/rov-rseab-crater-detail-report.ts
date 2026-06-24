import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal } from "./shared-logo";
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
 * ROV Seabed Survey Crater Inspection Report (Portrait)
 * Columns: Item No. | QID | Dive No. | Tape No. | Findings
 *
 * Filtered by item category = Crater. Ordered by leg name and distance.
 */
export const generateROVRSEABCraterDetailReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    const supabase = createClient();
    console.log("[ROV Seabed Crater Detail Report] Starting generation", { recordsCount: records?.length, hasHeader: !!headerData, config });
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
        };

        // ── Filter Records (Strict Seabed Filter: RSEAB + Crater category only) ──
        const filteredRecords = records.filter(r => {
            const typeCode = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
            if (typeCode !== 'RSEAB') return false;
            const cat = (r.inspection_data?.category || r.inspection_data?.type || '').toLowerCase();
            const desc = (r.description || '').toLowerCase();
            return cat === 'crater' || desc.startsWith('crater') || desc.startsWith('seabed crater');
        });

        // ── Pre-load logos ──
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

            if (companyLogo) drawLogo(d, companyLogo, 18, 18, pageWidth - margin - 22, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 18, 18, margin + 4, margin + 3, "left", "center");

            d.setFontSize(9); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Division", margin + contentWidth / 2, margin + 10, { align: "center" });
            d.setFontSize(13); d.setFont("helvetica", "bold");
            d.text("Seabed Survey Crater Inspection Report (ROV)", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        const ROW_H = 7;
        const drawContextRow = (d: jsPDF, startY: number, groupRecords: any[]) => {
            const isPF = config.printFriendly;
            const half = contentWidth / 2;

            // Date range for this group
            let startDate: Date | null = null;
            let endDate: Date | null = null;
            if (groupRecords.length > 0) {
                const dates = groupRecords
                    .map(r => new Date(r.cr_date || r.created_at))
                    .filter(d => !isNaN(d.getTime()));
                if (dates.length > 0) {
                    startDate = min(dates);
                    endDate = max(dates);
                }
            }
            const dateStr = startDate && endDate
                ? `${format(startDate, "dd MMM yyyy")} - ${format(endDate, "dd MMM yyyy")}`
                : "N/A";

            const drawBox = (label: string, value: string, x: number, y: number, w: number) => {
                d.setDrawColor(...colors.border);
                d.setLineWidth(0.1);
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, y, w, ROW_H, isPF ? "S" : "F");
                d.rect(x, y, w, ROW_H, "S");

                d.setTextColor(...colors.text);
                d.setFontSize(7.5);
                d.setFont("helvetica", "bold");
                d.text(label, x + 2.5, y + 4.8);
                d.setFont("helvetica", "normal");
                d.text(String(value), x + 35, y + 4.8);
            };

            drawBox("Structure:", headerData.platformName || "N/A", margin, startY, half);
            drawBox("Vessel:", headerData.vessel || "N/A", margin + half, startY, half);
            drawBox("Job Pack:", headerData.jobpackName || "N/A", margin, startY + ROW_H, half);
            drawBox("Date Range:", dateStr, margin + half, startY + ROW_H, half);

            return startY + ROW_H * 2 + 3;
        };

        const drawFooter = (d: jsPDF, pageNum: number, totalPages: number) => {
            const footerY = pageHeight - 10;
            d.setDrawColor(...colors.border);
            d.setLineWidth(0.1);
            d.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

            d.setFontSize(7);
            d.setTextColor(...colors.text);
            d.setFont("helvetica", "bold");
            d.text("CONFIDENTIAL", margin, footerY);

            d.setFont("helvetica", "normal");
            d.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
            d.text(`Structure: ${headerData.platformName || "N/A"}`, margin + 35, footerY);
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`, margin + 85, footerY);
        };

        drawPageHeader(doc);

        let currentY = margin + HEADER_H + 4;
        currentY = drawContextRow(doc, currentY, filteredRecords);

        // Helper to extract legs and distance from QID
        const parseQid = (q: string) => {
            const match = q.match(/S\/BED\(([^)]+)\)-(\d+)M/i);
            if (match) {
                return { legs: match[1].trim(), distance: parseInt(match[2], 10) };
            }
            const fallbackMatch = q.match(/\(([^)]+)\)[^\d]*(\d+)/);
            if (fallbackMatch) {
                return { legs: fallbackMatch[1].trim(), distance: parseInt(fallbackMatch[2], 10) };
            }
            return { legs: q, distance: 0 };
        };

        // Sort records by leg name and distance value
        const sortedRecords = [...filteredRecords].sort((a, b) => {
            const qA = (a.structure_components?.q_id || a.qid || '').toUpperCase();
            const qB = (b.structure_components?.q_id || b.qid || '').toUpperCase();
            
            const parsedA = parseQid(qA);
            const parsedB = parseQid(qB);
            
            const legCompare = parsedA.legs.localeCompare(parsedB.legs, undefined, { numeric: true, sensitivity: 'base' });
            if (legCompare !== 0) return legCompare;
            
            return parsedA.distance - parsedB.distance;
        });

        // Map records to autoTable RowInput[]
        const tableRows = sortedRecords.map((r, rIdx) => {
            const comp = r.structure_components || {};
            const d = r.inspection_data || {};
            const anoms = r.insp_anomalies || [];
            const isAnom = anoms.length > 0;

            // Dive & Tape No
            const diveNo = r.insp_rov_jobs?.job_no || r.dive_no || "—";
            const tapeNo = r.insp_video_tapes?.tape_no || r.tape_no || d.tape_no || r.tape_id || "—";

            // Format Findings
            let findings = r.description || d.findings || "No significant findings";
            
            if (anoms.length > 0) {
                findings += `\n` + anoms.map((a: any) => `[Anom Ref: ${a.ref_no || a.anomaly_ref_no || "N/A"}]${a.is_rectified ? `\n(Rectified: ${a.rect_comments || ""})` : ""}`).join("\n");
            }

            return [
                { content: String(rIdx + 1), styles: { halign: "center" as const } },
                { content: comp.q_id || r.qid || "—" },
                { content: String(diveNo), styles: { halign: "center" as const } },
                { content: String(tapeNo), styles: { halign: "center" as const } },
                { content: findings, styles: { textColor: isAnom ? colors.anomaly : colors.text } }
            ];
        });

        autoTable(doc, {
            startY: currentY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 6 },
            head: [
                [
                    { content: "Item No.", styles: { halign: "center" as const } },
                    { content: "QID" },
                    { content: "Dive No.", styles: { halign: "center" as const } },
                    { content: "Tape No.", styles: { halign: "center" as const } },
                    { content: "Findings" }
                ]
            ],
            body: tableRows,
            theme: "grid",
            headStyles: { fillColor: colors.navy, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
            styles: { fontSize: 7.5, cellPadding: 2.5 },
            columnStyles: {
                0: { cellWidth: 12 }, // Item No.
                1: { cellWidth: 42 }, // QID
                2: { cellWidth: 18 }, // Dive No.
                3: { cellWidth: 38 }, // Tape No.
                4: { cellWidth: "auto" } // Findings
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);
            }
        });

        const finalY = (doc as any).lastAutoTable?.finalY ?? (margin + HEADER_H + 20);
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                drawPageHeader(doc);
                sigY = pageHeight - 38;
            }
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number) => {
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
                doc.setTextColor(...colors.text); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
                doc.text("Name:", lx + 2, sigY + 10);
                doc.text("Date:", lx + 2, sigY + 13.5);
                doc.text("Signature:", lx + 2, sigY + 17);
            };

            drawSig('PREPARED BY', margin);
            drawSig('REVIEWED BY', margin + sigW);
            drawSig('APPROVED BY', margin + (sigW * 2));
        }

        // --- Finalize Page Numbers ---
        const totalPages = doc.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            drawFooter(doc, j, totalPages);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Seabed_Survey_Crater_Inspection_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (e) {
        console.error("ROV Seabed Crater Detail Report Error", e);
        throw e;
    }
};
