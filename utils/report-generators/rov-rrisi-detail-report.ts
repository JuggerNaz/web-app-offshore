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
 * ROV Riser Inspection Report (Portrait)
 * Columns: Item No. | QID | Elevation | Dive No. | Tape No. | CP (mV) | Findings
 *
 * Data is grouped by Riser (RS). Each Riser group starts on a new page.
 * Associated components are clubbed under their parent Riser QID.
 * Inside each group, data is ordered by Elevation ascending.
 */
export const generateROVRRISIDetailReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    const supabase = createClient();
    console.log("[ROV Riser Detail Report] Starting generation", { recordsCount: records?.length, hasHeader: !!headerData, config });
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

        // ── Filter Records (Strict Riser Filter: RRISI only + Prefix R only + NOT RISG) ──
        const filteredRecords = records.filter(r => {
            const qid = (r.structure_components?.q_id || '').toUpperCase();
            const typeCode = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RRISI' && qid.startsWith('R') && !qid.startsWith('RISG') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
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

        // Fetch all components to build a complete QID map for grouping
        const { data: allComps } = await supabase.from('structure_components').select('id, q_id, code, name, metadata').eq('structure_id', config.structureId);
        const compRegistry = new Map<number, any>();
        const qidToId = new Map<string, number>();
        if (allComps) {
            allComps.forEach(c => {
                compRegistry.set(c.id, c);
                qidToId.set(c.q_id.toUpperCase(), c.id);
                const m = c.q_id.match(/R[IS-]*(\d+)/i);
                if (m) qidToId.set(m[1], c.id);
            });
        }

        // Group records by parent Riser component (RS)
        const risersMap = new Map<number, { riserComp: any, records: any[] }>();
        const unassigned: any[] = [];
        filteredRecords.forEach(r => {
            const comp = r.structure_components;
            if (!comp) return;
            let rid: number | null = null;
            if (comp.code === 'RS') rid = comp.id;
            else if (comp.metadata?.associated_comp_id) rid = Number(comp.metadata.associated_comp_id);
            else {
                const q = (comp.q_id || '').toUpperCase();
                const m = q.match(/R[IS-]*(\d+)/i);
                if (m && qidToId.has(m[1])) rid = qidToId.get(m[1])!;
                else if (qidToId.has(q)) rid = qidToId.get(q)!;
            }
            if (rid) {
                if (!risersMap.has(rid)) risersMap.set(rid, { riserComp: compRegistry.get(rid) || comp, records: [] });
                risersMap.get(rid)!.records.push(r);
            } else unassigned.push(r);
        });

        if (unassigned.length > 0) {
            if (risersMap.size === 1) Array.from(risersMap.values())[0].records.push(...unassigned);
            else risersMap.set(0, { riserComp: { q_id: 'Miscellaneous' }, records: unassigned });
        }

        const groups = Array.from(risersMap.values()).sort((a, b) => {
            const qA = a.riserComp?.q_id || '';
            const qB = b.riserComp?.q_id || '';
            return qA.localeCompare(qB, undefined, { numeric: true, sensitivity: 'base' });
        });

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
            d.text("ROV Riser Inspection Report", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });
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
            d.setTextColor(150, 150, 150);
            d.setFont("helvetica", "normal");
            d.text(`Report ID: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin, footerY);
            d.text(`Printed: ${format(new Date(), "dd MMM yyyy HH:mm")}`, margin + contentWidth / 2, footerY, { align: "center" });
            d.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
        };

        for (let gIdx = 0; gIdx < groups.length; gIdx++) {
            const group = groups[gIdx];
            const riser = group.riserComp;
            const groupRecs = group.records;

            if (gIdx > 0) doc.addPage();

            drawPageHeader(doc);
            let currentY = drawContextRow(doc, margin + HEADER_H + 2, groupRecs);

            // Group header section
            doc.setFillColor(...colors.navy);
            doc.rect(margin, currentY, contentWidth, 7, "F");
            doc.setTextColor(255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(`Riser QID: ${riser?.q_id || "Unknown"}`, margin + 4, currentY + 5);
            currentY += 10;

            // Sort group records by Elevation ascending (order by elevation Asc)
            const sortedRecords = [...groupRecs].sort((a, b) => {
                const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                return elA - elB;
            });

            // Map rows for autoTable
            const tableRows = sortedRecords.map((r, rIdx) => {
                const comp = r.structure_components || {};
                const d = r.inspection_data || {};
                const anoms = r.insp_anomalies || [];
                const isAnom = r.has_anomaly || anoms.length > 0;

                const elevVal = r.elevation ?? d.elevation;
                const elevDisplay = elevVal !== undefined && elevVal !== null && elevVal !== "" ? `${elevVal} m` : "—";

                const diveNo =
                    r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name ||
                    r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                    r.rov_job_id || r.dive_job_id || "—";

                const tapeNo = r.insp_video_tapes?.tape_no || d.tape_no || r.tape_id || "—";

                // Format CP
                const cpVal = d.cp_rdg ?? d.cp ?? "";
                let cpDisplay = cpVal !== "" && cpVal !== null && cpVal !== undefined ? `${cpVal} mV` : "—";
                
                const additionals = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : [];
                const addCpDetails: string[] = [];
                additionals.forEach((a: any) => {
                    const val = a.reading ?? a.cp_rdg ?? "";
                    if (val !== "" && val !== null && val !== undefined) {
                        cpDisplay += `, ${val} mV`;
                        const loc = a.location ? ` @ ${a.location}` : "";
                        addCpDetails.push(`Add. CP${loc}: ${val} mV`);
                    }
                });

                // Format Findings
                let findings = r.description || d.findings || "No significant findings";
                if (addCpDetails.length > 0) {
                    findings += `\n[${addCpDetails.join(", ")}]`;
                }
                if (anoms.length > 0) {
                    findings += `\n` + anoms.map((a: any) => `[Anom Ref: ${a.ref_no || a.anomaly_ref_no || "N/A"}]${a.is_rectified ? `\n(Rectified: ${a.rect_comments || ""})` : ""}`).join("\n");
                }

                return [
                    { content: String(rIdx + 1), styles: { halign: "center" as const } },
                    { content: comp.q_id || "—" },
                    { content: elevDisplay, styles: { halign: "center" as const } },
                    { content: String(diveNo), styles: { halign: "center" as const } },
                    { content: String(tapeNo), styles: { halign: "center" as const } },
                    { content: cpDisplay, styles: { halign: "center" as const } },
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
                        { content: "Elevation", styles: { halign: "center" as const } },
                        { content: "Dive No.", styles: { halign: "center" as const } },
                        { content: "Tape No.", styles: { halign: "center" as const } },
                        { content: "CP", styles: { halign: "center" as const } },
                        { content: "Findings" }
                    ]
                ],
                body: tableRows,
                theme: "grid",
                headStyles: { fillColor: colors.navy, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
                styles: { fontSize: 7.5, cellPadding: 2.5 },
                columnStyles: {
                    0: { cellWidth: 12 }, // Item No.
                    1: { cellWidth: 16 }, // QID
                    2: { cellWidth: 18 }, // Elevation
                    3: { cellWidth: 18 }, // Dive No.
                    4: { cellWidth: 18 }, // Tape No.
                    5: { cellWidth: 26 }, // CP
                    6: { cellWidth: "auto" } // Findings
                },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) drawPageHeader(doc);
                }
            });
        }

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
        doc.save(`ROV_Riser_Inspection_Report_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (e) {
        console.error("ROV Riser Detail Report Error", e);
        throw e;
    }
};
