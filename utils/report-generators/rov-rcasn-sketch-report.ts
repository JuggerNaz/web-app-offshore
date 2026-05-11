import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo } from "./shared-logo";
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
    showSignatures?: boolean;
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
            riser: [71, 85, 105] as [number, number, number],
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

        const drawHeader = (d: jsPDF) => {
            const hH = 22; const isPF = config.printFriendly;
            if (isPF) { d.setDrawColor(...colors.navy); d.setLineWidth(0.5); d.rect(margin, margin, contentWidth, hH, 'S'); d.setTextColor(...colors.navy); }
            else { d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, hH, 'F'); d.setTextColor(255, 255, 255); }
            if (coLogo) drawLogo(d, coLogo, 16, 16, pageWidth - margin - 20, margin + 3, 'right', 'center');
            if (ctLogo) drawLogo(d, ctLogo, 16, 16, margin + 4, margin + 3, 'left', 'center');
            d.setFontSize(9); d.setFont("helvetica", "bold"); d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + contentWidth/2, margin + 6, { align: 'center' });
            d.setFontSize(7); d.setFont("helvetica", "normal"); d.text(companySettings.department_name || 'Technical Division', margin + contentWidth/2, margin + 10, { align: 'center' });
            d.setFontSize(13); d.setFont("helvetica", "bold"); d.text("ROV Caisson Survey (Sketch) Report", margin + contentWidth/2, margin + 17, { align: 'center' });
        };

        const drawFooter = (d: jsPDF, pageNum: number, totalPages: number) => {
            const footerY = pageHeight - 10;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            d.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
            d.setFontSize(7); d.setTextColor(150, 150, 150);
            d.setFont("helvetica", "normal");
            d.text(`Report ID: ${headerData.sowReportNo || 'N/A'}`, margin, footerY);
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
            drawBox('SOW Report No:', headerData.sowReportNo || 'N/A', margin, contentWidth, y + (rH * 2));
            return y + (rH * 3) + 4;
        };

        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const caisson = group.caissonComp;
            const recordsInGroup = group.records;
            if (i > 0) doc.addPage();
            drawHeader(doc);
            let currentY = drawContext(doc, margin + 22 + 2, recordsInGroup);

            // Sub-header
            doc.setFillColor(...colors.navy); doc.rect(margin, currentY, contentWidth, 7, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
            doc.text(`Caisson QID: ${caisson?.q_id || 'Unknown'}`, margin + 5, currentY + 5);
            currentY += 10;

            const gW = contentWidth * 0.40; const dW = contentWidth * 0.60;
            const gX = margin; const dX = margin + gW;

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
            const gTopY = currentY + 15;
            const gBottomY = gTopY + 140;

            // Calculate a nice scale range
            const sMax = Math.ceil((designStart + 2) / 5) * 5;
            const sMin = Math.floor((designEnd - 5) / 5) * 5;
            const eRange = sMax - sMin;
            const eToY = (e: number) => gTopY + ((sMax - e) / eRange) * (gBottomY - gTopY);

            const cX = gX + (gW / 2);
            const pipeStartY = eToY(designStart);
            const pipeEndY = eToY(designEnd);

            // --- Graphics Area ---
            // 1. Draw Caisson Pipe (Vertical)
            const drawP = (x: number, y1: number, y2: number) => {
                doc.setLineWidth(rWidth); doc.setDrawColor(60, 70, 90); doc.line(x, y1, x, y2);
                doc.setLineWidth(rWidth * 0.8); doc.setDrawColor(80, 95, 115); doc.line(x, y1, x, y2);
                doc.setLineWidth(rWidth * 0.2); doc.setDrawColor(180, 190, 210); doc.line(x - rWidth * 0.2, y1, x - rWidth * 0.2, y2);
            };
            drawP(cX, pipeStartY, pipeEndY);

            // 2. Draw Oval Terminator at the bottom
            const rx = rWidth / 2;
            const ry = rWidth * 0.4;
            const termY = pipeEndY; 
            
            doc.setDrawColor(50, 50, 50); doc.setLineWidth(0.8);
            doc.setFillColor(80, 95, 115); // Match pipe color
            doc.ellipse(cX, termY, rx, ry, 'FD');
            
            // Grill lines inside the oval terminator
            doc.setLineWidth(0.2);
            doc.setDrawColor(40, 40, 40);
            // Horizontal lines
            doc.line(cX - rx * 0.6, termY + ry * 0.4, cX + rx * 0.6, termY + ry * 0.4);
            doc.line(cX - rx * 0.8, termY + ry * 0.7, cX + rx * 0.8, termY + ry * 0.7);
            
            // Vertical lines (downward only from pipe end)
            doc.line(cX, pipeEndY, cX, pipeEndY + ry);
            doc.line(cX - rx * 0.4, termY, cX - rx * 0.4, termY + ry * 0.9);
            doc.line(cX + rx * 0.4, termY, cX + rx * 0.4, termY + ry * 0.9);
            
            doc.setFontSize(6); doc.setTextColor(50, 50, 50);
            doc.text(terminatorQid, cX + rx + 2, termY + ry);
            if (!isNaN(terminatorElev)) {
                doc.text(`${terminatorElev}m`, cX + rx + 2, termY + ry + 2.5);
            }

            // Scale
            doc.setLineWidth(0.1); doc.setDrawColor(200, 200, 200);
            for (let e = sMax; e >= sMin; e -= 5) {
                const ey = eToY(e);
                if (ey <= gBottomY + 15) {
                    doc.line(cX - 15, ey, cX - 8, ey);
                    doc.setFontSize(6); doc.setTextColor(150, 150, 150); doc.text(`${e}m`, cX - 22, ey + 1);
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
                    doc.setLineWidth(0.2); 
                    const lineEnd = cX + cw/2 + 2 + 10;
                    doc.line(cX + cw/2 + 2, py, lineEnd, py);
                    doc.setFontSize(6); doc.setTextColor(...colors.navy); 
                    doc.text(`${el}m`, lineEnd + 1, py + 1);
                    doc.text(c.q_id || 'Clamp', lineEnd + 1, py + 3);
                } else if (isGuide) {
                    const gw = rWidth + 14; const gh = 6;
                    doc.setFillColor(230, 235, 245); doc.rect(cX - gw/2, py - gh/2, gw, gh, 'F');
                    doc.setDrawColor(...colors.navy); doc.setLineWidth(1); doc.rect(cX - gw/2, py - gh/2, gw, gh, 'S');
                    // Structural lines inside guide frame
                    doc.setLineWidth(0.3);
                    doc.line(cX - gw/2, py - gh/2, cX + gw/2, py + gh/2);
                    doc.line(cX - gw/2, py + gh/2, cX + gw/2, py - gh/2);
                    doc.setLineWidth(0.2); 
                    const lineEnd = cX + gw/2 + 10;
                    doc.line(cX + gw/2, py, lineEnd, py);
                    doc.setFontSize(6); doc.setTextColor(...colors.navy); 
                    doc.text(`${el}m`, lineEnd + 1, py + 1);
                    doc.text(c.q_id || 'Guide Frame', lineEnd + 1, py + 3);
                } else {
                    doc.setFillColor(...col); doc.circle(cX, py, 1.8, 'F');
                    doc.setDrawColor(...col); doc.setLineWidth(0.1); 
                    const lineEnd = cX + 2 + 10;
                    doc.line(cX + 2, py, lineEnd, py);
                    doc.setFontSize(6); doc.setTextColor(...col);
                    doc.text(`${el}m`, lineEnd + 1, py + 1);
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
                margin: { left: dX, right: margin, top: margin + 22 + 6 },
                tableWidth: dW,
                head: [['Elev (m)', 'CP (mV)', 'Findings / Anomalies']],
                body: sortedR.map(r => {
                    const rd = r.inspection_data || {};
                    const anoms = r.insp_anomalies || [];
                    const isAnom = r.has_anomaly || anoms.length > 0;
                    const c = r.structure_components || {};
                    let findings = r.description || 'No significant findings';
                    if (isAnom && anoms.length > 0) {
                        findings += `\n` + anoms.map((a: any) => `[Anom Ref: ${a.ref_no || 'N/A'}]${a.is_rectified ? `\n(Rectified: ${a.rect_comments || ''})` : ''}`).join('\n');
                    }
                    if (r.insp_rov_jobs?.job_no) findings += `\n[Dive: ${r.insp_rov_jobs.job_no}]`;
                    return [
                        { content: r.elevation ? `${r.elevation}m` : (rd.elevation ? `${rd.elevation}m` : 'N/A'), styles: { fontStyle: 'bold' } },
                        { content: rd.cp_rdg ?? rd.cp ?? '-', styles: { halign: 'center' } },
                        { content: findings, styles: { textColor: isAnom ? colors.anomaly : colors.text } }
                    ];
                }),
                theme: 'grid',
                headStyles: { fillColor: colors.navy, textColor: [255, 255, 255], fontSize: 8 },
                styles: { fontSize: 7, cellPadding: 2 },
                columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 15 }, 2: { cellWidth: 'auto' } },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) drawHeader(doc);
                }
            });
        }

        const finalY = (doc as any).lastAutoTable?.finalY ?? (margin + 22 + 20);
        if (config.showSignatures !== false) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                drawHeader(doc);
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

        const totalPages = doc.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            drawFooter(doc, j, totalPages);
        }

        console.log("[ROV Caisson Sketch Report] Generation complete, returnBlob:", config?.returnBlob);
        if (config?.returnBlob !== false) {
            console.log("[ROV Caisson Sketch Report] Returning Blob");
            return doc.output("blob");
        }
        
        console.log("[ROV Caisson Sketch Report] Saving PDF to file");
        doc.save(`ROV_Caisson_Sketch_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (e) { 
        console.error("ROV Caisson Sketch Report Error", e); 
        throw e; 
    }
};
