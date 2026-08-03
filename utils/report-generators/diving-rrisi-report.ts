import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { createClient } from "@/utils/supabase/client";
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
    showSignatures?: boolean;
    showPageNumbers?: boolean;
    watermarkText?: string;
    reportType?: 'R' | 'J' | 'I';
}

/**
 * Riser / J-Tube / I-Tube Survey Report Diving (Sketch Version)
 * Groups all associated components (clamps, welds, anodes, flanges, pipe sections) under Parent QID.
 * Plots vertical pipe with bottom curve bend leading to pipeline, seabed mudline, water level, and clamp callouts.
 */
export const generateDivingRRISIReport = async (
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
            'R': { title: 'Riser Inspection Report (Diving)', prefix: 'R', label: 'RISER', componentLabel: 'Riser Component', sketchTitle: 'RISER SKETCH', filePrefix: 'Diving_Riser_Survey_Report' },
            'J': { title: 'J-Tube Inspection Report (Diving)', prefix: 'J', label: 'J-TUBE', componentLabel: 'J-Tube Component', sketchTitle: 'J-TUBE SKETCH', filePrefix: 'Diving_JTube_Survey_Report' },
            'I': { title: 'I-Tube Inspection Report (Diving)', prefix: 'I', label: 'I-TUBE', componentLabel: 'I-Tube Component', sketchTitle: 'I-TUBE SKETCH', filePrefix: 'Diving_ITube_Survey_Report' }
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
            mudline: [140, 95, 40] as [number, number, number],
            seaLevel: [59, 130, 246] as [number, number, number]
        };

        const supabase = createClient();

        // Fetch platform water depth
        const { data: platform } = await supabase.from('u_platform').select('water_depth').eq('id', config.structureId).maybeSingle();
        const platformDepth = platform?.water_depth ? -Math.abs(platform.water_depth) : -35;

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

        // --- Pre-load Logos ---
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

        // --- Render Each Parent Riser Group ---
        const totalGroups = sortedGroups.length > 0 ? sortedGroups.length : 1;

        for (let gIdx = 0; gIdx < totalGroups; gIdx++) {
            if (gIdx > 0) doc.addPage();

            const group = sortedGroups[gIdx] || { parentQid: `${typeConfig.label} General`, records: filteredRecords };
            const parentQid = group.parentQid;
            const gRecords = group.records || [];

            drawHeader(doc);
            const startY = drawContext(doc, margin + 22 + 2);
            const isPF = config.printFriendly;

            // Section Banner Header
            doc.setFillColor(isPF ? 240 : 31, isPF ? 240 : 55, isPF ? 240 : 93);
            doc.rect(margin, startY, contentWidth, 7, 'F');
            if (isPF) {
                doc.setTextColor(...colors.navy);
            } else {
                doc.setTextColor(255, 255, 255);
            }
            doc.setFontSize(9); doc.setFont("helvetica", "bold");
            doc.text(`${typeConfig.componentLabel}: ${parentQid}`, margin + 5, startY + 5);

            const sketchY = startY + 10;
            const gW = contentWidth * 0.38; // Left sketch panel width
            const dW = contentWidth * 0.60; // Right autoTable panel width
            const gX = margin;
            const dX = margin + gW + 4;

            // Sort records in group by elevation descending
            const sortedGroupRecords = [...gRecords].sort((a, b) => {
                const elevA = parseFloat(a.elevation ?? a.verification_depth ?? a.inspection_data?.verification_depth ?? a.inspection_data?.elevation ?? 0) || 0;
                const elevB = parseFloat(b.elevation ?? b.verification_depth ?? b.inspection_data?.verification_depth ?? b.inspection_data?.elevation ?? 0) || 0;
                return elevB - elevA;
            });

            // ── Draw Graphical Diagram Sketch with Bottom Bend ─────────────────
            const drawRiserSketch = (d: jsPDF, sx: number, sy: number, sw: number, recordsInGroup: any[]) => {
                const isPF = config.printFriendly;
                
                // Panel Border
                d.setDrawColor(...colors.darkBorder); d.setLineWidth(0.3);
                d.setFillColor(isPF ? 255 : 252, isPF ? 255 : 253, isPF ? 255 : 254);
                d.rect(sx, sy, sw, 145, 'FD');

                d.setFontSize(7.5); d.setFont("helvetica", "bold"); d.setTextColor(...colors.navy);
                d.text(`${typeConfig.sketchTitle} (${parentQid})`, sx + (sw / 2), sy + 5, { align: 'center' });

                // Scale bounds
                const elevs = recordsInGroup.map(r => parseFloat(r.elevation ?? r.verification_depth ?? r.inspection_data?.verification_depth ?? r.inspection_data?.elevation ?? 0)).filter(e => !isNaN(e));
                const maxElev = elevs.length > 0 ? Math.max(...elevs, 5) : 5;
                const minElev = elevs.length > 0 ? Math.min(...elevs, platformDepth - 5) : platformDepth;

                const topY = sy + 15;
                const mudlineY = sy + 125;
                const bottomY = sy + 138;
                const drawH = mudlineY - topY;

                const elevToY = (elev: number) => {
                    const ratio = (maxElev - elev) / (maxElev - platformDepth || 1);
                    return topY + (ratio * drawH);
                };

                const pipeCenterX = sx + (sw * 0.35);
                const rWidth = 8;
                const bRadius = 10;

                // 1. Sea Level Line (0m)
                if (maxElev >= 0 && minElev <= 0) {
                    const seaY = elevToY(0);
                    d.setDrawColor(...colors.seaLevel); d.setLineWidth(0.4);
                    d.line(sx + 4, seaY, sx + sw - 4, seaY);
                    d.setFontSize(6); d.setTextColor(...colors.seaLevel); d.setFont("helvetica", "bold");
                    d.text("SEA LEVEL (0.00m)", sx + 5, seaY - 1.5);
                }

                // 2. Seabed Mudline Line
                const seabedY = elevToY(platformDepth);
                d.setDrawColor(...colors.mudline); d.setLineWidth(0.8);
                d.line(sx + 4, seabedY, sx + sw - 4, seabedY);
                d.setFontSize(6); d.setTextColor(...colors.mudline); d.setFont("helvetica", "bold");
                d.text(`SEABED MUDLINE (${platformDepth.toFixed(1)}m)`, sx + 5, seabedY - 1.5);

                // Helper pipe cylinder renderer
                const drawPipeSegment = (x1: number, y1: number, x2: number, y2: number) => {
                    d.setLineWidth(rWidth); d.setDrawColor(120, 130, 150); d.line(x1, y1, x2, y2);
                    d.setLineWidth(rWidth * 0.7); d.setDrawColor(160, 175, 195); d.line(x1, y1, x2, y2);
                    d.setLineWidth(rWidth * 0.25); d.setDrawColor(220, 230, 240); d.line(x1 - 1, y1, x2 - 1, y2);
                };

                // 3. Pipe Geometry (Straight Pipe for I-Tube based on ELV_2; Curved bend for Riser & J-Tube)
                const isITube = targetPrefix === 'I';

                if (isITube) {
                    // Find I-Tube Terminator / End Elevation (elv_2 / ELV_2)
                    let itubeEndElev = platformDepth;
                    let foundElv2: number | null = null;

                    recordsInGroup.forEach(r => {
                        const meta = r.structure_components?.metadata || r.component?.metadata || {};
                        const inspData = r.inspection_data || {};
                        const val = meta.elv_2 ?? meta.ELV_2 ?? meta.end_elevation ?? r.structure_components?.elv_2 ?? r.structure_components?.end_elevation ?? inspData.elv_2 ?? inspData.end_elevation;
                        if (val != null && !isNaN(parseFloat(String(val)))) {
                            foundElv2 = parseFloat(String(val));
                        }
                    });

                    if (foundElv2 != null) {
                        itubeEndElev = foundElv2;
                    } else if (elevs.length > 0) {
                        itubeEndElev = Math.min(...elevs);
                    }

                    const pipeTopY = elevToY(maxElev);
                    const pipeBottomY = elevToY(itubeEndElev);
                    
                    // Draw vertical straight pipe
                    drawPipeSegment(pipeCenterX, pipeTopY, pipeCenterX, pipeBottomY);

                    // ── Draw Oval Grill Terminal at Pipe End ──
                    const rx = rWidth / 2; // 4mm radius matches exact pipe width
                    const ry = 2.5;        // 2.5mm vertical radius for 3D oval perspective

                    // 1. Oval Base Fill
                    d.setFillColor(180, 195, 210);
                    d.ellipse(pipeCenterX, pipeBottomY, rx, ry, 'F');

                    // 2. Grill Mesh Bars (Vertical & Horizontal Grid)
                    d.setDrawColor(...colors.navy);
                    d.setLineWidth(0.35);
                    // Vertical grill bars
                    d.line(pipeCenterX - 2, pipeBottomY - 1.8, pipeCenterX - 2, pipeBottomY + 1.8);
                    d.line(pipeCenterX, pipeBottomY - 2.5, pipeCenterX, pipeBottomY + 2.5);
                    d.line(pipeCenterX + 2, pipeBottomY - 1.8, pipeCenterX + 2, pipeBottomY + 1.8);
                    // Horizontal grill bar
                    d.line(pipeCenterX - 3.8, pipeBottomY, pipeCenterX + 3.8, pipeBottomY);

                    // 3. Oval Outer Rim Border
                    d.setDrawColor(...colors.navy);
                    d.setLineWidth(0.6);
                    d.ellipse(pipeCenterX, pipeBottomY, rx, ry, 'S');

                    // 4. Leader Line & Callout Label
                    d.setDrawColor(...colors.navy);
                    d.setLineWidth(0.3);
                    d.line(pipeCenterX + rx + 1, pipeBottomY, pipeCenterX + rx + 6, pipeBottomY);

                    d.setFontSize(5.5); d.setTextColor(...colors.navy); d.setFont("helvetica", "bold");
                    d.text(`TERMINATOR GRILL (${itubeEndElev.toFixed(1)}m)`, pipeCenterX + rx + 7, pipeBottomY + 1.5);
                } else {
                    // Riser & J-Tube Column + 90-degree curved bottom bend & horizontal pipeline
                    const bendStartY = seabedY;
                    const pipeTopY = elevToY(maxElev);
                    drawPipeSegment(pipeCenterX, pipeTopY, pipeCenterX, bendStartY);

                    const bendEndX = pipeCenterX + bRadius;
                    const bendEndY = bendStartY + bRadius;

                    const drawCurveSegment = (color: [number, number, number], width: number, offset: number) => {
                        const segs = 15;
                        let lx = pipeCenterX + offset;
                        let ly = bendStartY;
                        const cx = pipeCenterX + offset;
                        const cy = bendStartY;
                        const ex = bendEndX;
                        const ey = bendEndY + offset;
                        d.setDrawColor(...color); d.setLineWidth(width);
                        for (let j = 1; j <= segs; j++) {
                            const t = j / segs;
                            const tx = Math.pow(1 - t, 2) * cx + 2 * (1 - t) * t * cx + Math.pow(t, 2) * ex;
                            const ty = Math.pow(1 - t, 2) * cy + 2 * (1 - t) * t * ey + Math.pow(t, 2) * ey;
                            d.line(lx, ly, tx, ty);
                            lx = tx; ly = ty;
                        }
                    };

                    drawCurveSegment([120, 130, 150], rWidth, 0);
                    drawCurveSegment([160, 175, 195], rWidth * 0.7, 0);
                    drawCurveSegment([220, 230, 240], rWidth * 0.25, -1);

                    // Horizontal Pipeline extending right
                    const pipeRightX = sx + sw - 6;
                    d.setLineWidth(rWidth); d.setDrawColor(120, 130, 150); d.line(bendEndX, bendEndY, pipeRightX, bendEndY);
                    d.setLineWidth(rWidth * 0.7); d.setDrawColor(160, 175, 195); d.line(bendEndX, bendEndY, pipeRightX, bendEndY);
                    d.setLineWidth(rWidth * 0.25); d.setDrawColor(220, 230, 240); d.line(bendEndX, bendEndY - 1, pipeRightX, bendEndY - 1);

                    d.setFontSize(5.5); d.setTextColor(100, 115, 130); d.setFont("helvetica", "bold");
                    d.text("PIPELINE BEND", bendEndX + 2, bendEndY + 6);
                }

                // 5. Elevation Scale Ticks
                d.setDrawColor(180, 190, 205); d.setLineWidth(0.2);
                for (let e = Math.floor(maxElev); e >= Math.ceil(platformDepth); e -= 5) {
                    const ty = elevToY(e);
                    if (ty >= topY && ty <= bottomY) {
                        d.line(pipeCenterX - 10, ty, pipeCenterX - 5, ty);
                        d.setFontSize(5.5); d.setFont("helvetica", "normal"); d.setTextColor(100, 115, 130);
                        d.text(`${e}m`, pipeCenterX - 11, ty + 1.5, { align: 'right' });
                    }
                }

                // 6. Component Markers & Callouts (including Clamps)
                recordsInGroup.forEach((r) => {
                    const c = r.structure_components || {};
                    const qid = (c.q_id || r.q_id || r.component_qid || '').toUpperCase();
                    const compCode = (c.code || r.component_code || '').toUpperCase();
                    const inspData = r.inspection_data || {};
                    const elevRaw = r.elevation ?? r.verification_depth ?? inspData.verification_depth ?? inspData.elevation ?? inspData.depth ?? null;
                    if (elevRaw == null || isNaN(parseFloat(String(elevRaw)))) return;
                    const elev = parseFloat(elevRaw);
                    const py = elevToY(elev);
                    if (py < topY || py > bottomY) return;

                    const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                    const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                    const markerColor = isAnomaly ? colors.anomaly : colors.navy;

                    const isClamp = compCode === 'CL' || compCode === 'CLP' || compCode === 'CLAMP' || 
                                    qid.includes('CLP') || qid.includes('CLAMP') || qid.includes('SUPP') || 
                                    (r.description && r.description.toLowerCase().includes('clamp'));

                    if (isClamp) {
                        // Clamp Shape: Bracket rectangle with bolt ears
                        const cw = rWidth + 5; const ch = 4;
                        d.setFillColor(255, 255, 255);
                        d.rect(pipeCenterX - cw/2, py - ch/2, cw, ch, 'F');
                        d.setDrawColor(...colors.navy); d.setLineWidth(0.7);
                        d.rect(pipeCenterX - cw/2, py - ch/2, cw, ch, 'S');

                        // Left & Right bolt ears
                        d.setFillColor(...colors.navy);
                        d.rect(pipeCenterX - cw/2 - 2, py - 1, 2, 2, 'F');
                        d.rect(pipeCenterX + cw/2, py - 1, 2, 2, 'F');
                        d.circle(pipeCenterX - cw/2 - 1, py, 0.5, 'F');
                        d.circle(pipeCenterX + cw/2 + 1, py, 0.5, 'F');

                        // Leader line & text callout
                        d.setDrawColor(...colors.navy); d.setLineWidth(0.2);
                        d.line(pipeCenterX + cw/2 + 2, py, pipeCenterX + cw/2 + 6, py);
                        d.setFontSize(5); d.setTextColor(...colors.navy); d.setFont("helvetica", "bold");
                        d.text(`${elev.toFixed(1)}m ${qid} (Clamp)`, pipeCenterX + cw/2 + 7, py + 1.5);
                    } else if (compCode === 'AN' || qid.includes('AN')) {
                        // Anode shape
                        d.setFillColor(245, 158, 11); d.circle(pipeCenterX, py, 2, 'F');
                        d.setDrawColor(217, 119, 6); d.setLineWidth(0.3); d.circle(pipeCenterX, py, 2, 'S');
                        d.setFontSize(5); d.setTextColor(180, 83, 9); d.setFont("helvetica", "bold");
                        d.text(`${elev.toFixed(1)}m ${qid}`, pipeCenterX + 4, py + 1.5);
                    } else {
                        // General Node (Weld, Pipe section)
                        d.setFillColor(...markerColor); d.circle(pipeCenterX, py, 1.5, 'F');
                        d.setDrawColor(255, 255, 255); d.setLineWidth(0.2); d.circle(pipeCenterX, py, 1.5, 'S');
                        
                        d.setDrawColor(...markerColor); d.setLineWidth(0.2);
                        d.line(pipeCenterX + 1.5, py, pipeCenterX + 5, py);
                        d.setFontSize(5); d.setTextColor(...markerColor); d.setFont("helvetica", "bold");
                        d.text(`${elev.toFixed(1)}m ${qid}`, pipeCenterX + 6, py + 1.5);
                    }
                });
            };

            // Render Riser Graphical Sketch
            drawRiserSketch(doc, gX, sketchY, gW, sortedGroupRecords);

            // ── AutoTable for Details on Right Panel ─────────────────────────────
            const tableRows = sortedGroupRecords.map((r, idx) => {
                const itemNo = idx + 1;
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

                return {
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
                };
            });

            autoTable(doc, {
                startY: sketchY,
                margin: { left: dX, right: margin, top: margin + 22 + 6, bottom: 20 },
                tableWidth: dW,
                head: [
                    ['Item No.', 'QID', 'Elev', 'Dive', 'CP', 'UT', 'Findings']
                ],
                body: tableRows.map(tr => tr.rowCells),
                theme: 'grid',
                headStyles: { 
                    fillColor: isPF ? [255, 255, 255] : colors.navy, 
                    textColor: isPF ? colors.navy : 255, 
                    fontSize: 7, 
                    fontStyle: 'bold', 
                    halign: 'center',
                    lineWidth: 0.3,
                    lineColor: colors.border
                },
                styles: { 
                    fontSize: 7, 
                    cellPadding: 2, 
                    textColor: colors.text, 
                    lineColor: colors.border,
                    lineWidth: 0.2
                },
                tableLineWidth: 0.3,
                tableLineColor: colors.darkBorder,
                didParseCell: (data) => {
                    if (data.section === 'body') {
                        const tr = tableRows[data.row.index];
                        if (tr) {
                            if (tr.isAnomaly) {
                                data.cell.styles.textColor = colors.anomaly;
                                data.cell.styles.fontStyle = 'bold';
                            } else if (tr.isRectified) {
                                data.cell.styles.textColor = colors.rectified;
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    }
                },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' },
                    1: { cellWidth: 20, fontStyle: 'bold', halign: 'left' },
                    2: { cellWidth: 14, halign: 'center' },
                    3: { cellWidth: 13, halign: 'center' },
                    4: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
                    5: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
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
                const drawSig = (label: string, lx: number) => {
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
                    doc.text("Date:", lx + 2, sigY + 13.5);
                    doc.text("Signature:", lx + 2, sigY + 17);
                };

                drawSig('PREPARED BY', margin);
                drawSig('REVIEWED BY', margin + sigW);
                drawSig('APPROVED BY', margin + (sigW * 2));
            }
        }

        // Apply Watermark & Signatures
        applyWatermarkAndSignaturesGlobal(doc, config);

        if (config.returnBlob) return doc.output("blob");

        doc.save(`${typeConfig.filePrefix}_${(config?.reportNoPrefix || headerData?.sowReportNo) || 'Report'}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("Diving RRISI Sketch Report Generation Error:", e);
        throw e;
    }
};
