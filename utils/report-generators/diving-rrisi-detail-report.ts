import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { createClient } from "@/utils/supabase/client";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal , formatPdfDate } from "./shared-logo";

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
    showSignatures?: boolean;
    showPageNumbers?: boolean;
    watermarkText?: string;
    reportType?: 'R' | 'J' | 'I';
}

/**
 * Riser / J-Tube / I-Tube Survey Report Diving (Non-Sketch Detail Version)
 * Groups all associated components (clamps, welds, anodes, flanges, pipe sections) under Parent QID.
 */
export const generateDivingRRISIDetailReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - (margin * 2);

        const rType = config.reportType || 'R';
        const typeConfig = {
            'R': { title: 'Riser Inspection Summary Report (Diving)', prefix: 'R', label: 'RISER', componentLabel: 'Riser Component', filePrefix: 'Diving_Riser_Summary_Report' },
            'J': { title: 'J-Tube Inspection Summary Report (Diving)', prefix: 'J', label: 'J-TUBE', componentLabel: 'J-Tube Component', filePrefix: 'Diving_JTube_Summary_Report' },
            'I': { title: 'I-Tube Inspection Summary Report (Diving)', prefix: 'I', label: 'I-TUBE', componentLabel: 'I-Tube Component', filePrefix: 'Diving_ITube_Summary_Report' }
        }[rType];

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            darkBorder: [148, 163, 184] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            anomaly: [220, 38, 38] as [number, number, number],
            rectified: [22, 163, 74] as [number, number, number],
        };

        const supabase = createClient();

        // Fetch all components to build parent component lookup registry
        const { data: allComps } = await supabase.from('structure_components').select('id, q_id, code, name, metadata').eq('structure_id', config.structureId);

        // Build lookup map of valid Parent Components matching code 'RS' and QID prefix
        const targetPrefix = typeConfig.prefix; // 'R', 'J', or 'I'

        const compRegistry = new Map<number, any>();
        const parentCompsMap = new Map<number, any>();
        const parentQidMap = new Map<string, string>(); // uppercase parent QID -> Full Parent QID string

        // 1) Populate parentCompsMap from allComps
        if (allComps) {
            allComps.forEach((c: any) => {
                compRegistry.set(c.id, c);
                const code = (c.code || '').toUpperCase().trim();
                const qid = (c.q_id || '').trim();
                const qidUpper = qid.toUpperCase();

                const isRsCode = code === 'RS' || code === 'RISER' || code === 'JT' || code === 'IT' || code === 'I-TUBE' || code === 'J-TUBE';
                const isParentCandidate = isRsCode && qidUpper.startsWith(targetPrefix) && 
                    (targetPrefix !== 'R' || !qidUpper.startsWith('RISG'));

                if (isParentCandidate && qid) {
                    parentCompsMap.set(c.id, c);
                    parentQidMap.set(qidUpper, qid);
                }
            });
        }

        // 2) Also inspect incoming records for parent RS / JT / IT components
        records.forEach((r: any) => {
            const comp = r.structure_components || {};
            const cId = comp.id || r.component_id;
            const cCode = (comp.code || r.component_code || '').toUpperCase().trim();
            const qid = (comp.q_id || r.q_id || r.component_qid || '').trim();
            const qidUpper = qid.toUpperCase();

            const isRsCode = cCode === 'RS' || cCode === 'RISER' || cCode === 'JT' || cCode === 'IT' || cCode === 'I-TUBE' || cCode === 'J-TUBE';
            const isParentCandidate = isRsCode && qidUpper.startsWith(targetPrefix) && 
                (targetPrefix !== 'R' || !qidUpper.startsWith('RISG'));

            if (isParentCandidate && qid) {
                if (cId && !parentCompsMap.has(cId)) {
                    parentCompsMap.set(cId, comp.q_id ? comp : { id: cId, q_id: qid, code: cCode || 'RS' });
                }
                if (!parentQidMap.has(qidUpper)) {
                    parentQidMap.set(qidUpper, qid);
                }
                if (cId) compRegistry.set(cId, comp);
            }
        });

        // 3) Helper to resolve FULL Parent QID string for any inspection record
        const getParentQid = (r: any): string | null => {
            const comp = r.structure_components || {};
            const compCode = (comp.code || r.component_code || '').toUpperCase().trim();
            const qid = (comp.q_id || r.q_id || r.component_qid || '').trim();
            const qidUpper = qid.toUpperCase();
            const metadata = comp.metadata || r.metadata || {};

            // Reject RISG (Riser General / Riser Guide) if Riser report
            if (targetPrefix === 'R' && qidUpper.startsWith('RISG')) return null;

            // A) Check metadata associated parent ID
            const pId = Number(metadata.associated_comp_id || metadata.parent_id || metadata.comp_id_parent || metadata.parent_comp_id);
            if (pId && compRegistry.has(pId)) {
                const pComp = compRegistry.get(pId);
                const pQ = (pComp.q_id || '').trim();
                const pQUpper = pQ.toUpperCase();
                if (pQ && (pQUpper.startsWith(targetPrefix) || pQUpper.startsWith('RIS')) && (targetPrefix !== 'R' || !pQUpper.startsWith('RISG'))) {
                    return pQ;
                }
            }

            // B) Check metadata associated parent QID
            const pQid = String(metadata.associated_comp_qid || metadata.parent_qid || metadata.parent_q_id || '').trim();
            const pQidUpper = pQid.toUpperCase();
            if (pQid && (pQidUpper.startsWith(targetPrefix) || pQidUpper.startsWith('RIS')) && (targetPrefix !== 'R' || !pQidUpper.startsWith('RISG'))) {
                return pQid;
            }

            // C) If this record itself IS a registered parent component
            if (parentQidMap.has(qidUpper)) {
                return parentQidMap.get(qidUpper)!;
            }

            // D) Prefix matching against known parent QIDs (longest matching parent QID)
            let bestMatchUpper = '';
            let bestMatchOriginal = '';
            parentQidMap.forEach((origQid, pQUpper) => {
                if (qidUpper.startsWith(pQUpper) || qidUpper.startsWith(pQUpper + '-') || qidUpper.startsWith(pQUpper + '_')) {
                    if (pQUpper.length > bestMatchUpper.length) {
                        bestMatchUpper = pQUpper;
                        bestMatchOriginal = origQid;
                    }
                }
            });
            if (bestMatchOriginal) return bestMatchOriginal;

            // E) Fallback prefix check & regex pattern matching (only when no registered parent QID matched)
            const isMatchPrefix = qidUpper.startsWith(targetPrefix) || 
                (targetPrefix === 'R' && qidUpper.startsWith('RIS')) ||
                (targetPrefix === 'J' && qidUpper.startsWith('JT')) ||
                (targetPrefix === 'I' && qidUpper.startsWith('IT'));

            if (!isMatchPrefix && compCode !== 'RS') return null;

            // Strip subcomponent suffixes (e.g., -SUPP-9M, -CL1, -AN1, -W1, _TEST01)
            const baseQid = qid.replace(/[-_](SUPP|CLP?|WELD|FLANGE|ANOD?|SK\d+|TEST\d*).*/i, '');
            if (baseQid && baseQid.length > 0 && baseQid !== qid) {
                if (parentQidMap.has(baseQid.toUpperCase())) return parentQidMap.get(baseQid.toUpperCase())!;
                return baseQid;
            }

            if (isMatchPrefix) {
                const registeredParents = Array.from(parentQidMap.values());
                if (registeredParents.length > 0) {
                    return registeredParents[0];
                }
                return qid;
            }
            return null;
        };

        // 4) Group records by FULL Parent QID
        const risersMap = new Map<string, { parentQid: string; records: any[] }>();
        const filteredRecords: any[] = [];

        records.forEach(r => {
            const pQid = getParentQid(r);
            if (pQid) {
                if (!risersMap.has(pQid)) {
                    risersMap.set(pQid, { parentQid: pQid, records: [] });
                }
                risersMap.get(pQid)!.records.push(r);
                filteredRecords.push(r);
            }
        });

        // Seed from allComps if risersMap is empty
        if (risersMap.size === 0 && allComps && allComps.length > 0) {
            allComps.forEach((c: any) => {
                const q = (c.q_id || '').trim();
                const qUpper = q.toUpperCase();
                const code = (c.code || '').toUpperCase().trim();
                if ((code === 'RS' || qUpper.startsWith(targetPrefix)) && (targetPrefix !== 'R' || !qUpper.startsWith('RISG'))) {
                    const dummy = { structure_components: c };
                    const pQ = getParentQid(dummy);
                    if (pQ && !risersMap.has(pQ)) {
                        risersMap.set(pQ, { parentQid: pQ, records: [] });
                    }
                }
            });
        }

        // Fallback default group if still empty
        if (risersMap.size === 0) {
            const fallbackQid = `${typeConfig.label}-1`;
            risersMap.set(fallbackQid, { parentQid: fallbackQid, records: [] });
        }

        interface RiserGroup {
            parentQid: string;
            records: any[];
        }
        const sortedGroups: RiserGroup[] = Array.from(risersMap.values())
            .sort((a, b) => a.parentQid.localeCompare(b.parentQid, undefined, { numeric: true, sensitivity: 'base' }));

        // Pre-load Logos
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (filteredRecords.length > 0) {
            const dates = filteredRecords.map(r => new Date(r.cr_date || r.inspection_date)).filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) {
                startDate = min(dates);
                endDate = max(dates);
            }
        }
        const dateRangeStr = startDate && endDate 
            ? `${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`
            : 'N/A';

        const drawHeader = (d: jsPDF) => {
            const headerH = 22;
            const isPF = config.printFriendly;
            
            if (isPF) {
                d.setDrawColor(...colors.navy);
                d.setLineWidth(0.5);
                d.rect(margin, margin, contentWidth, headerH, 'S');
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy);
                d.rect(margin, margin, contentWidth, headerH, 'F');
                d.setTextColor(255);
            }

            if (companyLogo)    drawLogo(d, companyLogo,    16, 16, pageWidth - margin - 20, margin + 3, 'right', 'center');
            if (contractorLogo) drawLogo(d, contractorLogo, 16, 16, margin + 4,              margin + 3, 'left',  'center');

            d.setFontSize(8); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 10, { align: 'center' });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text(typeConfig.title, margin + (contentWidth/2), margin + 17, { align: 'center' });

            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || 'N/A'}`, margin + (contentWidth/2), margin + 21, { align: 'center' });
        };

        const drawContext = (d: jsPDF, y: number) => {
            const rowH = 7;
            const tableY = y;
            const colW = contentWidth / 2;
            const isPF = config.printFriendly;
            
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border);
                d.setLineWidth(0.2); 
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, isPF ? 'S' : 'FD'); 
                
                d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold");
                d.text(label, x + 3, ty + 4.8); d.setFont("helvetica", "normal");
                d.text(String(value), x + 36, ty + 4.8);
            };

            drawBox('Structure:', headerData.platformName || 'N/A', margin, colW, tableY);
            drawBox('Vessel / Location:', headerData.vessel || 'N/A', margin + colW, colW, tableY);
            drawBox('Job Pack:', headerData.jobpackName || 'N/A', margin, colW, tableY + rowH);
            drawBox('Insp. Date Range:', dateRangeStr, margin + colW, colW, tableY + rowH);

            d.setDrawColor(...colors.darkBorder);
            d.setLineWidth(0.3);
            d.rect(margin, tableY, contentWidth, rowH * 2, 'S');
            
            return tableY + (rowH * 2) + 5;
        };

        // --- Helper CP & UT Extractors ---
        const extractCP = (data: any): { display: string; detailPostfix: string } => {
            const readings: string[] = [];
            const details: string[] = [];

            const primary = data.cp_reading_mv ?? data.cp_rdg ?? data.cp_reading ?? data.cp_val ?? data.cp;
            if (primary != null && String(primary).trim() !== '' && String(primary).trim().toUpperCase() !== 'N/A') {
                const val = parseFloat(primary);
                const str = !isNaN(val) ? (val > 0 ? `-${val} mV` : `${val} mV`) : `${primary} mV`;
                readings.push(str);
            }

            if (data.cp_stabbing != null && String(data.cp_stabbing).trim() !== '') {
                const val = parseFloat(data.cp_stabbing);
                const str = !isNaN(val) ? (val > 0 ? `-${val} mV` : `${val} mV`) : `${data.cp_stabbing} mV`;
                readings.push(str);
                details.push(`Stabbing: ${str}`);
            }

            if (data.cp_contact != null && String(data.cp_contact).trim() !== '') {
                const val = parseFloat(data.cp_contact);
                const str = !isNaN(val) ? (val > 0 ? `-${val} mV` : `${val} mV`) : `${data.cp_contact} mV`;
                readings.push(str);
                details.push(`Contact: ${str}`);
            }

            if (Array.isArray(data.cp_readings)) {
                data.cp_readings.forEach((c: any, i: number) => {
                    if (c != null && String(c).trim() !== '') {
                        readings.push(`${c} mV`);
                        details.push(`CP #${i+1}: ${c}mV`);
                    }
                });
            }

            const uniqueReadings = Array.from(new Set(readings));
            const display = uniqueReadings.length > 0 ? uniqueReadings.join(' / ') : 'N/A';
            const detailPostfix = details.length > 0 ? `[CP: ${details.join(', ')}]` : '';

            return { display, detailPostfix };
        };

        const extractUT = (data: any): { display: string; detailPostfix: string } => {
            const readings: string[] = [];
            const details: string[] = [];

            const primary = data.ut_reading_mm ?? data.ut_rdg ?? data.ut_reading ?? data.ut_val ?? data.ut_thickness ?? data.ut;
            if (primary != null && String(primary).trim() !== '' && String(primary).trim().toUpperCase() !== 'N/A') {
                readings.push(`${primary} mm`);
            }

            const pts = ['ut_12_o_clock', 'ut_3_o_clock', 'ut_6_o_clock', 'ut_9_o_clock'];
            const ptLabels = ['12h', '3h', '6h', '9h'];
            pts.forEach((key, idx) => {
                if (data[key] != null && String(data[key]).trim() !== '') {
                    readings.push(`${data[key]} mm`);
                    details.push(`${ptLabels[idx]}: ${data[key]}mm`);
                }
            });

            if (Array.isArray(data.ut_readings)) {
                data.ut_readings.forEach((u: any, i: number) => {
                    if (u != null && String(u).trim() !== '') {
                        readings.push(`${u} mm`);
                        details.push(`UT #${i+1}: ${u}mm`);
                    }
                });
            }

            const uniqueReadings = Array.from(new Set(readings));
            const display = uniqueReadings.length > 0 ? uniqueReadings.join(' / ') : 'N/A';
            const detailPostfix = details.length > 0 ? `[UT: ${details.join(', ')}]` : '';

            return { display, detailPostfix };
        };

        drawHeader(doc);
        const startY = drawContext(doc, margin + 22 + 2);
        const isPF = config.printFriendly;

        // Build continuous table rows with Group Section Header banners for each parent Riser QID
        const bodyRows: any[] = [];
        let globalItemCounter = 1;

        sortedGroups.forEach((group) => {
            const parentQid = group.parentQid;
            const gRecords = group.records || [];

            // Group section banner row
            bodyRows.push([
                {
                    content: `${typeConfig.componentLabel}: ${parentQid}`,
                    colSpan: 7,
                    styles: {
                        fillColor: isPF ? [240, 240, 240] : [241, 245, 249],
                        textColor: colors.navy,
                        fontStyle: 'bold',
                        fontSize: 8,
                        cellPadding: 3.5,
                        halign: 'left'
                    }
                }
            ]);

            // Sort records by elevation descending
            const sortedGroupRecords = [...gRecords].sort((a, b) => {
                const elevA = parseFloat(a.elevation || a.verification_depth || a.inspection_data?.verification_depth || 0) || 0;
                const elevB = parseFloat(b.elevation || b.verification_depth || b.inspection_data?.verification_depth || 0) || 0;
                return elevB - elevA;
            });

            sortedGroupRecords.forEach((r) => {
                const itemNo = globalItemCounter++;
                const qid = r.structure_components?.q_id || r.q_id || r.component_qid || 'N/A';
                
                const elevRaw = r.elevation ?? r.verification_depth ?? r.inspection_data?.verification_depth ?? r.inspection_data?.elevation ?? null;
                const elevVal = elevRaw != null && !isNaN(parseFloat(elevRaw)) ? `${parseFloat(elevRaw).toFixed(2)} m` : (elevRaw ? `${elevRaw} m` : 'N/A');

                const diveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name || 
                               r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || 
                               r.dive_job_id || r.rov_job_id || r.inspection_data?.dive_no || 'N/A';

                const data = r.inspection_data || {};

                const cpInfo = extractCP(data);
                const utInfo = extractUT(data);

                const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || r.rectified_remarks || '';

                const findingsParts: string[] = [];
                if (r.description && String(r.description).trim() !== '' && String(r.description).trim().toUpperCase() !== 'N/A') {
                    findingsParts.push(String(r.description).trim());
                } else if (data.remarks && String(data.remarks).trim() !== '') {
                    findingsParts.push(String(data.remarks).trim());
                }

                if (cpInfo.detailPostfix) findingsParts.push(cpInfo.detailPostfix);
                if (utInfo.detailPostfix) findingsParts.push(utInfo.detailPostfix);

                if (isAnomaly && anomRef) findingsParts.push(`[Ref: ${anomRef}]`);
                if (isRectified) findingsParts.push(`[Rectified: ${rectRem || 'Completed'}]`);

                const findingsStr = findingsParts.length > 0 ? findingsParts.join('\n') : 'N/A';

                bodyRows.push({
                    rowCells: [
                        String(itemNo),
                        qid,
                        elevVal,
                        diveNo,
                        cpInfo.display,
                        utInfo.display,
                        findingsStr
                    ],
                    isAnomaly,
                    isRectified
                });
            });
        });

        const bodyForAutoTable = bodyRows.map(row => Array.isArray(row) ? row : row.rowCells);

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin, top: margin + 22 + 6, bottom: 20 },
            head: [
                ['Item No.', 'QID', 'Elevation (m)', 'Dive No.', 'CP', 'UT', 'Findings']
            ],
            body: bodyForAutoTable,
            theme: 'grid',
            headStyles: { 
                fillColor: isPF ? [255, 255, 255] : colors.navy, 
                textColor: isPF ? colors.navy : 255, 
                fontSize: 8, 
                fontStyle: 'bold', 
                halign: 'center',
                lineWidth: 0.3,
                lineColor: colors.border
            },
            styles: { 
                fontSize: 7.5, 
                cellPadding: 2.5, 
                textColor: colors.text, 
                lineColor: colors.border,
                lineWidth: 0.2
            },
            tableLineWidth: 0.3,
            tableLineColor: colors.darkBorder,
            didParseCell: (data) => {
                if (data.section === 'body') {
                    const rowObj = bodyRows[data.row.index];
                    if (rowObj && !Array.isArray(rowObj)) {
                        if (rowObj.isAnomaly) {
                            data.cell.styles.textColor = colors.anomaly;
                            data.cell.styles.fontStyle = 'bold';
                        } else if (rowObj.isRectified) {
                            data.cell.styles.textColor = colors.rectified;
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            },
            columnStyles: {
                0: { cellWidth: 16, halign: 'center' },
                1: { cellWidth: 26, fontStyle: 'bold', halign: 'left' },
                2: { cellWidth: 20, halign: 'center' },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
                5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
                6: { cellWidth: 'auto', halign: 'left' }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawHeader(doc);

                // Bottom page footer bar
                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.darkBorder); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  ${typeConfig.title}  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
                    margin, pageHeight - 6
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 6, { align: "right" });
                }
            }
        });

        // --- Signatures Block ---
        const finalY = (doc as any).lastAutoTable?.finalY ?? (margin + 40);
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                drawHeader(doc);
                sigY = pageHeight - 38;
            }
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.2);
                doc.rect(lx, sigY, sigW - 4, 18);
                if (!config.printFriendly) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 4, 4.5, "FD");
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

        // Apply Watermark & Signatures
        applyWatermarkAndSignaturesGlobal(doc, config);

        if (config.returnBlob) return doc.output("blob");

        doc.save(`${typeConfig.filePrefix}_${(config?.reportNoPrefix || headerData?.sowReportNo) || 'Report'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("Diving RRISI Detail Report Generation Error:", e);
        throw e;
    }
};
