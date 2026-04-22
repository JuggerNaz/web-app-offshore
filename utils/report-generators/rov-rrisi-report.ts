import jsPDF from "jspdf";
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

        // ── 1. Context ──────────────────────────────────────────────────────────
        const { data: platform } = await supabase.from('u_platform').select('water_depth').eq('id', config.structureId).maybeSingle();
        const platformDepth = platform?.water_depth ? -Math.abs(platform.water_depth) : -35;

        const { data: allComps } = await supabase.from('structure_components').select('id, q_id, code, name, metadata').eq('structure_id', config.structureId);
        const compRegistry = new Map<number, any>();
        const qidToId = new Map<string, number>();
        if (allComps) {
            allComps.forEach(c => {
                compRegistry.set(c.id, c);
                qidToId.set(c.q_id.toUpperCase(), c.id);
                const m = c.q_id.match(/R[IS-]*(\d+)/i);
                if (m) qidToId.set(m[1], c.id);
            });
        }

        const risersMap = new Map<number, { riserComp: any, records: any[] }>();
        const unassigned: any[] = [];
        records.forEach(r => {
            const comp = r.structure_components;
            if (!comp) return;
            let rid: number | null = null;
            if (comp.code === 'RS') rid = comp.id;
            else if (comp.metadata?.associated_comp_id) rid = Number(comp.metadata.associated_comp_id);
            else {
                const q = (comp.q_id || '').toUpperCase(); const m = q.match(/R[IS-]*(\d+)/i);
                if (m && qidToId.has(m[1])) rid = qidToId.get(m[1])!;
                else if (qidToId.has(q)) rid = qidToId.get(q)!;
            }
            if (rid) {
                if (!risersMap.has(rid)) risersMap.set(rid, { riserComp: compRegistry.get(rid) || comp, records: [] });
                risersMap.get(rid)!.records.push(r);
            } else unassigned.push(r);
        });

        if (unassigned.length > 0) {
            if (risersMap.size === 1) Array.from(risersMap.values())[0].records.push(...unassigned);
            else risersMap.set(0, { riserComp: { q_id: 'Miscellaneous' }, records: unassigned });
        }

        const groups = Array.from(risersMap.values()).sort((a, b) => {
            const qA = a.riserComp?.q_id || ''; const qB = b.riserComp?.q_id || '';
            return qA.localeCompare(qB, undefined, { numeric: true, sensitivity: 'base' });
        });

        // ── 2. Rendering ────────────────────────────────────────────────────────
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
            d.setFontSize(13); d.setFont("helvetica", "bold"); d.text(`ROV Riser Survey Report`, margin + contentWidth/2, margin + 17, { align: 'center' });
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
            const riser = group.riserComp;
            const recordsInGroup = group.records;
            if (i > 0) doc.addPage();
            drawHeader(doc);
            let currentY = drawContext(doc, margin + 22 + 2, recordsInGroup);

            // Sub-header
            doc.setFillColor(...colors.navy); doc.rect(margin, currentY, contentWidth, 7, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
            doc.text(`RISER QID: ${riser?.q_id || 'Unknown'}`, margin + 5, currentY + 5);
            currentY += 10;

            const gW = contentWidth * 0.40; const dW = contentWidth * 0.60;
            const gX = margin; const dX = margin + gW;

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

            const gTopY = currentY + 15;
            const gMudlineY = gTopY + 140;

            const sMax = Math.max(designStart + 2, 5);
            const sMin = Math.min(mudlineElev - 10, -40);
            const eRange = sMax - sMin;
            const eToY = (e: number) => gTopY + ((sMax - e) / eRange) * (gMudlineY - gTopY);

            const cX = gX + (gW / 2) - 10;
            const pipeY = eToY(bottomElev); 
            const mudY = eToY(mudlineElev) + (rWidth / 2);
            const bY = eToY(bottomElev + bRadius);

            // --- Draw Mudline ---
            doc.setDrawColor(...colors.mudline); doc.setLineWidth(1.2);
            if (suspGap === 0) {
                doc.line(gX, mudY, gX + gW, mudY);
                doc.setFontSize(7); doc.setTextColor(...colors.mudline); 
                doc.text("SEABED / MUDLINE", gX + 2, mudY - 3, { align: 'left' });
            } else {
                const startMudY = mudY;
                const endMudY = pipeY + (rWidth / 2);
                const touchMudX = cX + bRadius + (mudTouchDist * (gW / 60));
                doc.line(gX, startMudY, cX - 10, startMudY);
                let lx = cX - 10; let ly = startMudY;
                const segs = 20;
                for (let j = 1; j <= segs; j++) {
                    const t = j / segs;
                    const tx = Math.pow(1 - t, 2) * (cX - 10) + 2 * (1 - t) * t * cX + Math.pow(t, 2) * touchMudX;
                    const ty = Math.pow(1 - t, 2) * startMudY + 2 * (1 - t) * t * endMudY + Math.pow(t, 2) * endMudY;
                    doc.line(lx, ly, tx, ty); lx = tx; ly = ty;
                }
                doc.line(lx, ly, gX + gW, ly);
                doc.setFontSize(7); doc.setTextColor(...colors.mudline); 
                doc.text(`SUSPENSION (${suspGap}m)`, cX, startMudY + 5, { align: 'center' });
                doc.text("SEABED", gX + 2, startMudY - 3, { align: 'left' });
            }

            // --- Draw Riser ---
            const drawP = (x1: number, y1: number, x2: number, y2: number, isV: boolean) => {
                doc.setLineWidth(rWidth); doc.setDrawColor(50, 60, 80); doc.line(x1, y1, x2, y2);
                doc.setLineWidth(rWidth * 0.7); doc.setDrawColor(71, 85, 105); doc.line(x1, y1, x2, y2);
                doc.setLineWidth(rWidth * 0.2); doc.setDrawColor(148, 163, 184); 
                const o = -rWidth * 0.15; if (isV) doc.line(x1 + o, y1, x2 + o, y2); else doc.line(x1, y1 + o, x2, y2 + o);
            };
            drawP(cX, eToY(designStart), cX, bY, true);
            const endX = cX + bRadius; 
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
            drawC([50, 60, 80], rWidth, 0); drawC([71, 85, 105], rWidth * 0.7, 0); drawC([148, 163, 184], rWidth * 0.2, -rWidth * 0.15);
            drawP(endX, pipeY, gX + gW - 5, pipeY, false);
            doc.setFontSize(6); doc.setTextColor(71, 85, 105); doc.text("PIPELINE", endX + 10, pipeY + 8);

            // Scale
            doc.setLineWidth(0.1); doc.setDrawColor(200);
            for (let e = Math.floor(sMax); e >= sMin; e -= 5) {
                const ey = eToY(e);
                if (ey <= gMudlineY + 15) {
                    doc.line(cX - 12, ey, cX - 5, ey);
                    doc.setFontSize(6); doc.setTextColor(150, 150, 150); doc.text(`${e}m`, cX - 18, ey + 1);
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
                    doc.setLineWidth(0.3); doc.line(cX + cw/2 + fw, py, dX - 5, py);
                    doc.setFontSize(6); doc.setTextColor(...colors.navy); doc.text(c.q_id || 'Clamp', dX - 3, py + 1.5, { align: 'right' });
                } else {
                    doc.setFillColor(...col); doc.circle(cX, py, 1.8, 'F');
                    doc.setDrawColor(...col); doc.setLineWidth(0.1); doc.line(cX + 2, py, dX - 5, py);
                }
            });

            // --- Table ---
            const sortedR = [...recordsInGroup].sort((a, b) => (parseFloat(b.elevation) || 0) - (parseFloat(a.elevation) || 0));
            autoTable(doc, {
                startY: currentY,
                margin: { left: dX, right: margin },
                tableWidth: dW,
                head: [['Loc / Elev', 'CP (mV)', 'Findings / Anomalies']],
                body: sortedR.map(r => {
                    const rd = r.inspection_data || {};
                    const anoms = r.insp_anomalies || [];
                    const isAnom = r.has_anomaly || anoms.length > 0;
                    const c = r.structure_components || {};
                    const isClamp = c.code === 'CL' || rd.clamp_type || c.q_id?.includes('SUPP') || c.q_id?.includes('CLP');
                    let findings = r.description || 'No significant findings';
                    if (isClamp) findings = `Clamp: ${c.q_id || 'N/A'}\n${findings}`;
                    if (isAnom && anoms.length > 0) {
                        findings += `\n` + anoms.map((a: any) => `[Anom Ref: ${a.ref_no || 'N/A'}]${a.is_rectified ? `\n(Rectified: ${a.rect_comments || ''})` : ''}`).join('\n');
                    }
                    if (r.insp_rov_jobs?.job_no) findings += `\n[Dive: ${r.insp_rov_jobs.job_no}]`;
                    return [
                        { content: r.elevation ? `${r.elevation}m` : (rd.riser_item || 'N/A'), styles: { fontStyle: 'bold' } },
                        { content: rd.cp_rdg ?? rd.cp ?? '-', styles: { halign: 'center' } },
                        { content: findings, styles: { textColor: isAnom ? colors.anomaly : colors.text } }
                    ];
                }),
                theme: 'grid',
                headStyles: { fillColor: colors.navy, textColor: [255, 255, 255], fontSize: 8 },
                styles: { fontSize: 7, cellPadding: 2 },
                columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 15 }, 2: { cellWidth: 'auto' } }
            });

            const sigY = pageHeight - 32; const sigW = contentWidth / 3;
            const drawS = (l: string, lx: number) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1); doc.rect(lx, sigY, sigW - 4, 15, 'S');
                if (!config.printFriendly) { doc.setFillColor(...colors.navy); doc.rect(lx, sigY, sigW - 4, 4, 'F'); doc.setTextColor(255, 255, 255); }
                else doc.setTextColor(...colors.navy);
                doc.setFontSize(7); doc.text(l, lx + 2, sigY + 3);
            };
            drawS('PREPARED BY', margin); drawS('REVIEWED BY', margin + sigW); drawS('APPROVED BY', margin + (sigW * 2));
        }

        // --- Finalize Page Numbers ---
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            drawFooter(doc, j, totalPages);
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Riser_Survey_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (e) { console.error("RRISI Report Error", e); throw e; }
};
