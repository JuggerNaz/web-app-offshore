import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal , formatPdfDate } from "./shared-logo";
import { createClient } from "@/utils/supabase/client";

export interface CompanySettings {
    company_name?: string;
    department_name?: string;
    departmentName?: string;
    logo_url?: string;
}

export interface PipelineEventSketchReportOptions {
    reportNoPrefix?: string;
    printFriendly?: boolean;
    jobPackId?: number;
    structureId?: number;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    returnBlob?: boolean;
    showSignatures?: boolean;
    showContractorLogo?: boolean;
    headerData?: any;
    printBlankReport?: boolean;
    isBlankReport?: boolean;
}

export interface PipelineEventItem {
    id: any;
    kp: number;
    kpDisplay: string;
    eventName: string;
    eventType: string;
    position: string;
    description: string;
    spanLength?: number;
    spanHeight?: number;
    burialDepth?: number;
    northing?: string;
    easting?: string;
    cpReading?: string;
    category: "SPAN" | "BURIAL" | "STABILIZER" | "CROSSING" | "CP" | "ANODE" | "DEBRIS" | "FITTING" | "DEFECT" | "GENERAL";
}

/**
 * Landscape Pipeline Event List Sketch Report Generator
 * Renders pipeline graphics with KP axis, span/burial profiles, stabilizer/crossing graphics,
 * non-overlapping event flag markers, geodetic parameters header, and matching event list tables per page.
 */
