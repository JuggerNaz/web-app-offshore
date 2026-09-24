import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo , applyWatermarkAndSignaturesGlobal , formatPdfDate } from "./shared-logo";

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
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    returnBlob?: boolean;
    isBlankReport?: boolean;
    showSignatures?: boolean;
    showPageNumbers?: boolean;
}

export const generateROVRSCORReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    try {
        const sowReportNo = headerData?.sowReportNo || headerData?.sow_report_no || config?.sowReportNo || 'N/A';
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

        const headerH = 24;
        const drawHeader = (d: jsPDF) => {
            const isPF = config.printFriendly;
            if (isPF) {
                d.setDrawColor(...colors.navy); d.setLineWidth(0.3); d.rect(margin, margin, contentWidth, headerH, 'S');
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, headerH, 'F');
                d.setTextColor(255);
            }

            if (companyLogo)    drawLogo(d, companyLogo,    15, 15, pageWidth - margin - 18, margin + 4.5, 'right', 'center');
            if (contractorLogo) drawLogo(d, contractorLogo, 15, 15, margin + 4,              margin + 4.5, 'left',  'center');

            d.setFontSize(10.5); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || 'NasQuest Resources Sdn Bhd', margin + (contentWidth/2), margin + 5.5, { align: 'center' });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 9.5, { align: 'center' });
            d.setFontSize(10.5); d.setFont("helvetica", "bold");
            d.text(`Scour Survey Sketch Report (ROV)`, margin + (contentWidth/2), margin + 15, { align: 'center' });

            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`Report No: ${sowReportNo}`, margin + (contentWidth/2), margin + 19.5, { align: 'center' });
        };

        let startDate: Date | null = null;
        let endDate: Date | null = null;
        if (records.length > 0) {
            const dates = records
                .map(r => new Date(r.cr_date || r.created_at))
                .filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) { startDate = new Date(Math.min(...dates.map(d => d.getTime()))); endDate = new Date(Math.max(...dates.map(d => d.getTime()))); }
        }
        const dateRangeStr = startDate && endDate
            ? `${format(startDate, "dd MMM yyyy")} - ${format(endDate, "dd MMM yyyy")}`
            : (headerData.date || "N/A");

        const drawContext = (d: jsPDF, y: number) => {
            const rowH = 6;
            const colW = contentWidth / 2;
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1); 
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, isPF ? 'S' : 'F'); 
                if (!isPF) d.rect(x, ty, w, rowH, 'S');
                d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4.2); d.setFont("helvetica", "normal");
                d.text(String(value), x + 35, ty + 4.2);
            };
            drawBox('Structure:', headerData.platformName || 'N/A', margin, colW, y);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + colW, colW, y);
            drawBox('Job Pack:', headerData.jobpackName || 'N/A', margin, colW, y + rowH);
            drawBox('Insp. Date Range:', dateRangeStr, margin + colW, colW, y + rowH);
            return y + (rowH * 2) + 3;
        };

        // --- 1. Pre-fetch Structure Components if missing metadata ---
        const compRegistry = new Map<string, any>();
        const effectiveStructureId = config?.structureId || records.find(r => r.structure_components?.structure_id || r.structure_id)?.structure_components?.structure_id || records.find(r => r.structure_id)?.structure_id;

        if (effectiveStructureId && typeof window !== "undefined") {
            try {
                const { createClient } = await import("@/utils/supabase/client");
                const supabase = createClient();
                const { data: allComps } = await supabase
                    .from("structure_components")
                    .select("id, q_id, code, name, face, metadata")
                    .eq("structure_id", effectiveStructureId);

                if (allComps && allComps.length > 0) {
                    allComps.forEach(c => {
                        if (c.q_id) compRegistry.set(c.q_id.toUpperCase().trim(), c);
                    });
                }
            } catch (e) {
                console.warn("[ROV RSCOR Report] Could not pre-fetch structure_components:", e);
            }
        }

        // --- 2. Helper to format face label ---
        const formatFaceName = (faceStr: string): string => {
            const trimmed = String(faceStr).trim();
            if (!trimmed || trimmed === "-" || trimmed.toUpperCase() === "N/A") return "General / Unassigned Face";
            if (/^face\b/i.test(trimmed)) {
                return trimmed.replace(/^face\s*[:\- ]*\s*/i, "Face ");
            }
            if (/^(row|leg|pile|column|bay)\b/i.test(trimmed)) {
                return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
            }
            return `Face ${trimmed}`;
        };

        // --- 3. Helper to resolve record Face according to rules ---
        const resolveRecordFace = (r: any): string => {
            const d = r.inspection_data || r.inspection_dat || {};
            let comp = r.structure_components || r.component || {};
            const qid = String(comp.q_id || comp.id_no || comp.name || r.qid || "").toUpperCase().trim();

            if (qid && compRegistry.has(qid)) {
                const regComp = compRegistry.get(qid);
                comp = { ...regComp, ...comp, metadata: regComp.metadata || comp.metadata };
            }

            const md = (typeof comp.metadata === "string" ? JSON.parse(comp.metadata) : comp.metadata) || {};
            const rawObj = comp.raw || {};
            const rawMd = (typeof rawObj.metadata === "string" ? JSON.parse(rawObj.metadata) : rawObj.metadata) || {};

            // 1. Platform Face Value from Record
            const inspFace = d.platform_face || d.platformFace || d.face || r.platform_face || r.face;
            if (inspFace && String(inspFace).trim() && String(inspFace).trim() !== "-" && String(inspFace).trim().toUpperCase() !== "N/A") {
                return formatFaceName(String(inspFace));
            }

            const compCode = (
                comp.code || 
                comp.component_type || 
                comp.component_types?.code || 
                r.component_code || 
                comp.type || 
                ""
            ).toUpperCase();

            // 2. Component Face Value
            const compFace = comp.face || md.face || md.face_name || md.face_code || md.Face || 
                             md.additionalInfo?.face || md.additionalInfo?.face_pos || rawObj.face || rawMd.face;
            if (compFace && String(compFace).trim() && String(compFace).trim() !== "-" && String(compFace).trim().toUpperCase() !== "N/A") {
                return formatFaceName(String(compFace));
            }

            // 3. Start & End Leg Names
            const sLeg = md.start_leg || md.s_leg || md.leg_1 || md.StartLeg || md.Leg_1 || 
                         comp.start_leg || comp.startLeg || comp.s_leg || rawObj.start_leg || rawObj.s_leg || "";
            const fLeg = md.end_leg || md.f_leg || md.leg_2 || md.EndLeg || md.Leg_2 || 
                         comp.end_leg || comp.endLeg || comp.f_leg || rawObj.end_leg || rawObj.f_leg || "";
            const pileLeg = md.leg_no || md.leg || md.leg_name || comp.leg_no || comp.leg || rawObj.leg_no || "";

            const cleanLeg = (l: string) => String(l).trim().replace(/^leg\s*/i, "").toUpperCase();
            const sLegClean = sLeg ? cleanLeg(sLeg) : "";
            const fLegClean = fLeg ? cleanLeg(fLeg) : "";
            const pileLegClean = pileLeg ? cleanLeg(pileLeg) : "";

            const isPile = compCode === "PL" || compCode === "PILE" || qid.startsWith("PL") || qid.startsWith("PILE");
            if (isPile) {
                if (sLegClean && fLegClean && sLegClean !== fLegClean) {
                    return `Face ${sLegClean}-${fLegClean}`;
                } else if (sLegClean) {
                    return `Face Leg ${sLegClean}`;
                } else if (fLegClean) {
                    return `Face Leg ${fLegClean}`;
                } else if (pileLegClean) {
                    return `Face Leg ${pileLegClean}`;
                }
                const scourLoc = d.scour_location || "";
                if (scourLoc) {
                    const legMatch = scourLoc.match(/leg\s*[:\- ]*\s*([a-zA-Z0-9]+)/i);
                    if (legMatch && legMatch[1]) {
                        return `Face Leg ${legMatch[1].toUpperCase()}`;
                    }
                }
                return "Piles";
            }

            if (sLegClean && fLegClean && sLegClean !== fLegClean) {
                return `Face ${sLegClean}-${fLegClean}`;
            } else if (sLegClean) {
                return `Face Leg ${sLegClean}`;
            } else if (fLegClean) {
                return `Face Leg ${fLegClean}`;
            } else if (pileLegClean) {
                return `Face Leg ${pileLegClean}`;
            }

            const scourLoc = d.scour_location || "";
            if (scourLoc) {
                const legMatch = scourLoc.match(/leg\s*[:\- ]*\s*([a-zA-Z0-9]+)/i);
                if (legMatch && legMatch[1]) {
                    return `Face Leg ${legMatch[1].toUpperCase()}`;
                }
            }

            const nodeMatch = qid.match(/N?(\d{1,5})[\-_/]+N?(\d{1,5})/i);
            if (nodeMatch) {
                return `Face N${nodeMatch[1]}-N${nodeMatch[2]}`;
            }

            return "General / Unassigned Face";
        };

        // --- 4. Group records by Face ---
        const faceGroups = new Map<string, any[]>();
        records.forEach(r => {
            const faceKey = resolveRecordFace(r);
            if (!faceGroups.has(faceKey)) {
                faceGroups.set(faceKey, []);
            }
            faceGroups.get(faceKey)!.push(r);
        });

        const sortedFaces = Array.from(faceGroups.keys()).sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
        );

        const renderFaces = sortedFaces.length > 0 ? sortedFaces : ["General / Unassigned Face"];

        for (let pageIdx = 0; pageIdx < renderFaces.length; pageIdx++) {
            const faceName = renderFaces[pageIdx];
            const faceRecords = faceGroups.get(faceName) || [];

            // Extract all unique components in this face
            const qidSet = new Set<string>();
            faceRecords.forEach(r => {
                const q = r.structure_components?.q_id || r.component?.q_id || r.qid;
                if (q) qidSet.add(q);
            });
            const qidsInFace = Array.from(qidSet);

            // Separate horizontal framing members vs pile records
            const homRecords = faceRecords.filter(r => {
                const comp = r.structure_components || r.component || {};
                const code = (comp.code || comp.component_type || "").toUpperCase();
                const q = (comp.q_id || r.qid || "").toUpperCase();
                return code !== "PL" && code !== "PILE" && !q.startsWith("PL");
            });

            const pileRecords = faceRecords.filter(r => {
                const comp = r.structure_components || r.component || {};
                const code = (comp.code || comp.component_type || "").toUpperCase();
                const q = (comp.q_id || r.qid || "").toUpperCase();
                return code === "PL" || code === "PILE" || q.startsWith("PL");
            });

            // Determine legs for this face
            const foundLegNames: string[] = [];
            faceRecords.forEach(r => {
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

            // Primary framing component for geometry
            const primaryComp = homRecords[0]?.structure_components || homRecords[0]?.component || faceRecords[0]?.structure_components || {};
            const pMd = (typeof primaryComp.metadata === "string" ? JSON.parse(primaryComp.metadata) : primaryComp.metadata) || {};

            let leg1 = (primaryComp.startLeg || pMd.start_leg || pMd.s_leg || pMd.leg_1 || (foundLegNames[0] || '')).toUpperCase().replace(/^LEG\s*/i, '');
            let leg2 = (primaryComp.endLeg || pMd.end_leg || pMd.f_leg || pMd.leg_2 || (foundLegNames[1] || '')).toUpperCase().replace(/^LEG\s*/i, '');

            if (!leg1 && !leg2 && faceName.includes('-')) {
                const fMatch = faceName.match(/([A-Z0-9]+)\s*-\s*([A-Z0-9]+)/i);
                if (fMatch) {
                    leg1 = fMatch[1].replace(/^LEG\s*/i, '');
                    leg2 = fMatch[2].replace(/^LEG\s*/i, '');
                }
            }

            if (!leg1) leg1 = foundLegNames[0] ? foundLegNames[0].toUpperCase().replace(/^LEG\s*/i, '') : 'A1';
            if (!leg2) leg2 = foundLegNames[1] ? foundLegNames[1].toUpperCase().replace(/^LEG\s*/i, '') : (leg1 !== 'B1' ? 'B1' : 'A2');

            let startNode = primaryComp.startNode || pMd.start_node || pMd.s_node || 'N/A';
            let endNode = primaryComp.endNode || pMd.end_node || pMd.f_node || 'N/A';
            const primaryQid = primaryComp.q_id || qidsInFace[0] || '';
            if (primaryQid.includes('-')) {
                const match = primaryQid.match(/([A-Z0-9]+)-([A-Z0-9]+)/);
                if (match) { startNode = match[1]; endNode = match[2]; }
            }

            // Find piles belonging to leg1 and leg2
            const findPileForLeg = (legName: string) => {
                if (!legName) return null;
                const lUpper = legName.toUpperCase();
                return pileRecords.find(pr => {
                    const comp = pr.structure_components || pr.component || {};
                    const q = (comp.q_id || pr.qid || "").toUpperCase();
                    const md = (typeof comp.metadata === "string" ? JSON.parse(comp.metadata) : comp.metadata) || {};
                    const loc = (pr.inspection_data?.scour_location || "").toUpperCase();
                    const compLeg = (md.leg_no || md.leg || md.leg_name || comp.leg_no || comp.start_leg || "").toUpperCase();
                    return q.includes(lUpper) || compLeg.includes(lUpper) || loc.includes(lUpper);
                });
            };

            const pileLeft = findPileForLeg(leg1);
            const pileRight = findPileForLeg(leg2);

            // --- CONSOLIDATE DATA BY 3 SPATIAL LOCATIONS: LEFT LEG, MIDPOINT, RIGHT LEG ---
            const leftRecords: any[] = [];
            const midRecords: any[] = [];
            const rightRecords: any[] = [];

            faceRecords.forEach(r => {
                const rd = r.inspection_data || r.inspection_dat || {};
                const locTag = (rd.scour_location || '').toLowerCase();
                const comp = r.structure_components || r.component || {};
                const q = (comp.q_id || r.qid || "").toUpperCase();
                const isPl = (comp.code || comp.component_type || "").toUpperCase() === "PL" || q.startsWith("PL");
                const l1 = leg1.toLowerCase();
                const l2 = leg2.toLowerCase();

                if (locTag.includes('mid') || locTag.includes('middle') || locTag.includes('center')) {
                    midRecords.push(r);
                } else if (isPl) {
                    if (q.includes(leg1.toUpperCase()) || locTag.includes(l1)) {
                        leftRecords.push(r);
                    } else if (q.includes(leg2.toUpperCase()) || locTag.includes(l2)) {
                        rightRecords.push(r);
                    } else {
                        leftRecords.push(r);
                    }
                } else if (locTag.includes('start') || (l1 && locTag.includes(l1))) {
                    leftRecords.push(r);
                } else if (locTag.includes('end') || (l2 && locTag.includes(l2))) {
                    rightRecords.push(r);
                } else {
                    if (q.includes(leg1.toUpperCase())) leftRecords.push(r);
                    else if (q.includes(leg2.toUpperCase())) rightRecords.push(r);
                    else midRecords.push(r);
                }
            });

            if (pageIdx > 0) doc.addPage();
            drawHeader(doc);
            let currentY = drawContext(doc, margin + headerH + 2);

            // Banner for Face
            doc.setFillColor(...colors.navy); doc.rect(margin, currentY, contentWidth, 5.5, 'F');
            doc.setTextColor(255); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
            const qidDisplay = qidsInFace.length > 0 ? ` | COMPONENTS: ${qidsInFace.join(', ')}` : '';
            doc.text(`FACE: ${faceName.toUpperCase()}${qidDisplay}`, margin + 5, currentY + 3.8);
            currentY += 7.5;

            const panelH = 58;
            const panelW = contentWidth;

            const drawGraphics = (d: jsPDF, gy: number) => {
                const da = d as any;
                const innerMargin = 60;
                const homY = gy + 25.5;
                const legRadius = 5.5;
                const homX1_center = margin + innerMargin;
                const homX2_center = margin + panelW - innerMargin;
                const redDashed = [239, 68, 68] as [number, number, number];

                const depths = faceRecords.map(r => parseFloat(r.inspection_data?.scour_depth || '0')).filter(v => !isNaN(v));
                const maxD = depths.length > 0 ? Math.max(...depths, 300) : 500;
                const maxVisualDepth = 10;
                const depthScale = maxD > 0 ? maxVisualDepth / maxD : 0.02;

                // Consolidate location records taking maximum depth / severity
                const consolidateLocation = (recs: any[], posX: number) => {
                    let maxDepth = 0;
                    let maxBurial = 0;
                    let hasExposed = false;
                    let hasAnom = false;
                    let hasRect = false;

                    recs.forEach(r => {
                        const rd = r.inspection_data || r.inspection_dat || {};
                        const dVal = parseFloat(rd.scour_depth || '0');
                        if (!isNaN(dVal) && dVal > maxDepth) maxDepth = dVal;

                        const bVal = parseFloat(rd.Burial_percent || '0');
                        if (!isNaN(bVal) && bVal > maxBurial) maxBurial = bVal;

                        if (rd.Exposed_pile === 'Yes' || rd.Exposed_pile === true || rd.Exposed_pile === 1) {
                            hasExposed = true;
                        }

                        const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                        if (r.has_anomaly || !!linkedAnom) hasAnom = true;
                        if (linkedAnom ? linkedAnom.is_rectified : r.rectified) hasRect = true;
                    });

                    return {
                        x: posX,
                        depth: maxDepth,
                        burial: maxBurial,
                        exposed: hasExposed,
                        isAnom: hasAnom,
                        isRect: hasRect
                    };
                };

                const pointLeft  = consolidateLocation(leftRecords, homX1_center);
                const pointMid   = consolidateLocation(midRecords, homX1_center + ((homX2_center - homX1_center) * 0.5));
                const pointRight = consolidateLocation(rightRecords, homX2_center);

                const mudBaseline = homY + 3.5;
                const getMudY = (p: { depth: number; burial: number }) => {
                    if (p.burial > 0) {
                        return mudBaseline - Math.min(6, (p.burial / 100) * 6);
                    } else {
                        return mudBaseline + Math.min(maxVisualDepth, p.depth * depthScale);
                    }
                };

                const leftY  = getMudY(pointLeft);
                const midY   = getMudY(pointMid);
                const rightY = getMudY(pointRight);

                let homActualX1 = homX1_center;
                let homActualX2 = homX2_center;

                // Uniform structural dimensions for both sides (symmetric leg + pile length)
                const topY = gy + 7.5;
                const jacketLegBotY = homY + 6.5;
                const pOffsetBot = gy + panelH - 9;
                const refTotalH = pOffsetBot - topY;

                // Draw leg and pile connection with uniform structural length on both sides
                const drawSlantedConnection = (
                    lx: number, 
                    name: string, 
                    node: string, 
                    side: 'left' | 'right', 
                    pileRec: any,
                    mudY: number,
                    hasExposedPile: boolean
                ) => {
                    const slant = side === 'left' ? -3.5 : 3.5;
                    const dy = homY - topY;
                    const homX_at_junction = lx + (slant * (dy / refTotalH) * 1.5);
                    if (side === 'left') homActualX1 = homX_at_junction + legRadius - 0.5;
                    else homActualX2 = homX_at_junction - legRadius + 0.5;

                    const pSlantB = slant * ((pOffsetBot - topY) / refTotalH);

                    if (hasExposedPile) {
                        // EXPOSED PILE CASE: Jacket sleeve stops above mudline revealing the pile cylinder in water
                        const sleeveBotY = homY + 3;
                        const slantSleeveB = slant * ((sleeveBotY - topY) / refTotalH);

                        da.setDrawColor(70, 80, 95); da.setLineWidth(0.8);
                        da.line(lx - legRadius, topY, lx - legRadius + slantSleeveB, sleeveBotY);
                        da.line(lx + legRadius, topY, lx + legRadius + slantSleeveB, sleeveBotY);
                        da.ellipse(lx, topY, legRadius, 1.3, 'S');
                        da.ellipse(lx + slantSleeveB, sleeveBotY, legRadius, 1.2, 'S');

                        // Exposed inner pile cylinder extending through water into seabed
                        const pR = legRadius * 0.75;
                        const pSlantT = slantSleeveB;
                        da.setDrawColor(40, 60, 80); da.setLineWidth(0.8);
                        da.line(lx - pR + pSlantT, sleeveBotY, lx - pR + pSlantB, pOffsetBot);
                        da.line(lx + pR + pSlantT, sleeveBotY, lx + pR + pSlantB, pOffsetBot);
                        da.ellipse(lx + pSlantB, pOffsetBot, pR, 1.1, 'S');

                        // Hatching on pile
                        da.setDrawColor(160, 175, 195); da.setLineWidth(0.4);
                        for (let hY = sleeveBotY + 2; hY < pOffsetBot; hY += 2.2) {
                            const hSlant = slant * ((hY - topY) / refTotalH);
                            da.line(lx - pR + hSlant, hY, lx + pR + hSlant, hY);
                        }

                        // Exposed marker badge
                        const expBadgeY = (sleeveBotY + mudY) / 2;
                        const expBadgeX = side === 'left' ? lx - 14 : lx + 14;
                        da.setFillColor(254, 242, 242); da.setDrawColor(220, 38, 38); da.setLineWidth(0.3);
                        da.rect(expBadgeX - 11, expBadgeY - 2.2, 22, 4.4, 'FD');
                        da.setFontSize(4.5); da.setTextColor(220, 38, 38); da.setFont("helvetica", "bold");
                        da.text("EXPOSED PILE", expBadgeX, expBadgeY + 0.8, { align: 'center' });
                    } else {
                        // NON-EXPOSED PILE CASE: Main jacket leg continues all the way into the seabed
                        // No pile is visible in the water column above mudline
                        da.setDrawColor(70, 80, 95); da.setLineWidth(0.8);
                        da.line(lx - legRadius, topY, lx - legRadius + pSlantB, pOffsetBot);
                        da.line(lx + legRadius, topY, lx + legRadius + pSlantB, pOffsetBot);
                        da.ellipse(lx, topY, legRadius, 1.3, 'S');
                        da.ellipse(lx + pSlantB, pOffsetBot, legRadius, 1.1, 'S');

                        // Subsea foundation hatching (strictly BELOW the mudline)
                        da.setDrawColor(160, 175, 195); da.setLineWidth(0.4);
                        for (let hY = mudY + 1.8; hY < pOffsetBot; hY += 2.2) {
                            const hSlant = slant * ((hY - topY) / refTotalH);
                            da.line(lx - legRadius + hSlant, hY, lx + legRadius + hSlant, hY);
                        }
                    }

                    // Centerline
                    da.setDrawColor(...redDashed); da.setLineDash([2, 1], 0); da.setLineWidth(0.3);
                    da.line(lx, topY - 2, lx + pSlantB, pOffsetBot + 2); da.setLineDash([], 0);

                    // Leg node badge at top
                    const circleY = gy + 3.5; const circleX = lx - (slant * 0.2);
                    da.setDrawColor(...redDashed); da.setLineDash([1.5, 1], 0);
                    da.line(lx, topY, circleX, circleY + 4.5); da.setLineDash([], 0);
                    da.setDrawColor(100); da.setFillColor(255); da.circle(circleX, circleY, 4.5, 'FD');
                    da.setFontSize(5.5); da.setTextColor(0); da.setFont("helvetica", "bold");
                    da.text(`LEG ${name}`.toUpperCase(), circleX, circleY + 0.7, { align: 'center' }); da.setFont("helvetica", "normal");

                    // Node label
                    da.setFontSize(5.5); const nodeX = side === 'left' ? lx - 10 : lx + 10;
                    da.text(node, nodeX, homY, { align: side === 'left' ? 'right' : 'left' });

                    // Only label pile if the pile was actually listed or inspected in the scope
                    const isPileInspected = !!pileRec && faceRecords.some(r => r === pileRec || (r.qid && (r.qid === pileRec.qid || r.qid === pileRec.structure_components?.q_id)));
                    const pileQid = pileRec?.structure_components?.q_id || pileRec?.component?.q_id || pileRec?.qid;
                    if (isPileInspected && pileQid && String(pileQid).trim()) {
                        const pileText = `Pile: ${pileQid}`;
                        const badgeW = Math.max(24, pileText.length * 2.0 + 5);
                        da.setFillColor(240, 245, 255); da.setDrawColor(31, 55, 93); da.setLineWidth(0.3);
                        da.rect(lx + pSlantB - (badgeW / 2), pOffsetBot + 1, badgeW, 4, 'FD');
                        da.setFontSize(5); da.setTextColor(31, 55, 93); da.setFont("helvetica", "bold");
                        da.text(pileText, lx + pSlantB, pOffsetBot + 3.7, { align: 'center' });
                    }
                };

                drawSlantedConnection(homX1_center, leg1, startNode, 'left', pileLeft, leftY, pointLeft.exposed);
                drawSlantedConnection(homX2_center, leg2, endNode, 'right', pileRight, rightY, pointRight.exposed);

                // Horizontal framing member
                da.setDrawColor(40); da.setLineWidth(1.2);
                da.line(homActualX1, homY - 3, homActualX2, homY - 3);
                da.line(homActualX1, homY + 3, homActualX2, homY + 3);
                da.setDrawColor(...redDashed); da.setLineDash([2, 1], 0); da.setLineWidth(0.3);
                da.line(homActualX1 - 3, homY, homActualX2 + 3, homY); da.setLineDash([], 0);

                // Position measurement points at the true structural locations
                pointLeft.x = homX1_center;
                pointRight.x = homX2_center;
                pointMid.x = homX1_center + ((homX2_center - homX1_center) * 0.5);

                // --- DRAW SINGLE CONTINUOUS NATURAL SMOOTH MUDLINE (PCHIP MONOTONIC SPLINE) ---
                const startMarginX = margin + 5;
                const endMarginX = margin + panelW - 5;

                const pts = [
                    { x: startMarginX, y: leftY },
                    { x: pointLeft.x,  y: leftY },
                    { x: pointMid.x,   y: midY },
                    { x: pointRight.x, y: rightY },
                    { x: endMarginX,   y: rightY }
                ];

                const n = pts.length;
                const deltas: number[] = [];
                const hSeg: number[] = [];
                for (let i = 0; i < n - 1; i++) {
                    hSeg[i] = pts[i + 1].x - pts[i].x;
                    deltas[i] = hSeg[i] !== 0 ? (pts[i + 1].y - pts[i].y) / hSeg[i] : 0;
                }

                const m: number[] = new Array(n).fill(0);
                m[0] = 0;
                m[n - 1] = 0;

                for (let i = 1; i < n - 1; i++) {
                    const dPrev = deltas[i - 1];
                    const dNext = deltas[i];
                    if (dPrev * dNext <= 0) {
                        m[i] = 0;
                    } else {
                        m[i] = (2 * dPrev * dNext) / (dPrev + dNext);
                    }
                }

                da.setDrawColor(...colors.mud);
                da.setLineWidth(1.6);
                da.setLineDash([], 0);

                let prevX = pts[0].x;
                let prevY = pts[0].y;
                const steps = 30;

                for (let i = 0; i < n - 1; i++) {
                    const pA = pts[i];
                    const pB = pts[i + 1];
                    const hi = hSeg[i];
                    const mi = m[i];
                    const mi1 = m[i + 1];

                    for (let s = 1; s <= steps; s++) {
                        const t = s / steps;
                        const t2 = t * t;
                        const t3 = t2 * t;

                        const h00 = 2 * t3 - 3 * t2 + 1;
                        const h10 = t3 - 2 * t2 + t;
                        const h01 = -2 * t3 + 3 * t2;
                        const h11 = t3 - t2;

                        const px = pA.x + t * hi;
                        const py = h00 * pA.y + h10 * hi * mi + h01 * pB.y + h11 * hi * mi1;

                        da.line(prevX, prevY, px, py);
                        prevX = px;
                        prevY = py;
                    }
                }

                // Mudline label
                da.setFontSize(7); da.setTextColor(...colors.mud); da.setFont("helvetica", "bold");
                da.text("Mudline", startMarginX + 3, mudBaseline - 6);

                // --- DRAW EXACTLY 3 NON-OVERLAPPING MEASUREMENT BUBBLES ---
                [pointLeft, pointMid, pointRight].forEach(p => {
                    const py = getMudY(p);
                    da.setDrawColor(120); da.setLineWidth(0.4); da.line(p.x, homY + 3, p.x, py); 
                    const r = 5; 
                    const my = (homY + 3 + py) / 2;

                    let bubbleColor = [255, 255, 255];
                    let borderCol = [120, 120, 120];
                    if (p.isAnom) { bubbleColor = [254, 226, 226]; borderCol = colors.anomaly; }
                    else if (p.isRect) { bubbleColor = [220, 252, 231]; borderCol = colors.rectified; }

                    da.setFillColor(...bubbleColor); da.setDrawColor(...borderCol); da.circle(p.x, my, r, 'FD');
                    da.setFontSize(5); da.setTextColor(0); da.setFont("helvetica", "normal");
                    const val = p.burial > 0 ? `${p.burial}%` : `${p.depth} mm`;
                    da.text(val, p.x, my + 1, { align: 'center' });
                    if (p.exposed) {
                        da.setDrawColor(...colors.mud); da.setLineWidth(0.8); da.circle(p.x, my, r + 1, 'S');
                    }
                });
            };

            drawGraphics(doc, currentY);
            currentY += panelH + 4;

            // Sort face records by location:
            // 1. Start Leg (Left Leg) + respective Piles
            // 2. Midpoint (always in the middle)
            // 3. End Leg (Right Leg) + respective Piles
            const sortGroupRecords = (recs: any[]) => {
                return [...recs].sort((a, b) => {
                    const qidA = (a.structure_components?.q_id || a.component?.q_id || a.qid || "").toUpperCase();
                    const qidB = (b.structure_components?.q_id || b.component?.q_id || b.qid || "").toUpperCase();
                    const isPlA = qidA.startsWith("PL");
                    const isPlB = qidB.startsWith("PL");
                    if (isPlA !== isPlB) return isPlA ? 1 : -1;
                    return qidA.localeCompare(qidB);
                });
            };

            const sortedTableRecords = [
                ...sortGroupRecords(leftRecords),
                ...sortGroupRecords(midRecords),
                ...sortGroupRecords(rightRecords)
            ];

            autoTable(doc, {
                startY: currentY,
                margin: { left: margin, right: margin, top: margin + headerH + 6, bottom: config.showSignatures !== false ? 26 : 10 },
                head: [['Component QID', 'Location', 'Scour Depth', 'Burial %', 'Exposed Pile', 'Findings / Remarks']],
                body: sortedTableRecords.length > 0 ? sortedTableRecords.map(r => {
                    const rd = r.inspection_data || {};
                    const qid = r.structure_components?.q_id || r.component?.q_id || r.qid || 'N/A';
                    const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                    const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                    const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                    const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                    const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || '';

                    const isLeft = leftRecords.includes(r);
                    const isRight = rightRecords.includes(r);
                    const isMid = midRecords.includes(r);

                    let locationStr = rd.scour_location || '';
                    if (!locationStr || locationStr === 'N/A') {
                        if (isLeft) locationStr = `Leg : ${leg1}`;
                        else if (isRight) locationStr = `Leg : ${leg2}`;
                        else if (isMid) locationStr = 'At Midpoint';
                        else locationStr = 'N/A';
                    }

                    const findingsParts: string[] = [];
                    if (r.description?.trim()) findingsParts.push(r.description.trim());
                    if (rd.comments?.trim() && !findingsParts.includes(rd.comments.trim())) findingsParts.push(rd.comments.trim());

                    if (rd.cp_rdg) findingsParts.push(`CP: ${rd.cp_rdg} mV`);
                    if (rd.ut_rdg) findingsParts.push(`UT: ${rd.ut_rdg} mm`);

                    if (isAnomaly && anomRef) findingsParts.push(`[Anomaly Ref: ${anomRef}]`);
                    if (isRectified) findingsParts.push(`[Rectified: ${rectRem || 'Yes'}]`);

                    return [
                        qid,
                        locationStr,
                        rd.scour_depth !== undefined && rd.scour_depth !== null && String(rd.scour_depth).trim() !== '' ? `${rd.scour_depth} mm` : '—',
                        rd.Burial_percent !== undefined && rd.Burial_percent !== null && String(rd.Burial_percent).trim() !== '' ? `${rd.Burial_percent}%` : '—',
                        rd.Exposed_pile === 'Yes' || rd.Exposed_pile === true || rd.Exposed_pile === 1 ? 'Yes' : 'No',
                        { 
                            content: findingsParts.length > 0 ? findingsParts.join('\n') : 'No significant findings',
                            styles: {
                                textColor: isAnomaly ? colors.anomaly : (isRectified ? colors.rectified : colors.text),
                                fontStyle: (isAnomaly || isRectified) ? 'bold' : 'normal'
                            }
                        }
                    ];
                }) : [
                    ["-", "-", "-", "-", "-", "No scour survey observations recorded for this scope."]
                ],
                theme: 'grid',
                headStyles: { 
                    fillColor: isPF ? [255,255,255] : colors.navy, 
                    textColor: isPF ? colors.navy : 255, 
                    fontSize: 6.5, 
                    minCellHeight: 4.5,
                    halign: 'center' 
                },
                styles: { fontSize: 6.5, cellPadding: 1.5, minCellHeight: 4 },
                columnStyles: {
                    0: { cellWidth: 32 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 22, halign: 'center' },
                    3: { cellWidth: 20, halign: 'center' },
                    4: { cellWidth: 22, halign: 'center' },
                    5: { cellWidth: 'auto' },
                },
                didDrawPage: (data) => {
                    if (data.pageNumber > 1) drawHeader(doc);
                },
                didParseCell: (data) => {
                    if (data.section === 'body') {
                        const r = sortedTableRecords[data.row.index];
                        if (!r) return;
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

        const sigY = pageHeight - 25;
        if (config.showSignatures !== false) {
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1);
                doc.rect(lx, sigY, sigW - 4, 16);
                if (!isPF) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 4, 4, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.2);
                doc.setTextColor(...colors.text); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
                doc.text("Name:", lx + 2, sigY + 8.5);
                if (person?.name) doc.text(person.name, lx + 14, sigY + 8.5);
                doc.text("Date:", lx + 2, sigY + 12);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 12);
                doc.text("Signature:", lx + 2, sigY + 15);
            };

            drawSig("PREPARED BY", margin, config?.preparedBy);
            drawSig("REVIEWED BY", margin + sigW, config?.reviewedBy);
            drawSig("APPROVED BY", margin + (sigW * 2), config?.approvedBy);
        }

        const totalPages = doc.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            const footerY = pageHeight - 5;
            doc.setDrawColor(...colors.border); doc.setLineWidth(0.1);
            doc.line(margin, footerY - 2.5, pageWidth - margin, footerY - 2.5);
            doc.setFontSize(6.5); doc.setTextColor(150, 150, 150);
            doc.setFont("helvetica", "normal");
            doc.text(`${companySettings.company_name || 'NasQuest Resources Sdn Bhd'}  |  Scour Survey Sketch Report (ROV)  |  SOW: ${sowReportNo}`, margin, footerY);
            if (config.showPageNumbers !== false) {
                doc.text(`Page ${j} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
            }
        }

        applyWatermarkAndSignaturesGlobal(doc, { ...config, sigY });
        if (config.returnBlob) return doc.output("blob");
        doc.save(`Scour_Survey_Sketch_Report_${sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;
    } catch (e) {
        console.error("RSCOR Report Error", e);
        throw e;
    }
};
