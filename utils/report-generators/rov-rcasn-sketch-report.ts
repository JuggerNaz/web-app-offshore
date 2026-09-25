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
    showSignatures?: boolean;
    isBlankReport?: boolean;
}

/**
 * ROV Caisson Survey (Sketch) Report
 */
export const generateROVCasnSketchReport = async (
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

        // 1. Context & Grouping
        const { data: platform } = await supabase.from('u_platform').select('water_depth').eq('id', config.structureId).maybeSingle();
        const platformDepth = platform?.water_depth ? -Math.abs(platform.water_depth) : -35;

        // Filter records by inspection code RCASN and component code CS
        const filteredRecords = records.filter(r => {
            const typeCode = (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase();
            const compCode = (r.structure_components?.code || '').toUpperCase();
            return typeCode === 'RCASN' || compCode === 'CS';
        });

        if (!config.isBlankReport && filteredRecords.length === 0) {
            return null;
        }

        const { data: allComps } = await supabase.from('structure_components').select('id, q_id, code, name, metadata').eq('structure_id', config.structureId);
        // 1. Context & Grouping
        const compRegistry = new Map<number, any>();
        const qidRegistry  = new Map<string, any>();
        if (allComps) {
            allComps.forEach(c => {
                compRegistry.set(c.id, c);
                qidRegistry.set(c.q_id.toUpperCase(), c);
            });
        }

        const getGroupKey = (r: any): string => {
            const comp = r.structure_components || {};
            const metadata = comp.metadata || {};
            const qid = (comp.q_id || "Unknown").toUpperCase();
            
            // 1. Check explicit association in record metadata
            const parentId = metadata.associated_comp_id || metadata.parent_id || metadata.comp_id_parent || metadata.parent_comp_id || metadata.associated_id;
            let parentQid  = metadata.parent_qid || metadata.parent_q_id;

            // Helper to find the ultimate "CS" parent in the hierarchy
            const findUltimateCSParent = (cid: number | null, depth = 0): string | null => {
                if (!cid || depth > 5) return null;
                const c = compRegistry.get(cid);
                if (!c) return null;
                
                const meta = c.metadata || {};
                const pId = meta.associated_comp_id || meta.parent_id || meta.comp_id_parent || meta.parent_comp_id || meta.associated_id;
                const typeCode = (c.code || "").toUpperCase();
                
                // If it's a CS and has no parent, it's our ultimate group key
                if (typeCode === "CS" && !pId) return c.q_id;
                
                // Otherwise keep climbing
                return findUltimateCSParent(pId, depth + 1) || (typeCode === "CS" ? c.q_id : null);
            };

            // 2. Try climbing the registry hierarchy
            const ultimateParent = findUltimateCSParent(parentId || comp.id);
            if (ultimateParent) return ultimateParent;

            // 3. Fallback to explicit parent QID string
            if (parentQid) return parentQid;

            // 4. Fallback to prefix matching against all top-level CS components
            if (qid.startsWith("CS")) {
                let bestMatch = "";
                allComps?.forEach(c => {
                    const cCode = (c.code || "").toUpperCase();
                    const cQid  = (c.q_id || "").toUpperCase();
                    const cMeta = c.metadata || {};
                    const cpId  = cMeta.associated_comp_id || cMeta.parent_id || cMeta.comp_id_parent || cMeta.parent_comp_id || cMeta.associated_id;
                    
                    if (cCode === "CS" && !cpId && qid.startsWith(cQid) && cQid.length > bestMatch.length) {
                        bestMatch = c.q_id;
                    }
                });
                if (bestMatch) return bestMatch;
            }

            // 5. Fallback to regex for CS-XX pattern
            const match = qid.match(/^(CS-[^-_ ]+)/i);
            if (match) return match[1];

            return (comp.code || "").toUpperCase() === "CS" ? qid : "General";
        };

        const caissonGroups: Record<string, any[]> = {};
        const caissonObjects: Record<string, any> = {};

        filteredRecords.forEach(r => {
            const comp = r.structure_components || {};
            const typeCode = (comp.code || "").toUpperCase();
            const groupKey = getGroupKey(r).toUpperCase();
            
            if (!caissonGroups[groupKey]) caissonGroups[groupKey] = [];
            caissonGroups[groupKey].push(r);
            
            // If this record is for the caisson itself, store it as the representative object
            if (typeCode === "CS" && !caissonObjects[groupKey]) {
                caissonObjects[groupKey] = comp;
            }
        });

        const sortedGroupKeys = Object.keys(caissonGroups).sort((a, b) => {
            if (a === "GENERAL") return 1;
            if (b === "GENERAL") return -1;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });

        const groups = sortedGroupKeys.map(key => {
            // Find the actual CS component for this key to get metadata
            const caissonComp = caissonObjects[key] || allComps?.find(c => 
                c.q_id.toUpperCase() === key || 
                (key !== "GENERAL" && c.q_id.toUpperCase().startsWith(key))
            ) || { q_id: key };
            return { caissonComp, records: caissonGroups[key] };
        });

        // 2. Assets
        let coLogo: any = null; let ctLogo: any = null;
        if (companySettings.logo_url) { try { coLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {} }
        if (headerData.contractorLogoUrl) { try { ctLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {} }

        const HEADER_H = 26;

        const drawHeader = (d: jsPDF) => {
            const isPF = config.printFriendly;
            if (isPF) { d.setDrawColor(...colors.navy); d.setLineWidth(0.5); d.rect(margin, margin, contentWidth, HEADER_H, 'S'); d.setTextColor(...colors.navy); }
            else { d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, HEADER_H, 'F'); d.setTextColor(255, 255, 255); }
            if (coLogo) drawLogo(d, coLogo, 16, 16, pageWidth - margin - 20, margin + 4, 'right', 'center');
            if (ctLogo) drawLogo(d, ctLogo, 16, 16, margin + 4, margin + 4, 'left', 'center');
            d.setFontSize(11); d.setFont("helvetica", "bold"); d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + contentWidth/2, margin + 6, { align: 'center' });
            d.setFontSize(8.5); d.setFont("helvetica", "normal"); d.text(companySettings.department_name || 'Technical Division', margin + contentWidth/2, margin + 10.5, { align: 'center' });
            d.setFontSize(11); d.setFont("helvetica", "bold"); d.text("Caisson Survey (Sketch) Report (ROV)", margin + contentWidth/2, margin + 16.5, { align: 'center' });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || 'N/A'}`, margin + contentWidth/2, margin + 21, { align: 'center' });
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

        if (!config.isBlankReport && groups.length === 0) {
            return null;
        }

        const renderGroups = groups.length > 0 ? groups : [{
            caissonId: "GENERAL",
            caissonComp: { q_id: "GENERAL", name: "Caisson" },
            records: []
        }];

        for (let i = 0; i < renderGroups.length; i++) {
            const group = renderGroups[i];
            const caisson = group.caissonComp;
            const recordsInGroup = group.records;
            if (i > 0) doc.addPage();

            drawHeader(doc);
            let currentY = drawContext(doc, margin + HEADER_H + 2, recordsInGroup);

            // Sub-header
            doc.setFillColor(...colors.navy); doc.rect(margin, currentY, contentWidth, 7, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
            doc.text(`Caisson QID: ${caisson?.q_id || 'Unknown'}`, margin + 5, currentY + 5);
            currentY += 10;

            const gW = contentWidth * 0.38; const dW = contentWidth * 0.60;
            const gX = margin; const dX = margin + gW + 4;

            // --- Elev Processing ---
            const rMeta = caisson?.metadata || {};
            const rAdd = rMeta.additionalInfo || {};
            
            // Find terminator in this group to define the bottom
            const terminatorRecord = recordsInGroup.find(r => {
                const rqid = (r.structure_components?.q_id || '').toUpperCase();
                const rname = (r.structure_components?.name || '').toUpperCase();
                return rqid.includes('TERM') || rname.includes('TERMINATOR');
            });
            const terminatorQid = terminatorRecord?.structure_components?.q_id || "CAISSON TERMINATOR";
            const terminatorElev = terminatorRecord ? parseFloat(terminatorRecord.elevation ?? terminatorRecord.inspection_data?.elevation) : NaN;

            // Priority list for Elevation 1 (Top)
            const designStart = parseFloat(
                rMeta.elv_1 ?? 
                rMeta.elevation_1 ?? 
                rAdd.elv_1 ?? 
                rAdd.elevation_1 ?? 
                rMeta.start_elevation ?? 
                rMeta.start_elev ?? 
                5
            );

            // Priority list for Elevation 2 (Bottom / Terminator)
            const designEnd = !isNaN(terminatorElev) ? terminatorElev : parseFloat(
                rMeta.elv_2 ?? 
                rMeta.elevation_2 ?? 
                rAdd.elv_2 ?? 
                rAdd.elevation_2 ?? 
                rMeta.end_elevation ?? 
                rMeta.end_elev ?? 
                platformDepth
            );
            
            const rWidth = 12;
            const sketchH = 155;
            const isPF = config?.printFriendly;

            // Sketch Card Panel (Border box matching Riser sketch)
            doc.setDrawColor(...colors.border); doc.setLineWidth(0.3);
            doc.setFillColor(isPF ? 255 : 252, isPF ? 255 : 253, isPF ? 255 : 254);
            doc.rect(gX, currentY, gW, sketchH, 'FD');

            doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.navy);
            doc.text(`CAISSON SKETCH (${caisson?.q_id || 'Unknown'})`, gX + (gW / 2), currentY + 5, { align: 'center' });

            const gTopY = currentY + 15;
            const gBottomY = gTopY + 130;

            // Calculate a nice scale range
            const sMax = Math.ceil((designStart + 2) / 5) * 5;
            const sMin = Math.floor((designEnd - 5) / 5) * 5;
            const eRange = sMax - sMin;
            const eToY = (e: number) => gTopY + ((sMax - e) / eRange) * (gBottomY - gTopY);

            const cX = gX + (gW / 2);
            const pipeStartY = eToY(designStart);
            const pipeEndY = eToY(designEnd);

            // 1. Sea Level Line (0m)
            if (sMax >= 0 && sMin <= 0) {
                const seaY = eToY(0);
                doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.4);
                doc.line(gX + 2, seaY, gX + gW - 2, seaY);
                doc.setFontSize(5); doc.setTextColor(59, 130, 246); doc.setFont("helvetica", "bold");
                doc.text("SEA LEVEL (0.00m)", gX + 2.5, seaY - 1.2);
            }

            // --- Graphics Area ---
            // 1. Draw Caisson Pipe (Vertical)
            const drawP = (x: number, y1: number, y2: number) => {
                doc.setLineWidth(rWidth); doc.setDrawColor(120, 130, 150); doc.line(x, y1, x, y2);
                doc.setLineWidth(rWidth * 0.8); doc.setDrawColor(160, 175, 195); doc.line(x, y1, x, y2);
                doc.setLineWidth(rWidth * 0.2); doc.setDrawColor(220, 230, 240); doc.line(x - rWidth * 0.2, y1, x - rWidth * 0.2, y2);
            };
            drawP(cX, pipeStartY, pipeEndY);

            // 2. Draw Oval Terminator at the bottom (flattened oval matching pipeline graphic width)
            const rx = rWidth / 2;
            const ry = rWidth * 0.32; // Oval radius: rx = 6 (width = 12), ry = 3.84 (height = 7.68)
            const termY = pipeEndY; 
            
            doc.setDrawColor(50, 50, 50); doc.setLineWidth(0.8);
            doc.setFillColor(160, 175, 195); // Match pipe fill color
            doc.ellipse(cX, termY, rx, ry, 'FD');
            
            // Full Grill Mesh lines inside the oval terminator (clipped to ellipse boundaries)
            doc.setLineWidth(0.3);
            doc.setDrawColor(40, 40, 40);
            
            // Horizontal grill lines
            const hRatios = [-0.5, 0, 0.5];
            hRatios.forEach(r => {
                const dy = ry * r;
                const dx = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
                doc.line(cX - dx, termY + dy, cX + dx, termY + dy);
            });
            
            // Vertical grill lines
            const vRatios = [-0.6, -0.2, 0.2, 0.6];
            vRatios.forEach(r => {
                const dx = rx * r;
                const dy = ry * Math.sqrt(Math.max(0, 1 - (dx / rx) ** 2));
                doc.line(cX + dx, termY - dy, cX + dx, termY + dy);
            });
            
            // Terminator Elevation on Left Side
            if (!isNaN(terminatorElev)) {
                const leftTermLineEnd = cX - rx - 5;
                doc.setLineWidth(0.2); doc.setDrawColor(50, 50, 50);
                doc.line(cX - rx, termY, leftTermLineEnd, termY);
                doc.setFontSize(5.5); doc.setTextColor(50, 50, 50);
                doc.text(`${terminatorElev}m`, leftTermLineEnd - 1, termY + 1, { align: "right" });
            }

            // Terminator Name on Right Side
            const rightTermLineEnd = Math.min(cX + rx + 5, gX + gW - 20);
            doc.setLineWidth(0.2); doc.setDrawColor(50, 50, 50);
            doc.line(cX + rx, termY, rightTermLineEnd, termY);
            doc.setFontSize(5.5); doc.setTextColor(50, 50, 50);
            let termText = terminatorQid;
            const maxTermW = (gX + gW - 2) - (rightTermLineEnd + 1);
            if (doc.getTextWidth(termText) > maxTermW) {
                while (termText.length > 3 && doc.getTextWidth(termText + "...") > maxTermW) {
                    termText = termText.slice(0, -1);
                }
                termText += "...";
            }
            doc.text(termText, rightTermLineEnd + 1, termY + 1);

            // Scale on Far Left
            doc.setLineWidth(0.1); doc.setDrawColor(200, 200, 200);
            for (let e = sMax; e >= sMin; e -= 5) {
                const ey = eToY(e);
                if (ey <= gBottomY + 15) {
                    doc.line(gX + 7, ey, gX + 10, ey);
                    doc.setFontSize(5); doc.setTextColor(150, 150, 150); doc.text(`${e}m`, gX + 2, ey + 1);
                }
            }

            // Mark Points and Draw Component Graphics
            recordsInGroup.forEach(r => {
                const c = r.structure_components || {}; const d = r.inspection_data || {};
                const el = parseFloat(r.elevation ?? d.elevation); if (isNaN(el)) return;
                const py = eToY(el);
                const isA = r.has_anomaly || (r.insp_anomalies && r.insp_anomalies.length > 0);
                const col = isA ? colors.anomaly : colors.navy;
                
                const cName = (c.name || '').toLowerCase();
                const cQid = (c.q_id || '').toLowerCase();
                const isClamp = cName.includes('clamp') || cQid.includes('clp') || cQid.includes('supp');
                const isGuide = cName.includes('guide') || cName.includes('frame') || cQid.includes('gf');

                if (isClamp) {
                    const cw = rWidth + 8; const ch = 4;
                    doc.setFillColor(255, 255, 255); doc.rect(cX - cw/2, py - ch/2, cw, ch, 'F');
                    doc.setDrawColor(...colors.navy); doc.setLineWidth(0.8); doc.rect(cX - cw/2, py - ch/2, cw, ch, 'S');
                    // Bolts/Ears
                    doc.rect(cX - cw/2 - 2, py - 1, 2, 2, 'S'); doc.rect(cX + cw/2, py - 1, 2, 2, 'S');
                    
                    // Left Side: Elevation Value
                    doc.setLineWidth(0.2); doc.setDrawColor(...colors.navy);
                    const leftLineEnd = cX - cw/2 - 2 - 5;
                    doc.line(cX - cw/2 - 2, py, leftLineEnd, py);
                    doc.setFontSize(5.5); doc.setTextColor(...colors.navy); 
                    doc.text(`${el}m`, leftLineEnd - 1, py + 1, { align: "right" });

                    // Right Side: Object Name / QID
                    const rightLineEnd = Math.min(cX + cw/2 + 2 + 5, gX + gW - 20);
                    doc.line(cX + cw/2 + 2, py, rightLineEnd, py);
                    doc.setFontSize(5.5); doc.setTextColor(...colors.navy);
                    let qidText = c.q_id || 'Clamp';
                    const maxQidW = (gX + gW - 2) - (rightLineEnd + 1);
                    if (doc.getTextWidth(qidText) > maxQidW) {
                        while (qidText.length > 3 && doc.getTextWidth(qidText + "...") > maxQidW) {
                            qidText = qidText.slice(0, -1);
                        }
                        qidText += "...";
                    }
                    doc.text(qidText, rightLineEnd + 1, py + 1);
                } else if (isGuide) {
                    const gw = rWidth + 14; const gh = 6;
                    doc.setFillColor(230, 235, 245); doc.rect(cX - gw/2, py - gh/2, gw, gh, 'F');
                    doc.setDrawColor(...colors.navy); doc.setLineWidth(1); doc.rect(cX - gw/2, py - gh/2, gw, gh, 'S');
                    // Structural lines inside guide frame
                    doc.setLineWidth(0.3);
                    doc.line(cX - gw/2, py - gh/2, cX + gw/2, py + gh/2);
                    doc.line(cX - gw/2, py + gh/2, cX + gw/2, py - gh/2);
                    
                    // Left Side: Elevation Value
                    doc.setLineWidth(0.2); doc.setDrawColor(...colors.navy);
                    const leftLineEnd = cX - gw/2 - 5;
                    doc.line(cX - gw/2, py, leftLineEnd, py);
                    doc.setFontSize(5.5); doc.setTextColor(...colors.navy); 
                    doc.text(`${el}m`, leftLineEnd - 1, py + 1, { align: "right" });

                    // Right Side: Object Name / QID
                    const rightLineEnd = Math.min(cX + gw/2 + 5, gX + gW - 20);
                    doc.line(cX + gw/2, py, rightLineEnd, py);
                    doc.setFontSize(5.5); doc.setTextColor(...colors.navy);
                    let qidText = c.q_id || 'Guide Frame';
                    const maxQidW = (gX + gW - 2) - (rightLineEnd + 1);
                    if (doc.getTextWidth(qidText) > maxQidW) {
                        while (qidText.length > 3 && doc.getTextWidth(qidText + "...") > maxQidW) {
                            qidText = qidText.slice(0, -1);
                        }
                        qidText += "...";
                    }
                    doc.text(qidText, rightLineEnd + 1, py + 1);
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
            const sortedR = [...recordsInGroup].sort((a, b) => {
                const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                return elB - elA;
            });
            autoTable(doc, {
                startY: currentY,
                margin: { left: dX, right: margin, top: margin + HEADER_H + 6 },
                tableWidth: dW,
                head: [['Item No.', 'Elev (m)', 'Dive No.', 'CP (mV)', 'Findings / Anomalies']],
                body: sortedR.length > 0 ? sortedR.map((r, idx) => {
                    const itemNo = idx + 1;
                    const rd = r.inspection_data || {};
                    const anoms = r.insp_anomalies || [];
                    const isAnom = r.has_anomaly || anoms.length > 0;
                    const c = r.structure_components || {};

                    const diveNo = r.insp_rov_jobs?.job_no || r.insp_rov_jobs?.name || r.inspection_data?.dive_no || 'N/A';

                    const primaryCP = rd.cp_rdg ?? rd.cp_reading_mv ?? rd.cp ?? "";
                    const additionals: any[] = Array.isArray(rd.cp_rdg_additional) ? rd.cp_rdg_additional : (Array.isArray(rd.cp_readings) ? rd.cp_readings : []);
                    const additionalCPs = additionals
                        .map((a: any) => a.reading ?? a.cp_rdg ?? "")
                        .filter((val: any) => val !== "" && val !== null && val !== undefined);

                    const cpList = [primaryCP, ...additionalCPs].filter((val: any) => val !== "" && val !== null && val !== undefined);
                    const cpDisplay = cpList.length > 0 ? cpList.map(val => String(val)).join('\n') : '-';

                    let findingsParts: string[] = [];
                    if (r.description && r.description.trim()) {
                        findingsParts.push(r.description.trim());
                    } else if (rd.findings && rd.findings.trim()) {
                        findingsParts.push(rd.findings.trim());
                    }

                    additionals.forEach((a: any) => {
                        const val = a.reading ?? a.cp_rdg ?? "";
                        if ((val !== "" && val !== null && val !== undefined) || a.location) {
                            const loc = a.location ? ` @ ${a.location}` : "";
                            const unit = String(val).toLowerCase().includes("mv") || !val ? "" : " mV";
                            findingsParts.push(`Add. CP${loc}: ${val}${unit}`);
                        }
                    });

                    if (isAnom && anoms.length > 0) {
                        anoms.forEach((a: any) => {
                            findingsParts.push(`[Anom Ref: ${a.anomaly_ref_no || a.ref_no || 'N/A'}]${a.is_rectified ? ` (Rectified: ${a.rectified_remarks || a.rect_comments || ''})` : ''}`);
                        });
                    }

                    const findings = findingsParts.length > 0 ? findingsParts.join('\n') : 'No significant findings';

                    return [
                        { content: String(itemNo), styles: { halign: 'center' } },
                        { content: r.elevation ? `${r.elevation}m` : (rd.elevation ? `${rd.elevation}m` : 'N/A'), styles: { fontStyle: 'bold', halign: 'center' } },
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

        const finalY = (doc as any).lastAutoTable?.finalY ?? (margin + HEADER_H + 20);
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                drawHeader(doc);
                sigY = pageHeight - 38;
            }
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number, person?: { name: string; date: string }) => {
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

            drawSig('PREPARED BY', margin, config?.preparedBy);
            drawSig('REVIEWED BY', margin + sigW, config?.reviewedBy);
            drawSig('APPROVED BY', margin + (sigW * 2), config?.approvedBy);
        }

        const totalPages = doc.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            drawFooter(doc, j, totalPages);
        }

        console.log("[ROV Caisson Sketch Report] Generation complete, returnBlob:", config?.returnBlob);
        if (config?.returnBlob !== false) {
            console.log("[ROV Caisson Sketch Report] Returning Blob");
            applyWatermarkAndSignaturesGlobal(doc, config);
            return doc.output("blob");
        }
        
        console.log("[ROV Caisson Sketch Report] Saving PDF to file");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`ROV_Caisson_Sketch_Report_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (e) { 
        console.error("ROV Caisson Sketch Report Error", e); 
        throw e; 
    }
};
