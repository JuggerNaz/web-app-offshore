import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/utils/supabase/client";
import { CompanySettings, ReportConfig } from "./defect-anomaly-report";
import { loadLogoWithTransparency, drawLogo } from "./shared-logo";

export const generateSeabedSurveyReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings,
    config: ReportConfig,
    itemTypeFilter: string
) => {
    const supabase = createClient();
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // ── Fetch Data ──────────────────────────────────────────────────────────
    let records: any[] = [];
    try {
        const { data, error } = await supabase.from('insp_records')
            .select(`
                insp_id, inspection_data, description, structure_components:component_id ( q_id )
            `)
            .eq('structure_id', Number(structure.id))
            .eq('inspection_type_code', 'RSEAB')
            .order('insp_id', { ascending: true });
            
        if (data) {
            // First map all records, then filter by type, then re-number sequentially
            const allMapped = data.map((r: any) => ({
                id: r.insp_id,
                x: parseFloat(r.inspection_data?.x || '0'),
                y: parseFloat(r.inspection_data?.y || '0'),
                label: '', // will be assigned after filtering
                qid: r.structure_components?.q_id || r.insp_id,
                face: r.inspection_data?.face || '',
                distance: parseFloat(r.inspection_data?.distance_from_leg) || 0,
                northing: r.inspection_data?.northing || '',
                easting: r.inspection_data?.easting || '',
                type: r.inspection_data?.category || r.inspection_data?.type || (r.description?.includes('Gas Seepage') ? 'Gas Seepage' : r.description?.includes('Crater') ? 'Crater' : 'Debris'),
                description: r.description?.replace(/^(Debris|Gas Seepage|Crater|Seabed Debris):\s*/, '') || '',
                size: r.inspection_data?.size_dimensions || r.inspection_data?.dimension_1 || '',
                material: r.inspection_data?.material || r.inspection_data?.debris_material || 'Unknown',
                isMetallic: (r.inspection_data?.material || r.inspection_data?.debris_material) === 'Metallic'
            })).filter(r => !isNaN(r.x) && !isNaN(r.y) && r.type.toLowerCase().includes(itemTypeFilter.toLowerCase()));

            // Re-number labels sequentially so map flags match table IDs
            records = allMapped.map((r, idx) => ({ ...r, label: (idx + 1).toString() }));
        }
    } catch (e) {
        console.error("Error fetching seabed data", e);
    }

    // ── Logos ────────────────────────────────────────────────────────────────
    let clientLogo: any = null;
    if (companySettings.logo_url) {
        clientLogo = await loadLogoWithTransparency(companySettings.logo_url);
    }

    let contractorLogo: any = null;
    let contractorName = "";
    if (config.showContractorLogo) {
        const contractorId = jobPack?.metadata?.contrac;
        if (contractorId) {
            try {
                const cid = String(contractorId);
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
                let q = supabase.from("u_lib_list").select("logo_url, lib_desc").eq("lib_code", "CONTR_NAM");
                q = isUUID ? q.or(`id.eq.${cid},lib_id.eq.${cid}`) : q.eq("lib_id", cid);
                const { data } = await q.maybeSingle();
                if (data?.logo_url) contractorLogo = await loadLogoWithTransparency(data.logo_url);
                if (data?.lib_desc) contractorName = data.lib_desc;
            } catch (e) {
                console.error("Error fetching contractor logo", e);
            }
        }
    }

    // ── Layout Constants ─────────────────────────────────────────────────────
    const headerH = 28;
    const logoSize = 18;
    const logoPadding = 4;
    const isPrintFriendly = config.printFriendly === true;
    const FOOTER_Y_OFFSET = 10; 

    // ── Draw Header ──────────────────────────────────────────────────────────
    const drawHeader = (d: jsPDF) => {
        const sx = margin, sy = margin;

        if (isPrintFriendly) {
            d.setDrawColor(180, 180, 180);
            d.setLineWidth(0.3);
            d.rect(sx, sy, contentWidth, headerH);
        } else {
            d.setFillColor(31, 55, 93);
            d.rect(sx, sy, contentWidth, headerH, "F");
        }

        // Contractor logo + name (left)
        if (contractorLogo) {
            drawLogo(d, contractorLogo, logoSize, logoSize, sx + logoPadding, sy + logoPadding, 'left', 'center');
        }

        // Client logo (right)
        if (clientLogo) {
            drawLogo(d, clientLogo, logoSize, logoSize, pageWidth - margin - logoSize - logoPadding, sy + logoPadding, 'right', 'center');
        }

        // Center text
        d.setTextColor(isPrintFriendly ? 31 : 255, isPrintFriendly ? 55 : 255, isPrintFriendly ? 93 : 255);
        d.setFont("helvetica", "bold");
        d.setFontSize(12);
        d.text((companySettings.company_name || "").toUpperCase(), pageWidth / 2, sy + 8, { align: "center" });

        d.setFont("helvetica", "normal");
        d.setFontSize(9);
        d.text(companySettings.departmentName || "Engineering Department", pageWidth / 2, sy + 12, { align: "center" });

        d.setFont("helvetica", "bold");
        d.setFontSize(13);
        d.text(`SEABED SURVEY - ${itemTypeFilter.toUpperCase()} REPORT`, pageWidth / 2, sy + 20, { align: "center" });

        d.setTextColor(0, 0, 0);
    };

    const drawSubHeader = (d: jsPDF) => {
        const field = structure?.field_name || structure?.str_name || "N/A";
        const installation = structure?.str_name || structure?.str_desc || "N/A";
        const reportNoDisplay = sowReportNo || jobPack?.metadata?.report_no || "N/A";

        const labelColWidth = 32;
        const valueColWidth = (contentWidth - labelColWidth * 2) / 2;

        const headStyle = isPrintFriendly
            ? { fillColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [0, 0, 0] as [number, number, number] }
            : { fillColor: [229, 231, 235] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [0, 0, 0] as [number, number, number] };

        autoTable(d, {
            startY: margin + headerH + 5,
            head: [],
            body: [
                [
                    { content: "Project Description:", styles: headStyle },
                    { content: jobPack?.name || "N/A" },
                    { content: "Report No.:", styles: headStyle },
                    { content: reportNoDisplay }
                ],
                [
                    { content: "Field:", styles: headStyle },
                    { content: field },
                    { content: "Installation:", styles: headStyle },
                    { content: installation }
                ]
            ] as any,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: labelColWidth },
                1: { cellWidth: valueColWidth },
                2: { cellWidth: labelColWidth },
                3: { cellWidth: valueColWidth }
            },
            margin: { left: margin, right: margin }
        });
    };

    if (records.length === 0) {
        drawHeader(doc);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`No ${itemTypeFilter} records found for this seabed survey.`, pageWidth / 2, 80, { align: "center" });
        if (config.returnBlob) return doc.output("blob");
        doc.save(`${config.reportNoPrefix}_Seabed_${itemTypeFilter.replace(/\s+/g,'_')}.pdf`);
        return;
    }

    // ── Pagination by Distance ───────────────────────────────────────────────
    // Group records into 21m chunks
    const maxDist = Math.max(...records.map(r => r.distance || 0));
    const totalRanges = Math.max(1, Math.ceil((maxDist + 1) / 21));

    let pageRanges: { pageIndex: number; items: any[]; minD: number; maxD: number }[] = [];
    for (let i = 0; i < totalRanges; i++) {
        const minDistance = i * 21;
        const maxDistance = (i + 1) * 21;
        const pageItems = records.filter(d => d.distance > minDistance && d.distance <= maxDistance);
        if (pageItems.length > 0) {
            // Re-number per page so flag labels on the map match table IDs below
            const numbered = pageItems.map((item, idx) => ({ ...item, label: (idx + 1).toString() }));
            pageRanges.push({ pageIndex: i, items: numbered, minD: minDistance, maxD: maxDistance });
        }
    }

    for (let r = 0; r < pageRanges.length; r++) {
        if (r > 0) doc.addPage();
        
        drawHeader(doc);
        drawSubHeader(doc);
        
        const currentY = (doc as any).lastAutoTable.finalY + 5;
        const { pageIndex, items, minD, maxD } = pageRanges[r];

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Graphical Map: Distance ${minD}m to ${maxD}m`, margin, currentY + 5);

        // ── Draw Map Plot ────────────────────────────────────────────────────
        const plotY = currentY + 10;
        const plotSize = 140; // 140x140 square map
        const plotCenterX = margin + (contentWidth / 2);
        const plotCenterY = plotY + (plotSize / 2);

        // ── Map Legend ───────────────────────────────────────────────────────
        // Only show relevant legends based on report type
        const showDebrisLeg = itemTypeFilter.toLowerCase().includes('debris') || itemTypeFilter === '';
        const showGasLeg = itemTypeFilter.toLowerCase().includes('gas') || itemTypeFilter === '';
        const showCraterLeg = itemTypeFilter.toLowerCase().includes('crater') || itemTypeFilter === '';

        const legY = plotY - 6; 
        // Move starting position to the right to avoid overlap with "Graphical Map..." title
        let currentLegX = plotCenterX; 
        
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);

        if (showDebrisLeg) {
            // Metallic (Blue)
            doc.setFillColor(29, 78, 216);
            doc.circle(currentLegX + 2, legY - 1, 1, "F");
            doc.text("METALLIC", currentLegX + 4.5, legY, { align: "left" });
            currentLegX += 18;

            // Non-Metallic (Orange)
            doc.setFillColor(234, 88, 12);
            doc.circle(currentLegX + 2, legY - 1, 1, "F");
            doc.text("NON-METALLIC", currentLegX + 4.5, legY, { align: "left" });
            currentLegX += 26;
        }

        if (showGasLeg) {
            // Seepage (Green)
            doc.setFillColor(34, 197, 94);
            doc.circle(currentLegX + 2, legY - 1, 1, "F");
            doc.text("SEEPAGE", currentLegX + 4.5, legY, { align: "left" });
            currentLegX += 18;
        }

        if (showCraterLeg) {
            // Crater (Purple)
            doc.setFillColor(147, 51, 234);
            doc.circle(currentLegX + 2, legY - 1, 1, "F");
            doc.text("CRATER", currentLegX + 4.5, legY, { align: "left" });
        }
        
        if (isPrintFriendly) {
            doc.setDrawColor(0, 0, 0);
            doc.rect(plotCenterX - plotSize/2, plotY, plotSize, plotSize);
        } else {
            doc.setFillColor(250, 252, 255); // very light blue
            doc.rect(plotCenterX - plotSize/2, plotY, plotSize, plotSize, "F");
            doc.setDrawColor(180, 180, 180); // Softer border
            doc.rect(plotCenterX - plotSize/2, plotY, plotSize, plotSize, "S");
        }

        // Draw compass labels
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("NORTH", plotCenterX, plotY + 4.5, { align: "center" });
        doc.text("SOUTH", plotCenterX, plotY + plotSize - 2, { align: "center" });
        doc.text("WEST", plotCenterX - plotSize/2 + 2, plotCenterY, { align: "left" });
        doc.text("EAST", plotCenterX + plotSize/2 - 2, plotCenterY, { align: "right" });

        // Platform Legs (Assume 4 legs) - RATIO UPDATED TO MATCH GUI (88/600 = 0.14666 from center)
        const innerRatio = 0.14666; 
        const dx = (plotSize * innerRatio);
        const dy = (plotSize * innerRatio);
        const legOffsets = [
            { x: -dx, y: -dy, n: "A1" },
            { x: dx,  y: -dy, n: "A2" },
            { x: -dx, y: dy,  n: "B1" },
            { x: dx,  y: dy,  n: "B2" },
        ];

        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.3);
        doc.line(plotCenterX - dx, plotCenterY - dy, plotCenterX + dx, plotCenterY - dy);
        doc.line(plotCenterX - dx, plotCenterY + dy, plotCenterX + dx, plotCenterY + dy);
        doc.line(plotCenterX - dx, plotCenterY - dy, plotCenterX - dx, plotCenterY + dy);
        doc.line(plotCenterX + dx, plotCenterY - dy, plotCenterX + dx, plotCenterY + dy);

        legOffsets.forEach(leg => {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(100, 100, 100);
            doc.circle(plotCenterX + leg.x, plotCenterY + leg.y, 2.5, "DF");
            doc.setFontSize(5);
            doc.setTextColor(0, 0, 0);
            doc.text(leg.n, plotCenterX + leg.x, plotCenterY + leg.y + 0.8, { align: "center" });
        });

        // Calculate Pixel Per Meter scale based on max range (21m)
        // Matching GUI logic: padding margin are subtracted from available radius
        const marginPaddingRatio = 20 / 300; // GUI uses 20px padding on 300px radius
        const safetyMargin = (plotSize / 2) * marginPaddingRatio;
        const maxRangeOnPage = 21; 
        const scale = ((plotSize / 2) - dx - safetyMargin) / maxRangeOnPage;

        // Draw distance grids (every 3m)
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.1);
        for (let d = 3; d <= maxRangeOnPage; d += 3) {
            const rx = dx + (d * scale);
            const ry = dy + (d * scale);
            doc.rect(plotCenterX - rx, plotCenterY - ry, 2 * rx, 2 * ry, "S");
            
            // Draw text corner labels
            doc.setFontSize(5);
            doc.setTextColor(180, 180, 180);
            doc.text(`${d}m`, plotCenterX - rx + 0.5, plotCenterY - ry + 3);
            doc.text(`${d}m`, plotCenterX + rx - 5.5, plotCenterY - ry + 3);
            doc.text(`${d}m`, plotCenterX + rx - 5.5, plotCenterY + ry - 1);
            doc.text(`${d}m`, plotCenterX - rx + 0.5, plotCenterY + ry - 1);
        }

        // Draw Markers
        items.forEach(item => {
            // Coordinate mapping: (x-50)/100 * plotSize centers it and scales to full bounds
            const screenX = plotCenterX + ((item.x - 50) / 100) * plotSize;
            const screenY = plotCenterY + ((item.y - 50) / 100) * plotSize;

            if (item.type.includes('Gas Seepage')) {
                doc.setFillColor(34, 197, 94); // Green
            } else if (item.type.includes('Crater')) {
                doc.setFillColor(147, 51, 234); // Purple
            } else if (item.isMetallic) {
                doc.setFillColor(29, 78, 216); // Blue
            } else {
                doc.setFillColor(234, 88, 12); // Orange
            }

            doc.setDrawColor(255, 255, 255);
            doc.setLineWidth(0.2);
            doc.circle(screenX, screenY, 3, "DF");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6);
            doc.setFont("helvetica", "bold");
            doc.text(item.label, screenX, screenY + 1, { align: "center" });
        });

        // ── Details Table ────────────────────────────────────────────────────
        const tableY = plotY + plotSize + 5;
        const tableBody = items.map(item => [
            String(item.label),
            item.qid,
            item.face,
            `${item.distance}m`,
            String(item.northing),
            String(item.easting),
            item.description || '-',
            item.material,
            item.size || '-'
        ]);

        autoTable(doc, {
            startY: tableY,
            head: [["ID", "QID", "Face", "Dist.", "Northing", "Easting", "Description", "Material", "Dims"]],
            body: tableBody,
            theme: "grid",
            headStyles: {
                fillColor: isPrintFriendly ? [229, 231, 235] : [31, 55, 93],
                textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
                fontStyle: "bold",
                fontSize: 8,
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
            margin: { left: margin, right: margin }
        });
    }

    // ── Footer ─────────────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    const printedDateStr = `Printed: ${new Date().toLocaleDateString("en-GB")}`;

    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        const footerLineY = pageHeight - FOOTER_Y_OFFSET;
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(margin, footerLineY, pageWidth - margin, footerLineY);

        if (config.showPageNumbers) {
            doc.setTextColor(100, 100, 100);
            doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, footerLineY + 4, { align: "center" });
        }
        doc.setTextColor(100, 100, 100);
        doc.text(printedDateStr, pageWidth - margin, footerLineY + 4, { align: "right" });
    }

    if (config.returnBlob) return doc.output("blob");
    doc.save(`${config.reportNoPrefix}_Seabed_${itemTypeFilter.replace(/\s+/g,'_')}.pdf`);
};