export const generatePipelineEventSketchReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings = {},
    config: PipelineEventSketchReportOptions = {},
    recordsOverride?: any[]
) => {
    const supabase = createClient();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 10;
    const contentWidth = pageWidth - margin * 2; // 277mm
    const isPrintFriendly = config.printFriendly === true;

    const colors = {
        navy: [31, 55, 93] as [number, number, number],
        teal: [20, 184, 166] as [number, number, number],
        lightGray: [248, 250, 252] as [number, number, number],
        border: [203, 213, 225] as [number, number, number],
        darkBorder: [100, 116, 139] as [number, number, number],
        text: [30, 41, 59] as [number, number, number],
        muted: [100, 116, 139] as [number, number, number],

        // Event Categories Colors
        span: [239, 68, 68] as [number, number, number],         // Red
        burial: [145, 123, 76] as [number, number, number],      // Olive / Brown
        stabilizer: [107, 114, 128] as [number, number, number], // Gray Slate
        crossing: [168, 85, 247] as [number, number, number],    // Purple
        cp: [14, 165, 233] as [number, number, number],          // Cyan / Sky Blue
        anode: [34, 197, 94] as [number, number, number],        // Green
        debris: [245, 158, 11] as [number, number, number],      // Amber / Orange
        fitting: [99, 102, 241] as [number, number, number],     // Indigo
        defect: [225, 29, 72] as [number, number, number],       // Rose Red
        general: [71, 85, 105] as [number, number, number],      // Slate
    };

    // ── 1. Fetch & Normalize Records ─────────────────────────────────────────
    let rawRecords: any[] = [];
    if (recordsOverride && recordsOverride.length > 0) {
        rawRecords = recordsOverride;
    } else {
        try {
            const sId = Number(structure?.str_id || structure?.id || structure?.structure_id || config.structureId || 0);
            const jpId = Number(jobPack?.id || jobPack?.jobpack_id || config.jobPackId || 0);
            let q = supabase
                .from("insp_records")
                .select("*, structure_components:component_id(q_id, name, code)")
                .order("insp_id", { ascending: true });

            if (sId > 0) {
                q = q.eq("structure_id", sId);
            }
            if (jpId > 0) {
                q = q.eq("jobpack_id", jpId);
            }

            const { data, error } = await q;
            if (data && data.length > 0) {
                rawRecords = data;
            } else if (sId > 0) {
                // Fallback query by structure_id alone if jobpack_id filter yielded no records
                const { data: fallbackData } = await supabase
                    .from("insp_records")
                    .select("*, structure_components:component_id(q_id, name, code)")
                    .eq("structure_id", sId)
                    .order("insp_id", { ascending: true });
                if (fallbackData) rawRecords = fallbackData;
            }
        } catch (err) {
            console.error("Error fetching pipeline records for sketch report", err);
        }
    }

    // Process & Classify Events
    const events: PipelineEventItem[] = rawRecords
        .map((r: any) => {
            let idraw = r.inspection_data || r.inspection_dat || {};
            if (typeof idraw === "string") {
                try { idraw = JSON.parse(idraw); } catch (e) { idraw = {}; }
            }
            const rawKp = r.fp_kp ?? idraw.kp ?? idraw.fp_kp ?? idraw.location ?? idraw.kp_start ?? r.elevation ?? "0";
            const kpNum = parseFloat(String(rawKp).replace(/[^\d.-]/g, "")) || 0;

            const compCode = String(r.structure_components?.code || r.structure_components?.q_id || "").toUpperCase();
            const nameUpper = String(idraw.eventName || idraw.event_name || idraw.event_id || idraw.name || r.inspection_type_name || r.inspection_type_code || compCode || r.description || "").toUpperCase();
            const typeUpper = String(idraw.eventType || idraw.event_type || idraw.category || idraw.type || r.inspection_type_code || "").toUpperCase();
            const descRaw = idraw.eventDescription || idraw.event_description || idraw.findings || idraw.observations || r.description || r.remarks || "";

            let category: PipelineEventItem["category"] = "GENERAL";
            if (typeUpper.includes("SPAN") || nameUpper.includes("SPAN") || descRaw.toUpperCase().includes("SPAN")) {
                category = "SPAN";
            } else if (typeUpper.includes("BURIAL") || typeUpper.includes("BURIED") || nameUpper.includes("BURIAL") || descRaw.toUpperCase().includes("BURIAL")) {
                category = "BURIAL";
            } else if (typeUpper.includes("STABILIZER") || typeUpper.includes("MATTRESS") || nameUpper.includes("STABILIZER") || descRaw.toUpperCase().includes("MATTRESS") || nameUpper.includes("BLOCK")) {
                category = "STABILIZER";
            } else if (typeUpper.includes("CROSSING") || nameUpper.includes("CROSSING") || descRaw.toUpperCase().includes("CROSSING")) {
                category = "CROSSING";
            } else if (typeUpper.includes("CP") || nameUpper.includes("CP") || idraw.cp_reading || idraw.cp_rdg || idraw.cp_reading_mv) {
                category = "CP";
            } else if (typeUpper.includes("ANODE") || nameUpper.includes("ANODE")) {
                category = "ANODE";
            } else if (typeUpper.includes("DEBRIS") || nameUpper.includes("DEBRIS")) {
                category = "DEBRIS";
            } else if (typeUpper.includes("FLANGE") || typeUpper.includes("VALVE") || typeUpper.includes("FITTING") || nameUpper.includes("VALVE") || nameUpper.includes("TEE")) {
                category = "FITTING";
            } else if (typeUpper.includes("DEFECT") || typeUpper.includes("DAMAGE") || typeUpper.includes("ANOMALY") || r.has_anomaly) {
                category = "DEFECT";
            }

            const kpLabel = isNaN(kpNum) ? String(rawKp) : `KP ${kpNum.toFixed(3)}`;
            const displayEvtName = idraw.eventName || idraw.event_name || (nameUpper.length > 0 && nameUpper.length < 35 ? nameUpper : `EVENT ${r.insp_id || ''}`);

            return {
                id: r.insp_id || Math.random(),
                kp: isNaN(kpNum) ? 0 : kpNum,
                kpDisplay: kpLabel,
                eventName: displayEvtName,
                eventType: idraw.eventType || idraw.event_type || category,
                position: idraw.eventPosition || idraw.event_position || idraw.position || r.structure_components?.q_id || "-",
                description: descRaw || "-",
                spanLength: parseFloat(idraw.span_length || idraw.spanLength || idraw.length || "0"),
                spanHeight: parseFloat(idraw.span_height || idraw.spanHeight || idraw.gap_height || "0"),
                burialDepth: parseFloat(idraw.burial_depth || idraw.burialDepth || idraw.depth_of_burial || "0"),
                northing: idraw.northing || idraw.n_coord || "-",
                easting: idraw.easting || idraw.e_coord || "-",
                cpReading: idraw.cp_reading || idraw.cp_rdg || idraw.cp || "",
                category
            };
        })
        .sort((a, b) => a.kp - b.kp);

    // Fallback: If no inspection records are logged yet for this pipeline structure, fetch components or construct demo events
    if (events.length === 0 && !config.printBlankReport) {
        let componentEvents: PipelineEventItem[] = [];
        try {
            const sId = Number(structure?.str_id || structure?.id || structure?.structure_id || config.structureId || 0);
            if (sId > 0) {
                const { data: comps } = await supabase
                    .from("structure_components")
                    .select("*")
                    .eq("structure_id", sId)
                    .order("id", { ascending: true });

                if (comps && comps.length > 0) {
                    componentEvents = comps.map((c: any, idx: number) => {
                        const compCode = String(c.code || c.q_id || "").toUpperCase();
                        const compName = c.name || c.q_id || `COMPONENT #${c.id}`;
                        const kpVal = parseFloat(c.metadata?.kp || c.kp || String(idx * 0.2)) || (idx * 0.2);
                        
                        let category: PipelineEventItem["category"] = "GENERAL";
                        if (compCode.includes("SPAN")) category = "SPAN";
                        else if (compCode.includes("BURIAL") || compCode.includes("BUR")) category = "BURIAL";
                        else if (compCode.includes("MAT") || compCode.includes("STAB")) category = "STABILIZER";
                        else if (compCode.includes("CROSS")) category = "CROSSING";
                        else if (compCode.includes("AN")) category = "ANODE";
                        else if (compCode.includes("CP")) category = "CP";
                        else if (compCode.includes("VALVE") || compCode.includes("TEE") || compCode.includes("FLG")) category = "FITTING";

                        return {
                            id: c.id,
                            kp: kpVal,
                            kpDisplay: `KP ${kpVal.toFixed(3)}`,
                            eventName: compName,
                            eventType: c.code || category,
                            position: c.q_id || `POS ${idx + 1}`,
                            description: c.metadata?.description || c.description || `Pipeline component ${compName}`,
                            spanLength: category === "SPAN" ? 15 : 0,
                            spanHeight: category === "SPAN" ? 0.5 : 0,
                            burialDepth: category === "BURIAL" ? 1.2 : 0,
                            northing: c.metadata?.northing || "-",
                            easting: c.metadata?.easting || "-",
                            cpReading: "",
                            category
                        };
                    });
                }
            }
        } catch (e) {}

        if (componentEvents.length > 0) {
            events.push(...componentEvents);
        } else {
            const demoEvents: PipelineEventItem[] = [
                {
                    id: 101,
                    kp: 0.000,
                    kpDisplay: "KP 0.000",
                    eventName: "Riser Connection / KP Start",
                    eventType: "Riser / Flange",
                    position: "Pipeline Start",
                    description: "Riser spool flange connection at platform base.",
                    spanLength: 0,
                    spanHeight: 0,
                    burialDepth: 0,
                    northing: "450123.50",
                    easting: "112450.20",
                    cpReading: "-1020 mV",
                    category: "FITTING"
                },
                {
                    id: 102,
                    kp: 0.180,
                    kpDisplay: "KP 0.180",
                    eventName: "Pipeline Free Span #01",
                    eventType: "Free Span",
                    position: "Under Pipe",
                    description: "Unsupported pipeline span over seabed depression. Length: 12.5m, Max Gap: 0.45m.",
                    spanLength: 12.5,
                    spanHeight: 0.45,
                    burialDepth: 0,
                    northing: "450280.10",
                    easting: "112590.80",
                    cpReading: "",
                    category: "SPAN"
                },
                {
                    id: 103,
                    kp: 0.420,
                    kpDisplay: "KP 0.420",
                    eventName: "Concrete Mattress Stabilizer",
                    eventType: "Stabilizer",
                    position: "Over Pipe",
                    description: "Concrete mattress installed over pipeline for stabilization.",
                    spanLength: 0,
                    spanHeight: 0,
                    burialDepth: 0,
                    northing: "450490.30",
                    easting: "112810.40",
                    cpReading: "",
                    category: "STABILIZER"
                },
                {
                    id: 104,
                    kp: 0.650,
                    kpDisplay: "KP 0.650",
                    eventName: "Buried Section #01",
                    eventType: "Burial",
                    position: "In Seabed",
                    description: "Pipeline covered under natural seabed sediment. Depth of burial: 1.15m.",
                    spanLength: 0,
                    spanHeight: 0,
                    burialDepth: 1.15,
                    northing: "450710.60",
                    easting: "113020.90",
                    cpReading: "",
                    category: "BURIAL"
                },
                {
                    id: 105,
                    kp: 0.890,
                    kpDisplay: "KP 0.890",
                    eventName: "Bracelet Anode AN-04",
                    eventType: "Anode",
                    position: "Pipeline Body",
                    description: "Half-shell bracelet zinc anode attached. 15% estimated depletion.",
                    spanLength: 0,
                    spanHeight: 0,
                    burialDepth: 0,
                    northing: "450940.20",
                    easting: "113240.10",
                    cpReading: "-1045 mV",
                    category: "ANODE"
                }
            ];
            events.push(...demoEvents);
        }
    }

    // Extract continuous Span and Burial intervals across all events
    const spanIntervals = extractFeatureIntervals(events, "SPAN");
    const burialIntervals = extractFeatureIntervals(events, "BURIAL");

    // ── 2. Geodetic Parameters Data ──────────────────────────────────────────
    let geodeticData: any = jobPack?.metadata?.geodetic_parameters || null;
    if (!geodeticData && (structure?.id || config.structureId)) {
        try {
            const sId = Number(structure?.id || config.structureId || 0);
            if (sId > 0) {
                const { data: pipeGeo } = await supabase
                    .from("u_pipegeo")
                    .select("*")
                    .eq("str_id", sId)
                    .maybeSingle();
                if (pipeGeo) {
                    geodeticData = {
                        geo_proj_nam: pipeGeo.geo_proj_nam,
                        geo_units: pipeGeo.geo_units,
                        geo_datum: pipeGeo.geo_datum,
                        geo_elli_sph: pipeGeo.geo_elli_sph,
                        geo_dir: pipeGeo.geo_dir,
                        geo_dx: pipeGeo.geo_dx,
                        geo_dy: pipeGeo.geo_dy,
                        geo_dz: pipeGeo.geo_dz,
                    };
                }
            }
        } catch (e) {
            console.error("Error fetching geodetic data for pipeline report", e);
        }
    }

    // ── 3. Logos Preloading ──────────────────────────────────────────────────
    let clientLogo: any = null;
    if (companySettings?.logo_url) {
        try { clientLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
    }

    let contractorLogo: any = null;
    const logoUrl = config.headerData?.contractorLogoUrl;
    if (logoUrl) {
        try { contractorLogo = await loadLogoWithTransparency(logoUrl); } catch (_) {}
    }

    // ── 4. Drawing Components ────────────────────────────────────────────────
    const drawHeader = (d: jsPDF) => {
        const headerH = 20;
        if (isPrintFriendly) {
            d.setDrawColor(...colors.navy); d.setLineWidth(0.3); d.rect(margin, margin, contentWidth, headerH, "S");
            d.setTextColor(...colors.navy);
        } else {
            d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, headerH, "F");
            d.setTextColor(255, 255, 255);
        }

        if (clientLogo) drawLogo(d, clientLogo, 16, 15, pageWidth - margin - 18, margin + 2.5, "right", "center");
        if (contractorLogo) drawLogo(d, contractorLogo, 16, 15, margin + 2, margin + 2.5, "left", "center");

        d.setFontSize(11); d.setFont("helvetica", "bold");
        d.text((companySettings.company_name || "OFFSHORE INSPECTION DIVISION").toUpperCase(), margin + (contentWidth / 2), margin + 5, { align: "center" });
        d.setFontSize(8); d.setFont("helvetica", "normal");
        d.text(companySettings.department_name || companySettings.departmentName || "Engineering & Technical Division", margin + (contentWidth / 2), margin + 10, { align: "center" });

        d.setFontSize(12); d.setFont("helvetica", "bold");
        d.text("PIPELINE NAVIGATION EVENT SKETCH REPORT", margin + (contentWidth / 2), margin + 16, { align: "center" });
    };

    const drawSubHeader = (d: jsPDF, startY: number): number => {
        const rowH = 5.5;
        const hData = config.headerData || {};

        const structName = structure?.str_name || structure?.name || hData.platformName || "N/A";
        const jobPackName = jobPack?.name || hData.jobpackName || "N/A";
        const vessel = hData.vessel || "N/A";
        const reportNo = sowReportNo || hData.sowReportNo || "N/A";
        const inspDate = hData.date || format(new Date(), "dd/MM/yyyy");

        const minKpVal = events.length > 0 ? Math.min(...events.map(e => e.kp)).toFixed(3) : "0.000";
        const maxKpVal = events.length > 0 ? Math.max(...events.map(e => e.kp)).toFixed(3) : "0.000";
        const kpRangeStr = `KP ${minKpVal} - KP ${maxKpVal}`;

        const fieldsRow1 = [
            { label: "PIPELINE / STRUCTURE:", value: structName },
            { label: "JOBPACK:", value: jobPackName },
            { label: "SOW REPORT NO:", value: reportNo }
        ];

        const fieldsRow2 = [
            { label: "VESSEL / SPREAD:", value: vessel },
            { label: "INSPECTION DATE:", value: inspDate },
            { label: "TOTAL EVENTS / KP:", value: `${events.length} Events (${kpRangeStr})` }
        ];

        const colW = contentWidth / 3;

        // Row 1
        fieldsRow1.forEach((f, idx) => {
            const x = margin + idx * colW;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            if (!isPrintFriendly) d.setFillColor(...colors.lightGray);
            d.rect(x, startY, colW, rowH, isPrintFriendly ? "S" : "FD");
            d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold");
            d.text(f.label, x + 2, startY + 3.8);
            d.setFont("helvetica", "normal");
            d.text(String(f.value), x + 38, startY + 3.8);
        });

        // Row 2
        fieldsRow2.forEach((f, idx) => {
            const x = margin + idx * colW;
            const y = startY + rowH;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            if (!isPrintFriendly) d.setFillColor(...colors.lightGray);
            d.rect(x, y, colW, rowH, isPrintFriendly ? "S" : "FD");
            d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold");
            d.text(f.label, x + 2, y + 3.8);
            d.setFont("helvetica", "normal");
            d.text(String(f.value), x + 38, y + 3.8);
        });

        return startY + rowH * 2 + 1.5;
    };

    const drawGeodeticBlock = (d: jsPDF, startY: number): number => {
        if (!geodeticData) return startY;

        const projName = geodeticData.geo_proj_nam || "UTM Zone 48N";
        const datum = geodeticData.geo_datum || "WGS 84";
        const ellipsoid = geodeticData.geo_elli_sph || "WGS 84";
        const units = geodeticData.geo_units || "Meters";
        const datumShift = geodeticData.geo_dir || "DX, DY, DZ Shift";
        const dx = geodeticData.geo_dx ?? "0.000";
        const dy = geodeticData.geo_dy ?? "0.000";
        const dz = geodeticData.geo_dz ?? "0.000";

        const headStyle = isPrintFriendly
            ? { fillColor: [245, 245, 245] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [200, 200, 200] as [number, number, number] }
            : { fillColor: [224, 231, 255] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [200, 200, 200] as [number, number, number] };

        autoTable(d, {
            startY: startY,
            margin: { left: margin, right: margin },
            head: [
                [
                    { content: "GEODETIC PARAMETERS & NAVIGATION REFERENCE", colSpan: 6, styles: { fillColor: isPrintFriendly ? [230, 230, 230] : [31, 55, 93], textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7.5 } }
                ]
            ],
            body: [
                [
                    { content: "Projection:", styles: headStyle }, { content: String(projName) },
                    { content: "Datum:", styles: headStyle }, { content: String(datum) },
                    { content: "Dx (m):", styles: headStyle }, { content: String(dx) }
                ],
                [
                    { content: "Units:", styles: headStyle }, { content: String(units) },
                    { content: "Ellipsoid:", styles: headStyle }, { content: String(ellipsoid) },
                    { content: "Dy (m):", styles: headStyle }, { content: String(dy) }
                ],
                [
                    { content: "Datum Shift:", styles: headStyle }, { content: String(datumShift) },
                    { content: "", styles: headStyle }, { content: "" },
                    { content: "Dz (m):", styles: headStyle }, { content: String(dz) }
                ]
            ] as any,
            theme: "grid",
            styles: { fontSize: 7, cellPadding: 1.2, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [30, 41, 59] }
        });

        return (d as any).lastAutoTable.finalY + 1.5;
    };

    const drawLegendBlock = (d: jsPDF, startY: number): number => {
        const legendH = 8.5;
        d.setDrawColor(...colors.border); d.setLineWidth(0.1);
        d.setFillColor(255, 255, 255);
        d.rect(margin, startY, contentWidth, legendH, "FD");

        d.setFontSize(7.5); d.setFont("helvetica", "bold"); d.setTextColor(...colors.navy);
        d.text("EVENT LEGENDS:", margin + 3, startY + 5.5);

        const legends = [
            { label: "Span (Under)", color: colors.span, sym: "🚩" },
            { label: "Burial (Over)", color: colors.burial, sym: "⛰️" },
            { label: "Stabilizer", color: colors.stabilizer, sym: "🧱" },
            { label: "Crossing", color: colors.crossing, sym: "🔀" },
            { label: "CP Reading", color: colors.cp, sym: "🔵" },
            { label: "Anode", color: colors.anode, sym: "🟩" },
            { label: "Debris", color: colors.debris, sym: "🟧" },
            { label: "Fitting/Valve", color: colors.fitting, sym: "🟣" },
            { label: "Anomaly/Defect", color: colors.defect, sym: "🔺" },
        ];

        let curX = margin + 32;
        legends.forEach(item => {
            d.setFillColor(...item.color);
            d.rect(curX, startY + 2.5, 3.5, 3.5, "F");
            d.setDrawColor(0, 0, 0); d.setLineWidth(0.1);
            d.rect(curX, startY + 2.5, 3.5, 3.5, "S");

            d.setFontSize(6.8); d.setFont("helvetica", "normal"); d.setTextColor(...colors.text);
            d.text(item.label, curX + 4.5, startY + 5.2);
            curX += 26.5;
        });

        return startY + legendH + 2;
    };

    // ── 5. Multi-Track Serpentine Ribbon Page Generation Loop ────────────────
    const eventsPerTrack = 8;
    const tracksPerPage = 3;
    const eventsPerPage = tracksPerPage * eventsPerTrack; // 24 events per page
    const totalPages = Math.max(1, Math.ceil(events.length / eventsPerPage));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (pageIdx > 0) doc.addPage("a4", "l");

        drawHeader(doc);
        let currentY = margin + 21.5;
        currentY = drawSubHeader(doc, currentY);
        if (pageIdx === 0 && geodeticData) {
            currentY = drawGeodeticBlock(doc, currentY);
        }
        currentY = drawLegendBlock(doc, currentY);

        const pageChunk = events.slice(pageIdx * eventsPerPage, (pageIdx + 1) * eventsPerPage);
        const numTracksOnPage = Math.max(1, Math.ceil(pageChunk.length / eventsPerTrack));

        for (let trackIdx = 0; trackIdx < numTracksOnPage; trackIdx++) {
            const trackEvents = pageChunk.slice(trackIdx * eventsPerTrack, (trackIdx + 1) * eventsPerTrack);
            if (trackEvents.length === 0) continue;

            const trackGlobalNum = pageIdx * tracksPerPage + trackIdx + 1;
            const startGlobalIdx = pageIdx * eventsPerPage + trackIdx * eventsPerTrack + 1;

            const trackMinKp = Math.min(...trackEvents.map(e => e.kp));
            const trackMaxKp = Math.max(...trackEvents.map(e => e.kp));
            const kpSpan = Math.max(0.02, trackMaxKp - trackMinKp);

            // Track Container Y Setup
            const trackStartY = currentY;

            // ── Track Header Banner ─────────────────────────────────────────
            const bannerH = 4.2;
            if (isPrintFriendly) {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.2);
                doc.rect(margin, trackStartY, contentWidth, bannerH, "S");
                doc.setTextColor(...colors.navy);
            } else {
                doc.setFillColor(...colors.navy);
                doc.rect(margin, trackStartY, contentWidth, bannerH, "F");
                doc.setTextColor(255, 255, 255);
            }
            doc.setFontSize(7); doc.setFont("helvetica", "bold");
            doc.text(`TRACK #${trackGlobalNum} — PIPELINE PROFILE & EVENTS (KP ${trackMinKp.toFixed(3)} TO KP ${trackMaxKp.toFixed(3)})`, margin + 3, trackStartY + 3);
            doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
            doc.text(`${trackEvents.length} Events in Segment`, margin + contentWidth - 3, trackStartY + 3, { align: "right" });

            // ── Track Pipe Canvas Graphic Section ────────────────────────────
            const canvasY = trackStartY + bannerH;
            const canvasH = 17;

            doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
            doc.setFillColor(252, 253, 255);
            doc.rect(margin, canvasY, contentWidth, canvasH, "FD");

            // Pipe Line Axis Y (Centered inside canvas)
            const pipeY = canvasY + 9;
            const graphMarginX = 18;
            const graphXStart = margin + graphMarginX;
            const graphXEnd = margin + contentWidth - graphMarginX;
            const graphW = graphXEnd - graphXStart;

            // Draw Slate Metallic Pipe Body
            doc.setFillColor(148, 163, 184);
            doc.rect(graphXStart, pipeY - 1.5, graphW, 3, "F");
            doc.setDrawColor(51, 65, 85); doc.setLineWidth(0.25);
            doc.line(graphXStart, pipeY - 1.5, graphXEnd, pipeY - 1.5);
            doc.line(graphXStart, pipeY + 1.5, graphXEnd, pipeY + 1.5);

            // KP Scale Line & Major Ticks
            doc.setDrawColor(...colors.muted); doc.setLineWidth(0.15);
            doc.line(graphXStart, pipeY + 4.5, graphXEnd, pipeY + 4.5);
            dText(doc, `KP ${trackMinKp.toFixed(3)}`, graphXStart, pipeY + 7.5, "center");
            dText(doc, `KP ${((trackMinKp + trackMaxKp) / 2).toFixed(3)}`, graphXStart + graphW / 2, pipeY + 7.5, "center");
            dText(doc, `KP ${trackMaxKp.toFixed(3)}`, graphXEnd, pipeY + 7.5, "center");

            [0, 0.25, 0.5, 0.75, 1].forEach(pct => {
                const tx = graphXStart + pct * graphW;
                doc.line(tx, pipeY + 3.8, tx, pipeY + 5.2);
            });

            // ── Render Continuous Span Intervals on Track ─────────────────
            spanIntervals.forEach(spanInt => {
                if (spanInt.startKp <= trackMaxKp && spanInt.endKp >= trackMinKp) {
                    const effStartKp = Math.max(spanInt.startKp, trackMinKp);
                    const effEndKp = Math.min(spanInt.endKp, trackMaxKp);

                    const pctStart = kpSpan === 0 ? 0 : Math.min(1, Math.max(0, (effStartKp - trackMinKp) / kpSpan));
                    const pctEnd = kpSpan === 0 ? 1 : Math.min(1, Math.max(0, (effEndKp - trackMinKp) / kpSpan));

                    const sx1 = graphXStart + pctStart * graphW;
                    const sx2 = graphXStart + pctEnd * graphW;
                    const dropY = pipeY + 3.8;

                    doc.setDrawColor(colors.span[0], colors.span[1], colors.span[2]);
                    doc.setLineWidth(0.5);
                    doc.line(sx1, dropY, sx2, dropY);

                    // Left vertical cap (only if span actually starts in this track)
                    const isStartInTrack = spanInt.startKp >= trackMinKp;
                    if (isStartInTrack) {
                        doc.line(sx1, pipeY + 1.5, sx1, dropY);
                    } else {
                        doc.setFontSize(4.8); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.span);
                        doc.text("« CONT.", Math.max(margin + 2, sx1 - 10), dropY + 1);
                    }

                    // Right vertical cap (only if span actually ends in this track)
                    const isEndInTrack = spanInt.endKp <= trackMaxKp;
                    if (isEndInTrack) {
                        doc.line(sx2, dropY, sx2, pipeY + 1.5);
                    } else {
                        doc.setFontSize(4.8); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.span);
                        doc.text("CONT. »", Math.min(margin + contentWidth - 2, sx2 + 1), dropY + 1);
                    }

                    if (sx2 - sx1 > 10) {
                        doc.setFontSize(4.8); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.span);
                        doc.text(`SPAN (${spanInt.lengthM.toFixed(1)}m)`, (sx1 + sx2) / 2, dropY + 2.5, { align: "center" });
                    }
                }
            });

            // ── Render Continuous Burial Cover Intervals on Track ──────────
            burialIntervals.forEach(burialInt => {
                if (burialInt.startKp <= trackMaxKp && burialInt.endKp >= trackMinKp) {
                    const effStartKp = Math.max(burialInt.startKp, trackMinKp);
                    const effEndKp = Math.min(burialInt.endKp, trackMaxKp);

                    const pctStart = kpSpan === 0 ? 0 : Math.min(1, Math.max(0, (effStartKp - trackMinKp) / kpSpan));
                    const pctEnd = kpSpan === 0 ? 1 : Math.min(1, Math.max(0, (effEndKp - trackMinKp) / kpSpan));

                    const bx1 = graphXStart + pctStart * graphW;
                    const bx2 = graphXStart + pctEnd * graphW;
                    const coverY = pipeY - 3.8;

                    doc.setDrawColor(colors.burial[0], colors.burial[1], colors.burial[2]);
                    doc.setLineWidth(0.5);
                    doc.line(bx1, coverY, bx2, coverY);

                    // Left vertical cap (only if burial starts in this track)
                    const isStartInTrack = burialInt.startKp >= trackMinKp;
                    if (isStartInTrack) {
                        doc.line(bx1, pipeY - 1.5, bx1, coverY);
                    } else {
                        doc.setFontSize(4.8); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.burial);
                        doc.text("« CONT.", Math.max(margin + 2, bx1 - 10), coverY - 0.5);
                    }

                    // Right vertical cap (only if burial ends in this track)
                    const isEndInTrack = burialInt.endKp <= trackMaxKp;
                    if (isEndInTrack) {
                        doc.line(bx2, coverY, bx2, pipeY - 1.5);
                    } else {
                        doc.setFontSize(4.8); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.burial);
                        doc.text("CONT. »", Math.min(margin + contentWidth - 2, bx2 + 1), coverY - 0.5);
                    }

                    if (bx2 - bx1 > 10) {
                        doc.setFontSize(4.8); doc.setFont("helvetica", "bold"); doc.setTextColor(...colors.burial);
                        doc.text(`BURIAL (${burialInt.lengthM.toFixed(1)}m)`, (bx1 + bx2) / 2, coverY - 1.2, { align: "center" });
                    }
                }
            });

            // Track placed flag badge X coordinates to prevent overlaps
            const placedFlags: { x: number; level: number }[] = [];

            // Render Events on Track Graphic
            trackEvents.forEach((evt, idx) => {
                const globalMarkerIdx = startGlobalIdx + idx;
                const pct = kpSpan === 0 ? (idx + 0.5) / trackEvents.length : Math.min(1, Math.max(0, (evt.kp - trackMinKp) / kpSpan));
                const evtX = graphXStart + pct * graphW;

                const categoryKey = (evt.category.toLowerCase() as keyof typeof colors);
                const categoryColor: [number, number, number] = colors[categoryKey] || colors.general;

                // Stabilizer Concrete Block
                if (evt.category === "STABILIZER") {
                    doc.setFillColor(colors.stabilizer[0], colors.stabilizer[1], colors.stabilizer[2]);
                    doc.rect(evtX - 4, pipeY + 1.8, 8, 2.2, "F");
                }

                // Pipeline Crossing Mark
                if (evt.category === "CROSSING") {
                    doc.setDrawColor(colors.crossing[0], colors.crossing[1], colors.crossing[2]); doc.setLineWidth(0.6);
                    doc.line(evtX - 3, pipeY - 4, evtX + 3, pipeY + 4);
                    doc.line(evtX - 3, pipeY + 4, evtX + 3, pipeY - 4);
                }

                // Non-Overlapping Flag Pin Logic
                let level = 1;
                for (const prev of placedFlags) {
                    if (Math.abs(prev.x - evtX) < 12) {
                        level = prev.level === 1 ? 2 : 1;
                    }
                }
                placedFlags.push({ x: evtX, level });

                const stemY = pipeY - (level === 1 ? 6.5 : 7.8);

                doc.setDrawColor(categoryColor[0], categoryColor[1], categoryColor[2]); doc.setLineWidth(0.35);
                doc.line(evtX, pipeY - 1.5, evtX, stemY);

                // Circular Badge Pin with Event Global Index
                doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2]);
                doc.circle(evtX, stemY, 2.2, "F");
                doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.15);
                doc.circle(evtX, stemY, 2.2, "S");

                doc.setFontSize(5.2); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
                doc.text(String(globalMarkerIdx), evtX, stemY + 0.8, { align: "center" });
            });

            // ── Track Attached Event Details Table ───────────────────────────
            const tableStartY = canvasY + canvasH;

            const tableBody = trackEvents.map((evt, idx) => {
                const globalMarkerIdx = startGlobalIdx + idx;
                const posStr = evt.position && evt.position !== "-" ? evt.position : evt.northing !== "-" ? `N:${evt.northing}` : "-";
                const typeStr = evt.eventType !== evt.eventName ? `${evt.eventType}` : evt.category;
                return [
                    `[${globalMarkerIdx}]`,
                    evt.kpDisplay,
                    `${evt.eventName} (${typeStr})`,
                    posStr,
                    evt.description
                ];
            });

            autoTable(doc, {
                startY: tableStartY,
                margin: { left: margin, right: margin },
                head: [
                    [
                        { content: "#", styles: { halign: "center" } },
                        { content: "KP / FP", styles: { halign: "left" } },
                        { content: "EVENT NAME & TYPE", styles: { halign: "left" } },
                        { content: "POSITION / COORD", styles: { halign: "left" } },
                        { content: "DESCRIPTION / FINDINGS & OBSERVATIONS", styles: { halign: "left" } }
                    ]
                ],
                body: tableBody as any,
                theme: "grid",
                headStyles: {
                    fillColor: isPrintFriendly ? [240, 240, 240] : [31, 55, 93],
                    textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
                    fontSize: 6.5,
                    fontStyle: "bold",
                    cellPadding: 1,
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1
                },
                styles: {
                    fontSize: 6.2,
                    cellPadding: 1,
                    textColor: [30, 41, 59],
                    lineColor: [215, 220, 230],
                    lineWidth: 0.1,
                    valign: "middle",
                    minCellHeight: 3.5
                },
                columnStyles: {
                    0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
                    1: { cellWidth: 20, fontStyle: "bold" },
                    2: { cellWidth: 52 },
                    3: { cellWidth: 32 },
                    4: { cellWidth: "auto" }
                },
                didParseCell: (data) => {
                    if (data.section === "body" && data.column.index === 0) {
                        const rowIdx = data.row.index;
                        const evt = trackEvents[rowIdx];
                        if (evt) {
                            const catKey = (evt.category.toLowerCase() as keyof typeof colors);
                            const catCol = colors[catKey] || colors.navy;
                            data.cell.styles.textColor = catCol as [number, number, number];
                        }
                    }
                }
            });

            currentY = (doc as any).lastAutoTable.finalY + 3;
        }
    }

    // Apply Watermark, Signatures & Page Numbers
    applyWatermarkAndSignaturesGlobal(doc, config);

    if (config.returnBlob) {
        return doc.output("blob");
    }

    doc.save(`${config.reportNoPrefix || "REP"}_Pipeline_Event_List_Sketch.pdf`);
};

