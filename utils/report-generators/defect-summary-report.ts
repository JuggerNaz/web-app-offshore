
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/utils/supabase/client";
import { CompanySettings, ReportConfig } from "./defect-anomaly-report";

// ─── Priority colour mapping ─────────────────────────────────────────────────
// colorMap: { [priorityLabelLower]: "R,G,B" } — loaded from DB at report time.
// Falls back to industry-standard palette when DB has no entry.
type ColorMap = Record<string, string>;

function priorityStyle(
    priority: string,
    colorMap: ColorMap = {},
    directColor?: string
): { bg: [number, number, number]; text: [number, number, number] } {
    const key = (priority || "").toLowerCase();

    // Try direct color from record first (if provided)
    let dbColor = directColor;

    // If no direct color, try from colorMap (library lookup)
    if (!dbColor) {
        dbColor = colorMap[key];
    }

    if (dbColor && dbColor.includes(",")) {
        const parts = dbColor.split(",").map((p) => parseInt(p.trim(), 10));
        if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
            const [r, g, b] = parts as [number, number, number];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            return { bg: [r, g, b], text: lum > 140 ? [0, 0, 0] : [255, 255, 255] };
        }
    }

    // Fallback: industry-standard palette
    if (key === "critical" || key === "c" || key === "priority 1") return { bg: [192, 0, 0], text: [255, 255, 255] };
    if (key === "high" || key === "h" || key === "priority 2") return { bg: [255, 102, 0], text: [255, 255, 255] };
    if (key === "medium" || key === "m" || key === "priority 3") return { bg: [255, 192, 0], text: [0, 0, 0] };
    if (key === "low" || key === "l" || key === "priority 4") return { bg: [146, 208, 80], text: [0, 0, 0] };
    if (key === "observation" || key === "o" || key === "priority 5") return { bg: [189, 215, 238], text: [0, 0, 0] };
    return { bg: [220, 220, 220], text: [0, 0, 0] };
}

// Priority sort order
const PRIORITY_ORDER: Record<string, number> = {
    critical: 1, c: 1, "priority 1": 1,
    high: 2, h: 2, "priority 2": 2,
    medium: 3, m: 3, "priority 3": 3,
    low: 4, l: 4, "priority 4": 4,
    observation: 5, o: 5, "priority 5": 5, "priority 6": 6,
    informational: 7,
};

function prioritySortKey(priority: string): number {
    return PRIORITY_ORDER[(priority || "").toLowerCase()] ?? 99;
}

// Format seconds as HH:MM:SS
function formatCounter(val: any): string {
    if (!val && val !== 0) return "";
    const n = Number(val);
    if (!isNaN(n) && n >= 0) {
        const h = Math.floor(n / 3600);
        const m = Math.floor((n % 3600) / 60);
        const s = Math.floor(n % 60);
        const pad = (x: number) => x.toString().padStart(2, "0");
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return String(val);
}

const loadImage = (url: string): Promise<string> =>
    new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width;
            c.height = img.height;
            const ctx = c.getContext("2d");
            if (ctx) { ctx.drawImage(img, 0, 0); resolve(c.toDataURL("image/jpeg")); }
            else resolve("");
        };
        img.onerror = () => resolve("");
    });

