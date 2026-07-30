import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal } from "./shared-logo";

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
 * Platform Inspection Summary Report — Executive Portrait
 * 
 * Includes:
 * 1. Standard Header & Footer with logos, SOW Report No, Job Pack, Platform Title & Vessel.
 * 2. Scope of Work (SOW) Progress Summary & Status Distribution.
 * 3. Inspection Type & Mode Breakdown (ROV vs Diver).
 * 4. Component Group Matrix Breakdown (SOW tasks vs Completed inspections).
 * 5. Structural Anomalies & Findings Summary table.
 * 6. Standard Signatures Block.
 */
export const generatePlatformInspectionSummaryReport = async (
    summaryData: any,
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth  = doc.internal.pageSize.getWidth(); // 210mm
        const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
        const margin       = 12;
        const contentWidth = pageWidth - margin * 2; // 186mm

        const colors = {
            navy:      [31,  55,  93]  as [number, number, number],
            teal:      [20,  184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border:    [203, 213, 225] as [number, number, number],
            text:      [30,  41,  59]  as [number, number, number],
            emerald:   [16,  185, 129] as [number, number, number],
            amber:     [245, 158, 11]  as [number, number, number],
            red:       [220, 38,  38]  as [number, number, number],
        };

        const HEADER_H = 24;

        // ── Pre-load logos ──────────────────────────────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings?.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData?.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        // ── Synchronous Page Header ─────────────────────────────────────────────
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

            if (companyLogo)    drawLogo(d, companyLogo,    18, 18, pageWidth - margin - 22, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 18, 18, margin + 4,              margin + 3, "left",  "center");

            d.setFontSize(9);   d.setFont("helvetica", "bold");
            d.text(companySettings?.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6,  { align: "center" });
            d.setFontSize(7);   d.setFont("helvetica", "normal");
            d.text(companySettings?.department_name || "Technical Inspection Division",  margin + contentWidth / 2, margin + 10, { align: "center" });
            d.setFontSize(12);  d.setFont("helvetica", "bold");
            d.text("Platform Inspection Summary Report",                             margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.sowReportNo || headerData?.sowReportNo) || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });
        };

        // ── Context Header Grid ───────────────────────────────────────────────────
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
                d.text(String(value), x + 34, ty + 4.8);
            };

            drawBox("Structure Title:", headerData?.platformName || "N/A", margin,        half - 1, y);
            drawBox("Job Pack Ref:",    headerData?.jobpackName  || "N/A", margin + half + 1, half - 1, y);
            drawBox("SOW Report No:",   headerData?.sowReportNo  || "N/A", margin,        half - 1, y + ROW_H);
            drawBox("Vessel / Support:",headerData?.vessel       || "N/A", margin + half + 1, half - 1, y + ROW_H);
        };

        // Render Page 1 Header & Context
        drawPageHeader(doc);
        drawContextRow(doc, margin + HEADER_H + 2);

        let currentY = margin + HEADER_H + 2 + (ROW_H * 2) + 6;

        // ── SECTION 1: Scope of Work Progress Overview ───────────────────────────
        doc.setFillColor(...colors.navy);
        doc.rect(margin, currentY, contentWidth, 6, "F");
        doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
        doc.text("1. SCOPE OF WORK (SOW) OVERVIEW & PROGRESS", margin + 3, currentY + 4.2);
        currentY += 8;

        const sow = summaryData?.sow || { total: 0, completed: 0, incomplete: 0, pending: 0, completionPct: 0 };
        const rec = summaryData?.records || { total: 0, completed: 0, incomplete: 0, anomaly: 0, finding: 0, rovCount: 0, diveCount: 0 };

        (autoTable as any)(doc, {
            startY: currentY,
            margin: { left: margin, right: margin },
            head: [["Total Planned SOW Tasks", "Completed Tasks", "Incomplete / In Progress", "Pending Scope", "Overall SOW Progress"]],
            body: [[
                String(sow.total || 0),
                `${sow.completed || 0} (${Math.round((sow.completed / (sow.total || 1)) * 100)}%)`,
                `${sow.incomplete || 0} (${Math.round((sow.incomplete / (sow.total || 1)) * 100)}%)`,
                `${sow.pending || 0} (${Math.round((sow.pending / (sow.total || 1)) * 100)}%)`,
                `${sow.completionPct || 0}%`
            ]],
            theme: "plain",
            styles: { fontSize: 8, cellPadding: 3, halign: "center", textColor: colors.text },
            headStyles: { fillColor: colors.lightGray, textColor: colors.navy, fontStyle: "bold", lineWidth: 0.1, drawColor: colors.border },
            bodyStyles: { lineWidth: 0.1, drawColor: colors.border }
        });
        currentY = (doc as any).lastAutoTable.finalY + 6;

        // ── SECTION 2: Inspection Mode & Type Summary ────────────────────────────
        doc.setFillColor(...colors.navy);
        doc.rect(margin, currentY, contentWidth, 6, "F");
        doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
        doc.text("2. INSPECTION RECORDS & METHODOLOGY BREAKDOWN", margin + 3, currentY + 4.2);
        currentY += 8;

        const inspTypeBreakdown = rec.inspTypeBreakdown || {};
        const inspTypeRows = Object.entries(inspTypeBreakdown).map(([code, val]: [string, any]) => [
            code,
            val.name || code,
            String(val.count || 0),
            String(val.rov || 0),
            String(val.dive || 0),
            String(val.anomaly || 0),
            String(val.finding || 0)
        ]);

        if (inspTypeRows.length === 0) {
            inspTypeRows.push(["N/A", "No specific inspection records logged for this SOW report", "0", "0", "0", "0", "0"]);
        }

        (autoTable as any)(doc, {
            startY: currentY,
            margin: { left: margin, right: margin },
            head: [["Type Code", "Inspection Description", "Total Logged", "ROV Mode", "Diver Mode", "Anomalies", "Findings"]],
            body: inspTypeRows,
            theme: "plain",
            styles: { fontSize: 7.5, cellPadding: 2.5, textColor: colors.text },
            headStyles: { fillColor: colors.lightGray, textColor: colors.navy, fontStyle: "bold", lineWidth: 0.1, drawColor: colors.border },
            columnStyles: {
                0: { fontStyle: "bold", halign: "center", cellWidth: 20 },
                1: { cellWidth: 70 },
                2: { halign: "center" },
                3: { halign: "center" },
                4: { halign: "center" },
                5: { halign: "center", textColor: colors.red, fontStyle: "bold" },
                6: { halign: "center" }
            },
            bodyStyles: { lineWidth: 0.1, drawColor: colors.border }
        });
        currentY = (doc as any).lastAutoTable.finalY + 6;

        // ── SECTION 3: Component Group Matrix Breakdown (Grouped Pivot Tables) ────
        if (currentY + 45 > pageHeight - 25) {
            doc.addPage();
            drawPageHeader(doc);
            currentY = margin + HEADER_H + 6;
        }

        doc.setFillColor(...colors.navy);
        doc.rect(margin, currentY, contentWidth, 6, "F");
        doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
        doc.text("3. STRUCTURAL COMPONENT BREAKDOWN (GROUPED PIVOT TABLES)", margin + 3, currentY + 4.2);
        currentY += 8;

        // Render Common Legend Box for Notation
        const drawLegend = (d: jsPDF, ly: number) => {
            const legendW = contentWidth;
            const legendH = 6;
            d.setFillColor(...colors.lightGray);
            d.rect(margin, ly, legendW, legendH, "F");
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            d.rect(margin, ly, legendW, legendH, "S");

            d.setFontSize(7); d.setFont("helvetica", "bold"); d.setTextColor(...colors.navy);
            d.text("STATUS NOTATION LEGEND:", margin + 3, ly + 4);

            d.setFont("helvetica", "bold");
            
            // Completed
            d.setTextColor(16, 185, 129); // emerald
            d.text("COMPLETED: [OK]", margin + 45, ly + 4);
            
            // Incomplete
            d.setTextColor(245, 158, 11); // amber
            d.text("INCOMPLETE: [!]", margin + 80, ly + 4);

            // Anomaly
            d.setTextColor(220, 38, 38); // red
            d.text("ANOMALY: [DEFECT]", margin + 115, ly + 4);

            // Pending
            d.setTextColor(100, 116, 139); // slate
            d.text("PENDING: [...]", margin + 155, ly + 4);
        };

        drawLegend(doc, currentY);
        currentY += 8;

        const componentSummary = summaryData?.componentSummary || {};
        const compGroupEntries = Object.entries(componentSummary);

        if (compGroupEntries.length === 0) {
            (autoTable as any)(doc, {
                startY: currentY,
                margin: { left: margin, right: margin },
                head: [["Component Group", "Component QID", "Inspection Status"]],
                body: [["N/A", "No component breakdown data available", "-"]],
                theme: "plain",
                styles: { fontSize: 7.5, cellPadding: 2.5, textColor: colors.text },
                headStyles: { fillColor: colors.lightGray, textColor: colors.navy, fontStyle: "bold", lineWidth: 0.1, drawColor: colors.border },
                bodyStyles: { lineWidth: 0.1, drawColor: colors.border }
            });
            currentY = (doc as any).lastAutoTable.finalY + 6;
        } else {
            compGroupEntries.forEach(([compGroup, qids]: [string, any]) => {
                if (currentY + 30 > pageHeight - 25) {
                    doc.addPage();
                    drawPageHeader(doc);
                    currentY = margin + HEADER_H + 6;
                    drawLegend(doc, currentY);
                    currentY += 8;
                }

                // Sub-header banner for Component Group (using standard clean text without % or pilcrow)
                doc.setFillColor(235, 242, 250);
                doc.rect(margin, currentY, contentWidth, 5.5, "F");
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.1);
                doc.rect(margin, currentY, contentWidth, 5.5, "S");
                doc.setTextColor(...colors.navy); doc.setFontSize(8); doc.setFont("helvetica", "bold");
                // Gather unique inspection type columns for this component group
                const allInspTypes = Array.from(new Set(
                    Object.values(qids).flatMap((q: any) => Object.keys(q.inspectionTypes || {}))
                )).filter(it => it.toUpperCase() !== "PL_CO" && it.toUpperCase() !== "PLCO").sort();

                // Filter QIDs to only include those with active/valid tasks for displayed columns
                const validQidEntries = Object.entries(qids).filter(([_, qidData]: [string, any]) => {
                    return allInspTypes.some(it => {
                        const counts = qidData.inspectionTypes?.[it];
                        return counts && ((counts.completed || 0) > 0 || (counts.incomplete || 0) > 0 || (counts.anomaly || 0) > 0 || (counts.pending || 0) > 0);
                    });
                });

                const qidCount = validQidEntries.length;
                if (qidCount === 0) return;

                doc.text(`CATEGORY: ${compGroup.toUpperCase()} (${qidCount} QID${qidCount > 1 ? 's' : ''})`, margin + 3, currentY + 4);
                currentY += 6.5;

                const headers = ["Component QID", ...allInspTypes, "Total Status"];
                const groupRows: any[] = [];

                validQidEntries.forEach(([qid, qidData]: [string, any]) => {
                    const row: any[] = [qid];

                    let totalCompl = 0;
                    let totalPend = 0;

                    allInspTypes.forEach((it) => {
                        const counts = qidData.inspectionTypes?.[it];
                        if (!counts) {
                            row.push("-");
                        } else {
                            totalCompl += (counts.completed || 0);
                            totalPend  += (counts.pending || 0);

                            const parts = [];
                            if (counts.completed > 0) parts.push(`[OK] ${counts.completed}`);
                            if (counts.incomplete > 0) parts.push(`[!] ${counts.incomplete}`);
                            if (counts.anomaly > 0) parts.push(`[DEFECT] ${counts.anomaly}`);
                            if (counts.pending > 0) parts.push(`[...] ${counts.pending}`);
                            row.push(parts.join(" ") || "-");
                        }
                    });

                    const overallStatus = totalCompl > 0 ? "Inspected" : (totalPend > 0 ? "Pending" : "Complete");
                    row.push(overallStatus);
                    groupRows.push(row);
                });

                // Column width calculations
                const qidColWidth = 42;
                const statusColWidth = 25;
                const typeColWidth = (contentWidth - qidColWidth - statusColWidth) / (allInspTypes.length || 1);

                const colStylesConfig: any = {
                    0: { fontStyle: "bold", cellWidth: qidColWidth }
                };
                allInspTypes.forEach((_, idx) => {
                    colStylesConfig[idx + 1] = { halign: "center", cellWidth: typeColWidth };
                });
                colStylesConfig[allInspTypes.length + 1] = { halign: "center", fontStyle: "bold", cellWidth: statusColWidth };

                (autoTable as any)(doc, {
                    startY: currentY,
                    margin: { left: margin, right: margin },
                    head: [headers],
                    body: groupRows,
                    theme: "plain",
                    styles: { fontSize: 7, cellPadding: 2, textColor: colors.text },
                    headStyles: { fillColor: [241, 245, 249], textColor: colors.navy, fontStyle: "bold", lineWidth: 0.1, drawColor: colors.border },
                    columnStyles: colStylesConfig,
                    bodyStyles: { lineWidth: 0.1, drawColor: colors.border },
                    didParseCell: (data: any) => {
                        if (data.section === "body" && data.column.index > 0 && data.column.index <= allInspTypes.length) {
                            const val = String(data.cell.raw || "");
                            if (val.includes("[DEFECT]")) {
                                data.cell.styles.textColor = [220, 38, 38]; // Red for defect/anomaly
                                data.cell.styles.fontStyle = "bold";
                            } else if (val.includes("[OK]")) {
                                data.cell.styles.textColor = [16, 185, 129]; // Emerald for complete
                                data.cell.styles.fontStyle = "bold";
                            } else if (val.includes("[!]")) {
                                data.cell.styles.textColor = [245, 158, 11]; // Amber for incomplete
                                data.cell.styles.fontStyle = "bold";
                            } else if (val.includes("[...]")) {
                                data.cell.styles.textColor = [100, 116, 139]; // Slate for pending
                            }
                        } else if (data.section === "body" && data.column.index === allInspTypes.length + 1) {
                            const statusVal = String(data.cell.raw || "");
                            if (statusVal === "Inspected" || statusVal === "Complete") {
                                data.cell.styles.textColor = [16, 185, 129];
                            } else if (statusVal === "Pending") {
                                data.cell.styles.textColor = [100, 116, 139];
                            }
                        }
                    }
                });

                currentY = (doc as any).lastAutoTable.finalY + 4;
            });
            currentY += 2;
        }

        // ── SECTION 4: Anomalies & Defects Summary ──────────────────────────────
        const anomalies = summaryData?.anomalies;
        if (anomalies && (anomalies.total > 0 || Object.keys(anomalies.byPriority || {}).length > 0)) {
            if (currentY + 35 > pageHeight - 25) {
                doc.addPage();
                drawPageHeader(doc);
                currentY = margin + HEADER_H + 6;
            }

            doc.setFillColor(...colors.navy);
            doc.rect(margin, currentY, contentWidth, 6, "F");
            doc.setTextColor(255); doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
            doc.text("4. ANOMALIES & DEFECTS SUMMARY", margin + 3, currentY + 4.2);
            currentY += 8;

            (autoTable as any)(doc, {
                startY: currentY,
                margin: { left: margin, right: margin },
                head: [["Anomaly Category", "Total Count", "Status"]],
                body: [
                    ["Total Anomalies Logged", String(anomalies.total || 0), anomalies.total > 0 ? "Requires Review" : "Clean"],
                    ["Open Anomalies", String(anomalies.open || 0), "Outstanding"],
                    ["Rectified Anomalies", String(anomalies.rectified || 0), "Closed"]
                ],
                theme: "plain",
                styles: { fontSize: 7.5, cellPadding: 2.5, textColor: colors.text },
                headStyles: { fillColor: colors.lightGray, textColor: colors.navy, fontStyle: "bold", lineWidth: 0.1, drawColor: colors.border },
                bodyStyles: { lineWidth: 0.1, drawColor: colors.border }
            });
            currentY = (doc as any).lastAutoTable.finalY + 6;
        }

        // ── Signatures Block ───────────────────────────────────────────────────
        if (config?.showSignatures !== false) {
            const sigH = 18;
            const sigW = contentWidth / 3;
            let finalY = (doc as any).lastAutoTable?.finalY ?? currentY;
            if (finalY + sigH + 15 > pageHeight) {
                doc.addPage();
                drawPageHeader(doc);
            }
            const sigY = pageHeight - 32;

            const drawSig = (label: string, lx: number) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1);
                doc.rect(lx, sigY, sigW - 4, 18);
                if (!config?.printFriendly) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 4, 4.5, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(7); doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.5);
                doc.setTextColor(...colors.text); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
                doc.text("Name:", lx + 2, sigY + 9.5);
                doc.text("Date:", lx + 2, sigY + 13);
                doc.text("Signature:", lx + 2, sigY + 16.5);
            };

            drawSig("PREPARED BY",  margin);
            drawSig("REVIEWED BY",  margin + sigW);
            drawSig("APPROVED BY",  margin + sigW * 2);
        }

        // ── Page Footers ────────────────────────────────────────────────────────
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
            doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
            doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
            doc.text(`${companySettings?.company_name || "NasQuest Resources"} | Platform Inspection Summary Report | SOW: ${headerData?.sowReportNo || "N/A"}`, margin, pageHeight - 7);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
        }

        await applyWatermarkAndSignaturesGlobal(doc, config);

        if (config?.returnBlob) {
            return doc.output("blob");
        } else {
            doc.save(`Platform_Summary_Report_${(headerData?.sowReportNo || "SUMMARY").replace(/[\/\\]/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
        }

    } catch (err) {
        console.error("[Platform Inspection Summary Report] Generation Error:", err);
        throw err;
    }
};
