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
    jobPackId?: number;
    structureId?: number;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    returnBlob?: boolean;
    reportType?: 'R' | 'J' | 'I'; // 'R' = Riser, 'J' = J-Tube, 'I' = I-Tube
    showSignatures?: boolean;
    isBlankReport?: boolean;
}

export const generateROVRRISIReport = async (
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

        // Determine Report Type & Filter
        const rType = config.reportType || 'R';
        const typeConfig = {
            'R': { title: 'Riser Survey Report (ROV)', prefix: 'R', label: 'RISER', file: 'Riser_Survey_Report_ROV' },
            'J': { title: 'J-Tube Inspection Report (ROV)', prefix: 'J', label: 'J-TUBE', file: 'JTube_Inspection_Report_ROV' },
            'I': { title: 'I-Tube Inspection Report (ROV)', prefix: 'I', label: 'I-TUBE', file: 'ITube_Inspection_Report_ROV' }
        }[rType];

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            anomaly: [239, 68, 68] as [number, number, number],
            rectified: [34, 197, 94] as [number, number, number],
            riser: [160, 175, 195] as [number, number, number],
            mudline: [145, 123, 76] as [number, number, number],
        };

        const supabase = createClient();

        // ── 1. Context ──────────────────────────────────────────────────────────
        const effectiveStructureId = config.structureId || 
            records.find(r => r.structure_id)?.structure_id || 
            records.find(r => r.structure_components?.structure_id)?.structure_components?.structure_id;

        const { data: platform } = effectiveStructureId 
            ? await supabase.from('u_platform').select('water_depth').eq('id', effectiveStructureId).maybeSingle()
            : { data: null };
        const platformDepth = platform?.water_depth ? -Math.abs(platform.water_depth) : -35;

        // Filter records strictly by type and prefix
        const filteredRecords = records.filter(r => {
            const qid = (r.structure_components?.q_id || r.q_id || r.component_qid || '').toUpperCase();
            const typeCode = (r.inspection_type?.code || r.inspection_type_code || "").toUpperCase();
            const compCode = (r.structure_components?.code || r.component_code || "").toUpperCase();
            
            if (rType === 'R') {
                return (typeCode === 'RRISI' || typeCode === 'RISER' || typeCode === 'CPSURV' || typeCode === 'MBINS') &&
                       (qid.startsWith('R') || compCode === 'RS' || compCode === 'CL' || qid.includes('SUPP') || qid.includes('CLAMP')) &&
                       !qid.startsWith('RISG');
            } else if (rType === 'J') {
                return (typeCode === 'JTISI' || typeCode === 'JTUBE' || typeCode === 'CPSURV' || typeCode === 'MBINS') &&
                       (qid.startsWith('J') || compCode === 'JT');
            } else if (rType === 'I') {
                return (typeCode === 'ITISI' || typeCode === 'ITUBE' || typeCode === 'CPSURV' || typeCode === 'MBINS') &&
                       (qid.startsWith('I') || compCode === 'IT');
            }
            return false;
        });

        if (!config.isBlankReport && filteredRecords.length === 0) {
            return null;
        }

        // Helper to extract identifier key (e.g., '11' from 'R11-SK358-WLP-A' or 'RIS-11-SUPP 1M')
        const extractTubeKey = (qid: string, prefix: 'R' | 'J' | 'I') => {
            if (!qid) return null;
            const q = qid.toUpperCase().trim();
            let pattern: RegExp;
            if (prefix === 'R') {
                pattern = /^(?:RISER|RIS|RS|R)[-_ ]*(\d+[A-Z]?)/i;
            } else if (prefix === 'J') {
                pattern = /^(?:JTUBE|JT|J)[-_ ]*(\d+[A-Z]?)/i;
            } else {
                pattern = /^(?:ITUBE|IT|I)[-_ ]*(\d+[A-Z]?)/i;
            }
            const match = q.match(pattern);
            if (match) {
                const rawNum = match[1].toUpperCase();
                const normNum = rawNum.replace(/^0+/, '') || '0';
                return { raw: rawNum, norm: normNum };
            }
            return null;
        };

        // Helper to check if a component is a primary parent Riser / J-Tube / I-Tube
        const isParentComp = (c: any, type: 'R' | 'J' | 'I') => {
            if (!c) return false;
            const qid = (c.q_id || '').toUpperCase().trim();
            const code = (c.code || '').toUpperCase().trim();
            
            // Subcomponents cannot be primary parent
            if (qid.includes('SUPP') || qid.includes('CLAMP') || qid.includes('CLP') || qid.includes('ANODE') || qid.includes('FLANGE') || qid.includes('WELD') || qid.includes('RISG')) {
                return false;
            }
            const meta = c.metadata || {};
            if (meta.associated_comp_id || meta.parent_id || meta.comp_id_parent || meta.parent_comp_id || meta.associated_comp_qid || meta.parent_qid) {
                return false;
            }
            if (type === 'R') {
                return (code === 'RS' || code === 'RISER' || qid.startsWith('R') || qid.startsWith('RIS')) && !qid.startsWith('RISG');
            }
            if (type === 'J') {
                return code === 'JT' || code === 'JTUBE' || qid.startsWith('J');
            }
            if (type === 'I') {
                return code === 'IT' || code === 'ITUBE' || qid.startsWith('I');
            }
            return false;
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
            const key = extractTubeKey(qid, rType);
            if (key) {
                parentByKey.set(key.raw, c);
                parentByKey.set(key.norm, c);
            }
        };

        if (allComps) {
            allComps.forEach(c => {
                compRegistry.set(c.id, c);
                if (isParentComp(c, rType)) {
                    registerParent(c);
                }
            });
        }

        // Also register parent components from incoming inspection records
        filteredRecords.forEach(r => {
            const comp = r.structure_components;
            if (comp) {
                if (comp.id) compRegistry.set(comp.id, comp);
                if (isParentComp(comp, rType)) {
                    registerParent(comp);
                }
            }
        });

        // Helper to resolve parent component for any component / record
        const resolveParentComp = (comp: any, r: any) => {
            if (!comp) return null;
            if (isParentComp(comp, rType)) {
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
                if (isParentComp(cand, rType)) return cand;
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

            // 4. Key match (e.g. RIS-11-SUPP matches R11 via '11')
            const key = extractTubeKey(qid, rType);
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

        // Group records by parent component
        const risersMap = new Map<number, { riserComp: any, records: any[] }>();
        const unassigned: any[] = [];

        filteredRecords.forEach(r => {
            const comp = r.structure_components;
            if (!comp) return;
            const parent = resolveParentComp(comp, r);
            if (parent && parent.id) {
                if (!risersMap.has(parent.id)) {
                    risersMap.set(parent.id, { riserComp: parent, records: [] });
                }
                risersMap.get(parent.id)!.records.push(r);
            } else {
                unassigned.push(r);
            }
        });

        if (unassigned.length > 0) {
            if (risersMap.size === 1) {
                Array.from(risersMap.values())[0].records.push(...unassigned);
            } else {
                risersMap.set(0, { riserComp: { q_id: 'Miscellaneous' }, records: unassigned });
            }
        }

        const groups = Array.from(risersMap.values()).sort((a, b) => {
            const qA = a.riserComp?.q_id || ''; const qB = b.riserComp?.q_id || '';
            return qA.localeCompare(qB, undefined, { numeric: true, sensitivity: 'base' });
        });

        if (!config.isBlankReport && groups.length === 0) {
            return null;
        }

        const renderGroups = groups.length > 0 ? groups : [{
            riserComp: { q_id: 'Riser General', name: 'Riser' },
            records: []
        }];

        // ── 2. Rendering ────────────────────────────────────────────────────────

        let coLogo: any = null; let ctLogo: any = null;
        if (companySettings.logo_url) { try { coLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {} }
        if (headerData.contractorLogoUrl) { try { ctLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {} }

        const hH = 26;
        const drawHeader = (d: jsPDF) => {
             const isPF = config.printFriendly;
            if (isPF) { d.setDrawColor(...colors.navy); d.setLineWidth(0.5); d.rect(margin, margin, contentWidth, hH, 'S'); d.setTextColor(...colors.navy); }
            else { d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, hH, 'F'); d.setTextColor(255, 255, 255); }
            if (coLogo) drawLogo(d, coLogo, 16, 16, pageWidth - margin - 20, margin + 3, 'right', 'center');
            if (ctLogo) drawLogo(d, ctLogo, 16, 16, margin + 4, margin + 3, 'left', 'center');
            d.setFontSize(11); d.setFont("helvetica", "bold"); d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            d.setFontSize(8.5); d.setFont("helvetica", "normal"); d.text(companySettings.department_name || 'Technical Division', margin + (contentWidth/2), margin + 10.5, { align: 'center' });
            d.setFontSize(11); d.setFont("helvetica", "bold"); d.text(typeConfig.title, margin + (contentWidth/2), margin + 16.5, { align: 'center' });
            d.setFontSize(8); d.setFont("helvetica", "normal"); d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || 'N/A'}`, margin + (contentWidth/2), margin + 21, { align: 'center' });
        };

        const drawFooter = (d: jsPDF, pageNum: number, totalPages: number) => {
            const footerY = pageHeight - 10;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            d.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
            d.setFontSize(7); d.setTextColor(150, 150, 150);
            d.setFont("helvetica", "normal");
            d.text(`Report ID: ${(config?.reportNoPrefix || headerData?.sowReportNo) || 'N/A'}`, margin, footerY);
            d.text(`Printed: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, margin + contentWidth/2, footerY, { align: 'center' });
            d.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
        };

        const drawContext = (d: jsPDF, y: number, groupRecords: any[]) => {
            const rH = 7; const half = contentWidth / 2; const isPF = config.printFriendly;
            let sD: Date | null = null; let eD: Date | null = null;
            const ds = groupRecords.map(r => new Date(r.cr_date || r.created_at)).filter(d => !isNaN(d.getTime()));
            if (ds.length > 0) { sD = min(ds); eD = max(ds); }
            const dr = sD && eD ? `${format(sD, 'dd MMM yyyy')} - ${format(eD, 'dd MMM yyyy')}` : 'N/A';
            const drawBox = (l: string, v: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1); if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rH, isPF ? 'S' : 'F'); d.rect(x, ty, w, rH, 'S');
                d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold"); d.text(l, x + 2, ty + 4.8);
                d.setFont("helvetica", "normal"); d.text(String(v), x + 36, ty + 4.8);
            };
            drawBox('Structure:', headerData.platformName || 'N/A', margin, half, y);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + half, half, y);
            drawBox('Job Pack:', headerData.jobpackName || 'N/A', margin, half, y + rH);
            drawBox('Insp. Date Range:', dr, margin + half, half, y + rH);
            return y + (rH * 2) + 4;
        };

        for (let i = 0; i < renderGroups.length; i++) {
            const group = renderGroups[i];
            const riser = group.riserComp;
            const recordsInGroup = group.records;

            if (i > 0) doc.addPage();
            drawHeader(doc);
            let currentY = drawContext(doc, margin + hH + 2, recordsInGroup);

            // Sub-header
            doc.setFillColor(...colors.navy); doc.rect(margin, currentY, contentWidth, 7, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
            doc.text(`${typeConfig.label} QID: ${riser?.q_id || 'Unknown'}`, margin + 5, currentY + 5);
            currentY += 10;

            const gW = contentWidth * 0.38; const dW = contentWidth * 0.60;
            const gX = margin; const dX = margin + gW + 4;
            const isPF = config.printFriendly;

            // --- Elev Processing ---
            const rMeta = riser?.metadata || {};
            const designStart = parseFloat(rMeta.start_elevation ?? rMeta.start_elev ?? 5);
            const designEnd = parseFloat(rMeta.end_elevation ?? rMeta.end_elev ?? platformDepth);
            
            const suspRec = recordsInGroup.find(r => r.inspection_data?.suspension_gap || r.description?.toLowerCase().includes('suspension'));
            const suspGap = suspRec ? parseFloat(suspRec.inspection_data?.suspension_gap || 0) : 0;
            const mudTouchDist = suspRec ? parseFloat(suspRec.inspection_data?.mud_touch_distance || 15) : 0;

            const rWidth = 8; const bRadius = 10;
            const bottomElev = designEnd;
            const mudlineElev = designEnd - suspGap;

            const sMax = Math.max(designStart + 2, 5);
            const sMin = Math.min(mudlineElev - 10, -40);
            const eRange = sMax - sMin;

            const gTopY = currentY + 15;
            const gMudlineY = gTopY + 115;
            const eToY = (e: number) => gTopY + ((sMax - e) / eRange) * (gMudlineY - gTopY);

            // Sketch Card Panel
            const sketchH = 145;
            doc.setDrawColor(...colors.border); doc.setLineWidth(0.3);
            doc.setFillColor(isPF ? 255 : 252, isPF ? 255 : 253, isPF ? 255 : 254);
            doc.rect(gX, currentY, gW, sketchH, 'FD');

            doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.navy);
            doc.text(`${typeConfig.label} SKETCH (${riser?.q_id || 'Unknown'})`, gX + (gW / 2), currentY + 5, { align: 'center' });

            const pipeCenterX = gX + (gW * 0.38);
            const cX = pipeCenterX;
            const pipeY = eToY(bottomElev); 
            const mudY = eToY(mudlineElev) + (rWidth / 2);
            const isStraight = rType === 'I';
            const bY = isStraight ? pipeY : eToY(bottomElev + bRadius);

            // 1. Sea Level Line (0m)
            if (sMax >= 0 && sMin <= 0) {
                const seaY = eToY(0);
                doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.4);
                doc.line(gX + 2, seaY, gX + gW - 2, seaY);
                doc.setFontSize(5); doc.setTextColor(59, 130, 246); doc.setFont("helvetica", "bold");
                doc.text("SEA LEVEL (0.00m)", gX + 2.5, seaY - 1.2);
            }

            // 2. Seabed Mudline Line
            doc.setDrawColor(...colors.mudline); doc.setLineWidth(1.2);
            if (suspGap === 0) {
                doc.line(gX + 2, mudY, gX + gW - 2, mudY);
                doc.setFontSize(5); doc.setTextColor(...colors.mudline); doc.setFont("helvetica", "bold");
                doc.text(`SEABED (${bottomElev.toFixed(1)}m)`, gX + 2.5, mudY - 1.5);
            } else {
                const startMudY = mudY;
                const endMudY = pipeY + (rWidth / 2);
                const touchMudX = Math.min(pipeCenterX + bRadius + (mudTouchDist * (gW / 60)), gX + gW - 4);
                doc.line(gX + 2, startMudY, pipeCenterX - 10, startMudY);
                let lx = pipeCenterX - 10; let ly = startMudY;
                const segs = 20;
                for (let j = 1; j <= segs; j++) {
                    const t = j / segs;
                    const tx = Math.pow(1 - t, 2) * (pipeCenterX - 10) + 2 * (1 - t) * t * pipeCenterX + Math.pow(t, 2) * touchMudX;
                    const ty = Math.pow(1 - t, 2) * startMudY + 2 * (1 - t) * t * endMudY + Math.pow(t, 2) * endMudY;
                    doc.line(lx, ly, tx, ty); lx = tx; ly = ty;
                }
                doc.line(lx, ly, gX + gW - 2, ly);
                doc.setFontSize(5); doc.setTextColor(...colors.mudline); doc.setFont("helvetica", "bold");
                doc.text(`SUSPENSION (${suspGap}m)`, pipeCenterX, startMudY + 4, { align: 'center' });
                doc.text(`SEABED (${bottomElev.toFixed(1)}m)`, gX + 2.5, startMudY - 1.5);
            }

            // --- Draw Riser ---
            const drawP = (x1: number, y1: number, x2: number, y2: number, isV: boolean) => {
                doc.setLineWidth(rWidth); doc.setDrawColor(120, 130, 150); doc.line(x1, y1, x2, y2);
                doc.setLineWidth(rWidth * 0.7); doc.setDrawColor(160, 175, 195); doc.line(x1, y1, x2, y2);
                doc.setLineWidth(rWidth * 0.2); doc.setDrawColor(220, 230, 240); 
                const o = -rWidth * 0.15; if (isV) doc.line(x1 + o, y1, x2 + o, y2); else doc.line(x1, y1 + o, x2, y2 + o);
            };
            if (rType === 'I') {
                let itubeEndElev = designEnd;
                let foundElv2: number | null = null;
                recordsInGroup.forEach(r => {
                    const meta = r.structure_components?.metadata || r.component?.metadata || {};
                    const inspData = r.inspection_data || {};
                    const val = meta.elv_2 ?? meta.ELV_2 ?? meta.end_elevation ?? r.structure_components?.elv_2 ?? r.structure_components?.end_elevation ?? inspData.elv_2 ?? inspData.end_elevation;
                    if (val != null && !isNaN(parseFloat(String(val)))) {
                        foundElv2 = parseFloat(String(val));
                    }
                });
                if (foundElv2 != null) itubeEndElev = foundElv2;

                const pipeTopY = eToY(designStart);
                const pipeBottomY = eToY(itubeEndElev);
                drawP(cX, pipeTopY, cX, pipeBottomY, true);

                const rx = rWidth / 2;
                const ry = 2.5;

                // Oval Base Fill
                doc.setFillColor(180, 195, 210);
                doc.ellipse(cX, pipeBottomY, rx, ry, 'F');

                // Grill Mesh Bars
                doc.setDrawColor(...colors.navy);
                doc.setLineWidth(0.35);
                doc.line(cX - 2, pipeBottomY - 1.8, cX - 2, pipeBottomY + 1.8);
                doc.line(cX, pipeBottomY - 2.5, cX, pipeBottomY + 2.5);
                doc.line(cX + 2, pipeBottomY - 1.8, cX + 2, pipeBottomY + 1.8);
                doc.line(cX - 3.8, pipeBottomY, cX + 3.8, pipeBottomY);

                // Oval Rim Border
                doc.setDrawColor(...colors.navy);
                doc.setLineWidth(0.6);
                doc.ellipse(cX, pipeBottomY, rx, ry, 'S');

                // Leader line and Callout
                // Left Side: Elevation
                const leftTermLineEnd = cX - rx - 5;
                doc.setDrawColor(...colors.navy);
                doc.setLineWidth(0.3);
                doc.line(cX - rx, pipeBottomY, leftTermLineEnd, pipeBottomY);
                doc.setFontSize(5); doc.setTextColor(...colors.navy); doc.setFont("helvetica", "bold");
                doc.text(`${itubeEndElev.toFixed(1)}m`, leftTermLineEnd - 1, pipeBottomY + 1.2, { align: "right" });

                // Right Side: Terminator Label
                const rightTermLineEnd = Math.min(cX + rx + 5, gX + gW - 22);
                doc.line(cX + rx, pipeBottomY, rightTermLineEnd, pipeBottomY);
                doc.text("TERMINATOR GRILL", rightTermLineEnd + 1, pipeBottomY + 1.2);
            } else {
                drawP(cX, eToY(designStart), cX, bY, true);
                const endX = cX + bRadius; 
                if (!isStraight) {
                    const drawC = (color: [number, number, number], width: number, off: number) => {
                        const segs = 20; let lx = cX + off; let ly = bY;
                        const cx = cX + off; const cy = bY; const ex = endX; const ey = pipeY + off;
                        doc.setDrawColor(...color); doc.setLineWidth(width);
                        for (let j = 1; j <= segs; j++) {
                            const t = j / segs;
                            const tx = Math.pow(1 - t, 2) * cx + 2 * (1 - t) * t * cx + Math.pow(t, 2) * ex;
                            const ty = Math.pow(1 - t, 2) * cy + 2 * (1 - t) * t * ey + Math.pow(t, 2) * ey;
                            doc.line(lx, ly, tx, ty); lx = tx; ly = ty;
                        }
                    };
                    drawC([120, 130, 150], rWidth, 0); drawC([160, 175, 195], rWidth * 0.7, 0); drawC([220, 230, 240], rWidth * 0.2, -rWidth * 0.15);
                }
                if ((rType as string) !== 'J' && (rType as string) !== 'I') {
                    const pipeEndX = Math.min(gX + gW - 4, endX + 25);
                    drawP(endX, pipeY, pipeEndX, pipeY, false);
                    doc.setFontSize(5); doc.setTextColor(120, 130, 150); doc.text("PIPELINE", Math.min(endX + 6, gX + gW - 14), pipeY + 6);
                }
            }

            // Scale on Far Left
            doc.setLineWidth(0.1); doc.setDrawColor(200, 200, 200);
            for (let e = Math.floor(sMax); e >= sMin; e -= 5) {
                const ey = eToY(e);
                if (ey <= gMudlineY + 15) {
                    doc.line(gX + 7, ey, gX + 10, ey);
                    doc.setFontSize(5); doc.setTextColor(150, 150, 150); doc.text(`${e}m`, gX + 2, ey + 1);
                }
            }

            // Mark Points
            recordsInGroup.forEach(r => {
                const c = r.structure_components || {}; const d = r.inspection_data || {};
                const el = parseFloat(r.elevation ?? d.elevation); if (isNaN(el)) return;
                const py = eToY(el);
                const isA = r.has_anomaly || (r.insp_anomalies && r.insp_anomalies.length > 0);
                const col = isA ? colors.anomaly : colors.navy;
                if (c.code === 'CL' || d.clamp_type || c.q_id?.includes('SUPP') || c.q_id?.includes('CLP')) {
                    const cw = rWidth + 8; const ch = 4.5; const fw = 3;
                    doc.setFillColor(255, 255, 255); doc.rect(cX - cw/2, py - ch/2, cw, ch, 'F');
                    doc.setDrawColor(...colors.navy); doc.setLineWidth(0.8); doc.rect(cX - cw/2, py - ch/2, cw, ch, 'S');
                    doc.rect(cX - cw/2 - fw, py - 1, fw, 2, 'S'); doc.rect(cX + cw/2, py - 1, fw, 2, 'S');
                    doc.setFillColor(...colors.navy); doc.circle(cX - cw/2 - fw/2, py, 0.5, 'F'); doc.circle(cX + cw/2 + fw/2, py, 0.5, 'F');
                    
                    // Left Side: Elevation Value
                    doc.setLineWidth(0.3); doc.setDrawColor(...colors.navy);
                    const leftLineStart = cX - cw/2 - fw;
                    const leftLineEnd = leftLineStart - 5;
                    doc.line(leftLineStart, py, leftLineEnd, py);
                    doc.setFontSize(5.5); doc.setTextColor(...colors.navy); 
                    doc.text(`${el}m`, leftLineEnd - 1, py + 1, { align: "right" });

                    // Right Side: Object Name / QID
                    const lineStart = cX + cw/2 + fw;
                    const lineEnd = Math.min(lineStart + 5, gX + gW - 20);
                    doc.line(lineStart, py, lineEnd, py);
                    doc.setFontSize(5.5); doc.setTextColor(...colors.navy);
                    let qidText = c.q_id || 'Clamp';
                    const maxQidW = (gX + gW - 2) - (lineEnd + 1);
                    if (doc.getTextWidth(qidText) > maxQidW) {
                        while (qidText.length > 3 && doc.getTextWidth(qidText + "...") > maxQidW) {
                            qidText = qidText.slice(0, -1);
                        }
                        qidText += "...";
                    }
                    doc.text(qidText, lineEnd + 1, py + 1);
                } else {
                    doc.setFillColor(...col); doc.circle(cX, py, 1.8, 'F');
                    doc.setDrawColor(...col); doc.setLineWidth(0.1); 

                    // Left Side: Elevation Value
                    const leftLineEnd = cX - 2 - 5;
                    doc.line(cX - 2, py, leftLineEnd, py);
                    doc.setFontSize(5.5); doc.setTextColor(...col);
                    doc.text(`${el}m`, leftLineEnd - 1, py + 1, { align: "right" });
                }
            });

            // --- Table ---
            // Sort by Elevation (descending) but ensure Bends/Pipelines are always last
            const sortedR = [...recordsInGroup].sort((a, b) => {
                const itemA = (a.inspection_data?.riser_item || a.description || "").toLowerCase();
                const itemB = (b.inspection_data?.riser_item || b.description || "").toLowerCase();
                
                const isBendA = itemA.includes('bend');
                const isBendB = itemB.includes('bend');
                const isPipeA = itemA.includes('pipeline') || itemA.includes('pipe');
                const isPipeB = itemB.includes('pipeline') || itemB.includes('pipe');

                // Priority: Normal < Bend < Pipeline
                if (isPipeA && !isPipeB) return 1;
                if (!isPipeA && isPipeB) return -1;
                if (isBendA && !isBendB) return 1;
                if (!isBendA && isBendB) return -1;

                // Otherwise sort by elevation descending
                const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                return elB - elA;
            });
            autoTable(doc, {
                startY: currentY,
                margin: { left: dX, right: margin, top: margin + hH + 6 },
                tableWidth: dW,
                head: [['Item No.', 'Loc / Elev', 'Dive No.', 'CP (mV)', 'Findings / Anomalies']],
                body: sortedR.length > 0 ? sortedR.map((r, idx) => {
                    const itemNo = idx + 1;
                    const rd = r.inspection_data || {};
                    const anoms = r.insp_anomalies || [];
                    const isAnom = r.has_anomaly || anoms.length > 0;
                    const c = r.structure_components || {};
                    const isClamp = c.code === 'CL' || rd.clamp_type || c.q_id?.includes('SUPP') || c.q_id?.includes('CLP');

                    const diveNo = r.insp_rov_jobs?.job_no || r.insp_dive_jobs?.job_no || r.insp_rov_jobs?.name || r.dive_no || r.inspection_data?.dive_no || 'N/A';

                    const primaryCP = rd.cp_rdg ?? rd.cp_reading_mv ?? rd.cp ?? "";
                    const additionals: any[] = Array.isArray(rd.cp_rdg_additional) ? rd.cp_rdg_additional : (Array.isArray(rd.cp_readings) ? rd.cp_readings : []);
                    const additionalCPs = additionals
                        .map((a: any) => a.reading ?? a.cp_rdg ?? "")
                        .filter((val: any) => val !== "" && val !== null && val !== undefined);

                    const cpList = [primaryCP, ...additionalCPs].filter((val: any) => val !== "" && val !== null && val !== undefined);
                    const cpDisplay = cpList.length > 0 ? cpList.map(val => String(val)).join('\n') : '-';

                    let findingsParts: string[] = [];
                    if (isClamp) findingsParts.push(`Clamp: ${c.q_id || 'N/A'}`);
                    if (r.description && r.description.trim()) findingsParts.push(r.description.trim());

                    additionals.forEach((a: any) => {
                        const val = a.reading ?? a.cp_rdg ?? "";
                        if ((val !== "" && val !== null && val !== undefined) || a.location) {
                            const loc = a.location ? ` @ ${a.location}` : "";
                            const unit = String(val).toLowerCase().includes("mv") || !val ? "" : " mV";
                            findingsParts.push(`Add. CP${loc}: ${val}${unit}`);
                        }
                    });

                    if (isAnom && anoms.length > 0) {
                        findingsParts.push(...anoms.map((a: any) => `[Anom Ref: ${a.ref_no || 'N/A'}]${a.is_rectified ? `\n(Rectified: ${a.rect_comments || ''})` : ''}`));
                    }

                    const findings = findingsParts.length > 0 ? findingsParts.join('\n') : 'No significant findings';

                    return [
                        { content: String(itemNo), styles: { halign: 'center' } },
                        { content: r.elevation ? `${r.elevation}m` : (rd.riser_item || 'N/A'), styles: { fontStyle: 'bold', halign: 'center' } },
                        { content: String(diveNo), styles: { halign: 'center' } },
                        { content: cpDisplay, styles: { halign: 'center' } },
                        { content: findings, styles: { textColor: isAnom ? colors.anomaly : colors.text } }
                    ];
                }) : [[
                    { content: "-", styles: { halign: 'center' } },
                    { content: "-", styles: { halign: 'center' } },
                    { content: "-", styles: { halign: 'center' } },
                    { content: "-", styles: { halign: 'center' } },
                    { content: "No observations recorded for this scope.", styles: { textColor: colors.text } }
                ]],
                theme: 'grid',
                headStyles: { fillColor: colors.navy, textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
                styles: { fontSize: 7, cellPadding: 2 },
                columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 16 }, 2: { cellWidth: 14 }, 3: { cellWidth: 14 }, 4: { cellWidth: 'auto' } },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) drawHeader(doc);
                }
            });
        }

        const finalY = (doc as any).lastAutoTable?.finalY ?? (margin + hH + 20);
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                drawHeader(doc);
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
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            drawFooter(doc, j, totalPages);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        doc.save(`${typeConfig.file}_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (e) { console.error("ROV Tube Report Error", e); throw e; }
};
