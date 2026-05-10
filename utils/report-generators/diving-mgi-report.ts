import { jsPDF } from "jspdf";
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
    showSignatures?: boolean;
    showPageNumbers?: boolean;
}

/**
 * Diving Marine Growth Inspection Graph Report (MGROW)
 */
export const generateDivingMGIReport = async (
    records: any[],
    mgiProfile: any,
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig,
    supabase?: any
) => {
    try {
        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - (margin * 2);
        
        const GRAPH_MAX_MM = 500;
        
        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            actual: [20, 184, 166] as [number, number, number], // Teal
            limit: [128, 0, 0] as [number, number, number],    // Maroon
            etLine: [59, 130, 246] as [number, number, number],  // Blue
            anomaly: [220, 38, 38] as [number, number, number],  // Red
            rectified: [22, 163, 74] as [number, number, number], // Green
        };

        const isPF = config.printFriendly;

        // 1. Load Logos
        const [companyLogo, contractorLogo] = await Promise.all([
            loadLogoWithTransparency(companySettings.logo_url || '/logo.png'),
            headerData.contractorLogoUrl ? loadLogoWithTransparency(headerData.contractorLogoUrl) : Promise.resolve(null)
        ]);

        const drawPageHeader = (d: jsPDF) => {
            const headerH = 22;
            const logoW = 25;
            
            if (isPF) {
                d.setDrawColor(...colors.navy); d.setLineWidth(0.5);
                d.rect(margin, margin, contentWidth, headerH, 'S');
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, headerH, 'F');
                d.setTextColor(255, 255, 255);
            }

            // Draw Logos
            if (companyLogo) drawLogo(d, companyLogo, logoW, headerH - 4, pageWidth - margin - logoW - 2, margin + 2, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, logoW, headerH - 4, margin + 2, margin + 2, "left", "center");

            // Text
            const textCenterX = margin + (contentWidth / 2);
            d.setFontSize(10); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', textCenterX, margin + 8, { align: 'center' });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', textCenterX, margin + 13, { align: 'center' });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text(`Diving Marine Growth Inspection Graph Report`, textCenterX, margin + 20, { align: 'center' });
        };

        const drawContextBox = (d: jsPDF, y: number) => {
            const rowH = 7;
            const colW = contentWidth / 3;
            
            const drawCell = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1);
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, isPF ? 'S' : 'F');
                if (!isPF) d.rect(x, ty, w, rowH, 'S');
                d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4.5); d.setFont("helvetica", "normal");
                d.text(String(value || "—"), x + 25, ty + 4.5);
            };

            drawCell('Structure:', headerData.platformName, margin, colW, y);
            drawCell('Job Pack:', headerData.jobpackName, margin + colW, colW, y);
            drawCell('Date:', format(new Date(), 'dd/MM/yyyy'), margin + (colW * 2), colW, y);
            drawCell('Vessel:', headerData.vessel || 'N/A', margin, colW, y + rowH);
            drawCell('SOW No:', headerData.sowReportNo, margin + colW, colW, y + rowH);
            drawCell('Page:', `${doc.getNumberOfPages()}`, margin + (colW * 2), colW, y + rowH);
            
            return y + (rowH * 2) + 5;
        };

        const parseCoverage = (mg: string) => {
            if (!mg || typeof mg !== 'string') return { h: '0', s: '0' };
            const lower = mg.toLowerCase();
            let rawVal = mg.split(':').pop()?.replace(/coverage/i, '').trim() || '0';
            let val = rawVal.replace('%', '');
            if (val.toLowerCase() === 'all over') val = '100';

            const getHighest = (v: string) => {
                if (v.includes('-')) {
                    const parts = v.split('-');
                    return parts[parts.length - 1].trim();
                }
                return v;
            };

            if (lower.startsWith('hard:')) return { h: getHighest(val), s: '0' };
            if (lower.startsWith('soft:')) return { h: '0', s: getHighest(val) };
            if (lower.startsWith('hard and soft:') || lower.startsWith('mgi:')) {
                if (val.includes('-')) {
                    const parts = val.split('-');
                    if (parts.length === 2) return { h: parts[0].trim(), s: parts[1].trim() };
                }
                return { h: val, s: val };
            }
            return { h: '0', s: '0' };
        };

        // ── Data Preparation ──────────────────────────────────────────────────
        const sortedRecords = [...records].sort((a: any, b: any) => {
            const elevA = parseFloat(a.elevation) || 0;
            const elevB = parseFloat(b.elevation) || 0;
            return elevB - elevA; // High to low
        });

        const plotPoints: { x: number, y: number, h: number, limitX: number, actualX: number, etX: number }[] = [];
        const thresholdList = mgiProfile?.thresholds || [];


        const tableData = sortedRecords.map((r: any, idx: number) => {
            const d = r.inspection_data || {};
            const elev = parseFloat(r.elevation) || 0;
            
            // Thickness Readings (Clock positions)
            const hList = ['mgi_hard_thickness_at_12','mgi_hard_thickness_at_3','mgi_hard_thickness_at_6','mgi_hard_thickness_at_9'];
            const sList = ['mgi_soft_thickness_at_12','mgi_soft_thickness_at_3','mgi_soft_thickness_at_6','mgi_soft_thickness_at_9'];
            const hVals = hList.map(v => parseFloat(d[v]) || 0);
            const sVals = sList.map(v => parseFloat(d[v]) || 0);
            const maxThick = Math.max(...hVals, ...sVals);

            // Coverage
            const mgData = parseCoverage(d.marine_growth);
            const hCov = d.mgi_hard_coverage ?? mgData.h;
            const sCov = d.mgi_soft_coverage ?? mgData.s;

            // Circumference
            const cAbove = parseFloat(d.circumferential_measurement_5m_above) || 0;
            const c0m = parseFloat(d.circumferential_measurement_0m) || 0;
            const cBelow = parseFloat(d.circumferential_measurement_5m_below) || 0;
            const cAvg = (cAbove + c0m + cBelow) / 3;
            
            // Diameter & Effective Thickness
            const nominalDia = parseFloat(d.nominal_diameter) || 0;
            // ET = 1/2 ( (Avg / 3.142) - Dia )
            // Use effective_thickness from data if available
            const et = d.effective_thickness !== undefined ? parseFloat(d.effective_thickness) : (nominalDia > 0 ? 0.5 * ((cAvg / 3.142) - nominalDia) : 0);

            // Max Allowable Calculation with Interpolation
            let limit = 0;
            if (mgiProfile && thresholdList.length > 0) {
                const absElev = Math.abs(elev);
                const wDepth = Math.abs(headerData.waterDepth || 0);
                
                const resolved = thresholdList.map((t: any) => {
                    let d = 0;
                    const from = String(t.from_elevation).toUpperCase().trim();
                    if (from === 'MSL' || from === '0') d = 0;
                    else if (from === 'MUDLINE') d = wDepth;
                    else if (from.includes('WD')) {
                        const m = from.match(/(\d+)\/(\d+)\s*WD/i);
                        if (m && parseInt(m[2]) !== 0) d = (parseInt(m[1]) / parseInt(m[2])) * wDepth;
                        else d = wDepth;
                    } else d = Math.abs(parseFloat(from) || 0);
                    return { depth: d, max: parseFloat(t.max_thickness) || 0 };
                }).sort((a: any, b: any) => a.depth - b.depth);

                if (resolved.length > 0) {
                    if (absElev <= resolved[0].depth) {
                        limit = resolved[0].max;
                    } else if (absElev >= resolved[resolved.length - 1].depth) {
                        limit = resolved[resolved.length - 1].max;
                    } else {
                        for (let i = 0; i < resolved.length - 1; i++) {
                            const p1 = resolved[i];
                            const p2 = resolved[i+1];
                            if (absElev >= p1.depth && absElev <= p2.depth) {
                                const ratio = (absElev - p1.depth) / (p2.depth - p1.depth);
                                limit = p1.max + (p2.max - p1.max) * ratio;
                                break;
                            }
                        }
                    }
                }
            } else if (d.mgi_profile) {
                limit = parseFloat(String(d.mgi_profile).replace(/[^\d.]/g, '')) || 0;
            }

            // Findings
            const linkedAnomaly = r.insp_anomalies?.[0];
            const isAnomaly = r.has_anomaly === true || !!linkedAnomaly;
            const isRectified = linkedAnomaly?.is_rectified || r.rectified;
            const anomRef = linkedAnomaly?.anomaly_ref_no || r.anomaly_ref_no || '';
            const rectRem = linkedAnomaly?.rectified_remarks || r.rectified_comments || '';

            let findings = r.description || "";
            if (isAnomaly && anomRef) findings += `\n[Ref: ${anomRef}]`;
            if (isRectified) findings += `\nRectified: ${rectRem || "N/A"}`;

            return {
                itemNo: idx + 1,
                qid: r.structure_components?.q_id || "—",
                elev,
                maxThick,
                hCov,
                sCov,
                cAbove,
                c0m,
                cBelow,
                cAvg,
                et,
                limit,
                nominalDia,
                findings,
                isAnomaly,
                isRectified
            };
        });

        // ── Draw ──────────────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextBox(doc, margin + 22 + 2);

        autoTable(doc, {
            startY,
            margin: { left: margin, right: margin },
            head: [
                [
                    { content: "Item\nNo.", rowSpan: 2 },
                    { content: "Elev\n(m)", rowSpan: 2 },
                    { content: "Thickness Profile (mm)", rowSpan: 2, styles: { halign: "center" } },
                    { content: "Coverage %", colSpan: 2, styles: { halign: "center" } },
                    { content: "Circumference Measurement (mm)", colSpan: 5, styles: { halign: "center" } },
                    { content: "Max\nAllow", rowSpan: 2 },
                    { content: "Dia\n(mm)", rowSpan: 2 },
                    { content: "Findings", rowSpan: 2 }
                ],
                [
                    "Hard", "Soft",
                    "-0.5m", "0m", "+0.5m", "Avg", "ET"
                ]
            ],
            body: tableData.map(row => [
                row.itemNo,
                row.elev.toFixed(1),
                "", // Graph placeholder
                `${row.hCov}%`,
                `${row.sCov}%`,
                row.cAbove || "—",
                row.c0m || "—",
                row.cBelow || "—",
                row.cAvg > 0 ? row.cAvg.toFixed(1) : "—",
                row.et > 0 ? row.et.toFixed(1) : "—",
                row.limit > 0 ? row.limit.toFixed(1) : "—",
                row.nominalDia || "—",
                row.findings
            ]),
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : 255,
                fontSize: 7,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                lineColor: colors.border,
                lineWidth: 0.1,
            },
            styles: {
                fontSize: 6.5,
                cellPadding: 1.5,
                textColor: colors.text,
                lineColor: colors.border,
                lineWidth: 0.1,
                halign: "center",
                valign: "middle"
            },
            columnStyles: {
                0: { cellWidth: 8 },  // Item
                1: { cellWidth: 10 }, // Elev
                2: { cellWidth: 80 }, // Graph
                3: { cellWidth: 10 }, // Hard %
                4: { cellWidth: 10 }, // Soft %
                5: { cellWidth: 12 }, // -0.5m
                6: { cellWidth: 12 }, // 0m
                7: { cellWidth: 12 }, // +0.5m
                8: { cellWidth: 12 }, // Avg
                9: { cellWidth: 12 }, // ET
                10: { cellWidth: 12 }, // Max Allow
                11: { cellWidth: 12 }, // Dia
                12: { cellWidth: "auto", halign: "left" } // Findings
            },
            didParseCell: (data: any) => {
                if (data.section === "body") {
                    const row = tableData[data.row.index];
                    
                    // Default font style
                    data.cell.styles.fontStyle = "normal";

                    // Color columns strictly as per user request
                    if (data.column.index === 9) { // ET
                        data.cell.styles.textColor = colors.etLine;
                        data.cell.styles.fontStyle = "bold";
                    } else if (data.column.index === 10) { // Max Allow
                        data.cell.styles.textColor = colors.limit;
                        data.cell.styles.fontStyle = "bold";
                    }

                    // For other columns, apply anomaly/rectified colors but EXCLUDE Average (index 8)
                    if (data.column.index !== 8 && data.column.index !== 9 && data.column.index !== 10) {
                        if (row.isAnomaly) {
                            data.cell.styles.textColor = colors.anomaly;
                            data.cell.styles.fontStyle = "bold";
                        } else if (row.isRectified) {
                            data.cell.styles.textColor = colors.rectified;
                            data.cell.styles.fontStyle = "bold";
                        }
                    }
                }
            },
            didDrawCell: (data: any) => {
                if (data.section === "body" && data.column.index === 2) {
                    const { x, y, width, height } = data.cell;
                    const row = tableData[data.row.index];
                    const xRatio = width / GRAPH_MAX_MM;

                    // Grid lines
                    doc.setLineWidth(0.05); doc.setDrawColor(245, 245, 245);
                    for (let g = 0; g <= GRAPH_MAX_MM; g += 10) {
                        if (g % 100 !== 0) doc.line(x + (g * xRatio), y, x + (g * xRatio), y + height);
                    }
                    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.15);
                    for (let g = 0; g <= GRAPH_MAX_MM; g += 100) {
                        const gx = x + (g * xRatio); doc.line(gx, y, gx, y + height);
                        if (data.row.index === 0) {
                            doc.setFontSize(6); 
                            if (isPF) doc.setTextColor(0, 0, 0);
                            else doc.setTextColor(255, 255, 255);
                            doc.setFont("helvetica", "bold");
                            doc.text(`${g}`, gx, y - 2.5, { align: 'center' });
                            doc.setFont("helvetica", "normal");
                        }
                    }

                    plotPoints.push({ 
                        x, y: y + (height / 2), h: height, 
                        limitX: x + (row.limit * xRatio), 
                        actualX: x + (row.maxThick * xRatio),
                        etX: x + (row.et * xRatio)
                    });
                }
            },
            didDrawPage: (data: any) => {
                if (data.pageNumber > 1) drawPageHeader(doc);
                
                // Draw graph lines for this page
                if (plotPoints.length > 0) {
                    const first = plotPoints[0];
                    const last = plotPoints[plotPoints.length - 1];

                    // 1. Max Allowable (Maroon)
                    doc.setDrawColor(...colors.limit); doc.setLineWidth(0.3);
                    doc.moveTo(first.limitX, first.y - (first.h / 2));
                    for (let p = 0; p < plotPoints.length; p++) doc.lineTo(plotPoints[p].limitX, plotPoints[p].y);
                    doc.lineTo(last.limitX, last.y + (last.h / 2));
                    doc.stroke();

                    // 2. Actual Reading (Teal)
                    doc.setDrawColor(...colors.actual); doc.setLineWidth(0.5);
                    doc.moveTo(first.actualX, first.y - (first.h / 2));
                    for (let p = 0; p < plotPoints.length; p++) doc.lineTo(plotPoints[p].actualX, plotPoints[p].y);
                    doc.lineTo(last.actualX, last.y + (last.h / 2));
                    doc.stroke();

                    // 3. Effective Thickness (Blue)
                    doc.setDrawColor(...colors.etLine); doc.setLineWidth(0.6);
                    doc.setLineDashPattern([1, 1], 0); // Dashed for ET
                    doc.moveTo(first.etX, first.y - (first.h / 2));
                    for (let p = 0; p < plotPoints.length; p++) doc.lineTo(plotPoints[p].etX, plotPoints[p].y);
                    doc.lineTo(last.etX, last.y + (last.h / 2));
                    doc.stroke();
                    doc.setLineDashPattern([], 0); // Reset

                    plotPoints.forEach(p => { 
                        doc.setFillColor(...colors.actual); 
                        doc.circle(p.actualX, p.y, 0.4, 'F'); 
                        doc.setFillColor(...colors.etLine); 
                        doc.circle(p.etX, p.y, 0.4, 'F'); 
                    });
                }
                
                // ── Signatures at Footer ──────────────────────────────────────
                if (config.showSignatures !== false) {
                    const sigY = pageHeight - 35;
                    const sigW = contentWidth / 3;
                    
                    const drawSig = (label: string, lx: number) => {
                        doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1); 
                        doc.rect(lx, sigY, sigW - 5, 15);
                        doc.setFillColor(...colors.navy); doc.rect(lx, sigY, sigW - 5, 4, 'F');
                        doc.setTextColor(255, 255, 255); doc.setFontSize(7); 
                        doc.text(label, lx + 2, sigY + 3);
                    };
                    drawSig('PREPARED BY', margin);
                    drawSig('REVIEWED BY', margin + sigW);
                    drawSig('APPROVED BY', margin + (sigW * 2));
                }

                // Page Footer Info
                doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
                doc.setTextColor(...colors.text);
                doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
                doc.line(margin, pageHeight - 15, margin + contentWidth, pageHeight - 15);
                
                // Formula Note
                doc.setFont("helvetica", "italic");
                doc.text("Effective Thickness (ET) Formula: ET = 1/2 ( (Avg Circumference / 3.142) - Nominal Diameter )", margin, pageHeight - 12);
                
                doc.setFont("helvetica", "normal");
                doc.text(
                    `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Diving Marine Growth Inspection Graph Report`,
                    margin, pageHeight - 8
                );
                if (config.showPageNumbers !== false) {
                    doc.text(`Page ${data.pageNumber}`, margin + contentWidth, pageHeight - 8, { align: "right" });
                }
            }
        });

        if (config.returnBlob) return doc.output("blob");
        doc.save(`Diving_MGI_Graph_Report_${headerData.sowReportNo || "N/A"}.pdf`);
        return;
    } catch (e) {
        console.error("Diving MGI Report Error", e);
        throw e;
    }
};
