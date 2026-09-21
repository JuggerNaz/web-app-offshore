import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal , formatPdfDate } from "./shared-logo";
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
 * ROV I-Tube Inspection Report (Portrait)
 * Columns: Item No. | QID | Elevation | Dive No. | Tape No. | CP (mV) | Findings
 *
 * Data is grouped by I-Tube parent (RS). Each I-Tube group starts on a new page.
 * Associated components are clubbed under their parent I-Tube QID.
 * Inside each group, data is ordered by Elevation ascending.
 */
export const generateROVRRISIITubeDetailReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | null | void> => {
    const supabase = createClient();
    console.log("[ROV I-Tube Detail Report] Starting generation", { recordsCount: records?.length, hasHeader: !!headerData, config });
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

        // ── Filter Records (Strict I-Tube Filter: RRISI only + Prefix I only) ──
        const filteredRecords = records.filter(r => {
            const qid = (r.structure_components?.q_id || '').toUpperCase();
            const typeCode = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
            const compCode = (r.structure_components?.code || "").toUpperCase();
            return typeCode === 'RRISI' && qid.startsWith('I') && (compCode === 'RS' || compCode === 'CL' || compCode === 'WELD');
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

        const effectiveStructureId = config.structureId || 
            records.find(r => r.structure_id)?.structure_id || 
            records.find(r => r.structure_components?.structure_id)?.structure_components?.structure_id;

        // Helper to extract identifier key (e.g., '02' from 'IT-02-SUPP')
        const extractTubeKey = (qid: string) => {
            if (!qid) return null;
            const q = qid.toUpperCase().trim();
            const match = q.match(/^(?:ITUBE|IT|I)[-_ ]*(\d+[A-Z]?)/i);
            if (match) {
                const rawNum = match[1].toUpperCase();
                const normNum = rawNum.replace(/^0+/, '') || '0';
                return { raw: rawNum, norm: normNum };
            }
            return null;
        };

        // Helper to check if a component is a primary parent I-Tube
        const isParentITubeComp = (c: any) => {
            if (!c) return false;
            const qid = (c.q_id || '').toUpperCase().trim();
            const code = (c.code || '').toUpperCase().trim();
            if (qid.includes('SUPP') || qid.includes('CLAMP') || qid.includes('CLP') || qid.includes('ANODE') || qid.includes('FLANGE') || qid.includes('WELD') || qid.includes('RISG')) {
                return false;
            }
            const meta = c.metadata || {};
            if (meta.associated_comp_id || meta.parent_id || meta.comp_id_parent || meta.parent_comp_id || meta.associated_comp_qid || meta.parent_qid) {
                return false;
            }
            return (code === 'IT' || code === 'ITUBE' || qid.startsWith('I'));
        };

        // Fetch all components to build a complete QID map for grouping
        const { data: allComps } = effectiveStructureId
            ? await supabase.from('structure_components').select('id, q_id, code, name, metadata').eq('structure_id', effectiveStructureId)
            : { data: [] };

        const compRegistry = new Map<number, any>();
        const parentCompsMap = new Map<number, any>();
        const parentByQid = new Map<string, any>();
        const parentByKey = new Map<string, any>();

        const registerParent = (c: any) => {
            if (!c || !c.id) return;
            parentCompsMap.set(c.id, c);
            const qid = (c.q_id || '').toUpperCase().trim();
            if (qid) {
                parentByQid.set(qid, c);
                const baseQid = qid.replace(/[-_](SK\d+|WLP|PLAT|TEST|BAY).*/i, '').trim();
                if (baseQid) parentByQid.set(baseQid, c);
            }
            const key = extractTubeKey(qid);
            if (key) {
                parentByKey.set(key.raw, c);
                parentByKey.set(key.norm, c);
            }
        };

        if (allComps) {
            allComps.forEach(c => {
                compRegistry.set(c.id, c);
                if (isParentITubeComp(c)) {
                    registerParent(c);
                }
            });
        }

        // Also register parent components from incoming inspection records
        filteredRecords.forEach(r => {
            const comp = r.structure_components;
            if (comp) {
                if (comp.id) compRegistry.set(comp.id, comp);
                if (isParentITubeComp(comp)) {
                    registerParent(comp);
                }
            }
        });

        // Helper to resolve parent component for any component / record
        const resolveParentComp = (comp: any, r: any) => {
            if (!comp) return null;
            if (isParentITubeComp(comp)) {
                return comp;
            }
            const meta = comp.metadata || r.metadata || {};

            // 1. Direct parent ID reference from metadata
            const pId = Number(meta.associated_comp_id || meta.parent_id || meta.comp_id_parent || meta.parent_comp_id || meta.associated_id);
            if (pId && parentCompsMap.has(pId)) {
                return parentCompsMap.get(pId);
            }
            if (pId && compRegistry.has(pId)) {
                const cand = compRegistry.get(pId);
                if (isParentITubeComp(cand)) return cand;
            }

            // 2. Direct parent QID reference from metadata
            const pQid = String(meta.associated_comp_qid || meta.parent_qid || meta.parent_q_id || '').toUpperCase().trim();
            if (pQid && parentByQid.has(pQid)) {
                return parentByQid.get(pQid);
            }

            const qid = (comp.q_id || r.q_id || r.component_qid || '').toUpperCase().trim();

            // 3. Exact QID match in parentByQid
            if (parentByQid.has(qid)) {
                return parentByQid.get(qid);
            }

            // 4. Key match (e.g. IT-02-SUPP matches IT-02 via '02'/'2')
            const key = extractTubeKey(qid);
            if (key) {
                if (parentByKey.has(key.norm)) return parentByKey.get(key.norm);
                if (parentByKey.has(key.raw)) return parentByKey.get(key.raw);
            }

            // 5. Prefix match against registered parents
            let longestMatch: any = null;
            let longestLen = 0;
            parentByQid.forEach((pComp, pQ) => {
                if (qid.startsWith(pQ) || qid.startsWith(pQ + '-') || qid.startsWith(pQ + '_')) {
                    if (pQ.length > longestLen) {
                        longestLen = pQ.length;
                        longestMatch = pComp;
                    }
                }
            });
            if (longestMatch) return longestMatch;

            // 6. If there is only 1 registered parent component, assign subcomponents to it
            if (parentCompsMap.size === 1) {
                return Array.from(parentCompsMap.values())[0];
            }

            return null;
        };

        // Group records by parent I-Tube component
        const itubesMap = new Map<number, { itubeComp: any, records: any[] }>();
        const unassigned: any[] = [];
        filteredRecords.forEach(r => {
            const comp = r.structure_components;
            if (!comp) return;
            const parent = resolveParentComp(comp, r);
            if (parent && parent.id) {
                if (!itubesMap.has(parent.id)) itubesMap.set(parent.id, { itubeComp: parent, records: [] });
                itubesMap.get(parent.id)!.records.push(r);
            } else unassigned.push(r);
        });

        if (unassigned.length > 0) {
            if (itubesMap.size === 1) Array.from(itubesMap.values())[0].records.push(...unassigned);
            else itubesMap.set(0, { itubeComp: { q_id: 'Miscellaneous' }, records: unassigned });
        }

        const groups = Array.from(itubesMap.values()).sort((a, b) => {
            const qA = a.itubeComp?.q_id || '';
            const qB = b.itubeComp?.q_id || '';
            return qA.localeCompare(qB, undefined, { numeric: true, sensitivity: 'base' });
        });

        if (groups.length === 0 && config.returnBlob) {
            return null;
        }

        const HEADER_H = 26;

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

            d.setFontSize(11); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
            d.setFontSize(8.5); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Division", margin + contentWidth / 2, margin + 10.5, { align: "center" });
            d.setFontSize(11); d.setFont("helvetica", "bold");
            d.text("I-Tube Inspection Report (ROV)", margin + contentWidth / 2, margin + 16.5, { align: "center" });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin + contentWidth / 2, margin + 21, { align: "center" });
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
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin + 85, footerY);
        };

        // ── Render each I-Tube group ──
        for (let i = 0; i < groups.length; i++) {
            const g = groups[i];
            if (i > 0) doc.addPage();
            drawPageHeader(doc);

            let currentY = margin + HEADER_H + 4;
            currentY = drawContextRow(doc, currentY, g.records);

            // I-Tube Header info block (navy sub-header banner)
            doc.setFillColor(...colors.navy);
            doc.rect(margin, currentY, contentWidth, 7, "F");
            doc.setTextColor(255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(`I-Tube Component: ${g.itubeComp?.q_id || "Miscellaneous"}`, margin + 4, currentY + 5);
            currentY += 10;

            // Sort records by elevation Ascending
            const sortedRecords = [...g.records].sort((a, b) => {
                const elA = a.elevation !== null && a.elevation !== undefined ? Number(a.elevation) : -9999;
                const elB = b.elevation !== null && b.elevation !== undefined ? Number(b.elevation) : -9999;
                return elA - elB;
            });

            // Map records to autoTable RowInput[]
            const tableRows = sortedRecords.map((r, rIdx) => {
                const comp = r.structure_components || {};
                const d = r.inspection_data || {};
                const anoms = r.insp_anomalies || [];
                const isAnom = anoms.length > 0;

                // Format Elevation
                const elev = r.elevation !== null && r.elevation !== undefined ? `${r.elevation} m` : "—";
                const elevDisplay = elev;

                // Dive & Tape No
                const diveNo = r.insp_rov_jobs?.job_no || r.dive_no || "—";
                const tapeNo = r.tape_no || "—";

                // Format CP
                const primaryCP = d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? "";
                const additionals = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : (Array.isArray(d.cp_readings) ? d.cp_readings : []);
                const additionalCPs = additionals
                    .map((a: any) => a.reading ?? a.cp_rdg ?? "")
                    .filter((val: any) => val !== "" && val !== null && val !== undefined);

                const cpList = [primaryCP, ...additionalCPs].filter((val: any) => val !== "" && val !== null && val !== undefined);
                const cpDisplay = cpList.length > 0
                    ? cpList.map((val: any) => String(val).toLowerCase().includes("mv") ? String(val) : `${val} mV`).join("\n")
                    : "—";

                // Format Findings
                let findingsParts: string[] = [];
                if (r.description && r.description.trim()) {
                    findingsParts.push(r.description.trim());
                } else if (d.findings && d.findings.trim()) {
                    findingsParts.push(d.findings.trim());
                }

                additionals.forEach((a: any) => {
                    const val = a.reading ?? a.cp_rdg ?? "";
                    if ((val !== "" && val !== null && val !== undefined) || a.location) {
                        const loc = a.location ? ` @ ${a.location}` : "";
                        const unit = String(val).toLowerCase().includes("mv") || !val ? "" : " mV";
                        findingsParts.push(`Add. CP${loc}: ${val}${unit}`);
                    }
                });

                if (anoms.length > 0) {
                    findingsParts.push(...anoms.map((a: any) => `[Anom Ref: ${a.ref_no || a.anomaly_ref_no || "N/A"}]${a.is_rectified ? `\n(Rectified: ${a.rect_comments || ""})` : ""}`));
                }

                const findings = findingsParts.length > 0 ? findingsParts.join("\n") : "No significant findings";

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
            const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
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
                if (person?.name) doc.text(person.name, lx + 14, sigY + 10);
                doc.text("Date:", lx + 2, sigY + 13.5);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 13.5);
                doc.text("Signature:", lx + 2, sigY + 17);
            };

            drawSig("PREPARED BY", margin, config?.preparedBy);
            drawSig("REVIEWED BY", margin + sigW, config?.reviewedBy);
            drawSig("APPROVED BY", margin + (sigW * 2), config?.approvedBy);
        }

        // --- Finalize Page Numbers ---
        const totalPages = doc.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            drawFooter(doc, j, totalPages);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_ITube_Inspection_Report_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (e) {
        console.error("ROV I-Tube Detail Report Error", e);
        throw e;
    }
};