function dText(doc: jsPDF, txt: string, x: number, y: number, align: "left" | "center" | "right" = "left") {
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105);
    doc.text(txt, x, y, { align });
}

interface PipelineFeatureInterval {
    id: string;
    type: "SPAN" | "BURIAL";
    startKp: number;
    endKp: number;
    lengthM: number;
    heightDepthM: number;
}

function extractFeatureIntervals(allEvents: PipelineEventItem[], categoryTarget: "SPAN" | "BURIAL"): PipelineFeatureInterval[] {
    const targetEvents = allEvents.filter(e => e.category === categoryTarget);
    const intervals: PipelineFeatureInterval[] = [];
    const processedIndices = new Set<number>();

    for (let i = 0; i < targetEvents.length; i++) {
        if (processedIndices.has(i)) continue;
        const e1 = targetEvents[i];

        const text1 = `${e1.eventName} ${e1.eventType} ${e1.description}`.toUpperCase();
        const isStart1 = text1.includes("START") || text1.includes("BEGIN") || text1.includes("INIT");
        const isEnd1 = text1.includes("END") || text1.includes("FINISH") || text1.includes("TERM");

        let pairedIdx = -1;
        for (let j = i + 1; j < targetEvents.length; j++) {
            if (processedIndices.has(j)) continue;
            const e2 = targetEvents[j];
            const text2 = `${e2.eventName} ${e2.eventType} ${e2.description}`.toUpperCase();
            const isStart2 = text2.includes("START") || text2.includes("BEGIN");
            const isEnd2 = text2.includes("END") || text2.includes("FINISH");

            if ((isStart1 && isEnd2) || (isEnd1 && isStart2) || (!isStart1 && !isEnd1 && (isStart2 || isEnd2))) {
                pairedIdx = j;
                break;
            }
        }

        if (pairedIdx !== -1) {
            const e2 = targetEvents[pairedIdx];
            processedIndices.add(i);
            processedIndices.add(pairedIdx);

            const minKp = Math.min(e1.kp, e2.kp);
            const maxKp = Math.max(e1.kp, e2.kp);
            const kpDiffM = (maxKp - minKp) * 1000;
            const lengthM = Math.max(e1.spanLength || e2.spanLength || 0, kpDiffM > 0 ? kpDiffM : 5);
            const heightM = e1.spanHeight || e2.spanHeight || e1.burialDepth || e2.burialDepth || 0;

            intervals.push({
                id: `${e1.id}_${e2.id}`,
                type: categoryTarget,
                startKp: minKp,
                endKp: maxKp > minKp ? maxKp : minKp + (lengthM / 1000),
                lengthM: Math.max(lengthM, kpDiffM),
                heightDepthM: heightM
            });
        } else {
            processedIndices.add(i);
            const lenM = e1.spanLength || e1.burialDepth || 5;
            const minKp = e1.kp;
            const maxKp = e1.kp + (lenM / 1000);

            intervals.push({
                id: String(e1.id),
                type: categoryTarget,
                startKp: minKp,
                endKp: maxKp,
                lengthM: lenM,
                heightDepthM: e1.spanHeight || e1.burialDepth || 0
            });
        }
    }

    return intervals;
}
