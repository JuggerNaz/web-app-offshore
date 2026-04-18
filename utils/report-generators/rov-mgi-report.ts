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

/**
 * ROV MGI Summary Report - Compact Technical Layout
 */
export const generateROVMGIReport = async (
    records: any[],
    mgiProfile: any,
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    try {
        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - (margin * 2);
        
        // --- 1. Preparation ---
        const safeWaterDepth = Math.max(headerData.waterDepth || 50, 50);
        const GRAPH_MAX_MM = 500;
        
        const resolveDepth = (from: any) => {
            const f = String(from).toUpperCase().trim();
            if (f === 'MSL' || f === '0') return 0;
            if (f === 'MUDLINE') return safeWaterDepth;
            const val = Math.abs(parseFloat(f) || 0);
            return -val; // Force negative as requested
        };

        const recordsByQid: Record<string, any[]> = {};
        records.forEach(r => {
            const qid = r.structure_components?.q_id || "Unassigned";
            if (!recordsByQid[qid]) recordsByQid[qid] = [];
            recordsByQid[qid].push(r);
        });

        const sortedQids = Object.keys(recordsByQid).sort();
        const thresholdList = mgiProfile?.thresholds || [];

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            actual: [20, 184, 166] as [number, number, number], // Teal
            limit: [128, 0, 0] as [number, number, number],    // Maroon
            anomaly: [220, 38, 38] as [number, number, number]  // Red
        };

        const drawPremiumHeader = async (d: jsPDF, qid: string) => {
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

            // 1. Company Logo (Right)
            if (companySettings.logo_url) {
                try {
                    const logoData = await loadLogoWithTransparency(companySettings.logo_url);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, pageWidth - margin - 20, margin + 3, 'right', 'center');
                    }
                } catch (e) {}
            }

            // 2. Contractor Logo (Left)
            if (headerData.contractorLogoUrl) {
                try {
                    const logoData = await loadLogoWithTransparency(headerData.contractorLogoUrl);
                    if (logoData) {
                        drawLogo(d, logoData, 16, 16, margin + 4, margin + 3, 'left', 'center');
                    }
                } catch (e) {}
            }

            d.setFontSize(8); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 6, { align: 'center' });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 10, { align: 'center' });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text(`ROV MGI Survey Report`, margin + (contentWidth/2), margin + 18, { align: 'center' });
        };

        const drawPremiumContext = (d: jsPDF, y: number, qid: string) => {
            const rowH = 6;
            const tableY = y;
            const colW = contentWidth / 3;
            const isPF = config.printFriendly;

            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1); 
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, isPF ? 'S' : 'F'); 
                if (!isPF) d.rect(x, ty, w, rowH, 'S');
                
                d.setTextColor(...colors.text); d.setFontSize(7); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4); d.setFont("helvetica", "normal");
                d.text(String(value), x + 25, ty + 4);
            };
            drawBox('Project:', headerData.jobpackName, margin, colW, tableY);
            drawBox('SOW Report:', headerData.sowReportNo, margin + colW, colW, tableY);
            drawBox('Date:', format(new Date(), 'dd/MM/yyyy'), margin + (colW * 2), colW, tableY);
            drawBox('Structure:', headerData.platformName, margin, colW, tableY + rowH);
            drawBox('Component:', qid, margin + colW, colW, tableY + rowH);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + (colW * 2), colW, tableY + rowH);
            return tableY + (rowH * 2) + 5;
        }

        const parseMG = (mg: string) => {
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
                    if (parts.length === 2) {
                        return { h: parts[0].trim(), s: parts[1].trim() };
                    }
                }
                return { h: val, s: val };
            }
            return { h: '0', s: '0' };
        };

        for (let i = 0; i < sortedQids.length; i++) {
            const qid = sortedQids[i];
            if (i > 0) doc.addPage();
            await drawPremiumHeader(doc, qid);
            const tableY = drawPremiumContext(doc, margin + 22 + 2, qid);

            const qidRecords = recordsByQid[qid].sort((a,b) => resolveDepth(b.elevation) - resolveDepth(a.elevation));
            const plotPoints: { x: number, y: number, h: number, limitX: number, actualX: number }[] = [];

            const tableData = qidRecords.map(r => {
                const elev = resolveDepth(r.elevation);
                const d = r.inspection_data || {};
                let limit = 0;
                if (d.mgi_profile) {
                    limit = parseFloat(String(d.mgi_profile).replace(/[^\d.]/g, '')) || 0;
                } else {
                    const t = thresholdList.find((th: any) => {
                        const from = resolveDepth(th.from_elevation);
                        const to = resolveDepth(th.to_elevation);
                        return Math.abs(elev) >= Math.min(Math.abs(from), Math.abs(to)) && Math.abs(elev) <= Math.max(Math.abs(from), Math.abs(to));
                    });
                    limit = t ? parseFloat(t.max_thickness) : 0;
                }
                const hList = ['mgi_hard_thickness_at_12','mgi_hard_thickness_at_3','mgi_hard_thickness_at_6','mgi_hard_thickness_at_9'];
                const sList = ['mgi_soft_thickness_at_12','mgi_soft_thickness_at_3','mgi_soft_thickness_at_6','mgi_soft_thickness_at_9'];
                const hVals = hList.map(v => parseFloat(d[v]) || (v === 'mgi_hard_thickness_at_12' ? parseFloat(d.mgi_hard_thickness) : 0) || 0);
                const sVals = sList.map(v => parseFloat(d[v]) || (v === 'mgi_soft_thickness_at_12' ? parseFloat(d.mgi_soft_thickness) : 0) || 0);
                
                const mgData = parseMG(d.marine_growth);
                const hCov = d.mgi_hard_coverage ?? mgData.h;
                const sCov = d.mgi_soft_coverage ?? mgData.s;

                return {
                    depth: elev, limit, 
                    maxInRow: Math.max(...hVals, ...sVals),
                    maxHard: Math.max(...hVals),
                    hCov, sCov,
                    h: hVals.map(v => v || '-'), s: sVals.map(v => v || '-'),
                    findings: r.description || 'N/A'
                };
            });

        const isPF = config.printFriendly;

        autoTable(doc, {
            startY: tableY,
            margin: { left: margin, right: margin },
            head: [
                [
                    { content: 'Depth (m)', rowSpan: 3, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } },
                    { content: 'Integrated Profile (mm)', rowSpan: 3, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } },
                    { content: 'Coverage % (H/S)', rowSpan: 3, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } },
                    { content: 'MGI READINGS (mm) - CLOCK POSITIONS', colSpan: 8, styles: { halign: 'center', fillColor: isPF ? [240,240,240] : colors.teal, textColor: isPF ? colors.text : 255, cellPadding: 1 } },
                    { content: 'Max Allowable (mm)', rowSpan: 3, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } },
                    { content: 'Inspection Findings', rowSpan: 3, styles: { halign: 'center', valign: 'middle', fillColor: isPF ? [255,255,255] : colors.navy, textColor: isPF ? colors.navy : 255 } }
                ],
                [
                    { content: 'HARD', colSpan: 4, styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 5.5, cellPadding: 0.5, fontStyle: 'bold' } },
                    { content: 'SOFT', colSpan: 4, styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 5.5, cellPadding: 0.5, fontStyle: 'bold' } }
                ],
                [
                    { content: '12H', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 6, cellPadding: 1 } },
                    { content: '3H', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 6, cellPadding: 1 } },
                    { content: '6H', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 6, cellPadding: 1 } },
                    { content: '9H', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 6, cellPadding: 1 } },
                    { content: '12S', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 6, cellPadding: 1 } },
                    { content: '3S', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 6, cellPadding: 1 } },
                    { content: '6S', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 6, cellPadding: 1 } },
                    { content: '9S', styles: { halign: 'center', fillColor: isPF ? [248,248,248] : colors.teal, textColor: isPF ? colors.text : 255, fontSize: 6, cellPadding: 1 } }
                ]
            ],
                body: tableData.map(row => {
                    const isAnomaly = row.maxInRow > row.limit && row.limit > 0;
                    
                    const formatReading = (v: any, isHard: boolean) => {
                        const numeric = parseFloat(v);
                        if (!isNaN(numeric) && numeric > 0) {
                            if (isAnomaly && isHard && numeric === row.maxHard) {
                                return { content: `${v}`, styles: { fontStyle: 'bold', textColor: colors.anomaly } };
                            }
                            if (numeric === row.maxInRow) {
                                return { content: `${v}`, styles: { fontStyle: 'bold', textColor: colors.teal } };
                            }
                        }
                        return v;
                    };

                    return [
                        `${row.depth.toFixed(1)}m`,
                        '',
                        `${row.hCov}% / ${row.sCov}%`,
                        ...row.h.map(v => formatReading(v, true)),
                        ...row.s.map(v => formatReading(v, false)),
                        { content: `${row.limit}mm`, styles: { fontStyle: 'bold', textColor: colors.limit } },
                        row.findings
                    ];
                }),
                theme: 'grid',
                styles: { fontSize: 6.5, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: colors.border },
                headStyles: { fillColor: colors.teal, textColor: 255, fontStyle: 'bold', halign: 'center', valign: 'middle' },
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 80 }, 2: { cellWidth: 15, halign: 'center' },
                    3: { cellWidth: 8, halign: 'center' }, 4: { cellWidth: 8, halign: 'center' }, 5: { cellWidth: 8, halign: 'center' }, 6: { cellWidth: 8, halign: 'center' },
                    7: { cellWidth: 8, halign: 'center' }, 8: { cellWidth: 8, halign: 'center' }, 9: { cellWidth: 8, halign: 'center' }, 10: { cellWidth: 8, halign: 'center' },
                    11: { cellWidth: 20, halign: 'center' }, 12: { cellWidth: 'auto' }
                },
                didDrawCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const { x, y, width, height } = data.cell;
                        const row = tableData[data.row.index];
                        const xRatio = width / GRAPH_MAX_MM;
                        doc.setLineWidth(0.05); doc.setDrawColor(245);
                        for (let g = 0; g <= GRAPH_MAX_MM; g += 10) { if (g % 100 !== 0) doc.line(x + (g * xRatio), y, x + (g * xRatio), y + height); }
                        doc.setDrawColor(230); doc.setLineWidth(0.1);
                        for (let g = 0; g <= GRAPH_MAX_MM; g += 100) {
                            const gx = x + (g * xRatio); doc.line(gx, y, gx, y + height);
                            if (data.row.index === 0) { 
                                doc.setFontSize(6); 
                                if (isPF) {
                                    doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
                                } else {
                                    doc.setTextColor(255);
                                }
                                doc.text(`${g}`, gx, y - 3, { align: 'center' }); 
                            }
                        }
                        plotPoints.push({ x, y: y + (height / 2), h: height, limitX: x + (row.limit * xRatio), actualX: x + (row.maxInRow * xRatio) });
                    }
                },
                didDrawPage: (data) => {
                   if (plotPoints.length > 0) {
                        const first = plotPoints[0];
                        const last = plotPoints[plotPoints.length - 1];

                        // 1. Max Allowable (Maroon)
                        doc.setDrawColor(...colors.limit); doc.setLineWidth(0.3);
                        doc.moveTo(first.limitX, first.y - (first.h / 2)); // Start at top edge
                        for (let p = 0; p < plotPoints.length; p++) doc.lineTo(plotPoints[p].limitX, plotPoints[p].y);
                        doc.lineTo(last.limitX, last.y + (last.h / 2)); // End at bottom edge
                        doc.stroke();

                        // 2. Actual Reading (Teal)
                        doc.setDrawColor(...colors.actual); doc.setLineWidth(0.5);
                        doc.moveTo(first.actualX, first.y - (first.h / 2));
                        for (let p = 0; p < plotPoints.length; p++) doc.lineTo(plotPoints[p].actualX, plotPoints[p].y);
                        doc.lineTo(last.actualX, last.y + (last.h / 2));
                        doc.stroke();

                        plotPoints.forEach(p => { doc.setFillColor(...colors.actual); doc.circle(p.actualX, p.y, 0.4, 'F'); });
                   }
                }
            });

            const sigY = pageHeight - 32; const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1); doc.rect(lx, sigY, sigW - 5, 12);
                doc.setFillColor(...colors.navy); doc.rect(lx, sigY, sigW - 5, 3.5, 'F');
                doc.setTextColor(255); doc.setFontSize(6); doc.text(label, lx + 2, sigY + 2.5);
            };
            drawSig('PREPARED BY', margin); drawSig('REVIEWED BY', margin + sigW); drawSig('APPROVED BY', margin + (sigW * 2));
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_MGI_Summary_${headerData.sowReportNo}.pdf`);
        return true;
    } catch (e) {
        console.error("MGI Report Error", e);
        throw e;
    }
};
