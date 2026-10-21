import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, draw3SectionHeader, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, getInspectionDateRange, sortScourFaceRecords, buildScourFaceTopology, formatReportFindingText, applyRecordCellStyling, REPORT_FOOTER_APP_TEXT } from "./shared-logo";
import { matchesLeg, cleanLegName, isPile } from "./scour-sorting-utils";

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

export const generateROVRSCORV2Report = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    try {
        records = normalizeReportRecords(records);
        if (!config.isBlankReport && (!records || records.length === 0)) {
            return null;
        }

        const sowReportNo = headerData?.sowReportNo || headerData?.sow_report_no || config?.sowReportNo || 'N/A';
        const isPF = config.printFriendly;
        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        const colors = {
            navy: [7, 78, 136] as [number, number, number],
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

        const headerH = 25;
        const drawHeader = (d: jsPDF) => {
            draw3SectionHeader(d, {
                reportTitle: "Scour Survey Sketch Report (ROV) - v2",
                reportNo: sowReportNo,
                structureName: headerData?.platformName,
                jobpackName: headerData?.jobpackName,
                companySettings,
                config,
                headerData,
                contractorLogoData: contractorLogo,
                clientLogoData: companyLogo,
                margin,
                headerH,
                headerY: 7,
            });
        };

        const dateRangeStr = getInspectionDateRange(records, headerData, config);

        const drawContext = (d: jsPDF, y: number) => {
            const rowH = 5;
            const colW = contentWidth / 2;
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border); d.setLineWidth(0.1); 
                if (!isPF) d.setFillColor(...colors.lightGray);
                d.rect(x, ty, w, rowH, config?.printFriendly ? 'S' : 'F'); 
                if (!isPF) d.rect(x, ty, w, rowH, 'S');
                d.setTextColor(...colors.text); d.setFontSize(7); d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 3.5); d.setFont("helvetica", "normal");
                d.text(String(value), x + 25, ty + 3.5);
            };
            drawBox('Structure:', headerData.platformName || 'N/A', margin, colW, y);
            drawBox('Vessel:', headerData.vessel || 'N/A', margin + colW, colW, y);
            drawBox('Job Pack:', headerData.jobpackName || 'N/A', margin, colW, y + rowH);
            drawBox('Insp. Date Range:', dateRangeStr, margin + colW, colW, y + rowH);
            return y + (rowH * 2) + 3;
        };

        const compRegistry = new Map<string | number, any>();
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
                        compRegistry.set(String(c.id), c);
                        compRegistry.set(Number(c.id), c);
                        if (c.q_id) compRegistry.set(c.q_id.toUpperCase().trim(), c);
                    });
                }
            } catch (e) {
                console.warn("[ROV RSCOR V2 Report] Could not pre-fetch structure_components:", e);
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
            const compId = r.component_id || r.structure_components?.id || r.component?.id;
            const qid = String(comp.q_id || comp.id_no || comp.name || r.qid || "").toUpperCase().trim();

            if (compId && compRegistry.has(compId)) {
                const regComp = compRegistry.get(compId);
                comp = { ...regComp, ...comp, metadata: regComp.metadata || comp.metadata };
            } else if (qid && compRegistry.has(qid)) {
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
        const compsPerPage = 4;
        const numPages = Math.max(1, Math.ceil(renderFaces.length / compsPerPage));

        // Scalable Graphics Drawer
        const drawGraphics = (d: jsPDF, x: number, y: number, w: number, h: number, compRecords: any[], faceName: string) => {
            const da = d as any;
            // Build dynamic topology of legs, nodes, and member spans for this face
            const topology = buildScourFaceTopology(compRecords, faceName);
            const { legs, spans } = topology;
            const numLegs = legs.length;
            const numSpans = spans.length;

            const innerMargin = numLegs === 2 ? w * 0.16 : (numLegs === 3 ? w * 0.12 : w * 0.08);
            const xStart = x + innerMargin;
            const xEnd = x + w - innerMargin;
            const legSpacing = numLegs > 1 ? (xEnd - xStart) / (numLegs - 1) : 0;
            const legX = legs.map((_, i) => xStart + i * legSpacing);

            const getLegSlant = (i: number) => {
                if (i === 0) return -w * 0.012;
                if (i === numLegs - 1) return w * 0.012;
                return 0;
            };

            const homY = y + h * 0.44;
            const legRadius = 3.5;
            const redDashed = [239, 68, 68] as [number, number, number];

            const topY = y + h * 0.12;
            const pOffsetBot = y + h * 0.88;
            const refTotalH = pOffsetBot - topY;

            const depths = compRecords.map(r => parseFloat(r.inspection_data?.scour_depth || '0')).filter(v => !isNaN(v));
            const maxD = depths.length > 0 ? Math.max(...depths, 300) : 500;
            const maxVisualDepth = h * 0.28;
            const depthScale = maxD > 0 ? maxVisualDepth / maxD : 0.02;

            const consolidateLocation = (recs: any[], posX: number) => {
                let maxDepth = 0;
                let maxBurial = 0;
                let hasExposed = false;
                let hasAnom = false;
                let hasRect = false;
                const hasData = recs.length > 0;

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
                    isRect: hasRect,
                    hasData
                };
            };

            // Consolidate data for each span at its 3 locations: Left (Leg-side), Midpoint, Right (Leg-side)
            const spanData = spans.map((s, j) => {
                const slantL = getLegSlant(j);
                const slantR = getLegSlant(j + 1);
                const homX_j = legX[j] + (slantL * ((homY - topY) / refTotalH) * 1.5);
                const homX_j1 = legX[j + 1] + (slantR * ((homY - topY) / refTotalH) * 1.5);

                const homActualX1 = homX_j + legRadius - 0.5;
                const homActualX2 = homX_j1 - legRadius + 0.5;
                const spanW = homActualX2 - homActualX1;

                // Leg-side readings are positioned ON the member just inside each leg
                const x_left = homActualX1 + Math.min(8, spanW * 0.17);
                const x_mid = (homActualX1 + homActualX2) / 2;
                const x_right = homActualX2 - Math.min(8, spanW * 0.17);

                const memberRecs = compRecords.filter(r => {
                    const comp = r.structure_components || r.component || {};
                    const q = String(comp.q_id || r.qid || "").toUpperCase();
                    return q === s.memberQid.toUpperCase();
                });

                const leftRecs = memberRecs.filter(r => {
                    const loc = String(r.inspection_data?.scour_location || "").toUpperCase();
                    const isMid = loc.includes("MID") || loc.includes("MIDDLE") || loc.includes("CENTER");
                    if (isMid) return false;
                    const locMatch = loc.match(/LEG\s*[:\- ]*\s*([A-Z0-9]+)/i);
                    const locLeg = locMatch ? cleanLegName(locMatch[1]) : "";
                    return locLeg === s.fromLeg || loc.includes(s.fromLeg);
                });

                const midRecs = memberRecs.filter(r => {
                    const loc = String(r.inspection_data?.scour_location || "").toUpperCase();
                    return loc.includes("MID") || loc.includes("MIDDLE") || loc.includes("CENTER");
                });

                const rightRecs = memberRecs.filter(r => {
                    const loc = String(r.inspection_data?.scour_location || "").toUpperCase();
                    const isMid = loc.includes("MID") || loc.includes("MIDDLE") || loc.includes("CENTER");
                    if (isMid) return false;
                    const locMatch = loc.match(/LEG\s*[:\- ]*\s*([A-Z0-9]+)/i);
                    const locLeg = locMatch ? cleanLegName(locMatch[1]) : "";
                    return locLeg === s.toLeg || loc.includes(s.toLeg);
                });

                return {
                    homActualX1,
                    homActualX2,
                    left: consolidateLocation(leftRecs, x_left),
                    mid: consolidateLocation(midRecs, x_mid),
                    right: consolidateLocation(rightRecs, x_right)
                };
            });

            const mudBaseline = homY + 2.5;
            const getMudY = (p: { depth: number; burial: number }) => {
                if (p.burial > 0) {
                    return mudBaseline - Math.min(4, (p.burial / 100) * 4);
                } else {
                    return mudBaseline + Math.min(maxVisualDepth, p.depth * depthScale);
                }
            };

            // Compute mudline elevation at each leg center (interpolating between adjacent member sides)
            const legMudY = legs.map((l, i) => {
                const pileRecs = compRecords.filter(r => isPile(r) && matchesLeg(r, l.name));
                const pData = pileRecs.find(r => {
                    const rd = r.inspection_data || {};
                    return (rd.scour_depth && parseFloat(rd.scour_depth) > 0) || (rd.Burial_percent && parseFloat(rd.Burial_percent) > 0);
                });

                if (pData) {
                    return getMudY(consolidateLocation([pData], legX[i]));
                }

                if (i === 0 && spanData.length > 0) {
                    return getMudY(spanData[0].left);
                } else if (i === numLegs - 1 && spanData.length > 0) {
                    return getMudY(spanData[spanData.length - 1].right);
                } else if (i > 0 && i - 1 < spanData.length && i < spanData.length) {
                    const yL = getMudY(spanData[i - 1].right);
                    const yR = getMudY(spanData[i].left);
                    return (yL + yR) / 2;
                }
                return mudBaseline;
            });

            // 1. Draw Legs
            for (let i = 0; i < numLegs; i++) {
                const lx = legX[i];
                const slant = getLegSlant(i);
                const pSlantB = slant * ((pOffsetBot - topY) / refTotalH);
                const homX_at_junction = lx + (slant * ((homY - topY) / refTotalH) * 1.5);
                const mudY = legMudY[i];
                const pileRec = legs[i].pileRec;

                const hasExposedPile = !!(
                    pileRec?.inspection_data?.Exposed_pile === 'Yes' || 
                    pileRec?.inspection_data?.Exposed_pile === true ||
                    (i === 0 && spanData[0]?.left.exposed) || 
                    (i === numLegs - 1 && spanData[numSpans - 1]?.right.exposed) || 
                    (i > 0 && (spanData[i - 1]?.right.exposed || spanData[i]?.left.exposed))
                );

                if (hasExposedPile) {
                    const sleeveBotY = homY + h * 0.06;
                    const slantSleeveB = slant * ((sleeveBotY - topY) / refTotalH);

                    da.setDrawColor(80); da.setLineWidth(0.6);
                    da.line(lx - legRadius, topY, lx - legRadius + slantSleeveB, sleeveBotY);
                    da.line(lx + legRadius, topY, lx + legRadius + slantSleeveB, sleeveBotY);
                    da.ellipse(lx, topY, legRadius, 1.0, 'S');
                    da.ellipse(lx + slantSleeveB, sleeveBotY, legRadius, 0.9, 'S');

                    const pR = legRadius * 0.75;
                    da.setDrawColor(60); da.setLineWidth(0.6);
                    da.line(lx - pR + slantSleeveB, sleeveBotY, lx - pR + pSlantB, pOffsetBot);
                    da.line(lx + pR + slantSleeveB, sleeveBotY, lx + pR + pSlantB, pOffsetBot);
                    da.ellipse(lx + pSlantB, pOffsetBot, pR, 0.8, 'S');
                } else {
                    da.setDrawColor(80); da.setLineWidth(0.6);
                    da.line(lx - legRadius, topY, lx - legRadius + pSlantB, pOffsetBot);
                    da.line(lx + legRadius, topY, lx + legRadius + pSlantB, pOffsetBot);
                    da.ellipse(lx, topY, legRadius, 1.0, 'S');
                    da.ellipse(lx + pSlantB, pOffsetBot, legRadius, 0.9, 'S');

                    // Foundation hatching strictly below mudline
                    da.setDrawColor(160, 175, 195); da.setLineWidth(0.3);
                    for (let hY = mudY + 1.5; hY < pOffsetBot; hY += 2) {
                        const hSlant = slant * ((hY - topY) / refTotalH);
                        da.line(lx - legRadius + hSlant, hY, lx + legRadius + hSlant, hY);
                    }
                }

                da.setDrawColor(...redDashed); da.setLineDash([1.5, 1], 0); da.setLineWidth(0.25);
                da.line(lx, topY - 2, lx + pSlantB, pOffsetBot + 2); da.setLineDash([], 0);

                const circleY = y + h * 0.05;
                const circleX = lx - (slant * 0.2);
                da.setDrawColor(...redDashed); da.setLineDash([1, 1], 0);
                da.line(lx, topY, circleX, circleY + 2.5); da.setLineDash([], 0);
                da.setDrawColor(100); da.setFillColor(255); da.circle(circleX, circleY, 3, 'FD');
                da.setFontSize(5.0); da.setTextColor(0); da.setFont("helvetica", "bold");
                da.text(legs[i].name.toUpperCase(), circleX, circleY + 0.7, { align: 'center' }); da.setFont("helvetica", "normal");

                // Node label
                if (i === 0) {
                    da.text(legs[i].node, lx - 8, homY + 1, { align: 'right' });
                } else if (i === numLegs - 1) {
                    da.text(legs[i].node, lx + 8, homY + 1, { align: 'left' });
                } else {
                    da.text(legs[i].node, lx, homY - 3.5, { align: 'center' });
                }
            }

            // 2. Draw Spans
            for (let j = 0; j < numSpans; j++) {
                const sp = spanData[j];
                da.setDrawColor(40); da.setLineWidth(1.0);
                da.line(sp.homActualX1, homY - 2, sp.homActualX2, homY - 2);
                da.line(sp.homActualX1, homY + 2, sp.homActualX2, homY + 2);
                da.setDrawColor(...redDashed); da.setLineDash([1.5, 1], 0); da.setLineWidth(0.25);
                da.line(sp.homActualX1 - 2, homY, sp.homActualX2 + 2, homY); da.setLineDash([], 0);

                const midSpanX = (sp.homActualX1 + sp.homActualX2) / 2;
                da.setFontSize(4.5); da.setFont("helvetica", "bold"); da.setTextColor(60, 70, 85);
                da.text(spans[j].memberQid, midSpanX, homY - 3.5, { align: 'center' });
            }

            // 3. Smooth Natural Mudline (PCHIP Monotonic Spline)
            const startMarginX = x + 3;
            const endMarginX = x + w - 3;
            const pts: { x: number; y: number }[] = [];

            pts.push({ x: startMarginX, y: legMudY[0] });

            for (let i = 0; i < numLegs; i++) {
                pts.push({ x: legX[i], y: legMudY[i] });
                if (i < numSpans) {
                    const sp = spanData[i];
                    pts.push({ x: sp.left.x, y: getMudY(sp.left) });
                    pts.push({ x: sp.mid.x, y: getMudY(sp.mid) });
                    pts.push({ x: sp.right.x, y: getMudY(sp.right) });
                }
            }

            pts.push({ x: endMarginX, y: legMudY[numLegs - 1] });

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
            da.setLineWidth(1.3);
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

            da.setFontSize(5.0); da.setTextColor(...colors.mud); da.setFont("helvetica", "bold");
            da.text("Mudline", startMarginX + 2, mudBaseline - 4);

            // 4. Measurement Bubbles ON MEMBER SIDES (NEVER ON LEGS)
            spanData.forEach(sp => {
                const locs = [sp.left, sp.mid, sp.right];
                locs.forEach(p => {
                    if (!p.hasData) return;
                    const py = getMudY(p);
                    da.setDrawColor(120); da.setLineWidth(0.3); da.line(p.x, homY + 2, p.x, py);
                    const r = numLegs >= 4 ? 2.5 : 3;
                    const my = (homY + 2 + py) / 2;

                    let bubbleColor = [255, 255, 255];
                    let borderCol = [120, 120, 120];
                    if (p.isAnom) { bubbleColor = [254, 226, 226]; borderCol = colors.anomaly; }
                    else if (p.isRect) { bubbleColor = [220, 252, 231]; borderCol = colors.rectified; }

                    da.setFillColor(...bubbleColor); da.setDrawColor(...borderCol); da.circle(p.x, my, r, 'FD');
                    da.setFontSize(numLegs >= 4 ? 3.5 : 4.0); da.setTextColor(0); da.setFont("helvetica", "normal");
                    const val = p.burial > 0 ? `${p.burial}%` : `${p.depth} mm`;
                    da.text(val, p.x, my + 0.8, { align: 'center' });
                    if (p.exposed) {
                        da.setDrawColor(...colors.mud); da.setLineWidth(0.6); da.circle(p.x, my, r + 0.8, 'S');
                    }
                });
            });
        };

        // Render loop grouped by 4 per page
        for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
            if (pageIdx > 0) doc.addPage();
            drawHeader(doc);
            let currentY = drawContext(doc, margin + headerH + 2);

            const startFaceIdx = pageIdx * compsPerPage;
            const pageFaces = renderFaces.slice(startFaceIdx, startFaceIdx + compsPerPage);

            const isLastPage = pageIdx === numPages - 1;
            const availableH = pageHeight - currentY - margin - (isLastPage && config.showSignatures !== false ? 28 : 0);
            const compRowH = availableH / Math.max(1, pageFaces.length);

            for (let c = 0; c < pageFaces.length; c++) {
                const faceName = pageFaces[c];
                const compRecords = faceGroups.get(faceName) || [];
                const sortedCompRecords = sortScourFaceRecords(compRecords, faceName);

                // Draw Face Header Bar
                doc.setFillColor(...colors.navy); doc.rect(margin, currentY, contentWidth, 4.5, 'F');
                doc.setTextColor(255); doc.setFontSize(7); doc.setFont("helvetica", "bold");
                const qids = Array.from(new Set(sortedCompRecords.map(r => r.structure_components?.q_id || r.qid).filter(Boolean)));
                const qidDisplay = qids.length > 0 ? ` (${qids.join(', ')})` : '';
                doc.text(`FACE: ${faceName.toUpperCase()}${qidDisplay}`, margin + 3, currentY + 3.2);
                currentY += 5.5;

                const sketchW = contentWidth / 2 - 4;
                const sketchH = compRowH - 7;
                
                // 1. Draw Sketch on the Left
                drawGraphics(doc, margin, currentY, sketchW, sketchH, compRecords, faceName);

                // 2. Draw Table on the Right
                const tableX = margin + contentWidth / 2 + 2;
                const tableW = contentWidth / 2 - 4;

                autoTable(doc, {
                    startY: currentY,
                    margin: { left: tableX, right: margin },
                    tableWidth: tableW,
                    head: [['Component', 'Location', 'Scour', 'Burial', 'Exposed', 'Remarks']],
                    body: sortedCompRecords.map(r => {
                        const rd = r.inspection_data || {};
                        const qid = r.structure_components?.q_id || r.component?.q_id || r.qid || 'N/A';
                        const linkedAnom = r.insp_anomalies && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null;
                        const isAnomaly = r.has_anomaly || !!linkedAnom || (r.description && r.description.toLowerCase().includes('anomaly'));
                        const isRectified = linkedAnom ? linkedAnom.is_rectified : (r.rectified || (r.description && r.description.toLowerCase().includes('rectified')));
                        const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || '';
                        const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || '';

                        const findings = formatReportFindingText(r);

                        const rawBurial = rd.Burial_percent ?? rd.burial_percent ?? rd.burial;
                        const burialNum = parseFloat(String(rawBurial ?? '').replace(/[^0-9.-]/g, ''));
                        const hasBurial = !isNaN(burialNum) && burialNum > 0;

                        const rawDepth = rd.scour_depth ?? rd.scourDepth ?? rd.depth;
                        const hasDepth = rawDepth !== undefined && rawDepth !== null && String(rawDepth).trim() !== '' && String(rawDepth).trim() !== '-' && String(rawDepth).trim() !== '—';

                        let depthDisplay = '-';
                        if (hasDepth) {
                            const s = String(rawDepth).trim();
                            depthDisplay = s.toLowerCase().includes('mm') || s.toLowerCase().includes('m') ? s : `${s} mm`;
                        } else if (hasBurial) {
                            depthDisplay = '0 mm';
                        }

                        const burialDisplay = rawBurial !== undefined && rawBurial !== null && String(rawBurial).trim() !== '' && String(rawBurial).trim() !== '-' && String(rawBurial).trim() !== '—'
                            ? (String(rawBurial).includes('%') ? String(rawBurial).trim() : `${rawBurial}%`)
                            : '-';

                        return [
                            qid,
                            rd.scour_location || 'N/A',
                            depthDisplay,
                            burialDisplay,
                            rd.Exposed_pile === 'Yes' || rd.Exposed_pile === true ? 'Yes' : 'No',
                            findings
                        ];
                    }),
                    theme: 'grid',
                    headStyles: {fillColor: config?.printFriendly ? [255,255,255] : colors.navy, textColor: config?.printFriendly ? colors.navy : 255, fontSize: 5.5, cellPadding: 0.8, halign: 'center', lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255]},
                    styles: {fontSize: 5.5, cellPadding: 0.8, lineWidth: 0.1, lineColor: colors.border},
                    columnStyles: {
                        0: { cellWidth: 20 },
                        1: { cellWidth: 15, halign: 'center' },
                        2: { cellWidth: 12, halign: 'center' },
                        3: { cellWidth: 12, halign: 'center' },
                        4: { cellWidth: 14, halign: 'center' },
                        5: { cellWidth: 'auto' }
                    },
                    didParseCell: (data) => {
                        if (data.section === 'body') {
                            const r = sortedCompRecords[data.row.index];
                            applyRecordCellStyling(data.cell, r, isPF);
                        }
                    }
                });

                currentY += sketchH + 1.5;
            }
        }

        // Draw signatures block at bottom of last page
        const sigY = pageHeight - 26;
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
                doc.setTextColor(...colors.text); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
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
            doc.text(REPORT_FOOTER_APP_TEXT, margin, footerY);
            if (config.showPageNumbers !== false) {
                doc.text(`Page ${j} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
            }
        }

        applyWatermarkAndSignaturesGlobal(doc, { ...config, sigY });
        if (config.returnBlob) return doc.output("blob");
        doc.save(`Scour_Survey_Sketch_Report_v2_${sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;
    } catch (e) {
        console.error("RSCOR v2 Report Error", e);
        throw e;
    }
};
