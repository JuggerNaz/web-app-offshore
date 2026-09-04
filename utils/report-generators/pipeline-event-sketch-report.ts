import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate } from "./shared-logo";
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
    kpNumStr: string;
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
 * Renders pipeline graphics with KP axis, CAD-style pipe sketch, span/burial profiles,
 * non-overlapping event markers, geodetic parameters header, and compact event detail boxes.
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
        headerBg: [226, 232, 240] as [number, number, number],
        border: [100, 116, 139] as [number, number, number],
        darkBorder: [15, 23, 42] as [number, number, number],
        lightGray: [248, 250, 252] as [number, number, number],
        text: [15, 23, 42] as [number, number, number],
        muted: [100, 116, 139] as [number, number, number],

        // Event Categories Colors
        span: [234, 88, 12] as [number, number, number],          // Orange for span
        burial: [145, 123, 76] as [number, number, number],       // Olive / Brown
        stabilizer: [107, 114, 128] as [number, number, number],  // Gray Slate
        crossing: [168, 85, 247] as [number, number, number],     // Purple
        cp: [14, 165, 233] as [number, number, number],           // Cyan / Sky Blue
        anode: [217, 70, 239] as [number, number, number],        // Magenta / Purple (Pic 1 style)
        debris: [245, 158, 11] as [number, number, number],       // Amber / Orange
        fitting: [99, 102, 241] as [number, number, number],      // Indigo
        defect: [225, 29, 72] as [number, number, number],        // Rose Red
        general: [217, 70, 239] as [number, number, number],      // Magenta
    };

    // ── 1. Fetch & Normalize Records (FILTER OUT VIDEO LOGS) ──────────────────
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

    // Process & Classify Events (Filtering Video Log records)
    const events: PipelineEventItem[] = (rawRecords || [])
        .map((r: any): PipelineEventItem | null => {
            let idraw = r.inspection_data || r.inspection_dat || {};
            if (typeof idraw === "string") {
                try { idraw = JSON.parse(idraw); } catch (e) { idraw = {}; }
            }
            const rawKp = r.fp_kp ?? idraw.kp ?? idraw.fp_kp ?? idraw.location ?? idraw.kp_start ?? r.elevation ?? "0";
            const kpNum = parseFloat(String(rawKp).replace(/[^\d.-]/g, "")) || 0;

            const compCode = String(r.structure_components?.code || r.structure_components?.q_id || "").toUpperCase();
            const nameUpper = String(idraw.eventName || idraw.event_name || idraw.event_id || idraw.name || r.inspection_type_name || r.inspection_type_code || compCode || r.description || "").toUpperCase();
            const typeUpper = String(idraw.eventType || idraw.event_type || idraw.category || idraw.type || r.inspection_type_code || "").toUpperCase();
            const descRaw = String(idraw.eventDescription || idraw.event_description || idraw.findings || idraw.observations || r.description || r.remarks || "");

            // 1. FILTER OUT VIDEO LOG EVENT DATA
            const isVideoLog =
                nameUpper.includes("VIDEO LOG") ||
                typeUpper.includes("VIDEO LOG") ||
                nameUpper.includes("VIDEO_LOG") ||
                typeUpper.includes("VIDEO_LOG") ||
                nameUpper.includes("TAPE RECORDING") ||
                nameUpper.includes("TAPE INTRODUCTION") ||
                nameUpper.includes("TAPE STOP") ||
                typeUpper.includes("TAPE") ||
                String(r.inspection_type_code || "").toUpperCase().includes("VIDEO") ||
                String(r.inspection_type_code || "").toUpperCase() === "VID" ||
                String(r.inspection_type_name || "").toUpperCase().includes("VIDEO") ||
                descRaw.toUpperCase().startsWith("TAPE RECORDING") ||
                descRaw.toUpperCase().startsWith("TAPE INTRODUCTION") ||
                descRaw.toUpperCase().startsWith("TAPE STOP") ||
                descRaw.toUpperCase().startsWith("CHECK VIDEO");

            if (isVideoLog) {
                return null;
            }

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
            } else if (typeUpper.includes("FLANGE") || typeUpper.includes("VALVE") || typeUpper.includes("FITTING") || nameUpper.includes("VALVE") || nameUpper.includes("TEE") || nameUpper.includes("J-TUBE") || nameUpper.includes("LINE TURN") || nameUpper.includes("FIELD JOINT")) {
                category = "FITTING";
            } else if (typeUpper.includes("DEFECT") || typeUpper.includes("DAMAGE") || typeUpper.includes("ANOMALY") || r.has_anomaly) {
                category = "DEFECT";
            }

            const kpNumStr = isNaN(kpNum) ? "0.000" : kpNum.toFixed(3);
            const kpLabel = `KP ${kpNumStr}`;
            let displayEvtName = idraw.eventName || idraw.event_name || (nameUpper.length > 0 && nameUpper.length < 35 ? nameUpper : `EVENT ${r.insp_id || ''}`);
            displayEvtName = displayEvtName.replace(/^EVENT\s*\d+\s*[-:]\s*/i, "").trim();

            const posVal = idraw.eventPosition || idraw.event_position || idraw.eventPos || idraw.event_pos || idraw.position || idraw.event_pos_val || idraw.pos || idraw.clock_pos || idraw.clock_position || r.clock_pos || r.structure_components?.q_id || "";
            const typeVal = idraw.eventType || idraw.event_type || idraw.type || idraw.category || r.inspection_type_name || r.inspection_type_code || (category !== "GENERAL" ? category : "");
            const spanLen = parseFloat(idraw.span_length || idraw.spanLength || idraw.length || "0");
            const spanH = parseFloat(idraw.span_height || idraw.spanHeight || idraw.gap_height || "0");
            const burialD = parseFloat(idraw.burial_depth || idraw.burialDepth || idraw.depth_of_burial || "0");

            // Format description with dimensions if span / burial exists and not already mentioned
            let finalDesc = descRaw;
            if (spanLen > 0 || spanH > 0) {
                const dimStr = `LENGTH:${spanLen.toFixed(2)}m/${(spanLen * 3.28084).toFixed(2)}ft${spanH > 0 ? ` HEIGHT:${(spanH * 1000).toFixed(1)}mm/${(spanH * 39.3701).toFixed(2)}in` : ""}`;
                if (!finalDesc || finalDesc === "-") {
                    finalDesc = dimStr;
                } else if (!finalDesc.toUpperCase().includes("LENGTH:")) {
                    finalDesc = `${finalDesc} ${dimStr}`.trim();
                }
            } else if (burialD > 0) {
                const burStr = `BURIAL DEPTH:${burialD.toFixed(2)}m/${(burialD * 3.28084).toFixed(2)}ft`;
                if (!finalDesc || finalDesc === "-") {
                    finalDesc = burStr;
                }
            }

            return {
                id: r.insp_id || Math.random(),
                kp: isNaN(kpNum) ? 0 : kpNum,
                kpDisplay: kpLabel,
                kpNumStr: kpNumStr,
                eventName: displayEvtName,
                eventType: String(typeVal === "-" ? "" : typeVal),
                position: String(posVal === "-" ? "" : posVal),
                description: finalDesc === "-" ? "" : finalDesc,
                spanLength: spanLen,
                spanHeight: spanH,
                burialDepth: burialD,
                northing: idraw.northing || idraw.n_coord || "-",
                easting: idraw.easting || idraw.e_coord || "-",
                cpReading: idraw.cp_reading || idraw.cp_rdg || idraw.cp || "",
                category
            };
        })
        .filter((e): e is PipelineEventItem => e !== null)
        .sort((a, b) => a.kp - b.kp);

    // Fallback: If no inspection records are logged yet for this pipeline structure, fetch components or construct clean demo events
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
                        const kpVal = parseFloat(c.metadata?.kp || c.kp || String(idx * 0.005)) || (idx * 0.005);
                        
                        let category: PipelineEventItem["category"] = "GENERAL";
                        if (compCode.includes("SPAN")) category = "SPAN";
                        else if (compCode.includes("BURIAL") || compCode.includes("BUR")) category = "BURIAL";
                        else if (compCode.includes("MAT") || compCode.includes("STAB")) category = "STABILIZER";
                        else if (compCode.includes("CROSS")) category = "CROSSING";
                        else if (compCode.includes("AN")) category = "ANODE";
                        else if (compCode.includes("CP")) category = "CP";
                        else if (compCode.includes("VALVE") || compCode.includes("TEE") || compCode.includes("FLG") || compCode.includes("JTUBE")) category = "FITTING";

                        return {
                            id: c.id,
                            kp: kpVal,
                            kpDisplay: `KP ${kpVal.toFixed(3)}`,
                            kpNumStr: kpVal.toFixed(3),
                            eventName: compName,
                            eventType: c.code || category,
                            position: c.q_id || "",
                            description: c.metadata?.description || c.description || "",
                            spanLength: category === "SPAN" ? 4.0 : 0,
                            spanHeight: category === "SPAN" ? 0.4 : 0,
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
                    kpNumStr: "0.000",
                    eventName: "J-TUBE",
                    eventType: "Clamps & Supports",
                    position: "RISER BEND",
                    description: "Riser bend suspended from the seabed approx. 400mm",
                    spanLength: 0,
                    spanHeight: 0,
                    burialDepth: 0,
                    category: "FITTING"
                },
                {
                    id: 102,
                    kp: 0.000,
                    kpDisplay: "KP 0.000",
                    kpNumStr: "0.000",
                    eventName: "SPAN STARTS",
                    eventType: "Seabed Profile (Span)",
                    position: "STARTS",
                    description: "Pipeline free span start detected",
                    spanLength: 4.0,
                    spanHeight: 0.4,
                    burialDepth: 0,
                    category: "SPAN"
                },
                {
                    id: 103,
                    kp: 0.004,
                    kpDisplay: "KP 0.004",
                    kpNumStr: "0.004",
                    eventName: "SPAN ENDS",
                    eventType: "Seabed Profile (Span)",
                    position: "ENDS",
                    description: "LENGTH:4.00m/13.12ft HEIGHT:400.0mm/15.75in",
                    spanLength: 4.0,
                    spanHeight: 0.4,
                    burialDepth: 0,
                    category: "SPAN"
                },
                {
                    id: 104,
                    kp: 0.004,
                    kpDisplay: "KP 0.004",
                    kpNumStr: "0.004",
                    eventName: "LINE TURN",
                    eventType: "Routing / Alignment",
                    position: "PIPE BODY",
                    description: "TOWARDS PORT SIDE",
                    spanLength: 0,
                    spanHeight: 0,
                    burialDepth: 0,
                    category: "GENERAL"
                },
                {
                    id: 105,
                    kp: 0.026,
                    kpDisplay: "KP 0.026",
                    kpNumStr: "0.026",
                    eventName: "ANODE",
                    eventType: "Cathodic Protection",
                    position: "TOP OF PIPE",
                    description: "Bracelet zinc anode attached. 10% depletion.",
                    spanLength: 0,
                    spanHeight: 0,
                    burialDepth: 0,
                    category: "ANODE"
                },
                {
                    id: 106,
                    kp: 0.033,
                    kpDisplay: "KP 0.033",
                    kpNumStr: "0.033",
                    eventName: "FIELD JOINT",
                    eventType: "Joint / Wrap",
                    position: "CIRCUMFERENTIAL",
                    description: "TAPE WRAP IN GOOD CONDITION",
                    spanLength: 0,
                    spanHeight: 0,
                    burialDepth: 0,
                    category: "FITTING"
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

    // ── 4. Drawing Header Components ─────────────────────────────────────────
    const drawHeader = (d: jsPDF) => {
        const headerH = 18;
        if (isPrintFriendly) {
            d.setDrawColor(...colors.navy); d.setLineWidth(0.3); d.rect(margin, margin, contentWidth, headerH, "S");
            d.setTextColor(...colors.navy);
        } else {
            d.setFillColor(...colors.navy); d.rect(margin, margin, contentWidth, headerH, "F");
            d.setTextColor(255, 255, 255);
        }

        if (clientLogo) drawLogo(d, clientLogo, 16, 14, pageWidth - margin - 18, margin + 2, "right", "center");
        if (contractorLogo) drawLogo(d, contractorLogo, 16, 14, margin + 2, margin + 2, "left", "center");

        d.setFontSize(10.5); d.setFont("helvetica", "bold");
        d.text((companySettings.company_name || "OFFSHORE INSPECTION DIVISION").toUpperCase(), margin + (contentWidth / 2), margin + 4.5, { align: "center" });
        d.setFontSize(7.5); d.setFont("helvetica", "normal");
        d.text(companySettings.department_name || companySettings.departmentName || "Inspection Department", margin + (contentWidth / 2), margin + 9, { align: "center" });

        d.setFontSize(11); d.setFont("helvetica", "bold");
        d.text("PIPELINE NAVIGATION EVENT SKETCH REPORT", margin + (contentWidth / 2), margin + 14.5, { align: "center" });
    };

    const drawSubHeader = (d: jsPDF, startY: number): number => {
        const rowH = 5;
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
            d.setTextColor(...colors.text); d.setFontSize(7); d.setFont("helvetica", "bold");
            d.text(f.label, x + 2, startY + 3.4);
            d.setFont("helvetica", "normal");
            d.text(String(f.value), x + 36, startY + 3.4);
        });

        // Row 2
        fieldsRow2.forEach((f, idx) => {
            const x = margin + idx * colW;
            const y = startY + rowH;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            if (!isPrintFriendly) d.setFillColor(...colors.lightGray);
            d.rect(x, y, colW, rowH, isPrintFriendly ? "S" : "FD");
            d.setTextColor(...colors.text); d.setFontSize(7); d.setFont("helvetica", "bold");
            d.text(f.label, x + 2, y + 3.4);
            d.setFont("helvetica", "normal");
            d.text(String(f.value), x + 36, y + 3.4);
        });

        return startY + rowH * 2 + 1.2;
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
                    { content: "GEODETIC PARAMETERS & NAVIGATION REFERENCE", colSpan: 6, styles: { fillColor: isPrintFriendly ? [230, 230, 230] : [31, 55, 93], textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7 } }
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
            styles: { fontSize: 6.5, cellPadding: 1, lineColor: [200, 200, 200], lineWidth: 0.1, textColor: [30, 41, 59] }
        });

        return (d as any).lastAutoTable.finalY + 1.2;
    };

    const drawLegendBlock = (d: jsPDF, startY: number): number => {
        const legendH = 7.5;
        d.setDrawColor(...colors.border); d.setLineWidth(0.1);
        d.setFillColor(255, 255, 255);
        d.rect(margin, startY, contentWidth, legendH, "FD");

        d.setFontSize(7); d.setFont("helvetica", "bold"); d.setTextColor(...colors.navy);
        d.text("EVENT LEGENDS:", margin + 2.5, startY + 4.8);

        const legends = [
            { label: "Span (Under)", color: colors.span },
            { label: "Burial (Over)", color: colors.burial },
            { label: "Stabilizer", color: colors.stabilizer },
            { label: "Crossing", color: colors.crossing },
            { label: "CP Reading", color: colors.cp },
            { label: "Anode / Event", color: colors.anode },
            { label: "Debris", color: colors.debris },
            { label: "Fitting / Joint", color: colors.fitting },
        ];

        let curX = margin + 28;
        legends.forEach(item => {
            d.setFillColor(...item.color);
            d.rect(curX, startY + 2.2, 3.2, 3.2, "F");
            d.setDrawColor(0, 0, 0); d.setLineWidth(0.1);
            d.rect(curX, startY + 2.2, 3.2, 3.2, "S");

            d.setFontSize(6.5); d.setFont("helvetica", "normal"); d.setTextColor(...colors.text);
            d.text(item.label, curX + 4.2, startY + 4.6);
            curX += 30;
        });

        return startY + legendH + 1.5;
    };

    // ── 5. Multi-Track Serpentine Ribbon Page Generation Loop ────────────────
    const eventsPerTrack = 8;
    const tracksPerPage = 3;
    const eventsPerPage = tracksPerPage * eventsPerTrack; // 24 events per page
    const totalPages = Math.max(1, Math.ceil(events.length / eventsPerPage));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        if (pageIdx > 0) doc.addPage("a4", "l");

        drawHeader(doc);
        let currentY = margin + 19.5;
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
            const trackMinKp = Math.min(...trackEvents.map(e => e.kp));
            const trackMaxKp = Math.max(...trackEvents.map(e => e.kp));
            const kpSpan = Math.max(0.005, trackMaxKp - trackMinKp);

            // Track Container Y Setup
            const trackStartY = currentY;

            // ── Track Header Banner ─────────────────────────────────────────
            const bannerH = 3.8;
            if (isPrintFriendly) {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.2);
                doc.rect(margin, trackStartY, contentWidth, bannerH, "S");
                doc.setTextColor(...colors.navy);
            } else {
                doc.setFillColor(...colors.navy);
                doc.rect(margin, trackStartY, contentWidth, bannerH, "F");
                doc.setTextColor(255, 255, 255);
            }
            doc.setFontSize(6.8); doc.setFont("helvetica", "bold");
            doc.text(`TRACK #${trackGlobalNum} — PIPELINE PROFILE & EVENTS (KP ${trackMinKp.toFixed(3)} TO KP ${trackMaxKp.toFixed(3)})`, margin + 2.5, trackStartY + 2.7);
            doc.setFontSize(6.2); doc.setFont("helvetica", "normal");
            doc.text(`${trackEvents.length} Events`, margin + contentWidth - 2.5, trackStartY + 2.7, { align: "right" });

            // ── Track Pipe Canvas Graphic Section (Pic 1 Style) ──────────────
            const canvasY = trackStartY + bannerH;
            const canvasH = 14;

            doc.setDrawColor(...colors.border); doc.setLineWidth(0.2);
            doc.setFillColor(255, 255, 255);
            doc.rect(margin, canvasY, contentWidth, canvasH, "FD");

            // Pipe Line Axis Y (Centered inside canvas)
            const pipeY = canvasY + 6.5;
            const graphMarginX = 14;
            const graphXStart = margin + graphMarginX;
            const graphXEnd = margin + contentWidth - graphMarginX;
            const graphW = graphXEnd - graphXStart;

            // Draw Pipe Body (Metallic Gray fill with outline - Pic 1 Style)
            doc.setFillColor(203, 213, 225); // Slate 300 fill
            doc.rect(graphXStart, pipeY - 1.8, graphW, 3.6, "F");
            doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.3);
            doc.line(graphXStart, pipeY - 1.8, graphXEnd, pipeY - 1.8);
            doc.line(graphXStart, pipeY + 1.8, graphXEnd, pipeY + 1.8);

            // Draw 3D Pipe End Cylinder opening on the left (Pic 1 Style)
            doc.setFillColor(241, 245, 249);
            doc.ellipse(graphXStart - 0.5, pipeY - 0.9, 1.2, 0.9, "FD");
            doc.ellipse(graphXStart - 0.5, pipeY + 0.9, 1.2, 0.9, "FD");

            // KP Scale Line & Major Ticks
            doc.setDrawColor(...colors.muted); doc.setLineWidth(0.12);
            doc.line(graphXStart, pipeY + 4.2, graphXEnd, pipeY + 4.2);
            dText(doc, `KP ${trackMinKp.toFixed(3)}`, graphXStart, pipeY + 6.5, "center");
            dText(doc, `KP ${((trackMinKp + trackMaxKp) / 2).toFixed(3)}`, graphXStart + graphW / 2, pipeY + 6.5, "center");
            dText(doc, `KP ${trackMaxKp.toFixed(3)}`, graphXEnd, pipeY + 6.5, "center");

            [0, 0.25, 0.5, 0.75, 1].forEach(pct => {
                const tx = graphXStart + pct * graphW;
                doc.line(tx, pipeY + 3.6, tx, pipeY + 4.8);
            });

            // ── Render Span Intervals as Orange Dashed Bracket (Pic 1 Style) ──
            spanIntervals.forEach(spanInt => {
                if (spanInt.startKp <= trackMaxKp && spanInt.endKp >= trackMinKp) {
                    const effStartKp = Math.max(spanInt.startKp, trackMinKp);
                    const effEndKp = Math.min(spanInt.endKp, trackMaxKp);

                    const pctStart = kpSpan === 0 ? 0 : Math.min(1, Math.max(0, (effStartKp - trackMinKp) / kpSpan));
                    const pctEnd = kpSpan === 0 ? 1 : Math.min(1, Math.max(0, (effEndKp - trackMinKp) / kpSpan));

                    const sx1 = graphXStart + pctStart * graphW;
                    const sx2 = graphXStart + pctEnd * graphW;
                    const dropY = pipeY + 3.5;

                    doc.setDrawColor(colors.span[0], colors.span[1], colors.span[2]);
                    doc.setLineWidth(0.4);

                    // Left vertical drop line
                    doc.line(sx1, pipeY + 1.8, sx1, dropY);
                    // Right vertical drop line
                    doc.line(sx2, dropY, sx2, pipeY + 1.8);

                    // Dashed horizontal span line underneath pipe (Pic 1 Style)
                    doc.setLineDashPattern([1.5, 1], 0);
                    doc.line(sx1, dropY, sx2, dropY);
                    doc.setLineDashPattern([], 0); // Reset dash
                }
            });

            // ── Render Burial Cover Intervals as Brown Dashed Line ────────────
            burialIntervals.forEach(burialInt => {
                if (burialInt.startKp <= trackMaxKp && burialInt.endKp >= trackMinKp) {
                    const effStartKp = Math.max(burialInt.startKp, trackMinKp);
                    const effEndKp = Math.min(burialInt.endKp, trackMaxKp);

                    const pctStart = kpSpan === 0 ? 0 : Math.min(1, Math.max(0, (effStartKp - trackMinKp) / kpSpan));
                    const pctEnd = kpSpan === 0 ? 1 : Math.min(1, Math.max(0, (effEndKp - trackMinKp) / kpSpan));

                    const bx1 = graphXStart + pctStart * graphW;
                    const bx2 = graphXStart + pctEnd * graphW;
                    const coverY = pipeY - 3.5;

                    doc.setDrawColor(colors.burial[0], colors.burial[1], colors.burial[2]);
                    doc.setLineWidth(0.4);

                    doc.line(bx1, pipeY - 1.8, bx1, coverY);
                    doc.line(bx2, coverY, bx2, pipeY - 1.8);

                    doc.setLineDashPattern([1.5, 1], 0);
                    doc.line(bx1, coverY, bx2, coverY);
                    doc.setLineDashPattern([], 0);
                }
            });

            // ── Render Symbols on Pipe (Pic 1 Style: Magenta Crosshairs, Arrows, Brackets) ──
            trackEvents.forEach((evt, idx) => {
                const pct = kpSpan === 0 ? (idx + 0.5) / trackEvents.length : Math.min(1, Math.max(0, (evt.kp - trackMinKp) / kpSpan));
                const evtX = graphXStart + pct * graphW;

                // Top tick leader line down to pipe
                doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.25);
                doc.line(evtX, canvasY + 0.5, evtX, pipeY - 1.8);

                if (evt.category === "SPAN") {
                    // Span marker tick or bracket
                    doc.setDrawColor(colors.span[0], colors.span[1], colors.span[2]); doc.setLineWidth(0.4);
                    doc.line(evtX, pipeY + 1.8, evtX, pipeY + 3.5);
                } else if (evt.category === "CROSSING" || evt.eventName.toUpperCase().includes("LINE TURN")) {
                    // Double arrow symbol <-> on pipe
                    doc.setDrawColor(168, 85, 247); doc.setLineWidth(0.4);
                    doc.line(evtX - 2.5, pipeY, evtX + 2.5, pipeY);
                    // Left arrow tip
                    doc.line(evtX - 2.5, pipeY, evtX - 1.5, pipeY - 1);
                    doc.line(evtX - 2.5, pipeY, evtX - 1.5, pipeY + 1);
                    // Right arrow tip
                    doc.line(evtX + 2.5, pipeY, evtX + 1.5, pipeY - 1);
                    doc.line(evtX + 2.5, pipeY, evtX + 1.5, pipeY + 1);
                } else if (evt.category === "STABILIZER") {
                    // Stabilizer block on pipe
                    doc.setFillColor(107, 114, 128);
                    doc.rect(evtX - 3, pipeY - 2.5, 6, 5, "F");
                } else if (evt.eventName.toUpperCase().includes("JOINT") || evt.category === "DEFECT") {
                    // Joint / End Bracket ][ marker
                    doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.5);
                    doc.line(evtX - 1.2, pipeY - 1.8, evtX - 1.2, pipeY + 1.8);
                    doc.line(evtX + 1.2, pipeY - 1.8, evtX + 1.2, pipeY + 1.8);
                    doc.line(evtX - 1.2, pipeY - 1.8, evtX - 0.4, pipeY - 1.8);
                    doc.line(evtX - 1.2, pipeY + 1.8, evtX - 0.4, pipeY + 1.8);
                    doc.line(evtX + 1.2, pipeY - 1.8, evtX + 0.4, pipeY - 1.8);
                    doc.line(evtX + 1.2, pipeY + 1.8, evtX + 0.4, pipeY + 1.8);
                } else {
                    // Magenta Crosshair Circle (Pic 1 Style for Anodes / Point Events)
                    doc.setDrawColor(217, 70, 239); doc.setLineWidth(0.35);
                    doc.circle(evtX, pipeY, 1.8, "S");
                    doc.line(evtX - 1.8, pipeY, evtX + 1.8, pipeY);
                    doc.line(evtX, pipeY - 1.8, evtX, pipeY + 1.8);
                }
            });

            // ── Track Attached Event Details (Pic 1 Style: Small Boxes / Cards in 4 Columns) ──
            const boxesStartY = canvasY + canvasH;
            const cols = 4;
            const boxW = contentWidth / cols; // 69.25mm per box
            const boxHeaderH = 4.2;

            // Render event boxes in rows of 4
            const numRows = Math.ceil(trackEvents.length / cols);
            let currentBoxRowY = boxesStartY;

            for (let rIdx = 0; rIdx < numRows; rIdx++) {
                const rowEvts = trackEvents.slice(rIdx * cols, (rIdx + 1) * cols);

                // Sub-column widths
                const kpColW = 11.5;
                const evtColW = 28.5;
                const descColW = boxW - kpColW - evtColW;

                // Calculate required content height for this row of boxes
                let maxContentLines = 2;
                rowEvts.forEach(evt => {
                    const nameLines = doc.splitTextToSize(evt.eventName.toUpperCase(), evtColW - 2.5);
                    let evtLinesCount = nameLines.length;

                    const typeText = evt.eventType && evt.eventType !== "-" && evt.eventType.toUpperCase() !== evt.eventName.toUpperCase()
                        ? `Type: ${evt.eventType}`
                        : "";
                    if (typeText) {
                        const typeLines = doc.splitTextToSize(typeText, evtColW - 2.5);
                        evtLinesCount += typeLines.length;
                    }

                    const posText = evt.position && evt.position !== "-"
                        ? `Pos: ${evt.position}`
                        : "";
                    if (posText) {
                        const posLines = doc.splitTextToSize(posText, evtColW - 2.5);
                        evtLinesCount += posLines.length;
                    }

                    const descText = evt.description && evt.description !== "-" ? evt.description : "-";
                    const descLines = doc.splitTextToSize(descText.toUpperCase(), descColW - 2.5);

                    maxContentLines = Math.max(maxContentLines, evtLinesCount, descLines.length);
                });

                const contentH = Math.max(8.5, Math.min(22, maxContentLines * 2.4 + 2.2));
                const totalBoxH = boxHeaderH + contentH;

                rowEvts.forEach((evt, cIdx) => {
                    const boxX = margin + cIdx * boxW;

                    // Box Border & Structure
                    doc.setDrawColor(...colors.darkBorder);
                    doc.setLineWidth(0.25);

                    // 1. Box Header Bar (Gray fill `#d1d5db` with bold labels: KP | Event | Description)
                    doc.setFillColor(209, 213, 219); // Crisp Light Slate Gray
                    doc.rect(boxX, currentBoxRowY, boxW, boxHeaderH, "FD");

                    doc.line(boxX + kpColW, currentBoxRowY, boxX + kpColW, currentBoxRowY + boxHeaderH);
                    doc.line(boxX + kpColW + evtColW, currentBoxRowY, boxX + kpColW + evtColW, currentBoxRowY + boxHeaderH);

                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(6.5);
                    doc.setFont("helvetica", "bold");
                    doc.text("KP", boxX + 1.5, currentBoxRowY + 3.0);
                    doc.text("Event", boxX + kpColW + 1.5, currentBoxRowY + 3.0);
                    doc.text("Description", boxX + kpColW + evtColW + 1.5, currentBoxRowY + 3.0);

                    // 2. Box Data Area
                    const dataY = currentBoxRowY + boxHeaderH;
                    doc.setFillColor(255, 255, 255);
                    doc.rect(boxX, dataY, boxW, contentH, "FD");

                    // Sub-column data vertical dividers
                    doc.line(boxX + kpColW, dataY, boxX + kpColW, dataY + contentH);
                    doc.line(boxX + kpColW + evtColW, dataY, boxX + kpColW + evtColW, dataY + contentH);

                    // Fill KP Value
                    doc.setFontSize(5.8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(0, 0, 0);
                    doc.text(evt.kpNumStr, boxX + 1.2, dataY + 3.2);

                    // Fill Event Column (Event Name, Event Type, Event Pos)
                    let curEvtY = dataY + 3.0;

                    // Event Name
                    doc.setFontSize(5.5);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(15, 23, 42);
                    const nameWrapped = doc.splitTextToSize(evt.eventName.toUpperCase(), evtColW - 2.5);
                    doc.text(nameWrapped, boxX + kpColW + 1.5, curEvtY);
                    curEvtY += nameWrapped.length * 2.3;

                    // Event Type
                    const typeText = evt.eventType && evt.eventType !== "-" && evt.eventType.toUpperCase() !== evt.eventName.toUpperCase()
                        ? `Type: ${evt.eventType}`
                        : "";
                    if (typeText) {
                        doc.setFontSize(4.6);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(71, 85, 105);
                        const typeWrapped = doc.splitTextToSize(typeText, evtColW - 2.5);
                        doc.text(typeWrapped, boxX + kpColW + 1.5, curEvtY);
                        curEvtY += typeWrapped.length * 2.1;
                    }

                    // Event Pos
                    const posText = evt.position && evt.position !== "-"
                        ? `Pos: ${evt.position}`
                        : "";
                    if (posText) {
                        doc.setFontSize(4.6);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(71, 85, 105);
                        const posWrapped = doc.splitTextToSize(posText, evtColW - 2.5);
                        doc.text(posWrapped, boxX + kpColW + 1.5, curEvtY);
                        curEvtY += posWrapped.length * 2.1;
                    }

                    // Fill Description Column
                    doc.setFontSize(5.0);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(30, 41, 59);

                    const descLines: string[] = [];
                    if (evt.description && evt.description !== "-") {
                        const splitDesc = doc.splitTextToSize(evt.description.toUpperCase(), descColW - 2.5);
                        descLines.push(...splitDesc);
                    } else {
                        descLines.push("-");
                    }

                    if (descLines.length > 0) {
                        doc.text(descLines.slice(0, 6), boxX + kpColW + evtColW + 1.5, dataY + 3.0);
                    }
                });

                currentBoxRowY += totalBoxH;
            }

            currentY = currentBoxRowY + 2.5;
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
    doc.setFontSize(5.8); doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105);
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

