import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal } from "./shared-logo";
import { createClient } from "@/utils/supabase/client";

export interface CompanySettings {
    company_name?: string;
    department_name?: string;
    departmentName?: string;
    logo_url?: string;
}

export interface ROVNavigReportOptions {
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
    showPageNumbers?: boolean;
    showSignatures?: boolean;
    showContractorLogo?: boolean;
    headerData?: any;
    printBlankReport?: boolean;
    isBlankReport?: boolean;
}

export interface NAVIGRecordItem {
    id: any;
    itemNo: number;
    dateStr: string;
    timeStr: string;
    easting: string;
    northing: string;
    kpDisplay: string;
    depth: string;
    cpReadingDisplay: string;
    eventNameFormatted: string;
    findingFormatted: string;
    priority: string;
    categoryType: "NORMAL" | "ANOMALY" | "DEBRIS" | "SPAN" | "CP_ANODE";
}

/**
 * Landscape Pipeline Visual Inspection Report (ROV) - NAVIG
 * Custom template for Pipeline Navigation Inspection (NAVIG)
 */
export const generateROVNavigReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string = "N/A",
    companySettings: CompanySettings = {},
    config: ROVNavigReportOptions = {},
    recordsOverride?: any[]
): Promise<Blob | void> => {
    const supabase = createClient();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 10;
    const contentWidth = pageWidth - margin * 2; // 277mm
    const isPrintFriendly = config.printFriendly === true;
    const isBlankReport = config.printBlankReport === true || config.isBlankReport === true;

    const colors = {
        navy: [31, 55, 93] as [number, number, number],
        lightGray: [248, 250, 252] as [number, number, number],
        border: [203, 213, 225] as [number, number, number],
        darkBorder: [100, 116, 139] as [number, number, number],
        text: [30, 41, 59] as [number, number, number],

        // Font Color Codes for Detail Rows
        normalText: [30, 41, 59] as [number, number, number],       // Normal Black
        anomalyText: [219, 39, 119] as [number, number, number],     // Pink (#DB2777)
        debrisText: [128, 0, 0] as [number, number, number],         // Maroon (#800000)
        spanText: [109, 40, 217] as [number, number, number],       // Violet (#6D28D9)
        cpAnodeText: [29, 78, 216] as [number, number, number],      // Blue (#1D4ED8)

        // Anomaly Priority Background Color Fills
        p1Fill: [254, 226, 226] as [number, number, number],        // Light Red
        p1Text: [185, 28, 28] as [number, number, number],
        p2Fill: [254, 243, 199] as [number, number, number],        // Light Amber
        p2Text: [180, 83, 9] as [number, number, number],
        p3Fill: [236, 253, 245] as [number, number, number],        // Light Green
        p3Text: [4, 120, 87] as [number, number, number],
        defaultFill: [241, 245, 249] as [number, number, number],
    };

    // ── 1. Fetch & Normalize Inspection Records ──────────────────────────────
    let rawRecords: any[] = [];
    if (recordsOverride && recordsOverride.length > 0) {
        rawRecords = recordsOverride;
    } else if (!isBlankReport) {
        try {
            const sId = Number(structure?.str_id || structure?.id || structure?.structure_id || config.structureId || 0);
            const jpId = Number(jobPack?.id || jobPack?.jobpack_id || config.jobPackId || 0);
            let q = supabase
                .from("insp_records")
                .select("*, structure_components:component_id(q_id, name, code)")
                .order("insp_id", { ascending: true });

            if (sId > 0) q = q.eq("structure_id", sId);
            if (jpId > 0) q = q.eq("jobpack_id", jpId);

            const { data } = await q;
            if (data && data.length > 0) {
                // Filter records for NAVIG inspection type or all records if filtered by jobpack
                const navigFiltered = data.filter((r: any) => {
                    const codeUpper = String(r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
                    return codeUpper === "NAVIG" || codeUpper.includes("NAV");
                });
                rawRecords = navigFiltered.length > 0 ? navigFiltered : data;
            }

            // Enrich rawRecords with v_anomaly_details priority details
            try {
                let anomQ = supabase.from("v_anomaly_details").select("*");
                if (jpId > 0) anomQ = anomQ.or(`jobpack_id.eq.${jpId},jobpack_id.eq.${Number(jpId) || 0}`);
                if (sId > 0) anomQ = anomQ.or(`structure_id.eq.${sId},structure_id.eq.${Number(sId) || 0}`);
                const { data: anomData } = await anomQ;
                if (anomData && anomData.length > 0) {
                    const anomMap = new Map<string, any>();
                    for (const a of anomData) {
                        const aId = String(a.insp_id || a.id || a.anomaly_id || "");
                        if (aId) anomMap.set(aId, a);
                    }
                    rawRecords = rawRecords.map((r: any) => {
                        const rId = String(r.insp_id || r.id || "");
                        const matchingAnom = anomMap.get(rId);
                        if (matchingAnom) {
                            return {
                                ...r,
                                priority: matchingAnom.priority || r.priority,
                                priority_color: matchingAnom.priority_color || r.priority_color,
                                display_ref_no: matchingAnom.display_ref_no || r.display_ref_no,
                                has_anomaly: true
                            };
                        }
                        return r;
                    });
                }
            } catch (anomErr) {
                console.error("Error fetching v_anomaly_details in NAVIG report:", anomErr);
            }
        } catch (err) {
            console.error("Error fetching NAVIG records for pipeline report", err);
        }
    }

    // Helper to get record timestamp for chronological sorting
    const getRecordTimestamp = (r: any): number => {
        let idraw = r.inspection_data || r.inspection_dat || {};
        if (typeof idraw === "string") {
            try { idraw = JSON.parse(idraw); } catch (e) { idraw = {}; }
        }

        const dateStrRaw = idraw.date || idraw.insp_date;
        const timeStrRaw = idraw.time || idraw.insp_time;

        if (dateStrRaw) {
            let formattedDate = String(dateStrRaw).trim();
            if (formattedDate.includes("/")) {
                const parts = formattedDate.split("/");
                if (parts.length === 3) {
                    formattedDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                }
            }
            const tStr = timeStrRaw ? String(timeStrRaw).trim() : "00:00:00";
            const parsed = new Date(`${formattedDate.split("T")[0]}T${tStr}`);
            if (!isNaN(parsed.getTime())) return parsed.getTime();
        }

        const fallbackDate = r.cr_date || r.created_at ? new Date(r.cr_date || r.created_at) : null;
        if (fallbackDate && !isNaN(fallbackDate.getTime())) return fallbackDate.getTime();

        return Number(r.insp_id || 0);
    };

    // Sort records by inspection date and time ascending (earliest to latest)
    rawRecords.sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b));

    // Process & Classify NAVIG Items
    const normalizedItems: NAVIGRecordItem[] = rawRecords.map((r: any, idx: number) => {
        let idraw = r.inspection_data || r.inspection_dat || {};
        if (typeof idraw === "string") {
            try { idraw = JSON.parse(idraw); } catch (e) { idraw = {}; }
        }

        const dateObj = r.cr_date || r.created_at ? new Date(r.cr_date || r.created_at) : null;
        const dateStr = idraw.date || (dateObj && !isNaN(dateObj.getTime()) ? format(dateObj, "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy"));
        
        let timeStr = "-";
        const rawTime = idraw.time || idraw.insp_time;
        if (rawTime) {
            const trimmedT = String(rawTime).trim();
            const parts = trimmedT.split(":");
            if (parts.length === 2) {
                timeStr = `${trimmedT}:00`;
            } else {
                timeStr = trimmedT;
            }
        } else if (dateObj && !isNaN(dateObj.getTime())) {
            timeStr = format(dateObj, "HH:mm:ss");
        }

        const eastingRaw = idraw.easting || idraw.e_coord || idraw.x_coord || idraw.east || "-";
        const easting = eastingRaw !== "-" ? `${eastingRaw} m` : "-";

        const northingRaw = idraw.northing || idraw.n_coord || idraw.y_coord || idraw.north || "-";
        const northing = northingRaw !== "-" ? `${northingRaw} m` : "-";

        const rawKp = r.fp_kp ?? idraw.kp ?? idraw.fp_kp ?? idraw.location ?? idraw.kp_start ?? "0";
        const kpNum = parseFloat(String(rawKp).replace(/[^\d.-]/g, ""));
        const kpDisplay = isNaN(kpNum) ? String(rawKp) : `KP ${kpNum.toFixed(3)}`;

        const depthRaw = idraw.depth || idraw.water_depth || idraw.depth_m || r.elevation || "-";
        const depth = depthRaw !== "-" ? `${depthRaw} m` : "-";

        // CP Column Formatting & Additional CP
        const primaryCp = idraw.cp_reading || idraw.cp_rdg || idraw.cp_reading_mv || idraw.cp || "";
        const additionalCps = idraw.additional_cp || idraw.cp_readings || idraw.cp_array || idraw.extra_cp || [];
        const additionalCpArray: string[] = Array.isArray(additionalCps)
            ? additionalCps.map(c => typeof c === "object" ? `${c.label ? c.label + ':' : ''}${c.val || c.value || c}mV` : `${c}mV`)
            : (typeof additionalCps === "string" && additionalCps.trim().length > 0 ? [additionalCps] : []);

        let cpReadingDisplay = primaryCp ? `${primaryCp} mV` : "-";
        if (additionalCpArray.length > 0) {
            cpReadingDisplay = primaryCp ? `${primaryCp} mV, ${additionalCpArray.join(", ")}` : additionalCpArray.join(", ");
        }

        // Event Name (Event Name + Event Type + Event Position + Event Description summary)
        const compCode = String(r.structure_components?.code || r.structure_components?.q_id || "").toUpperCase();
        const eventNameRaw = idraw.eventName || idraw.event_name || idraw.name || r.inspection_type_name || compCode || "EVENT";
        const eventTypeRaw = idraw.eventType || idraw.event_type || idraw.category || r.inspection_type_code || "-";
        const eventPosRaw = idraw.eventPosition || idraw.event_position || idraw.position || r.structure_components?.q_id || "-";
        const eventDescRaw = idraw.eventDescription || idraw.event_description || r.description || "";

        let eventNameFormatted = `${eventNameRaw}`;
        if (eventTypeRaw !== "-" && eventTypeRaw !== eventNameRaw) eventNameFormatted += ` [${eventTypeRaw}]`;
        if (eventPosRaw !== "-") eventNameFormatted += ` - Pos: ${eventPosRaw}`;
        if (eventDescRaw) eventNameFormatted += ` (${eventDescRaw})`;

        // Finding Column & Postfixes (Add'l CP + Anomaly Ref + Rectified Comments)
        let mainFinding = idraw.findings || idraw.observations || r.remarks || r.description || "Satisfactory inspection";
        const postfixes: string[] = [];

        if (additionalCpArray.length > 0) {
            postfixes.push(`[Add'l CP: ${additionalCpArray.join("; ")}]`);
        }

        const anomalyRef = idraw.anomaly_no || idraw.anomaly_ref || idraw.finding_ref || (r.has_anomaly ? `ANOM-${r.insp_id || idx + 1}` : "");
        if (anomalyRef) {
            postfixes.push(`[Ref: ${anomalyRef}]`);
        }

        const isRectified = idraw.is_rectified || idraw.rectified || idraw.action_taken || idraw.rectified_comments;
        if (isRectified) {
            const rectRemark = idraw.rectified_comments || idraw.action_taken || "Rectified during survey";
            postfixes.push(`[Rectified: ${rectRemark}]`);
        }

        const findingFormatted = postfixes.length > 0 ? `${mainFinding} ${postfixes.join(" ")}` : mainFinding;

        // Anomaly Priority & Row Classification
        const rawPrio = r.priority || r.anomaly_priority || idraw.anomaly_priority || idraw.priority || idraw.severity || r.anomaly_data?.priority || r.anomaly_data?.priority_code || "";
        let priority = "N/A";
        if (rawPrio) {
            const pStr = String(rawPrio).trim().toUpperCase();
            if (pStr.includes("PRIORITY 1") || pStr === "P1" || pStr === "1") priority = "PRIORITY 1";
            else if (pStr.includes("PRIORITY 2") || pStr === "P2" || pStr === "2") priority = "PRIORITY 2";
            else if (pStr.includes("PRIORITY 3") || pStr === "P3" || pStr === "3") priority = "PRIORITY 3";
            else if (pStr.includes("PRIORITY 4") || pStr === "P4" || pStr === "4") priority = "PRIORITY 4";
            else priority = pStr;
        } else if (r.has_anomaly) {
            priority = "PRIORITY 1";
        }

        const typeUpper = String(eventTypeRaw).toUpperCase();
        const nameUpper = String(eventNameRaw).toUpperCase();
        const descUpper = String(mainFinding).toUpperCase();

        let categoryType: NAVIGRecordItem["categoryType"] = "NORMAL";
        if (r.has_anomaly || typeUpper.includes("DEFECT") || typeUpper.includes("ANOMALY") || nameUpper.includes("DEFECT")) {
            categoryType = "ANOMALY";
        } else if (typeUpper.includes("DEBRIS") || nameUpper.includes("DEBRIS") || descUpper.includes("DEBRIS")) {
            categoryType = "DEBRIS";
        } else if (typeUpper.includes("SPAN") || nameUpper.includes("SPAN") || descUpper.includes("SPAN")) {
            categoryType = "SPAN";
        } else if (typeUpper.includes("ANODE") || typeUpper.includes("CP") || nameUpper.includes("ANODE") || nameUpper.includes("CP") || primaryCp) {
            categoryType = "CP_ANODE";
        }

        return {
            id: r.insp_id || idx + 1,
            itemNo: idx + 1,
            dateStr,
            timeStr,
            easting,
            northing,
            kpDisplay,
            depth,
            cpReadingDisplay,
            eventNameFormatted,
            findingFormatted,
            priority,
            categoryType
        };
    });

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
        } catch (e) {}
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

    // ── 4. Drawing Header & Subheaders ───────────────────────────────────────
    const drawHeader = (d: jsPDF) => {
        const headerH = 18;
        if (isPrintFriendly) {
            d.setDrawColor(...colors.navy); d.setLineWidth(0.3);
            d.rect(margin, margin, contentWidth, headerH, "S");
            d.setTextColor(...colors.navy);
        } else {
            d.setFillColor(...colors.navy);
            d.rect(margin, margin, contentWidth, headerH, "F");
            d.setTextColor(255, 255, 255);
        }

        if (clientLogo) drawLogo(d, clientLogo, 16, 14, pageWidth - margin - 18, margin + 2, "right", "center");
        if (contractorLogo) drawLogo(d, contractorLogo, 16, 14, margin + 2, margin + 2, "left", "center");

        d.setFontSize(10.5); d.setFont("helvetica", "bold");
        d.text((companySettings.company_name || "OFFSHORE INSPECTION DIVISION").toUpperCase(), margin + (contentWidth / 2), margin + 4.5, { align: "center" });
        d.setFontSize(7.5); d.setFont("helvetica", "normal");
        d.text(companySettings.department_name || companySettings.departmentName || "Technical Inspection & Integrity Management Division", margin + (contentWidth / 2), margin + 9, { align: "center" });

        d.setFontSize(11); d.setFont("helvetica", "bold");
        d.text("PIPELINE VISUAL INSPECTION REPORT", margin + (contentWidth / 2), margin + 15, { align: "center" });
    };

    const drawSubHeader = (d: jsPDF, startY: number): number => {
        const rowH = 5;
        const hData = config.headerData || {};

        const structName = structure?.str_name || structure?.name || hData.platformName || "N/A";
        const jobPackName = jobPack?.name || hData.jobpackName || "N/A";
        const vessel = hData.vessel || "N/A";
        const reportNo = sowReportNo || hData.sowReportNo || `${config.reportNoPrefix || "REP"}-NAVIG-01`;
        const inspDate = hData.date || format(new Date(), "dd/MM/yyyy");

        const fieldsRow1 = [
            { label: "PIPELINE / STRUCTURE:", value: structName },
            { label: "JOBPACK:", value: jobPackName },
            { label: "SOW REPORT NO:", value: reportNo }
        ];

        const fieldsRow2 = [
            { label: "VESSEL / SPREAD:", value: vessel },
            { label: "INSPECTION DATE:", value: inspDate },
            { label: "INSPECTION TYPE:", value: "NAVIG (Pipeline ROV Survey)" }
        ];

        const colW = contentWidth / 3;

        fieldsRow1.forEach((f, idx) => {
            const x = margin + idx * colW;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            if (!isPrintFriendly) d.setFillColor(...colors.lightGray);
            d.rect(x, startY, colW, rowH, isPrintFriendly ? "S" : "FD");
            d.setTextColor(...colors.text); d.setFontSize(7); d.setFont("helvetica", "bold");
            d.text(f.label, x + 2, startY + 3.5);
            d.setFont("helvetica", "normal");
            d.text(String(f.value), x + 38, startY + 3.5);
        });

        fieldsRow2.forEach((f, idx) => {
            const x = margin + idx * colW;
            const y = startY + rowH;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            if (!isPrintFriendly) d.setFillColor(...colors.lightGray);
            d.rect(x, y, colW, rowH, isPrintFriendly ? "S" : "FD");
            d.setTextColor(...colors.text); d.setFontSize(7); d.setFont("helvetica", "bold");
            d.text(f.label, x + 2, y + 3.5);
            d.setFont("helvetica", "normal");
            d.text(String(f.value), x + 38, y + 3.5);
        });

        return startY + rowH * 2 + 1.5;
    };

    const drawGeodeticBlock = (d: jsPDF, startY: number): number => {
        const projName = geodeticData?.geo_proj_nam || "UTM Zone 48N";
        const datum = geodeticData?.geo_datum || "WGS 84";
        const ellipsoid = geodeticData?.geo_elli_sph || "WGS 84";
        const units = geodeticData?.geo_units || "Meters";
        const datumShift = geodeticData?.geo_datum_shift || geodeticData?.datum_shift || geodeticData?.geo_dir || "WGS-84 To Timbalai";
        const dx = geodeticData?.geo_dx ?? "0.000";
        const dy = geodeticData?.geo_dy ?? "0.000";
        const dz = geodeticData?.geo_dz ?? "0.000";

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

        return (d as any).lastAutoTable.finalY + 1.5;
    };

    const drawLegendBlock = (d: jsPDF, startY: number): number => {
        const legendH = 7.5;
        d.setDrawColor(...colors.border); d.setLineWidth(0.1);
        d.setFillColor(255, 255, 255);
        d.rect(margin, startY, contentWidth, legendH, "FD");

        d.setFontSize(7); d.setFont("helvetica", "bold"); d.setTextColor(...colors.navy);
        d.text("ROW COLOR CODE LEGENDS:", margin + 3, startY + 4.8);

        const legends = [
            { label: "Normal Event (Black)", color: colors.normalText },
            { label: "Anomaly (Pink)", color: colors.anomalyText },
            { label: "Metallic Debris (Maroon)", color: colors.debrisText },
            { label: "Free Span (Violet)", color: colors.spanText },
            { label: "Anode / CP (Blue)", color: colors.cpAnodeText },
        ];

        let curX = margin + 46;
        legends.forEach(item => {
            d.setFillColor(...item.color);
            d.rect(curX, startY + 2, 3, 3, "F");
            d.setDrawColor(0, 0, 0); d.setLineWidth(0.1);
            d.rect(curX, startY + 2, 3, 3, "S");

            d.setFontSize(6.5); d.setFont("helvetica", "bold"); d.setTextColor(...item.color);
            d.text(item.label, curX + 4, startY + 4.5);
            curX += 45;
        });

        return startY + legendH + 2;
    };

    // ── 5. Render Page Document ──────────────────────────────────────────────
    drawHeader(doc);
    let currentY = margin + 19.5;
    currentY = drawSubHeader(doc, currentY);
    currentY = drawGeodeticBlock(doc, currentY);
    currentY = drawLegendBlock(doc, currentY);

    // Prepare Table Body Data
    let tableBodyData: any[] = [];

    if (isBlankReport || normalizedItems.length === 0) {
        // Render 12 Blank Structured Rows for Offshore Manual Logging
        for (let bIdx = 1; bIdx <= 12; bIdx++) {
            tableBodyData.push([
                `[${bIdx}]`,
                "", // Date
                "", // Time
                "", // Easting
                "", // Northing
                "", // KP
                "", // Depth
                "", // CP Reading
                "", // Event Name
                "", // Finding & Remarks
                "N/A" // Priority
            ]);
        }
    } else {
        tableBodyData = normalizedItems.map((item) => {
            return [
                `[${item.itemNo}]`,
                item.dateStr,
                item.timeStr,
                item.easting,
                item.northing,
                item.kpDisplay,
                item.depth,
                item.cpReadingDisplay,
                item.eventNameFormatted,
                item.findingFormatted,
                item.priority
            ];
        });
    }

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [
            [
                { content: "Item No.", styles: { halign: "center" } },
                { content: "Date", styles: { halign: "center" } },
                { content: "Time", styles: { halign: "center" } },
                { content: "Easting\n(m)", styles: { halign: "center" } },
                { content: "Northing\n(m)", styles: { halign: "center" } },
                { content: "KP\n(km)", styles: { halign: "center" } },
                { content: "Depth\n(m)", styles: { halign: "center" } },
                { content: "CP Reading\n(mV)", styles: { halign: "center" } },
                { content: "Event Name", styles: { halign: "center" } },
                { content: "Finding", styles: { halign: "center" } },
                { content: "Anomaly\nPriority", styles: { halign: "center" } }
            ]
        ],
        body: tableBodyData,
        theme: "grid",
        headStyles: {
            fillColor: isPrintFriendly ? [240, 240, 240] : [31, 55, 93],
            textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
            fontSize: 6.8,
            fontStyle: "bold",
            cellPadding: 1.5,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            valign: "middle",
            halign: "center"
        },
        styles: {
            fontSize: 6.3,
            cellPadding: 1.5,
            textColor: [30, 41, 59],
            lineColor: [210, 215, 225],
            lineWidth: 0.1,
            valign: "middle"
        },
        columnStyles: {
            0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
            1: { cellWidth: 18, halign: "center" },
            2: { cellWidth: 16, halign: "center" },
            3: { cellWidth: 22, halign: "right" },
            4: { cellWidth: 22, halign: "right" },
            5: { cellWidth: 18, halign: "center", fontStyle: "bold" },
            6: { cellWidth: 15, halign: "right" },
            7: { cellWidth: 24, halign: "center", fontStyle: "bold" },
            8: { cellWidth: 48 },
            9: { cellWidth: "auto" },
            10: { cellWidth: 20, halign: "center", fontStyle: "bold" }
        },
        didParseCell: (data) => {
            if (data.section === "body" && !isBlankReport && normalizedItems[data.row.index]) {
                const item = normalizedItems[data.row.index];

                // Apply Row Text Color Code Legend
                let rowColor = colors.normalText;
                if (item.categoryType === "ANOMALY") rowColor = colors.anomalyText;
                else if (item.categoryType === "DEBRIS") rowColor = colors.debrisText;
                else if (item.categoryType === "SPAN") rowColor = colors.spanText;
                else if (item.categoryType === "CP_ANODE") rowColor = colors.cpAnodeText;

                data.cell.styles.textColor = rowColor;

                // Anomaly Priority Column Background Color Fill
                if (data.column.index === 10) {
                    const prioUpper = String(item.priority).toUpperCase();
                    if (prioUpper.includes("P1") || prioUpper.includes("PRIORITY 1") || prioUpper.includes("CRITICAL") || prioUpper === "1") {
                        data.cell.styles.fillColor = colors.p1Fill;
                        data.cell.styles.textColor = colors.p1Text;
                    } else if (prioUpper.includes("P2") || prioUpper.includes("PRIORITY 2") || prioUpper.includes("SERIOUS") || prioUpper === "2") {
                        data.cell.styles.fillColor = colors.p2Fill;
                        data.cell.styles.textColor = colors.p2Text;
                    } else if (prioUpper.includes("P3") || prioUpper.includes("PRIORITY 3") || prioUpper.includes("MONITOR") || prioUpper === "3") {
                        data.cell.styles.fillColor = colors.p3Fill;
                        data.cell.styles.textColor = colors.p3Text;
                    } else {
                        data.cell.styles.fillColor = colors.defaultFill;
                        data.cell.styles.textColor = [100, 116, 139];
                    }
                }
            }
        }
    });

    // Apply Watermark, Signatures & Page Numbers
    applyWatermarkAndSignaturesGlobal(doc, config);

    if (config.returnBlob) {
        return doc.output("blob");
    }

    doc.save(`${config.reportNoPrefix || "REP"}_Pipeline_Visual_Inspection.pdf`);
};
