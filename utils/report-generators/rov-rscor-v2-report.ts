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
    printFriendly?: boolean;
    jobPackId?: number;
    structureId?: number;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    returnBlob?: boolean;
    showSignatures?: boolean;
    showPageNumbers?: boolean;
}

export const generateROVRSCORV2Report = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    try {
        const isPF = config.printFriendly;
        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - (margin * 2);

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            mud: [249, 115, 22] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            anomaly: [220, 38, 38] as [number, number, number],
            rectified: [22, 163, 74] as [number, number, number],
        };

        // --- 1. Preparation ---
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        const drawHeader = (d: jsPDF) => {
            const headerH = 18;
            const isPF = config.printFriendly;
            if (isPF) {
                d.setDrawColor(...colors.navy); d.setLineWidth(0.3); d.rect(margin, margin, contentWidth, headerH, 'S');
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, headerH, 'F');
                d.setTextColor(255);
            }

            if (companyLogo)    drawLogo(d, companyLogo,    14, 14, pageWidth - margin - 18, margin + 2, 'right', 'center');
            if (contractorLogo) drawLogo(d, contractorLogo, 14, 14, margin + 4,              margin + 2, 'left',  'center');

            d.setFontSize(8); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 4.5, { align: 'center' });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 8, { align: 'center' });
            d.setFontSize(11); d.setFont("helvetica", "bold");
            d.text(`Scour Survey Sketch Report (ROV) - v2`, margin + (contentWidth/2), margin + 12.5, { align: 'center' });

            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || 'N/A'}`, margin + (contentWidth/2), margin + 15.5, { align: 'center' });
        };

        const drawContext = (d: jsPDF, y: number) => {
            const rowH = 5;
            const colW = contentWidth / 2;
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1); 
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, isPF ? 'S' : 'F'); 
                if (!isPF) d.rect(x, ty, w, rowH, 'S');
                d.setTextColor(...colors.text); d.setFontSize(7); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 3.5); d.setFont("helvetica", "normal");
                d.text(String(value), x + 25, ty + 3.5);
            };
            drawBox('Structure:', headerData.platformName, margin, colW, y);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + colW, colW, y);
            drawBox('Job Pack:', headerData.jobpackName, margin, colW, y + rowH);
            drawBox('Report No:', headerData.sowReportNo || 'N/A', margin + colW, colW, y + rowH);
            return y + (rowH * 2) + 3;
        };

        // Group records by Component QID
        const groupedMap = new Map<string, any[]>();
        records.forEach(r => {
            const qid = r.structure_components?.q_id || 'Unknown';
            if (!groupedMap.has(qid)) groupedMap.set(qid, []);
            groupedMap.get(qid)?.push(r);
        });

        const components = Array.from(groupedMap.keys());
        const compsPerPage = 4;
        const totalPages = Math.ceil(components.length / compsPerPage);

        // Scalable Graphics Drawer
        const drawGraphics = (d: jsPDF, x: number, y: number, w: number, h: number, compRecords: any[], compData: any) => {
            const da = d as any;
            const innerMargin = w * 0.2;
            const homY = y + h * 0.45;
            const legRadius = 4;
            const homX1_center = x + innerMargin;
            const homX2_center = x + w - innerMargin;
            const redDashed = [239, 68, 68] as [number, number, number];

            // --- DATA PRE-PROCESSING FOR MAPPING ---
            const foundLegNames: string[] = [];
            compRecords.forEach(r => {
                const loc = (r.inspection_data?.scour_location || '').toLowerCase();
                if (loc.includes('leg') && loc.includes(':')) {
                    const parts = loc.split(':');
                    const name = parts[1].trim();
                    if (name && !foundLegNames.includes(name)) foundLegNames.push(name);
                } else if (loc.includes('leg')) {
                    const match = loc.match(/leg\s+([a-zA-Z0-9]+)/);
                    if (match && !foundLegNames.includes(match[1])) foundLegNames.push(match[1]);
                }
            });

            let leg1 = compData.startLeg || compData.metadata?.s_leg || (foundLegNames[0] || '').toUpperCase();
            let leg2 = compData.endLeg || compData.metadata?.f_leg || (foundLegNames[1] || '').toUpperCase();

            const depths = compRecords.map(r => parseFloat(r.inspection_data?.scour_depth || '0')).filter(v => !isNaN(v));
            const maxD = depths.length > 0 ? Math.max(...depths, 400) : 500;
            const depthScale = Math.min(0.04, (h * 0.35) / maxD); 

            let startNode = compData.startNode || compData.metadata?.s_node || 'N/A';
            let endNode = compData.endNode || compData.metadata?.f_node || 'N/A';
            if (compData.q_id && compData.q_id.includes('-')) {
                const match = compData.q_id.match(/([A-Z0-9]+)-([A-Z0-9]+)/);
                if (match) { startNode = match[1]; endNode = match[2]; }
            }

            let homActualX1 = homX1_center;
            let homActualX2 = homX2_center;

            const drawSlantedConnection = (lx: number, name: string, node: string, side: 'left' | 'right') => {
                const slant = side === 'left' ? -w * 0.012 : w * 0.012;
                const topY = y + h * 0.12; const botY = y + h * 0.88;
                const dy = homY - topY;
                const homX_at_junction = lx + (slant * (dy / (botY - topY)) * 1.5);
                if (side === 'left') homActualX1 = homX_at_junction + legRadius - 0.5;
                else homActualX2 = homX_at_junction - legRadius + 0.5;
                
                da.setDrawColor(80); da.setLineWidth(0.6);
                da.line(lx - legRadius, topY, lx - legRadius + slant, botY - h * 0.1);
                da.line(lx + legRadius, topY, lx + legRadius + slant, botY - h * 0.1);
                da.ellipse(lx, topY, legRadius, 1.0, 'S');
                
                da.setDrawColor(...redDashed); da.setLineDash([1.5, 1], 0); da.setLineWidth(0.25);
                da.line(lx, topY - 2, lx + slant * 1.2, botY + 3); da.setLineDash([], 0);
                
                const circleY = y + h * 0.05; const circleX = lx - (slant * 0.2);
                da.setDrawColor(...redDashed); da.setLineDash([1, 1], 0);
                da.line(lx, topY, circleX, circleY + 2.5); da.setLineDash([], 0);
                da.setDrawColor(100); da.setFillColor(255); da.circle(circleX, circleY, 3, 'FD');
                da.setFontSize(5.0); da.setTextColor(0); da.setFont("helvetica", "bold");
                da.text((name || node).toUpperCase(), circleX, circleY + 0.7, { align: 'center' }); da.setFont("helvetica", "normal");
                da.text(node, side === 'left' ? lx - 8 : lx + 8, homY + 1, { align: side === 'left' ? 'right' : 'left' });
            };

            drawSlantedConnection(homX1_center, leg1, startNode, 'left');
            drawSlantedConnection(homX2_center, leg2, endNode, 'right');

            da.setDrawColor(40); da.setLineWidth(1.0);
            da.line(homActualX1, homY - 2, homActualX2, homY - 2);
            da.line(homActualX1, homY + 2, homActualX2, homY + 2);
            da.setDrawColor(...redDashed); da.setLineDash([1.5, 1], 0); da.setLineWidth(0.25);
            da.line(homActualX1 - 2, homY, homActualX2 + 2, homY); da.setLineDash([], 0);

            const homLen = homActualX2 - homActualX1;
            const locValues = new Map<string, any>();
            compRecords.forEach(r => {
                const rd = r.inspection_data || {};
                let locTag = (rd.scour_location || '').toLowerCase();
                const depth = parseFloat(rd.scour_depth || '0');
                const burial = parseFloat(rd.Burial_percent || '0');
                
                let target = 'mid'; let xp = 0.5;
                if (locTag.includes('start') || (leg1 && locTag.includes(leg1.toLowerCase()))) { 
                    target = 'start'; xp = 0.05; 
                } else if (locTag.includes('end') || (leg2 && locTag.includes(leg2.toLowerCase()))) { 
                    target = 'end'; xp = 0.95; 
                }
                
                const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                const isAnom = r.has_anomaly || !!linkedAnom;
                const isRect = linkedAnom ? linkedAnom.is_rectified : r.rectified;

                if (!locValues.has(target) || locValues.get(target).depth < depth) {
                    locValues.set(target, { 
                        x: homActualX1 + (xp * homLen), 
                        depth, burial, 
                        exposed: rd.Exposed_pile === 'Yes',
                        isAnom, isRect 
                    });
                }
            });

            const finalPoints = Array.from(locValues.values()).sort((a, b) => a.x - b.x);
            if (!locValues.has('start')) finalPoints.unshift({ x: homActualX1 + (homLen * 0.05), depth: 0, burial: 0 });
            if (!locValues.has('mid')) {
                const mx = homActualX1 + (homLen * 0.5);
                const idx = finalPoints.findIndex(p => p.x > mx);
                if (idx === -1) finalPoints.push({ x: mx, depth: 0, burial: 0 });
                else finalPoints.splice(idx, 0, { x: mx, depth: 0, burial: 0 });
            }
            if (!locValues.has('end')) finalPoints.push({ x: homActualX1 + (homLen * 0.95), depth: 0, burial: 0 });
            finalPoints.sort((a, b) => a.x - b.x);

            const mudBaseline = homY + 2;
            const getMudY = (p: any) => {
                if (p.burial > 0) {
                    return mudBaseline - (p.burial / 100 * 4);
                } else {
                    return mudBaseline + (p.depth * depthScale);
                }
            };

            da.setDrawColor(...colors.mud); da.setLineWidth(1.2);
            let curX = x + 5; let curY = getMudY(finalPoints[0]);
            da.line(x + 2, curY - 0.5, curX, curY);

            for (let j = 0; j < finalPoints.length; j++) {
                const tx = finalPoints[j].x; const ty = getMudY(finalPoints[j]);
                const cp1x = curX + (tx - curX) / 2.5; const cp1y = curY;
                const cp2x = tx - (tx - curX) / 2.5; const cp2y = ty;
                const steps = 20;
                for (let s = 1; s <= steps; s++) {
                    const t = s / steps;
                    const px = Math.pow(1 - t, 3) * curX + 3 * Math.pow(1 - t, 2) * t * cp1x + 3 * (1 - t) * Math.pow(t, 2) * cp2x + Math.pow(t, 3) * tx;
                    const py = Math.pow(1 - t, 3) * curY + 3 * Math.pow(1 - t, 2) * t * cp1y + 3 * (1 - t) * Math.pow(t, 2) * cp2y + Math.pow(t, 3) * ty;
                    da.line(curX, curY, px, py); curX = px; curY = py;
                }
            }
            da.line(curX, curY, x + w - 5, curY - 0.5);
            da.setFontSize(5.5); da.setTextColor(...colors.mud); da.setFont("helvetica", "bold");
            da.text("Mudline", x + 10, mudBaseline - 4);

            finalPoints.forEach(p => {
                const py = getMudY(p);
                da.setDrawColor(120); da.setLineWidth(0.3); da.line(p.x, homY + 2, p.x, py); 
                const r = 3; const my = (homY + 2 + py) / 2;
                
                let bubbleColor = [255, 255, 255];
                let borderCol = [120, 120, 120];
                if (p.isAnom) { bubbleColor = [254, 226, 226]; borderCol = colors.anomaly; }
                else if (p.isRect) { bubbleColor = [220, 252, 231]; borderCol = colors.rectified; }

                da.setFillColor(...bubbleColor); da.setDrawColor(...borderCol); da.circle(p.x, my, r, 'FD');
                da.setFontSize(4.0); da.setTextColor(0); da.setFont("helvetica", "normal");
                const val = p.burial > 0 ? `${p.burial}%` : `${p.depth}M`;
                da.text(val, p.x, my + 0.8, { align: 'center' });
                if (p.exposed) {
                    da.setDrawColor(...colors.mud); da.setLineWidth(0.6); da.circle(p.x, my, r + 0.8, 'S');
                }
            });
        };

        // Render loop grouped by 4 per page
        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            if (pageIdx > 0) doc.addPage();
            drawHeader(doc);
            let currentY = drawContext(doc, margin + 18 + 2);

            const startCompIdx = pageIdx * compsPerPage;
            const pageComponents = components.slice(startCompIdx, startCompIdx + compsPerPage);

            // Calculate heights dynamically
            // Page content height is 186 mm (210 - 24)
            // Context header finishes at y=48 (margin 12 + header 18 + offset 2 + context 10 + offset 6)
            // Signatures block on the last page takes 28 mm.
            const isLastPage = pageIdx === totalPages - 1;
            const availableH = pageHeight - currentY - margin - (isLastPage && config.showSignatures !== false ? 25 : 0);
            const compRowH = availableH / 4;

            for (let c = 0; c < pageComponents.length; c++) {
                const qid = pageComponents[c];
                const compRecordsRaw = groupedMap.get(qid) || [];
                const compRecords = [...compRecordsRaw].sort((a, b) => {
                    const dateA = new Date(`${a.inspection_date || '1970-01-01'}T${a.inspection_time || '00:00:00'}`);
                    const dateB = new Date(`${b.inspection_date || '1970-01-01'}T${b.inspection_time || '00:00:00'}`);
                    return dateA.getTime() - dateB.getTime();
                });

                const compData = compRecords[0]?.structure_components || {};
                
                // Draw QID Header Bar
                doc.setFillColor(...colors.navy); doc.rect(margin, currentY, contentWidth, 4.5, 'F');
                doc.setTextColor(255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
                doc.text(`COMPONENT QID: ${qid} - ${compData.name || ''}`, margin + 3, currentY + 3.2);
                currentY += 5.5;

                const sketchW = contentWidth / 2 - 4;
                const sketchH = compRowH - 7;
                
                // 1. Draw Sketch on the Left
                drawGraphics(doc, margin, currentY, sketchW, sketchH, compRecords, compData);

                // 2. Draw Table on the Right
                const tableX = margin + contentWidth / 2 + 2;
                const tableW = contentWidth / 2 - 4;

                autoTable(doc, {
                    startY: currentY,
                    margin: { left: tableX, right: margin },
                    tableWidth: tableW,
                    head: [['Location', 'Scour Depth', 'Burial %', 'Exposed', 'Remarks']],
                    body: compRecords.map(r => {
                        const rd = r.inspection_data || {};
                        const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                        const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                        const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                        const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                        const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || '';

                        let findings = r.description || '';
                        if (isAnomaly && anomRef) findings += ` [Ref: ${anomRef}]`;
                        if (isRectified) findings += ` [Rect: ${rectRem || 'N/A'}]`;

                        return [
                            rd.scour_location || 'N/A',
                            rd.scour_depth ? `${rd.scour_depth} mm` : '-',
                            rd.Burial_percent ? `${rd.Burial_percent}%` : '-',
                            rd.Exposed_pile === 'Yes' || rd.Exposed_pile === true ? 'Yes' : 'No',
                            { 
                                content: findings || 'No findings',
                                styles: {
                                    textColor: isAnomaly ? colors.anomaly : (isRectified ? colors.rectified : colors.text),
                                    fontStyle: (isAnomaly || isRectified) ? 'bold' : 'normal'
                                }
                            }
                        ];
                    }),
                    theme: 'grid',
                    headStyles: { fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255, fontSize: 5.5, cellPadding: 0.8, halign: 'center' },
                    styles: { fontSize: 5.5, cellPadding: 0.8 },
                    columnStyles: {
                        0: { cellWidth: 20 },
                        1: { cellWidth: 15, halign: 'center' },
                        2: { cellWidth: 12, halign: 'center' },
                        3: { cellWidth: 12, halign: 'center' },
                        4: { cellWidth: 'auto' }
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body') {
                            const r = compRecords[data.row.index];
                            const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                            const isAnom = r.has_anomaly || !!linkedAnom;
                            const isRect = linkedAnom ? linkedAnom.is_rectified : r.rectified;

                            if (isAnom) {
                                data.cell.styles.textColor = colors.anomaly;
                                data.cell.styles.fontStyle = 'bold';
                            } else if (isRect) {
                                data.cell.styles.textColor = colors.rectified;
                                data.cell.styles.fontStyle = 'bold';
                            }
                        }
                    }
                });

                currentY += sketchH + 1.5;
            }
        }

        // Draw signatures block at bottom of last page
        if (config.showSignatures !== false) {
            const sigY = pageHeight - 25;
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1);
                doc.rect(lx, sigY, sigW - 4, 15);
                if (!isPF) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 4, 4.0, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.0);
                doc.setTextColor(...colors.text); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
                doc.text("Name:", lx + 2, sigY + 8);
                doc.text("Date:", lx + 2, sigY + 11);
                doc.text("Signature:", lx + 2, sigY + 14);
            };

            drawSig('PREPARED BY', margin);
            drawSig('REVIEWED BY', margin + sigW);
            drawSig('APPROVED BY', margin + (sigW * 2));
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`Scour_Survey_Sketch_Report_v2_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;
    } catch (e) {
        console.error("RSCOR v2 Report Error", e);
        throw e;
    }
};
