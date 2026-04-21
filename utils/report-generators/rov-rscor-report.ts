import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo } from "./shared-logo";

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
}

export const generateROVRSCORReport = async (
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

        const drawHeader = async (d: jsPDF) => {
            const headerH = 22;
            const isPF = config.printFriendly;
            if (isPF) {
                d.setDrawColor(...colors.navy); d.setLineWidth(0.3); d.rect(margin, margin, contentWidth, headerH, 'S');
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, headerH, 'F');
                d.setTextColor(255);
            }

            // NasQuest Logo (Right)
            if (companySettings.logo_url) {
                try {
                    const logoData = await loadLogoWithTransparency(companySettings.logo_url);
                    if (logoData) drawLogo(d, logoData, 16, 16, pageWidth - margin - 20, margin + 4, 'right', 'center');
                } catch (e) {}
            }

            // Contractor Logo (Left)
            if (headerData.contractorLogoUrl) {
                try {
                    const logoData = await loadLogoWithTransparency(headerData.contractorLogoUrl);
                    if (logoData) drawLogo(d, logoData, 16, 16, margin + 4, margin + 4, 'left', 'center');
                } catch (e) {}
            }

            d.setFontSize(10); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 11, { align: 'center' });
            d.setFontSize(14); d.setFont("helvetica", "bold");
            d.text(`ROV Scour Survey Report`, margin + (contentWidth/2), margin + 17, { align: 'center' });

            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || 'N/A'}`, margin + (contentWidth/2), margin + 21, { align: 'center' });
        };

        const drawContext = (d: jsPDF, y: number) => {
            const rowH = 7;
            const colW = contentWidth / 2;
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1); 
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, isPF ? 'S' : 'F'); 
                if (!isPF) d.rect(x, ty, w, rowH, 'S');
                d.setTextColor(...colors.text); d.setFontSize(8); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4.5); d.setFont("helvetica", "normal");
                d.text(String(value), x + 35, ty + 4.5);
            };
            drawBox('Structure:', headerData.platformName, margin, colW, y);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + colW, colW, y);
            drawBox('Job Pack:', headerData.jobpackName, margin, colW, y + rowH);
            drawBox('Report No:', headerData.sowReportNo || 'N/A', margin + colW, colW, y + rowH);
            return y + (rowH * 2) + 5;
        };

        const groupedMap = new Map<string, any[]>();
        records.forEach(r => {
            const qid = r.structure_components?.q_id || 'Unknown';
            if (!groupedMap.has(qid)) groupedMap.set(qid, []);
            groupedMap.get(qid)?.push(r);
        });

        const components = Array.from(groupedMap.keys());
        for (let i = 0; i < components.length; i++) {
            const qid = components[i];
            const compRecordsRaw = groupedMap.get(qid) || [];
            const compRecords = [...compRecordsRaw].sort((a, b) => {
                const dateA = new Date(`${a.inspection_date || '1970-01-01'}T${a.inspection_time || '00:00:00'}`);
                const dateB = new Date(`${b.inspection_date || '1970-01-01'}T${b.inspection_time || '00:00:00'}`);
                return dateA.getTime() - dateB.getTime();
            });

            const compData = compRecords[0]?.structure_components || {};
            if (i > 0) doc.addPage();
            await drawHeader(doc);
            let currentY = drawContext(doc, margin + 22 + 2);

            doc.setFillColor(...colors.navy); doc.rect(margin, currentY, contentWidth, 6, 'F');
            doc.setTextColor(255); doc.setFontSize(8); doc.setFont("helvetica", "bold");
            doc.text(`COMPONENT QID: ${qid} - ${compData.name || ''}`, margin + 5, currentY + 4);
            currentY += 8;

            const panelH = 70;
            const panelW = contentWidth;
            const drawGraphics = (d: jsPDF, gy: number) => {
                const da = d as any;
                const innerMargin = 60;
                const homY = gy + 32;
                const legRadius = 6;
                const homX1_center = margin + innerMargin;
                const homX2_center = margin + panelW - innerMargin;
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
                const depthScale = Math.min(0.04, 25 / maxD); 

                let startNode = compData.startNode || compData.metadata?.s_node || 'N/A';
                let endNode = compData.endNode || compData.metadata?.f_node || 'N/A';
                if (qid.includes('-')) {
                    const match = qid.match(/([A-Z0-9]+)-([A-Z0-9]+)/);
                    if (match) { startNode = match[1]; endNode = match[2]; }
                }

                let homActualX1 = homX1_center;
                let homActualX2 = homX2_center;

                const drawSlantedConnection = (lx: number, name: string, node: string, side: 'left' | 'right') => {
                    const slant = side === 'left' ? -4 : 4;
                    const topY = gy + 10; const botY = gy + panelH - 5;
                    const dy = homY - topY;
                    const homX_at_junction = lx + (slant * (dy / (botY - topY)) * 1.5);
                    if (side === 'left') homActualX1 = homX_at_junction + legRadius - 0.5;
                    else homActualX2 = homX_at_junction - legRadius + 0.5;
                    
                    da.setDrawColor(80); da.setLineWidth(0.8);
                    da.line(lx - legRadius, topY, lx - legRadius + slant, botY - 10);
                    da.line(lx + legRadius, topY, lx + legRadius + slant, botY - 10);
                    da.ellipse(lx, topY, legRadius, 1.5, 'S');
                    da.setDrawColor(200, 200, 200); da.setLineWidth(0.4);
                    const pR = legRadius * 0.7;
                    const pOffsetTop = botY - 15; const pOffsetBot = botY + 8;
                    const pSlantT = slant * ((pOffsetTop - topY) / (botY - 10 - topY));
                    const pSlantB = slant * ((pOffsetBot - topY) / (botY - 10 - topY));
                    da.line(lx - pR + pSlantT, pOffsetTop, lx - pR + pSlantB, pOffsetBot);
                    da.line(lx + pR + pSlantT, pOffsetTop, lx + pR + pSlantB, pOffsetBot);
                    da.setDrawColor(...redDashed); da.setLineDash([2, 1], 0); da.setLineWidth(0.3);
                    da.line(lx, topY - 3, lx + slant * 1.2, botY + 5); da.setLineDash([], 0);
                    const circleY = gy + 4; const circleX = lx - (slant * 0.2);
                    da.setDrawColor(...redDashed); da.setLineDash([1.5, 1], 0);
                    da.line(lx, topY, circleX, circleY + 5); da.setLineDash([], 0);
                    da.setDrawColor(100); da.setFillColor(255); da.circle(circleX, circleY, 5, 'FD');
                    da.setFontSize(6); da.setTextColor(0); da.setFont("helvetica", "bold");
                    da.text((name || node).toUpperCase(), circleX, circleY + 0.8, { align: 'center' }); da.setFont("helvetica", "normal");
                    da.setFontSize(6); const nodeX = side === 'left' ? lx - 12 : lx + 12;
                    da.text(node, nodeX, homY, { align: side === 'left' ? 'right' : 'left' });
                };

                drawSlantedConnection(homX1_center, leg1, startNode, 'left');
                drawSlantedConnection(homX2_center, leg2, endNode, 'right');

                da.setDrawColor(40); da.setLineWidth(1.2);
                da.line(homActualX1, homY - 3, homActualX2, homY - 3);
                da.line(homActualX1, homY + 3, homActualX2, homY + 3);
                da.setDrawColor(...redDashed); da.setLineDash([2, 1], 0); da.setLineWidth(0.3);
                da.line(homActualX1 - 3, homY, homActualX2 + 3, homY); da.setLineDash([], 0);

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

                const mudBaseline = homY + 12;
                const getMudY = (p: any) => p.burial > 0 ? mudBaseline - (p.burial / 100 * 10) : mudBaseline + (p.depth * depthScale);

                da.setDrawColor(...colors.mud); da.setLineWidth(1.5);
                let curX = margin + 5; let curY = getMudY(finalPoints[0]);
                da.line(margin + 2, curY - 0.5, curX, curY);

                for (let j = 0; j < finalPoints.length; j++) {
                    const tx = finalPoints[j].x; const ty = getMudY(finalPoints[j]);
                    const cp1x = curX + (tx - curX) / 2.5; const cp1y = curY;
                    const cp2x = tx - (tx - curX) / 2.5; const cp2y = ty;
                    const steps = 30;
                    for (let s = 1; s <= steps; s++) {
                        const t = s / steps;
                        const px = Math.pow(1 - t, 3) * curX + 3 * Math.pow(1 - t, 2) * t * cp1x + 3 * (1 - t) * Math.pow(t, 2) * cp2x + Math.pow(t, 3) * tx;
                        const py = Math.pow(1 - t, 3) * curY + 3 * Math.pow(1 - t, 2) * t * cp1y + 3 * (1 - t) * Math.pow(t, 2) * cp2y + Math.pow(t, 3) * ty;
                        da.line(curX, curY, px, py); curX = px; curY = py;
                    }
                }
                da.line(curX, curY, margin + panelW - 5, curY - 0.5);
                da.setFontSize(7); da.setTextColor(...colors.mud); da.setFont("helvetica", "bold");
                da.text("Mudline", margin + 10, mudBaseline - 6);

                finalPoints.forEach(p => {
                    const py = getMudY(p);
                    da.setDrawColor(120); da.setLineWidth(0.4); da.line(p.x, homY + 3, p.x, py); 
                    const r = 5; const my = (homY + 3 + py) / 2;
                    
                    let bubbleColor = [255, 255, 255]; // White
                    let borderCol = [120, 120, 120];
                    if (p.isAnom) { bubbleColor = [254, 226, 226]; borderCol = colors.anomaly; }
                    else if (p.isRect) { bubbleColor = [220, 252, 231]; borderCol = colors.rectified; }

                    da.setFillColor(...bubbleColor); da.setDrawColor(...borderCol); da.circle(p.x, my, r, 'FD');
                    da.setFontSize(5); da.setTextColor(0); da.setFont("helvetica", "normal");
                    const val = p.burial > 0 ? `${p.burial}%` : `${p.depth}MM`;
                    da.text(val, p.x, my + 1, { align: 'center' });
                    if (p.exposed) {
                        da.setDrawColor(...colors.mud); da.setLineWidth(0.8); da.circle(p.x, my, r + 1, 'S');
                    }
                });
            };

            drawGraphics(doc, currentY);
            currentY += panelH + 5;

            autoTable(doc, {
                startY: currentY,
                margin: { left: margin, right: margin },
                head: [['Location', 'Scour Depth', 'Burial %', 'Exposed Pile', 'Remarks']],
                body: compRecords.map(r => {
                    const rd = r.inspection_data || {};
                    const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                    const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                    const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                    const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                    const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || '';

                    let findings = r.description || '';
                    if (isAnomaly && anomRef) {
                        findings += `\n[Reference: ${anomRef}]`;
                    }
                    if (isRectified) {
                        findings += `\nRectified: ${rectRem || 'N/A'}`;
                    }

                    return [
                        rd.scour_location || 'N/A',
                        rd.scour_depth ? `${rd.scour_depth} mm` : '-',
                        rd.Burial_percent ? `${rd.Burial_percent}%` : '-',
                        rd.Exposed_pile === 'Yes' || rd.Exposed_pile === true ? 'Yes' : 'No',
                        { 
                            content: findings || 'No significant findings',
                            styles: {
                                textColor: isAnomaly ? colors.anomaly : (isRectified ? colors.rectified : colors.text),
                                fontStyle: (isAnomaly || isRectified) ? 'bold' : 'normal'
                            }
                        }
                    ];
                }),
                theme: 'grid',
                headStyles: { fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255, fontSize: 7, halign: 'center' },
                styles: { fontSize: 7 },
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
        }

        const sigY = pageHeight - 22;
        const sigW = (contentWidth / 3) - 2;
        const drawSigBlock = (label: string, lx: number) => {
            const isPF = config.printFriendly;
            doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1); doc.rect(lx, sigY, sigW, 11, 'S');
            if (!isPF) {
                doc.setFillColor(...colors.navy); doc.rect(lx, sigY, sigW, 3, 'F');
                doc.setTextColor(255);
            } else {
                doc.setTextColor(...colors.navy);
            }
            doc.setFontSize(6); doc.text(label, lx + 2, sigY + 2.2);
            doc.setTextColor(...colors.text); doc.setFontSize(5); 
            doc.text('Name:', lx + 2, sigY + 6.5); doc.text('Date:', lx + 2, sigY + 9);
        };
        drawSigBlock('PREPARED BY', margin); drawSigBlock('REVIEWED BY', margin + sigW + 3); drawSigBlock('APPROVED BY', margin + (sigW * 2) + 6);

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Scour_Survey_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;
    } catch (e) {
        console.error("RSCOR Report Error", e);
        throw e;
    }
};