// ─── Main Generator ──────────────────────────────────────────────────────────
export const generateDefectSummaryReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    const supabase = createClient();

    // ── Fetch anomalies + DB priority colours ────────────────────────────────
    let anomalies: any[] = [];
    let priorityColorMap: ColorMap = {};
    try {
        let url = `/api/reports/defect-summary?`;
        if (jobPack?.id) url += `jobpack_id=${jobPack.id}&`;
        if (structure?.id) url += `structure_id=${structure.id}&`;
        if (sowReportNo) url += `sow_report_no=${encodeURIComponent(sowReportNo)}&`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.data) anomalies = json.data;
        if (json.priority_colors) priorityColorMap = json.priority_colors;

        console.log("[DefectSummary] priorityColorMap from DB:", priorityColorMap);
    } catch (e) {
        console.error("[DefectSummary] Error fetching data:", e);
    }

    // Sort by priority
    anomalies = [...anomalies].sort(
        (a, b) => prioritySortKey(a.priority) - prioritySortKey(b.priority)
    );

    // ── Logos ────────────────────────────────────────────────────────────────
    let clientLogo = "";
    if (companySettings.logo_url) clientLogo = await loadImage(companySettings.logo_url);

    let contractorLogo = "";
    let contractorName = "";
    if (config.showContractorLogo) {
        const contractorId = jobPack?.metadata?.contrac;
        if (contractorId) {
            try {
                const cid = String(contractorId);
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
                let q = supabase.from("u_lib_list").select("logo_url, lib_desc").eq("lib_code", "CONTR_NAM");
                q = isUUID ? q.or(`id.eq.${cid},lib_id.eq.${cid}`) : (q as any).eq("lib_id", cid);
                const { data } = await (q as any).maybeSingle();
                if (data?.logo_url) contractorLogo = await loadImage(data.logo_url);
                if (data?.lib_desc) contractorName = data.lib_desc;
            } catch (e) { console.error("Contractor logo error:", e); }
        }
    }

    // ── Layout ───────────────────────────────────────────────────────────────
    const doc = new jsPDF({ orientation: "landscape" }); // Landscape for wider table
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const headerH = 26;
    const logoSize = 17;
    const logoPadding = 3;
    const isPrintFriendly = config.printFriendly === true;
    const FOOTER_LINE_Y = pageHeight - 8;

    // ── Draw Header ──────────────────────────────────────────────────────────
    const drawHeader = (d: jsPDF) => {
        const sx = margin;
        const sy = margin;

        if (isPrintFriendly) {
            d.setDrawColor(180, 180, 180);
            d.setLineWidth(0.3);
            d.rect(sx, sy, contentWidth, headerH);
        } else {
            d.setFillColor(31, 55, 93);
            d.rect(sx, sy, contentWidth, headerH, "F");
        }

        // Left — Contractor logo + name
        if (contractorLogo) {
            d.addImage(contractorLogo, "JPEG", sx + logoPadding, sy + logoPadding, logoSize, logoSize);
        }
        if (contractorName) {
            d.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
            d.setFont("helvetica", "normal");
            d.setFontSize(5.5);
            const lines = d.splitTextToSize(contractorName, 38);
            d.text(lines, sx + logoPadding + logoSize / 2, sy + logoPadding + logoSize + 2.5, { align: "center" });
        }

        // Right — Client logo
        if (clientLogo) {
            d.addImage(clientLogo, "JPEG", pageWidth - margin - logoSize - logoPadding, sy + logoPadding, logoSize, logoSize);
        }

        // Centre text
        d.setTextColor(isPrintFriendly ? 31 : 255, isPrintFriendly ? 55 : 255, isPrintFriendly ? 93 : 255);
        d.setFont("helvetica", "bold");
        d.setFontSize(11);
        d.text((companySettings.company_name || "TANJUNG OFFSHORE").toUpperCase(), pageWidth / 2, sy + 8, { align: "center" });
        d.setFont("helvetica", "normal");
        d.setFontSize(8);
        d.text(companySettings.departmentName || "Engineering Department", pageWidth / 2, sy + 13, { align: "center" });
        d.setFont("helvetica", "bold");
        d.setFontSize(12);
        d.text("DEFECT SUMMARY REPORT", pageWidth / 2, sy + 21, { align: "center" });
        d.setTextColor(0, 0, 0);
    };

    // ── Draw Sub-Header info table ───────────────────────────────────────────
    const drawSubHeader = (d: jsPDF, startY: number) => {
        const field = structure?.field_name || structure?.str_name || "N/A";
        const installation = structure?.str_name || structure?.str_desc || "N/A";
        const reportNoDisplay = sowReportNo || jobPack?.metadata?.report_no || "N/A";
        let vessel = "N/A";
        if (jobPack?.metadata?.vessel_history && Array.isArray(jobPack.metadata.vessel_history) && jobPack.metadata.vessel_history.length > 0) {
            vessel = jobPack.metadata.vessel_history.map((v: any) => v.name || v).join(" / ");
        } else if (jobPack?.metadata?.vessel) {
            vessel = jobPack.metadata.vessel;
        }
        const projectDesc = jobPack?.name || "N/A";
        const printDate = new Date().toLocaleDateString("en-GB");

        const lw = 35;
        const vw = (contentWidth - lw * 3) / 3;

        const headSt = isPrintFriendly
            ? { fillColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [0, 0, 0] as [number, number, number] }
            : { fillColor: [229, 231, 235] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [0, 0, 0] as [number, number, number] };

        autoTable(d, {
            startY,
            head: [],
            body: [
                [
                    { content: "Project Description:", styles: headSt }, { content: projectDesc },
                    { content: "Report No.:", styles: headSt }, { content: reportNoDisplay },
                    { content: "Print Date:", styles: headSt }, { content: printDate }
                ],
                [
                    { content: "Field:", styles: headSt }, { content: field },
                    { content: "Installation:", styles: headSt }, { content: installation },
                    { content: "Vessel:", styles: headSt }, { content: vessel }
                ],
            ] as any,
            theme: "grid",
            styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: lw }, 1: { cellWidth: vw },
                2: { cellWidth: lw }, 3: { cellWidth: vw },
                4: { cellWidth: lw }, 5: { cellWidth: vw },
            },
            margin: { left: margin, right: margin },
        });

        return (d as any).lastAutoTable.finalY;
    };

    const drawLegend = (d: jsPDF, y: number) => {
        // Build legend entries ONLY from library items that exist in our map
        const libraryLevels = Object.keys(priorityColorMap)
            .sort((a, b) => prioritySortKey(a) - prioritySortKey(b))
            .map(k => ({
                label: k.charAt(0).toUpperCase() + k.slice(1),
                key: k
            }));

        const allLevels = [
            ...libraryLevels,
            { label: "Rectified (R)", key: "_rect" },
        ];

        let x = margin;
        const boxW = 26; // Slightly wider to fit names comfortably
        const boxH = 5;
        const yy = y + 3;

        d.setFontSize(6.5);
        d.setFont("helvetica", "bold");
        d.text("Priority Legend:", x, yy + 3.5);
        x += 24;

        allLevels.forEach((lv) => {
            if (lv.key === "_rect") {
                d.setFillColor(0, 176, 80);
                d.setTextColor(255, 255, 255);
            } else {
                const { bg, text } = priorityStyle(lv.key, priorityColorMap);
                d.setFillColor(...bg);
                d.setTextColor(...text);
            }
            d.rect(x, yy, boxW, boxH, "F");
            d.setDrawColor(100, 100, 100);
            d.setLineWidth(0.1);
            d.rect(x, yy, boxW, boxH);
            d.setFont("helvetica", "bold");
            d.setFontSize(6);
            d.text(lv.label, x + boxW / 2, yy + 3.5, { align: "center" });
            x += boxW + 3;
        });

        d.setTextColor(0, 0, 0);
        return yy + boxH + 4;
    };

    // ── Draw footer line ─────────────────────────────────────────────────────
    const drawFooter = (d: jsPDF, pageNum: number, totalPages: number) => {
        d.setDrawColor(180, 180, 180);
        d.setLineWidth(0.3);
        d.line(margin, FOOTER_LINE_Y, pageWidth - margin, FOOTER_LINE_Y);
        d.setFontSize(7);
        d.setFont("helvetica", "normal");
        d.setTextColor(100, 100, 100);
        d.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, FOOTER_LINE_Y + 3.5, { align: "center" });
        d.text(`Printed: ${new Date().toLocaleDateString("en-GB")}`, pageWidth - margin, FOOTER_LINE_Y + 3.5, { align: "right" });
        d.setTextColor(0, 0, 0);
    };

    // ── Empty state ──────────────────────────────────────────────────────────
    if (anomalies.length === 0) {
        drawHeader(doc);
        const subHeaderEndY = drawSubHeader(doc, margin + headerH + 6);
        const legendEndY = drawLegend(doc, subHeaderEndY + 2);

        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text("No defect / anomaly records found for the selected filters.", pageWidth / 2, legendEndY + 20, { align: "center" });

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            if (config.showPageNumbers) drawFooter(doc, i, totalPages);
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`${config.reportNoPrefix}_DefectSummary.pdf`);
        return;
    }

    // ── Build table rows ──────────────────────────────────────────────────────
    // Columns: # | Anomaly Ref | Tape No (Counter) | Defect Code | Defect Type | Priority | Inspection Findings
    const tableHead = [["#", "Anomaly Ref No.", "Recording\n(Counter)", "Defect Code", "Defect Type", "Priority", "Inspection Findings"]];

    const tableBody: any[][] = anomalies.map((rec: any, idx: number) => {
        const priority = rec.priority || "—";
        // Use rec.priority_color directly from the view for maximum accuracy (Pic 4 compatibility)
        // Fallback to priorityColorMap if needed.
        const { bg, text } = priorityStyle(priority, priorityColorMap, rec.priority_color);
        const isRectified = rec.is_rectified === true || rec.is_rectified === "true" || rec.rectified_remarks;

        // Tape no + counter
        const tapeNo = (rec.tape_no || "").trim();
        const counter = formatCounter(rec.video_ref);
        const tapeDisplay = tapeNo ? (counter ? `${tapeNo} (${counter})` : tapeNo) : (counter || "—");

        // Defect code and type (Swapped to match UI labels and DB storage logic)
        // Based on UI Save: defect_type_code = Defect Code, defect_category_code = Defect Type
        const defectCode = rec.defect_type || "—";
        const defectType = rec.category || "—";

        // Findings + optional rectification info
        // Prioritize anomaly description over general inspection remarks
        let findings = rec.description || rec.observations || "—";
        if (isRectified && rec.rectified_remarks) {
            findings += `\n\n✓ Rectified: ${rec.rectified_remarks}`;
        }

        // Ref no
        const ref = rec.display_ref_no || rec.ref_no || `#${idx + 1}`;

        // Priority cell with colour
        const priorityCell = {
            content: isRectified ? `${priority}\n✓ RECTIFIED` : priority,
            styles: {
                fillColor: isRectified ? [0, 176, 80] as [number, number, number] : bg,
                textColor: isRectified ? [255, 255, 255] as [number, number, number] : text,
                fontStyle: "bold" as const,
                halign: "center" as const,
                fontSize: 7,
            },
        };

        // Finding cell — coloured by priority
        const findingsCell = {
            content: findings,
            styles: {
                fillColor: isRectified
                    ? [229, 255, 229] as [number, number, number]
                    : (bg[0] === 220 && bg[1] === 220 ? [255, 255, 255] as [number, number, number] :
                        // Very light tint of priority colour
                        [
                            Math.min(255, bg[0] + Math.floor((255 - bg[0]) * 0.80)),
                            Math.min(255, bg[1] + Math.floor((255 - bg[1]) * 0.80)),
                            Math.min(255, bg[2] + Math.floor((255 - bg[2]) * 0.80)),
                        ] as [number, number, number]
                    ),
                textColor: [0, 0, 0] as [number, number, number],
                fontSize: 7,
            },
        };

        return [
            { content: String(idx + 1), styles: { halign: "center" as const, fontStyle: "bold" as const } },
            ref,
            tapeDisplay,
            defectCode,
            defectType,
            priorityCell,
            findingsCell,
        ];
    });

    // ── Column widths (landscape 297mm — 2×12mm margins = 273mm usable) ──────
    // # | Ref | Tape | DefType | DefCode | Priority | Findings
    const cw = {
        no: 8,
        ref: 28,
        tape: 30,
        defType: 35,
        defCode: 22,
        priority: 20,
        findings: contentWidth - 8 - 28 - 30 - 35 - 22 - 20, // ~130mm
    };

    // First page: draw header and sub-header, then table from there
    drawHeader(doc);
    const subHeaderEndY = drawSubHeader(doc, margin + headerH + 5);
    const legendEndY = drawLegend(doc, subHeaderEndY + 2);

    autoTable(doc, {
        startY: legendEndY + 2,
        head: tableHead,
        body: tableBody,
        theme: "grid",
        headStyles: {
            fillColor: isPrintFriendly ? [229, 231, 235] : [31, 55, 93],
            textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
            fontStyle: "bold",
            fontSize: 7.5,
            lineWidth: 0.2,
            lineColor: [0, 0, 0],
            halign: "center",
        },
        styles: {
            fontSize: 7.5,
            cellPadding: 2,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            valign: "top",
            overflow: "linebreak",
        },
        columnStyles: {
            0: { cellWidth: cw.no, halign: "center" },
            1: { cellWidth: cw.ref },
            2: { cellWidth: cw.tape },
            3: { cellWidth: cw.defType },
            4: { cellWidth: cw.defCode },
            5: { cellWidth: cw.priority, halign: "center" },
            6: { cellWidth: cw.findings },
        },
        margin: { left: margin, right: margin, top: margin + headerH + 5, bottom: 14 },
        didDrawPage: (data: any) => {
            // Re-draw header on every page after the first
            if (data.pageNumber > 1) {
                drawHeader(doc);
            }
        },
    });

    // ── Signatory footer on last page ─────────────────────────────────────────
    const signatoryH = 22;
    const signatoryY = pageHeight - margin - signatoryH - 10;
    const lastY = (doc as any).lastAutoTable.finalY + 4;

    if (lastY + signatoryH + 10 < pageHeight - margin) {
        // Fits on last page
        drawSignatories(doc, signatoryY, contentWidth, margin, config);
    } else {
        doc.addPage();
        drawHeader(doc);
        drawSignatories(doc, margin + headerH + 10, contentWidth, margin, config);
    }

    // ── Page numbers on all pages ────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        if (config.showPageNumbers) drawFooter(doc, i, totalPages);
    }

    if (config.returnBlob) return doc.output("blob");
    doc.save(`${config.reportNoPrefix}_DefectSummary.pdf`);
};

// ─── Signatories ─────────────────────────────────────────────────────────────
function drawSignatories(doc: jsPDF, y: number, contentWidth: number, margin: number, config: ReportConfig) {
    const colW = contentWidth / 3;
    const h = 22;
    const people = [
        { title: "Prepared By", name: config.preparedBy?.name, date: config.preparedBy?.date },
        { title: "Reviewed By", name: config.reviewedBy?.name, date: config.reviewedBy?.date },
        { title: "Approved By", name: config.approvedBy?.name, date: config.approvedBy?.date },
    ];

    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.setFontSize(8);

    people.forEach((p, i) => {
        const x = margin + i * colW;
        doc.rect(x, y, colW, h);
        doc.setFont("helvetica", "bold");
        doc.text(p.title, x + 2, y + 4);
        doc.setFont("helvetica", "normal");
        doc.text("Name:", x + 2, y + 9);
        if (p.name) doc.text(p.name, x + 13, y + 9);
        doc.text("Sign:", x + 2, y + 14);
        doc.text("Date:", x + 2, y + 19);
        if (p.date) doc.text(p.date, x + 13, y + 19);
    });
}
