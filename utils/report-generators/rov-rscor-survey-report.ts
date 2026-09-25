import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format, min, max } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate } from "./shared-logo";

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
    showPageNumbers?: boolean;
    showSignatures?: boolean;
    isBlankReport?: boolean;
}

/**
 * ROV Scour Survey Report (RSCOUR / RSCOR) — Portrait Standard
 *
 * Columns: Item No. | Component QID | Elevation (m) | Dive No. | Tape No. | Findings
 */
export const generateROVRSCORSurveyReport = async (
    records: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    try {
        if (!config.isBlankReport && (!records || records.length === 0)) {
            return null;
        }

        const isBlank = config.isBlankReport || !records || records.length === 0;
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - margin * 2;

        const colors = {
            navy:      [31,  55,  93]  as [number, number, number],
            teal:      [20,  184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border:    [203, 213, 225] as [number, number, number],
            text:      [30,  41,  59]  as [number, number, number],
            anomaly:   [220, 38,  38]  as [number, number, number],
            rectified: [22,  163, 74]  as [number, number, number],
            finding:   [124, 58,  237] as [number, number, number],
        };

        // ── Date range ──────────────────────────────────────────────────────────
        let startDate: Date | null = null;
        let endDate:   Date | null = null;
        if (!isBlank && records.length > 0) {
            const dates = records
                .map(r => new Date(r.cr_date || r.created_at || r.inspection_date))
                .filter(d => !isNaN(d.getTime()));
            if (dates.length > 0) {
                startDate = min(dates);
                endDate   = max(dates);
            }
        }
        const dateRangeStr = startDate && endDate
            ? `${format(startDate, "dd MMM yyyy")} – ${format(endDate, "dd MMM yyyy")}`
            : (isBlank ? "" : "N/A");

        const HEADER_H = 26;

        // ── Pre-load logos ──────────────────────────────────────────────────────
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        // ── Synchronous page header ─────────────────────────────────────────────
        const drawPageHeader = (d: jsPDF) => {
            const isPF = config.printFriendly;
            if (isPF) {
                d.setDrawColor(...colors.navy);
                d.setLineWidth(0.5);
                d.rect(margin, margin, contentWidth, HEADER_H, "S");
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy);
                d.rect(margin, margin, contentWidth, HEADER_H, "F");
                d.setTextColor(255);
            }

            if (companyLogo)    drawLogo(d, companyLogo,    18, 18, pageWidth - margin - 22, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 18, 18, margin + 4,              margin + 3, "left",  "center");

            d.setFontSize(11);  d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6,  { align: "center" });
            d.setFontSize(8.5); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Inspection Division", margin + contentWidth / 2, margin + 10.5, { align: "center" });
            d.setFontSize(11);  d.setFont("helvetica", "bold");
            d.text("Scour Survey Report (ROV)", margin + contentWidth / 2, margin + 16.5, { align: "center" });
            d.setFontSize(8);   d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin + contentWidth / 2, margin + 21, { align: "center" });
        };

        // ── Context boxes ───────────────────────────────────────────────────────
        const ROW_H = 7;
        const drawContextRow = (d: jsPDF, y: number) => {
            const isPF = config.printFriendly;
            const half = contentWidth / 2;
            const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
                d.setDrawColor(...colors.border);
                d.setLineWidth(0.1);
                if (!isPF) {
                    d.setFillColor(...colors.lightGray);
                    d.rect(x, ty, w, ROW_H, "F");
                }
                d.rect(x, ty, w, ROW_H, "S");
                d.setTextColor(...colors.text);
                d.setFontSize(7.5);
                d.setFont("helvetica", "bold");
                d.text(label, x + 2, ty + 4.8);
                d.setFont("helvetica", "normal");
                d.text(String(value || ""), x + 36, ty + 4.8);
            };
            drawBox("Structure:",        headerData.platformName || "N/A", margin,        half, y);
            drawBox("Vessel:",           headerData.vessel       || "N/A", margin + half, half, y);
            drawBox("Job Pack:",         headerData.jobpackName  || "N/A", margin,        half, y + ROW_H);
            drawBox("Insp. Date Range:", dateRangeStr,                     margin + half, half, y + ROW_H);
            return y + ROW_H * 2 + 4;
        };

        // ── Pre-fetch Structure Components if missing metadata ─────────────────
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
                console.warn("[ROV RSCOR Survey Report] Could not pre-fetch structure_components:", e);
            }
        }

        // ── Helper to format face label ─────────────────────────────────────────
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

        // ── Helper to resolve record Face according to rules 1, 2, 3 ────────────
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

            // 1. First check the value of Platform Face value from the inspection record
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

            // Extract component Face value
            const compFace = comp.face || md.face || md.face_name || md.face_code || md.Face || 
                             md.additionalInfo?.face || md.additionalInfo?.face_pos || rawObj.face || rawMd.face;

            // Extract start and end leg names, or leg designation
            const sLeg = md.start_leg || md.s_leg || md.leg_1 || md.StartLeg || md.Leg_1 || 
                         comp.start_leg || comp.startLeg || comp.s_leg || rawObj.start_leg || rawObj.s_leg || "";
            const fLeg = md.end_leg || md.f_leg || md.leg_2 || md.EndLeg || md.Leg_2 || 
                         comp.end_leg || comp.endLeg || comp.f_leg || rawObj.end_leg || rawObj.f_leg || "";
            const pileLeg = md.leg_no || md.leg || md.leg_name || comp.leg_no || comp.leg || rawObj.leg_no || "";

            const cleanLeg = (l: string) => String(l).trim().replace(/^leg\s*/i, "").toUpperCase();
            const sLegClean = sLeg ? cleanLeg(sLeg) : "";
            const fLegClean = fLeg ? cleanLeg(fLeg) : "";
            const pileLegClean = pileLeg ? cleanLeg(pileLeg) : "";

            // 3. For Pile / PL component code:
            // First get the Platform Face value (checked above), if null check component Face value, if null check start and end leg names
            const isPile = compCode === "PL" || compCode === "PILE" || qid.startsWith("PL") || qid.startsWith("PILE");
            if (isPile) {
                if (compFace && String(compFace).trim() && String(compFace).trim() !== "-" && String(compFace).trim().toUpperCase() !== "N/A") {
                    return formatFaceName(String(compFace));
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
                return "Piles";
            }

            // 2. For HM (Horizontal Member) or HD (Horizontal Diagonal) or other framing members:
            // Fetch from component face value
            if (compFace && String(compFace).trim() && String(compFace).trim() !== "-" && String(compFace).trim().toUpperCase() !== "N/A") {
                return formatFaceName(String(compFace));
            }

            // If component face is missing, use start and end leg names to group the face
            if (sLegClean && fLegClean && sLegClean !== fLegClean) {
                return `Face ${sLegClean}-${fLegClean}`;
            } else if (sLegClean) {
                return `Face Leg ${sLegClean}`;
            } else if (fLegClean) {
                return `Face Leg ${fLegClean}`;
            } else if (pileLegClean) {
                return `Face Leg ${pileLegClean}`;
            }

            // Check scour_location for leg info (e.g. "Location: Leg : A1")
            const scourLoc = d.scour_location || "";
            if (scourLoc) {
                const legMatch = scourLoc.match(/leg\s*[:\- ]*\s*([a-zA-Z0-9]+)/i);
                if (legMatch && legMatch[1]) {
                    return `Face Leg ${legMatch[1].toUpperCase()}`;
                }
            }

            // Check if QID has nodes (e.g. HOM N56-N61)
            const nodeMatch = qid.match(/N?(\d{1,5})[\-_/]+N?(\d{1,5})/i);
            if (nodeMatch) {
                return `Face N${nodeMatch[1]}-N${nodeMatch[2]}`;
            }

            return "General / Unassigned Face";
        };

        const isPF = config.printFriendly;

        // ── Helper to build each table row ──────────────────────────────────────
        const buildRow = (r: any, idx: number): string[] => {
            const d   = r.inspection_data || r.inspection_dat || {};
            const qid = r.structure_components?.q_id || r.component?.q_id || r.qid || "N/A";
            const rawElev = r.elevation ?? d.elevation ?? null;
            let elevationStr = "—";
            if (rawElev !== null && rawElev !== undefined && String(rawElev).trim() !== "" && String(rawElev).trim() !== "—") {
                const elevNum = parseFloat(rawElev);
                elevationStr = !isNaN(elevNum) ? `${elevNum.toFixed(2)} m` : `${rawElev} m`;
            }

            const diveNo =
                r.insp_rov_jobs?.job_no  || r.insp_rov_jobs?.name  ||
                r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.name ||
                r.rov_job_id || r.dive_job_id || r.dive_no || "—";

            const tapeNo = r.insp_video_tapes?.tape_no || d.tape_no || r.tape_id || r.tape_no || "—";

            const findingsParts: string[] = [];

            // 1. Scour primary fields
            const scourDetails: string[] = [];
            if (d.scour_location && String(d.scour_location).trim()) {
                scourDetails.push(`Location: ${d.scour_location}`);
            }

            if (d.scour_depth !== undefined && d.scour_depth !== null && String(d.scour_depth).trim() !== "") {
                const unit = d.scour_depth_unit || "mm";
                scourDetails.push(`Scour Depth: ${d.scour_depth} ${unit}`);
            }

            if (d.Exposed_pile !== undefined && d.Exposed_pile !== null && String(d.Exposed_pile).trim() !== "") {
                const isExposed = d.Exposed_pile === true || d.Exposed_pile === "Yes" || d.Exposed_pile === "true" || d.Exposed_pile === 1;
                scourDetails.push(`Exposed Pile: ${isExposed ? "Yes" : "No"}`);
            }

            if (d.Burial_percent !== undefined && d.Burial_percent !== null && String(d.Burial_percent).trim() !== "") {
                scourDetails.push(`Burial: ${d.Burial_percent}%`);
            }

            if (scourDetails.length > 0) {
                findingsParts.push(scourDetails.join(", "));
            }

            // 2. Observations / Remarks / Description
            const mainDesc = (r.description || d.comments || d.remarks || d.findings || d.observation || "").trim();
            if (mainDesc) {
                findingsParts.push(mainDesc);
            }

            // 3. Additional CP readings postfix
            const cpReadingsList: string[] = [];
            if (d.cp_rdg !== undefined && d.cp_rdg !== null && String(d.cp_rdg).trim() !== "") {
                cpReadingsList.push(`Primary CP: ${d.cp_rdg} mV`);
            } else if (d.cp !== undefined && d.cp !== null && String(d.cp).trim() !== "") {
                cpReadingsList.push(`CP: ${d.cp} mV`);
            }

            const rawAddCP = d.cp_rdg_additional || d.cp_additional || d.cp_readings || d.additional_cp || [];
            if (Array.isArray(rawAddCP) && rawAddCP.length > 0) {
                const extraCps = rawAddCP.map((c: any) => {
                    if (typeof c === "object" && c !== null) {
                        const lbl = c.location || c.label || c.pos || "";
                        const val = c.value ?? c.val ?? c.reading ?? "";
                        return lbl ? `${lbl}: ${val} mV` : `${val} mV`;
                    }
                    return `${c} mV`;
                }).filter(Boolean);
                if (extraCps.length > 0) {
                    cpReadingsList.push(`Additional CP: [${extraCps.join(", ")}]`);
                }
            } else if (typeof rawAddCP === "string" && rawAddCP.trim().length > 0) {
                cpReadingsList.push(`Additional CP: ${rawAddCP.trim()}`);
            }

            if (cpReadingsList.length > 0) {
                findingsParts.push(cpReadingsList.join(" | "));
            }

            // 4. Additional UT readings postfix
            const utReadingsList: string[] = [];
            const primaryUT = d.ut_rdg ?? d.ut_wall_thickness ?? d.ut_thickness ?? d.ut ?? null;
            if (primaryUT !== null && primaryUT !== undefined && String(primaryUT).trim() !== "") {
                utReadingsList.push(`Primary UT: ${primaryUT} mm`);
            }

            const rawAddUT = d.ut_readings_additional || d.ut_additional || d.ut_readings || d.additional_ut || [];
            if (Array.isArray(rawAddUT) && rawAddUT.length > 0) {
                const extraUts = rawAddUT.map((u: any) => {
                    if (typeof u === "object" && u !== null) {
                        const lbl = u.location || u.label || u.pos || "";
                        const val = u.value ?? u.val ?? u.reading ?? "";
                        return lbl ? `${lbl}: ${val} mm` : `${val} mm`;
                    }
                    return `${u} mm`;
                }).filter(Boolean);
                if (extraUts.length > 0) {
                    utReadingsList.push(`Additional UT: [${extraUts.join(", ")}]`);
                }
            } else if (typeof rawAddUT === "string" && rawAddUT.trim().length > 0) {
                utReadingsList.push(`Additional UT: ${rawAddUT.trim()}`);
            }

            if (utReadingsList.length > 0) {
                findingsParts.push(utReadingsList.join(" | "));
            }

            // 5. Anomaly or Finding Reference No.
            const linkedAnom = r.insp_anomalies?.[0] ?? null;
            const anomRef = linkedAnom?.anomaly_ref_no || r.anomaly_ref_no || d.anomaly_ref_no || "";
            const findingRef = linkedAnom?.finding_ref_no || r.finding_ref_no || d.finding_ref_no || "";

            if (anomRef) {
                findingsParts.push(`Anomaly Ref: ${anomRef}`);
            } else if (findingRef) {
                findingsParts.push(`Finding Ref: ${findingRef}`);
            }

            // 6. Rectified comments if rectified
            const isRectified = linkedAnom?.is_rectified || r.rectified || d.is_rectified || false;
            if (isRectified) {
                const rectRem = linkedAnom?.rectified_remarks || r.rectified_comments || d.rectified_remarks || "Rectified";
                findingsParts.push(`Rectified Comments: ${rectRem}`);
            }

            return [
                String(idx),
                qid,
                elevationStr,
                String(diveNo),
                String(tapeNo),
                findingsParts.length > 0 ? findingsParts.join("\n") : "—",
            ];
        };

        // ── Draw first page ─────────────────────────────────────────────────────
        drawPageHeader(doc);
        const startY = drawContextRow(doc, margin + HEADER_H + 2);

        // ── Generate Grouped Body Data ──────────────────────────────────────────
        let tableBody: any[] = [];
        if (isBlank) {
            // Render 14 blank rows with empty fields for field recording
            tableBody = Array.from({ length: 14 }, (_, i) => [
                String(i + 1),
                "",
                "",
                "",
                "",
                ""
            ]);
        } else {
            // Group records by resolved Face
            const faceGroups = new Map<string, any[]>();
            records.forEach(r => {
                const faceKey = resolveRecordFace(r);
                if (!faceGroups.has(faceKey)) {
                    faceGroups.set(faceKey, []);
                }
                faceGroups.get(faceKey)!.push(r);
            });

            // Natural sort of face names
            const sortedFaces = Array.from(faceGroups.keys()).sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
            );

            let globalItemIndex = 1;
            sortedFaces.forEach(faceName => {
                const groupRecords = faceGroups.get(faceName) || [];
                // Sort records within group by QID, then Elevation Ascending
                const sortedGroupRecords = [...groupRecords].sort((a, b) => {
                    const qidA = (a.structure_components?.q_id || a.component?.q_id || a.qid || "").toUpperCase();
                    const qidB = (b.structure_components?.q_id || b.component?.q_id || b.qid || "").toUpperCase();
                    if (qidA !== qidB) return qidA.localeCompare(qidB, undefined, { numeric: true, sensitivity: "base" });

                    const elA = parseFloat(a.elevation ?? a.inspection_data?.elevation ?? 0) || 0;
                    const elB = parseFloat(b.elevation ?? b.inspection_data?.elevation ?? 0) || 0;
                    return elA - elB;
                });

                // Add Face group header row
                const groupHeaderRow: any = [
                    {
                        content: `${faceName.toUpperCase()}`,
                        colSpan: 6,
                        styles: {
                            fillColor: isPF ? [240, 244, 248] : [225, 235, 245],
                            textColor: colors.navy,
                            fontStyle: "bold",
                            fontSize: 8,
                            halign: "left",
                            valign: "middle",
                            minCellHeight: 6.5,
                            cellPadding: { top: 2, bottom: 2, left: 4, right: 4 },
                            lineColor: colors.border,
                            lineWidth: 0.1,
                        },
                    },
                ];
                groupHeaderRow._isHeader = true;
                tableBody.push(groupHeaderRow);

                sortedGroupRecords.forEach(r => {
                    const row = buildRow(r, globalItemIndex++);
                    (row as any)._record = r;
                    tableBody.push(row);
                });
            });
        }

        // ── Main table ──────────────────────────────────────────────────────────
        autoTable(doc, {
            startY,
            head: [[
                { content: "Item No.",        styles: { halign: "center", valign: "middle" } },
                { content: "Component QID",   styles: { halign: "center", valign: "middle" } },
                { content: "Elevation (m)",   styles: { halign: "center", valign: "middle" } },
                { content: "Dive No.",        styles: { halign: "center", valign: "middle" } },
                { content: "Tape No.",        styles: { halign: "center", valign: "middle" } },
                { content: "Findings",        styles: { halign: "center", valign: "middle" } },
            ]],
            body: tableBody,
            theme: "grid",
            headStyles: {
                fillColor: isPF ? [255, 255, 255] : colors.navy,
                textColor: isPF ? colors.navy : [255, 255, 255],
                fontSize: 8,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
                minCellHeight: 9,
                lineColor: colors.border,
                lineWidth: 0.1,
            },
            styles: {
                fontSize: 7.5,
                cellPadding: 2.5,
                textColor: colors.text,
                lineColor: colors.border,
                overflow: "linebreak",
                minCellHeight: isBlank ? 8 : 6,
            },
            margin: { 
                top: margin + HEADER_H + 4, 
                left: margin, 
                right: margin, 
                bottom: config.showSignatures !== false ? 36 : 14 
            },
            columnStyles: {
                0: { cellWidth: 15, halign: "center" },
                1: { cellWidth: 32 },
                2: { cellWidth: 22, halign: "center" },
                3: { cellWidth: 22, halign: "center" },
                4: { cellWidth: 22, halign: "center" },
                5: { cellWidth: "auto" },
            },
            didParseCell: (data) => {
                if (isBlank || data.section !== "body") return;
                const rawRow = data.row.raw as any;
                if (rawRow && rawRow._isHeader) return;
                const r = rawRow?._record;
                if (!r) return;

                const linkedAnom = r.insp_anomalies?.[0] ?? null;
                const metaStatus = (r.inspection_data?._meta_status || "").toLowerCase();
                const isFinding  = metaStatus === "finding" || !!r.finding_ref_no;
                const isAnom     = (r.has_anomaly || !!linkedAnom || !!r.anomaly_ref_no) && !isFinding;
                const isRect     = linkedAnom?.is_rectified || r.rectified || false;

                if (data.column.index === 5) {
                    if (isFinding) {
                        data.cell.styles.textColor = colors.finding;
                        data.cell.styles.fontStyle  = "bold";
                    } else if (isAnom) {
                        data.cell.styles.textColor = colors.anomaly;
                        data.cell.styles.fontStyle  = "bold";
                    } else if (isRect) {
                        data.cell.styles.textColor = colors.rectified;
                        data.cell.styles.fontStyle  = "bold";
                    }
                }
            },
            didDrawPage: (data) => {
                if (data.pageNumber > 1) drawPageHeader(doc);
            },
        });

        // ── Signatory block at footer ───────────────────────────────────────────
        const sigY = pageHeight - 34;
        if (config.showSignatures !== false) {
            const sigW = contentWidth / 3;

            const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy);
                doc.setLineWidth(0.1);
                doc.rect(lx, sigY, sigW - 4, 18);
                if (!isPF) {
                    doc.setFillColor(...colors.navy);
                    doc.rect(lx, sigY, sigW - 4, 4.5, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(7);
                doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.5);
                doc.setTextColor(...colors.text);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6.5);
                doc.text("Name:", lx + 2, sigY + 10);
                if (person?.name) doc.text(person.name, lx + 14, sigY + 10);
                doc.text("Date:", lx + 2, sigY + 13.5);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 13.5);
                doc.text("Signature:", lx + 2, sigY + 17);
            };

            drawSig("PREPARED BY", margin, config?.preparedBy);
            drawSig("REVIEWED BY", margin + sigW, config?.reviewedBy);
            drawSig("APPROVED BY", margin + (sigW * 2), config?.approvedBy);
        }

        const totalPages = doc.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...colors.text);
            doc.setDrawColor(...colors.border);
            doc.setLineWidth(0.2);
            doc.line(margin, pageHeight - 9, margin + contentWidth, pageHeight - 9);
            doc.text(
                `${companySettings.company_name || "NasQuest Resources Sdn Bhd"}  |  Scour Survey Report (ROV)  |  SOW: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`,
                margin, pageHeight - 6
            );
            if (config.showPageNumbers !== false) {
                doc.text(`Page ${j} of ${totalPages}`, margin + contentWidth, pageHeight - 6, { align: "right" });
            }
        }

        applyWatermarkAndSignaturesGlobal(doc, { ...config, sigY });
        if (config.returnBlob) return doc.output("blob");

        const filename = `ROV_Scour_Survey_Report_${(config?.reportNoPrefix || headerData?.sowReportNo) || "NOSO"}_${format(new Date(), "yyyyMMdd")}.pdf`;
        doc.save(filename);
        return null;
    } catch (err) {
        console.error("[ROV RSCOR Survey Report] Error:", err);
        throw err;
    }
};
