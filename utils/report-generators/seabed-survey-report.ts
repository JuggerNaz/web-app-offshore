import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/utils/supabase/client";
import { CompanySettings, ReportConfig } from "./defect-anomaly-report";
import { loadLogoWithTransparency, drawLogo , applyWatermarkAndSignaturesGlobal } from "./shared-logo";

export interface SeabedSurveyReportOptions extends Partial<ReportConfig> {
    comparisonKey?: string;
    comparisonName?: string;
    comparisonRecords?: any[];
    currentPage?: number;
    headerData?: any;
}

export const generateSeabedSurveyReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings,
    config: SeabedSurveyReportOptions = {},
    itemTypeFilter: string = ""
) => {
    const supabase = createClient();
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    const colors = {
        navy: [31, 55, 93] as [number, number, number],
        lightGray: [245, 247, 250] as [number, number, number],
        border: [209, 213, 219] as [number, number, number],
        text: [30, 41, 59] as [number, number, number],
        muted: [100, 116, 139] as [number, number, number]
    };

    // ── Fetch Current Dataset Records ──────────────────────────────────────────
    let records: any[] = [];
    try {
        let q = supabase.from('insp_records')
            .select(`
                insp_id, inspection_data, description, structure_components:component_id ( q_id )
            `)
            .eq('structure_id', Number(structure?.id || structure?.structure_id || 0))
            .eq('inspection_type_code', 'RSEAB')
            .order('insp_id', { ascending: true });

        if (jobPack?.id || jobPack?.jobpack_id) {
            q = q.eq('jobpack_id', Number(jobPack.id || jobPack.jobpack_id));
        }

        const { data, error } = await q;

        if (data) {
            const allMapped = data.map((r: any) => {
                const idraw = r.inspection_data || {};
                const cat = idraw.category || idraw.type || (r.description?.includes('Gas Seepage') ? 'Gas Seepage' : r.description?.includes('Crater') ? 'Crater' : 'Debris');
                
                // Formulate category-specific info string or dimensions/material
                let sizeDisplay = 'N/A';
                let matDisplay = 'N/A';

                if (cat === 'Gas Seepage') {
                    matDisplay = 'N/A';
                    const intensity = idraw.seepage_intensity || idraw.intensity || '';
                    sizeDisplay = intensity ? `Intensity: ${intensity}` : 'N/A';
                } else if (cat === 'Crater') {
                    matDisplay = 'N/A';
                    const cDia = idraw.crater_diameter || idraw.craterDiameter || '';
                    const cDiaUnit = idraw.crater_diameter_unit || idraw.craterDiameterUnit || 'm';
                    const cDep = idraw.crater_depth || idraw.craterDepth || '';
                    const cDepUnit = idraw.crater_depth_unit || idraw.craterDepthUnit || 'm';
                    if (cDia || cDep) {
                        const parts = [];
                        if (cDia) parts.push(`Dia: ${cDia}${cDiaUnit}`);
                        if (cDep) parts.push(`Depth: ${cDep}${cDepUnit}`);
                        sizeDisplay = parts.join(', ');
                    } else {
                        sizeDisplay = idraw.size_dimensions || idraw.dimension_1 || 'N/A';
                    }
                } else {
                    // Debris
                    matDisplay = idraw.material || idraw.debris_material || 'Unknown';
                    const rawSize = idraw.size_dimensions || idraw.dimension_1;
                    if (rawSize && rawSize !== 'm x m') {
                        sizeDisplay = rawSize;
                    } else {
                        const l = idraw.size_length || idraw.length || '';
                        const lu = idraw.size_length_unit || idraw.lengthUnit || 'm';
                        const w = idraw.size_width || idraw.width || '';
                        const wu = idraw.size_width_unit || idraw.widthUnit || 'm';
                        const h = idraw.size_height || idraw.height || '';
                        const hu = idraw.size_height_unit || idraw.heightUnit || 'm';
                        const d = idraw.size_diameter || idraw.diameter || '';
                        const du = idraw.size_diameter_unit || idraw.diameterUnit || 'm';
                        
                        const parts = [];
                        if (l) parts.push(`L:${l}${lu}`);
                        if (w) parts.push(`W:${w}${wu}`);
                        if (h) parts.push(`H:${h}${hu}`);
                        if (d) parts.push(`Dia:${d}${du}`);
                        sizeDisplay = parts.length > 0 ? parts.join(' x ') : 'N/A';
                    }
                }

                return {
                    id: r.insp_id,
                    x: parseFloat(idraw.x || '0'),
                    y: parseFloat(idraw.y || '0'),
                    label: '',
                    qid: r.structure_components?.q_id || r.insp_id,
                    face: idraw.face || '',
                    distance: parseFloat(idraw.distance_from_leg || idraw.distance) || 0,
                    northing: idraw.northing || '',
                    easting: idraw.easting || '',
                    type: cat,
                    description: r.description?.replace(/^(Debris|Gas Seepage|Crater|Seabed Debris):\s*/i, '') || idraw.debris_desc || '-',
                    size: sizeDisplay,
                    material: matDisplay,
                    isMetallic: (idraw.material || idraw.debris_material) === 'Metallic'
                };
            }).filter(r => !isNaN(r.x) && !isNaN(r.y) && (itemTypeFilter === '' || itemTypeFilter.toLowerCase() === 'all' || r.type.toLowerCase().includes(itemTypeFilter.toLowerCase())));

            records = allMapped.map((r, idx) => ({ ...r, label: (idx + 1).toString() }));
        }
    } catch (e) {
        console.error("Error fetching seabed data", e);
    }

    // Process comparison dataset if present
    let compRecords: any[] = [];
    if (config.comparisonRecords && config.comparisonRecords.length > 0) {
        compRecords = config.comparisonRecords.filter(r => 
            itemTypeFilter === '' || itemTypeFilter.toLowerCase() === 'all' || r.type.toLowerCase().includes(itemTypeFilter.toLowerCase())
        );
    }

    // ── Logos ────────────────────────────────────────────────────────────────
    let clientLogo: any = null;
    if (companySettings?.logo_url) {
        try { clientLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
    }

    let contractorLogo: any = null;
    let contractorName = "";
    if (config.showContractorLogo || config.headerData?.contractorLogoUrl) {
        const logoUrl = config.headerData?.contractorLogoUrl;
        if (logoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(logoUrl); } catch (_) {}
        }
    }

    // ── Header & Subheader Drawers ───────────────────────────────────────────
    const isPrintFriendly = config.printFriendly === true;
    const headerH = 22;

    const drawHeader = (d: jsPDF) => {
        if (isPrintFriendly) {
            d.setDrawColor(...colors.navy); d.setLineWidth(0.3); d.rect(margin, margin, contentWidth, headerH, 'S');
            d.setTextColor(...colors.navy);
        } else {
            d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, headerH, 'F');
            d.setTextColor(255);
        }

        if (clientLogo)     drawLogo(d, clientLogo,     16, 16, pageWidth - margin - 20, margin + 3, 'right', 'center');
        if (contractorLogo) drawLogo(d, contractorLogo, 16, 16, margin + 4,              margin + 3, 'left',  'center');

        d.setFontSize(10); d.setFont("helvetica", "bold");
        d.text((companySettings.company_name || 'OFFSHORE INSPECTION DIVISION').toUpperCase(), margin + (contentWidth/2), margin + 6, { align: 'center' });
        d.setFontSize(8); d.setFont("helvetica", "normal");
        d.text(companySettings.department_name || companySettings.departmentName || 'Engineering & Technical Division', margin + (contentWidth/2), margin + 11, { align: 'center' });
        
        d.setFontSize(13); d.setFont("helvetica", "bold");
        const titleType = itemTypeFilter && itemTypeFilter.toLowerCase() !== 'all' ? itemTypeFilter.toUpperCase() : "GENERAL";
        d.text(`SEABED SURVEY MULTI-DROP SKETCH REPORT (${titleType})`, margin + (contentWidth/2), margin + 17, { align: 'center' });
    };

    const drawSubHeader = (d: jsPDF, y: number) => {
        const rowH = 6;
        const colW = contentWidth / 2;
        const hData = config.headerData || {};
        
        const structName = structure?.str_name || structure?.name || hData.platformName || "N/A";
        const jobPackName = jobPack?.name || hData.jobpackName || "N/A";
        const vessel = hData.vessel || "N/A";
        const reportNo = sowReportNo || hData.sowReportNo || "N/A";
        const inspDate = hData.date || new Date().toLocaleDateString("en-GB");

        const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            if (!isPrintFriendly) d.setFillColor(...colors.lightGray);
            d.rect(x, ty, w, rowH, isPrintFriendly ? 'S' : 'F');
            if (!isPrintFriendly) d.rect(x, ty, w, rowH, 'S');
            d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold");
            d.text(label, x + 2, ty + 4); d.setFont("helvetica", "normal");
            d.text(String(value), x + 30, ty + 4);
        };

        drawBox('Structure:', structName, margin, colW, y);
        drawBox('Vessel:', vessel, margin + colW, colW, y);
        drawBox('Job Pack:', jobPackName, margin, colW, y + rowH);
        drawBox('Report No:', reportNo, margin + colW, colW, y + rowH);
        
        if (config.comparisonName) {
            drawBox('Filter Type:', itemTypeFilter || 'ALL', margin, colW, y + (rowH * 2));
            drawBox('Compared With:', config.comparisonName, margin + colW, colW, y + (rowH * 2));
            return y + (rowH * 3) + 4;
        } else {
            drawBox('Filter Type:', itemTypeFilter || 'ALL', margin, colW, y + (rowH * 2));
            drawBox('Inspection Date:', inspDate, margin + colW, colW, y + (rowH * 2));
            return y + (rowH * 3) + 4;
        }
    };

    // ── Handle Empty Records Case ────────────────────────────────────────────
    if (records.length === 0 && compRecords.length === 0) {
        drawHeader(doc);
        drawSubHeader(doc, margin + headerH + 3);
        doc.setFontSize(11);
        doc.setTextColor(100);
        const filterMsg = itemTypeFilter ? `matching filter '${itemTypeFilter}'` : "";
        doc.text(`No seabed survey records found ${filterMsg}.`, pageWidth / 2, 90, { align: "center" });

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        doc.save(`${sowReportNo || 'Report'}_Seabed_Survey.pdf`);
        return;
    }

    // ── Range Pagination (21m chunks) ────────────────────────────────────────
    const maxDistCurrent = records.length > 0 ? Math.max(...records.map(r => r.distance || 0)) : 0;
    const maxDistComp = compRecords.length > 0 ? Math.max(...compRecords.map(r => r.distance || 0)) : 0;
    const maxDist = Math.max(maxDistCurrent, maxDistComp);
    const totalRanges = Math.max(1, Math.ceil((maxDist + 1) / 21));

    let pageRanges: { pageIndex: number; items: any[]; compItems: any[]; minD: number; maxD: number }[] = [];
    for (let i = 0; i < totalRanges; i++) {
        const minD = i * 21;
        const maxD = (i + 1) * 21;
        const pageItems = records.filter(d => d.distance > minD && d.distance <= maxD);
        const pageCompItems = compRecords.filter(d => d.distance > minD && d.distance <= maxD);

        if (pageItems.length > 0 || pageCompItems.length > 0) {
            const numberedCurrent = pageItems.map((item, idx) => ({ ...item, label: (idx + 1).toString() }));
            const numberedComp = pageCompItems.map((item, idx) => ({ ...item, label: (idx + 1).toString() }));
            pageRanges.push({ pageIndex: i, items: numberedCurrent, compItems: numberedComp, minD, maxD });
        }
    }

    for (let r = 0; r < pageRanges.length; r++) {
        if (r > 0) doc.addPage();
        
        drawHeader(doc);
        const startY = drawSubHeader(doc, margin + headerH + 3);
        const { minD, maxD, items, compItems } = pageRanges[r];

        // Map Graphics Dimensions (Landscape Layout)
        const plotSize = 95; // 95x95 square map for landscape fit
        const plotCenterX = margin + (plotSize / 2) + 5;
        const plotCenterY = startY + 8 + (plotSize / 2);

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...colors.text);
        doc.text(`SEABED MAP GRAPHICS (Range: ${minD}m - ${maxD}m)`, margin + 2, startY + 4);

        // ── Map Legend ───────────────────────────────────────────────────────
        const legY = startY + 4;
        let legX = margin + 110;
        doc.setFontSize(7);
        doc.setTextColor(80);

        // Legend: Current Survey (Solid)
        doc.setFillColor(29, 78, 216); doc.circle(legX, legY - 1, 1.2, "F");
        doc.text("Metallic", legX + 2.5, legY, { align: "left" }); legX += 17;

        doc.setFillColor(234, 88, 12); doc.circle(legX, legY - 1, 1.2, "F");
        doc.text("Non-Metallic", legX + 2.5, legY, { align: "left" }); legX += 22;

        doc.setFillColor(34, 197, 94); doc.circle(legX, legY - 1, 1.2, "F");
        doc.text("Seepage", legX + 2.5, legY, { align: "left" }); legX += 17;

        doc.setFillColor(147, 51, 234); doc.circle(legX, legY - 1, 1.2, "F");
        doc.text("Crater", legX + 2.5, legY, { align: "left" }); legX += 17;

        if (compItems.length > 0) {
            doc.setFillColor(245, 158, 11); doc.circle(legX, legY - 1, 1.2, "F");
            doc.text("Previous Survey (Ref)", legX + 2.5, legY, { align: "left" });
        }

        // Draw Map Border
        if (isPrintFriendly) {
            doc.setDrawColor(0);
            doc.rect(plotCenterX - plotSize/2, plotCenterY - plotSize/2, plotSize, plotSize);
        } else {
            doc.setFillColor(250, 252, 255);
            doc.rect(plotCenterX - plotSize/2, plotCenterY - plotSize/2, plotSize, plotSize, "F");
            doc.setDrawColor(180);
            doc.rect(plotCenterX - plotSize/2, plotCenterY - plotSize/2, plotSize, plotSize, "S");
        }

        // Draw Compass Labels
        doc.setFontSize(7);
        doc.setTextColor(120);
        doc.text("NORTH", plotCenterX, plotCenterY - plotSize/2 + 3.5, { align: "center" });
        doc.text("SOUTH", plotCenterX, plotCenterY + plotSize/2 - 1.5, { align: "center" });
        doc.text("WEST", plotCenterX - plotSize/2 + 1.5, plotCenterY + 1, { align: "left" });
        doc.text("EAST", plotCenterX + plotSize/2 - 1.5, plotCenterY + 1, { align: "right" });

        // Platform Legs (4 Legs - A1, A2, B1, B2)
        const innerRatio = 0.14666;
        const dx = (plotSize * innerRatio);
        const dy = (plotSize * innerRatio);
        const legOffsets = [
            { x: -dx, y: -dy, n: "A1" },
            { x: dx,  y: -dy, n: "A2" },
            { x: -dx, y: dy,  n: "B1" },
            { x: dx,  y: dy,  n: "B2" },
        ];

        doc.setDrawColor(150); doc.setLineWidth(0.3);
        doc.line(plotCenterX - dx, plotCenterY - dy, plotCenterX + dx, plotCenterY - dy);
        doc.line(plotCenterX - dx, plotCenterY + dy, plotCenterX + dx, plotCenterY + dy);
        doc.line(plotCenterX - dx, plotCenterY - dy, plotCenterX - dx, plotCenterY + dy);
        doc.line(plotCenterX + dx, plotCenterY - dy, plotCenterX + dx, plotCenterY + dy);

        legOffsets.forEach(leg => {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(100);
            doc.circle(plotCenterX + leg.x, plotCenterY + leg.y, 2.2, "DF");
            doc.setFontSize(4.5);
            doc.setTextColor(0);
            doc.text(leg.n, plotCenterX + leg.x, plotCenterY + leg.y + 0.6, { align: "center" });
        });

        // Grid Scale & Distance Rings (every 3m)
        const safetyMargin = (plotSize / 2) * (20 / 300);
        const maxRangeOnPage = 21;
        const scale = ((plotSize / 2) - dx - safetyMargin) / maxRangeOnPage;

        doc.setDrawColor(220); doc.setLineWidth(0.1);
        for (let d = 3; d <= maxRangeOnPage; d += 3) {
            const actualDistance = minD + d;
            const rx = dx + (d * scale);
            const ry = dy + (d * scale);
            doc.rect(plotCenterX - rx, plotCenterY - ry, 2 * rx, 2 * ry, "S");
            
            doc.setFontSize(4.5);
            doc.setTextColor(180);
            doc.text(`${actualDistance}m`, plotCenterX - rx + 0.5, plotCenterY - ry + 2.5);
            doc.text(`${actualDistance}m`, plotCenterX + rx - 4.5, plotCenterY - ry + 2.5);
        }

        // Draw Historical Comparison Markers first (Amber Dashed/Ring)
        compItems.forEach(item => {
            const dRel = Math.max(0, item.distance - minD);
            const angle = Math.atan2(item.y - 50, item.x - 50);
            const rRad = dx + (dRel * scale);
            const screenX = plotCenterX + rRad * Math.cos(angle);
            const screenY = plotCenterY + rRad * Math.sin(angle);

            doc.setFillColor(245, 158, 11);
            doc.setDrawColor(217, 119, 6);
            doc.setLineWidth(0.2);
            doc.circle(screenX, screenY, 2.2, "DF");
            doc.setTextColor(255);
            doc.setFontSize(4.5);
            doc.setFont("helvetica", "bold");
            doc.text(`R${item.label}`, screenX, screenY + 0.7, { align: "center" });
        });

        // Draw Current Markers
        items.forEach(item => {
            const dRel = Math.max(0, item.distance - minD);
            const angle = Math.atan2(item.y - 50, item.x - 50);
            const rRad = dx + (dRel * scale);
            const screenX = plotCenterX + rRad * Math.cos(angle);
            const screenY = plotCenterY + rRad * Math.sin(angle);

            if (item.type.includes('Gas Seepage')) {
                doc.setFillColor(34, 197, 94);
            } else if (item.type.includes('Crater')) {
                doc.setFillColor(147, 51, 234);
            } else if (item.isMetallic) {
                doc.setFillColor(29, 78, 216);
            } else {
                doc.setFillColor(234, 88, 12);
            }

            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.2);
            doc.circle(screenX, screenY, 2.5, "DF");
            doc.setTextColor(255);
            doc.setFontSize(5);
            doc.setFont("helvetica", "bold");
            doc.text(item.label, screenX, screenY + 0.8, { align: "center" });
        });

        // ── Details Table (Right Side of Map Graphics) ───────────────────────
        const tableX = plotCenterX + (plotSize / 2) + 6;
        const tableW = pageWidth - margin - tableX;
        const tableY = startY + 8;

        const tableBody = items.map(item => [
            String(item.label),
            item.qid,
            item.face,
            `${item.distance}m`,
            item.material,
            item.size || '-',
            item.description || '-'
        ]);

        autoTable(doc, {
            startY: tableY,
            head: [["ID", "QID", "Face", "Dist.", "Material", "Dimensions", "Description"]],
            body: tableBody,
            theme: "grid",
            headStyles: {
                fillColor: isPrintFriendly ? [229, 231, 235] : [31, 55, 93],
                textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
                fontStyle: "bold",
                fontSize: 7.5,
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
            margin: { left: tableX, right: margin, top: margin + headerH + 20 },
            tableWidth: tableW
        });

        // If Comparison Data exists, draw second table below for Reference items
        if (compItems.length > 0) {
            const compTableY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 4 : tableY + 50;
            const compTableBody = compItems.map(item => [
                `R${item.label}`,
                item.qid || '-',
                item.face || '-',
                `${item.distance}m`,
                item.material || '-',
                item.description || '-'
            ]);

            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(217, 119, 6);
            doc.text(`Previous Survey Items (${config.comparisonName || 'Reference'})`, tableX, compTableY - 1);

            autoTable(doc, {
                startY: compTableY,
                head: [["Ref ID", "QID", "Face", "Dist.", "Material", "Description"]],
                body: compTableBody,
                theme: "grid",
                headStyles: {
                    fillColor: [245, 158, 11],
                    textColor: [255, 255, 255],
                    fontStyle: "bold",
                    fontSize: 7,
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0]
                },
                styles: { fontSize: 6.5, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
                margin: { left: tableX, right: margin, top: margin + headerH + 20 },
                tableWidth: tableW
            });
        }
    }

    // ── Signatures Section ───────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable?.finalY ?? (margin + headerH + 20);
    if (config.showSignatures !== false) {
        let sigY = pageHeight - 32;
        if (finalY > sigY - 5) {
            doc.addPage();
            drawHeader(doc);
            sigY = pageHeight - 32;
        }
        const sigW = contentWidth / 3;
        const drawSig = (label: string, lx: number) => {
            doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1);
            doc.rect(lx, sigY, sigW - 4, 16);
            if (!isPrintFriendly) {
                doc.setFillColor(...colors.navy);
                doc.rect(lx, sigY, sigW - 4, 4, "F");
                doc.setTextColor(255);
            } else {
                doc.setTextColor(...colors.navy);
            }
            doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
            doc.text(label, lx + 2, sigY + 3);
            doc.setTextColor(...colors.text); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
            doc.text("Name:", lx + 2, sigY + 8);
            doc.text("Date:", lx + 2, sigY + 11.5);
            doc.text("Signature:", lx + 2, sigY + 15);
        };

        drawSig('PREPARED BY', margin);
        drawSig('REVIEWED BY', margin + sigW);
        drawSig('APPROVED BY', margin + (sigW * 2));
    }

    // ── Footer ─────────────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    const printedDateStr = `Printed: ${new Date().toLocaleDateString("en-GB")}`;

    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const footerLineY = pageHeight - 8;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(margin, footerLineY, pageWidth - margin, footerLineY);

        if (config.showPageNumbers !== false) {
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(7);
            doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, footerLineY + 4, { align: "center" });
        }
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.text(printedDateStr, pageWidth - margin, footerLineY + 4, { align: "right" });
    }

    applyWatermarkAndSignaturesGlobal(doc, config);
    if (config.returnBlob) return doc.output("blob");
    const fileSuffix = itemTypeFilter ? itemTypeFilter.replace(/\s+/g,'_') : "General";
    doc.save(`${sowReportNo || 'Report'}_Seabed_Survey_${fileSuffix}.pdf`);
};
