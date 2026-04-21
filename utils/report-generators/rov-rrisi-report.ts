import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
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

/**
 * ROV Riser Structural Integrity Inspection Report (RRISI)
 */
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

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            anomaly: [239, 68, 68] as [number, number, number], // Red
            rectified: [34, 197, 94] as [number, number, number], // Green
            riser: [71, 85, 105] as [number, number, number], // Slate 600
        };

        // --- 1. Preparation ---
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (records.length > 0) {
            const dates = records.map(r => new Date(r.cr_date)).filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) {
                startDate = min(dates);
                endDate = max(dates);
            }
        }

        const dateRangeStr = startDate && endDate 
            ? `${format(startDate, 'dd MMM yyyy')} to ${format(endDate, 'dd MMM yyyy')}`
            : 'N/A';

        const drawHeader = async (d: jsPDF) => {
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

            if (companySettings.logo_url) {
                try {
                    const logoData = await loadLogoWithTransparency(companySettings.logo_url);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, pageWidth - margin - 20, margin + 4, 'right', 'center');
                    }
                } catch (e) {}
            }

            if (headerData.contractorLogoUrl) {
                try {
                    const logoData = await loadLogoWithTransparency(headerData.contractorLogoUrl);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, margin + 4, margin + 4, 'left', 'center');
                    }
                } catch (e) {}
            }

            d.setFontSize(10); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 10, { align: 'center' });
            d.setFontSize(14); d.setFont("helvetica", "bold");
            d.text(`ROV Riser Inspection Report`, margin + (contentWidth/2), margin + 17, { align: 'center' });

            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || 'N/A'}`, margin + (contentWidth/2), margin + 21, { align: 'center' });
        };

        const drawContext = (d: jsPDF, y: number) => {
            const rowH = 7;
            const tableY = y;
            const colW = contentWidth / 2;
            const isPF = config.printFriendly;
            
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1); 
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, isPF ? 'S' : 'F'); 
                if (!isPF) d.rect(x, ty, w, rowH, 'S');
                
                d.setTextColor(...colors.text); d.setFontSize(8); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4.5); d.setFont("helvetica", "normal");
                d.text(String(value), x + 35, ty + 4.5);
            };

            drawBox('Structure:', headerData.platformName, margin, colW, tableY);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + colW, colW, tableY);
            drawBox('Job Pack:', headerData.jobpackName, margin, colW, tableY + rowH);
            drawBox('Insp. Date Range:', dateRangeStr, margin + colW, colW, tableY + rowH);
            drawBox('Insp. Date:', dateRangeStr, margin, contentWidth, tableY + (rowH * 2));
            
            return tableY + (rowH * 3) + 5;
        };

        // --- Main Rendering ---
        await drawHeader(doc);
        const startY = drawContext(doc, margin + 22 + 2);

        // Define panels
        const graphicsWidth = contentWidth * 0.4;
        const dataWidth = contentWidth * 0.6;
        const graphicsX = margin;
        const dataX = margin + graphicsWidth;
        const mainHeight = pageHeight - startY - 45; // Space for signatures at bottom

        // --- Draw Graphics ---
        const drawGraphics = (d: jsPDF, y: number, h: number) => {
            const centerX = graphicsX + (graphicsWidth / 2) - 10;
            const riserTopY = y + 10;
            const riserBottomY = y + h - 40;
            const riserWidth = 7;
            const bendRadius = 15;
            
            // Shading Helper for 3D Effect
            const draw3DPipe = (x1: number, y1: number, x2: number, y2: number, isVertical: boolean) => {
                const w = riserWidth;
                // Shadow edge
                d.setLineWidth(w); d.setDrawColor(50, 60, 80); 
                d.line(x1, y1, x2, y2);
                // Main body
                d.setLineWidth(w * 0.7); d.setDrawColor(71, 85, 105);
                d.line(x1, y1, x2, y2);
                // Highlight
                d.setLineWidth(w * 0.2); d.setDrawColor(148, 163, 184);
                const offset = isVertical ? -w * 0.15 : -w * 0.15;
                if (isVertical) d.line(x1 + offset, y1, x2 + offset, y2);
                else d.line(x1, y1 + offset, x2, y2 + offset);
            };

            // 1. Riser Main Body (3D)
            draw3DPipe(centerX, riserTopY, centerX, riserBottomY, true);
            
            // 2. Riser Bend (3D curve)
            d.setLineCap("round");
            const endX = centerX + bendRadius;
            const endY = riserBottomY + bendRadius;

            // Draw layered curves for 3D effect
            const drawCurveLayer = (color: [number, number, number], width: number, off: number) => {
                const segments = 25;
                let lastX = centerX + off;
                let lastY = riserBottomY;
                d.setDrawColor(...color);
                d.setLineWidth(width);
                const cx = centerX + off;
                const cy = riserBottomY;
                const ex = endX;
                const ey = endY + off;
                // Control point P1 for Quadratic Bezier
                const p1x = cx;
                const p1y = ey;

                for (let i = 1; i <= segments; i++) {
                    const t = i / segments;
                    const tx = Math.pow(1 - t, 2) * cx + 2 * (1 - t) * t * p1x + Math.pow(t, 2) * ex;
                    const ty = Math.pow(1 - t, 2) * cy + 2 * (1 - t) * t * p1y + Math.pow(t, 2) * ey;
                    d.line(lastX, lastY, tx, ty);
                    lastX = tx;
                    lastY = ty;
                }
            };

            drawCurveLayer([50, 60, 80], riserWidth, 0); // Shadow
            drawCurveLayer([71, 85, 105], riserWidth * 0.7, 0); // Core
            drawCurveLayer([148, 163, 184], riserWidth * 0.2, -riserWidth * 0.15); // Highlight
            
            // 3. Pipeline (3D)
            const pipelineX = endX;
            const pipelineY = endY;
            draw3DPipe(pipelineX, pipelineY, graphicsX + graphicsWidth - 5, pipelineY, false);
            
            // 4. Labels
            d.setFontSize(7); d.setTextColor(71, 85, 105); d.setFont("helvetica", "bold");
            d.text("RISER", centerX - 10, riserTopY - 2, { align: 'center' });
            d.text("BEND", centerX - 12, riserBottomY + (bendRadius / 2));
            d.text("PIPELINE (50m)", pipelineX + 15, pipelineY + 8, { align: 'center' });

            // 5. Elevation Scale
            // Determine elevation range from records
            const elevations = records.map(r => Number(r.elevation)).filter(e => !isNaN(e));
            const minElev = elevations.length > 0 ? Math.min(...elevations, -20) : -30;
            const maxElev = elevations.length > 0 ? Math.max(...elevations, 2) : 5;
            const elevRange = maxElev - minElev;
            
            const elevToY = (elev: number) => {
                const ratio = (maxElev - elev) / elevRange;
                return riserTopY + (ratio * (riserBottomY - riserTopY));
            };

            // Draw elevation markers on the left
            d.setLineWidth(0.1); d.setDrawColor(150);
            for (let e = Math.floor(maxElev); e >= Math.floor(minElev); e -= 5) {
                const ey = elevToY(e);
                if (ey >= riserTopY && ey <= riserBottomY) {
                    d.line(centerX - 12, ey, centerX - riserWidth/2, ey);
                    d.setFontSize(6); d.setTextColor(100);
                    d.text(`${e}m`, centerX - 18, ey + 1);
                }
            }

            // 6. Components / Clamps
            // Fetch clamps associated with this riser (records with type CL or similar)
            records.forEach(r => {
                const comp = r.structure_components;
                const d_data = r.inspection_data || r.inspection_dat || {};
                const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                const isAnomaly = r.has_anomaly || !!linkedAnom || r.component_condition === 'Anomalous' || r.is_anomaly || (r.description && r.description.toLowerCase().includes('anomaly'));
                const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                
                let color = colors.navy;
                if (isAnomaly) color = colors.anomaly;
                if (isRectified) color = colors.rectified;

                if (comp?.code === 'CL' || d_data.clamp_type || (comp?.q_id && comp.q_id.startsWith('CL'))) {
                    const cy = elevToY(Number(r.elevation));
                    if (cy >= riserTopY && cy <= riserBottomY) {
                        // Draw Clamp Icon
                        d.setDrawColor(...color); d.setLineWidth(1);
                        d.rect(centerX - 5, cy - 2, 10, 4, 'S');
                        d.setFontSize(6); d.setTextColor(...color);
                        d.text(comp?.q_id || 'Clamp', centerX + 8, cy + 1);
                    }
                } else if (d_data.riser_item === 'Riser Bend') {
                    // Mark bend
                    d.setDrawColor(...color); d.setLineWidth(1.5);
                    // Position at the approximate middle of the curve
                    const midCurveX = centerX + (bendRadius * 0.3);
                    const midCurveY = riserBottomY + (bendRadius * 0.7);
                    d.circle(midCurveX, midCurveY, 4, 'S');
                    d.setFontSize(7);
                    d.text("INSP", midCurveX - 6, midCurveY + 1, { align: 'right' });
                } else if (d_data.riser_item === 'Pipeline') {
                    // Pipeline data
                    const dist = Number(d_data.distance_from_member || 0);
                    const px = pipelineX + (dist * ( (graphicsX + graphicsWidth - 5 - pipelineX) / 50 ));
                    d.setDrawColor(...color); d.setLineWidth(1);
                    d.line(px, pipelineY - 4, px, pipelineY + 4);
                    d.setFontSize(5);
                    d.text(`${dist}m`, px, pipelineY - 6, { align: 'center' });
                } else {
                    // Regular inspection point on riser
                    const iy = elevToY(Number(r.elevation));
                    if (iy >= riserTopY && iy <= riserBottomY) {
                        d.setFillColor(...color);
                        d.circle(centerX, iy, 1.5, 'F');
                        
                        // Pointer Line to Data
                        d.setDrawColor(...color); d.setLineWidth(0.1);
                        d.line(centerX + 2, iy, dataX - 5, iy);
                    }
                }
            });
            
            // Legend
            const legendY = riserBottomY + 40;
            const drawLegendItem = (x: number, ly: number, color: [number, number, number], label: string) => {
                d.setFillColor(...color); d.circle(x, ly, 2, 'F');
                d.setTextColor(...colors.text); d.setFontSize(7);
                d.text(label, x + 4, ly + 1.5);
            };
            drawLegendItem(graphicsX + 5, legendY, colors.navy, 'Normal');
            drawLegendItem(graphicsX + 35, legendY, colors.anomaly, 'Anomaly');
            drawLegendItem(graphicsX + 65, legendY, colors.rectified, 'Rectified');
        };

        // --- Draw Data Table ---
        const drawDataTable = (d: jsPDF, y: number, h: number) => {
            const isPF = config.printFriendly;
            const tableRecords = [...records].sort((a, b) => Number(b.elevation) - Number(a.elevation));
            
            autoTable(d, {
                startY: y,
                margin: { left: dataX, right: margin },
                tableWidth: dataWidth,
                head: [[
                    { content: 'Loc / Elev', styles: { halign: 'center' } },
                    { content: 'CP (mV)', styles: { halign: 'center' } },
                    { content: 'Findings / Anomalies', styles: { halign: 'left' } }
                ]],
                body: tableRecords.map(r => {
                    const rd = r.inspection_data || r.inspection_dat || {};
                    const loc = r.elevation ? `${r.elevation}m` : (rd.riser_item || 'N/A');
                    const cp = rd.cp_rdg || '-';
                    
                    const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                    const isAnomaly = r.has_anomaly || !!linkedAnom || r.component_condition === 'Anomalous' || r.is_anomaly || (r.description && r.description.toLowerCase().includes('anomaly'));
                    const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                    const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                    const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || '';

                    let findings = r.description || '';
                    if (rd.cp_rdg_additional && Array.isArray(rd.cp_rdg_additional)) {
                        rd.cp_rdg_additional.forEach((a: any) => {
                            if (a.reading) findings += `\nCP Add: ${a.reading}mV (${a.location || ''})`;
                        });
                    }
                    if (rd.debris && rd.debris !== 'None') findings += `\nDebris: ${rd.debris}`;
                    if (rd.marine_growth) findings += `\nMG: ${rd.marine_growth}`;

                    if (isAnomaly && anomRef) {
                        findings += `\n[Reference: ${anomRef}]`;
                    }
                    if (isRectified) {
                        findings += `\nRectified: ${rectRem || 'N/A'}`;
                    }

                    return [
                        { content: loc, styles: { fontStyle: 'bold' } },
                        { content: cp, styles: { halign: 'center' } },
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
                headStyles: { fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255, fontSize: 8 },
                styles: { fontSize: 7, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 20 },
                    1: { cellWidth: 15 },
                    2: { cellWidth: 'auto' }
                },
                didDrawCell: (data) => {
                    // Optional: add markers or icons in cells if needed
                }
            });
        };

        drawGraphics(doc, startY, mainHeight);
        drawDataTable(doc, startY, mainHeight);

        // Signatures
        const sigY = pageHeight - 35;
        const sigW = contentWidth / 3;
        const drawSig = (label: string, lx: number) => {
            const isPF = config.printFriendly;
            doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1); doc.rect(lx, sigY, sigW - 5, 15, 'S');
            if (!isPF) {
                doc.setFillColor(...colors.navy); doc.rect(lx, sigY, sigW - 5, 4, 'F');
                doc.setTextColor(255);
            } else {
                doc.setTextColor(...colors.navy);
            }
            doc.setFontSize(7); doc.text(label, lx + 2, sigY + 3);
            doc.setTextColor(...colors.text); doc.setFontSize(6); 
            doc.text('Name:', lx + 2, sigY + 10);
            doc.text('Date:', lx + 2, sigY + 13);
        };

        drawSig('PREPARED BY', margin);
        drawSig('REVIEWED BY', margin + sigW);
        drawSig('APPROVED BY', margin + (sigW * 2));

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_RRISI_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("RRISI Report Error", e);
        throw e;
    }
};
