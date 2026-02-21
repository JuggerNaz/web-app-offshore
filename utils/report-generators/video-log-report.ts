
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/utils/supabase/client";
import { CompanySettings, ReportConfig } from "./defect-anomaly-report";

const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL("image/jpeg")); }
            else resolve("");
        };
        img.onerror = () => resolve("");
    });
};

// Friendly labels for video log event types
const EVENT_TYPE_LABELS: Record<string, string> = {
    START_TASK: "Start Task",
    STOP_TASK: "Stop Task",
    PAUSE_TASK: "Pause Task",
    RESUME_TASK: "Resume Task",
    INSPECTION: "Inspection",
    ANNOTATION: "Annotation",
    CHAPTER: "Chapter",
    NOTE: "Note",
    ANOMALY: "Anomaly Detected",
    SNAPSHOT: "Snapshot",
};

function friendlyEventType(eventType: string): string {
    return EVENT_TYPE_LABELS[eventType] ?? eventType?.replace(/_/g, " ") ?? "—";
}

export const generateVideoLogReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    const supabase = createClient();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // ── Fetch Data ──────────────────────────────────────────────────────────
    let tapes: any[] = [];
    try {
        let url = `/api/reports/video-log?`;
        if (jobPack?.id) url += `jobpack_id=${jobPack.id}&`;
        if (sowReportNo) url += `sow_report_no=${sowReportNo}&`;
        if (structure?.id) url += `structure_id=${structure.id}&`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.data) tapes = json.data;
    } catch (e) {
        console.error("Error fetching video log data", e);
    }

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
                q = isUUID ? q.or(`id.eq.${cid},lib_id.eq.${cid}`) : q.eq("lib_id", cid);
                const { data } = await q.maybeSingle();
                if (data?.logo_url) contractorLogo = await loadImage(data.logo_url);
                if (data?.lib_desc) contractorName = data.lib_desc;
            } catch (e) { console.error("Error fetching contractor logo", e); }
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

        if (contractorLogo) {
            d.addImage(contractorLogo, "JPEG", sx + logoPadding, sy + logoPadding, logoSize, logoSize);
        }
        if (contractorName) {
            d.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
            d.setFont("helvetica", "normal");
            d.setFontSize(6);
            const cx = sx + logoPadding + logoSize / 2;
            const nameLines = d.splitTextToSize(contractorName, 40);
            d.text(nameLines, cx, sy + logoPadding + logoSize + 3, { align: "center" });
        }
        if (clientLogo) {
            d.addImage(clientLogo, "JPEG", pageWidth - margin - logoSize - logoPadding, sy + logoPadding, logoSize, logoSize);
        }

        d.setTextColor(isPrintFriendly ? 31 : 255, isPrintFriendly ? 55 : 255, isPrintFriendly ? 93 : 255);
        d.setFont("helvetica", "bold");
        d.setFontSize(12);
        d.text((companySettings.company_name || "").toUpperCase(), pageWidth / 2, sy + 8, { align: "center" });

        d.setFont("helvetica", "normal");
        d.setFontSize(9);
        d.text(companySettings.departmentName || "Engineering Department", pageWidth / 2, sy + 12, { align: "center" });

        d.setFont("helvetica", "bold");
        d.setFontSize(13);
        d.text("VIDEO LOG REPORT", pageWidth / 2, sy + 20, { align: "center" });

        d.setTextColor(0, 0, 0);
    };

    // ── Summary Sub-Header ───────────────────────────────────────────────────
    const drawSubHeader = (d: jsPDF) => {
        const field = structure?.field_name || structure?.str_name || "N/A";
        const installation = structure?.str_name || structure?.str_desc || "N/A";
        const reportNoDisplay = sowReportNo || jobPack?.metadata?.report_no || "N/A";
        const vessel = jobPack?.metadata?.vessel || "N/A";
        const projectDesc = jobPack?.name || "N/A";

        const labelColWidth = 32;
        const valueColWidth = (contentWidth - labelColWidth * 2) / 2;

        const headStyle = isPrintFriendly
            ? { fillColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [0, 0, 0] as [number, number, number] }
            : { fillColor: [229, 231, 235] as [number, number, number], fontStyle: "bold" as const, lineWidth: 0.1, lineColor: [0, 0, 0] as [number, number, number] };

        autoTable(d, {
            startY: margin + headerH + 10,
            head: [],
            body: [
                [
                    { content: "Project Description:", styles: headStyle },
                    { content: projectDesc },
                    { content: "Report No.:", styles: headStyle },
                    { content: reportNoDisplay }
                ],
                [
                    { content: "Field:", styles: headStyle },
                    { content: field },
                    { content: "Installation:", styles: headStyle },
                    { content: installation }
                ],
                [
                    { content: "Vessel:", styles: headStyle },
                    { content: vessel },
                    { content: "", styles: headStyle },
                    { content: "" }
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
            margin: { left: margin, right: margin, top: margin + headerH + 5 }
        });
    };

    if (tapes.length === 0) {
        drawHeader(doc);
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("No video log records found.", pageWidth / 2, 80, { align: "center" });
        if (config.returnBlob) return doc.output("blob");
        doc.save(`${config.reportNoPrefix}_VideoLog.pdf`);
        return;
    }

    // ── First Page ───────────────────────────────────────────────────────────
    drawHeader(doc);
    drawSubHeader(doc);
    let currentY = (doc as any).lastAutoTable?.finalY + 8 ?? margin + headerH + 50;
    let isFirstPage = true;

    // ── Per-Tape Groups ──────────────────────────────────────────────────────
    // Sort tapes by tape_no ascending
    const sortedTapes = [...tapes].sort((a, b) => {
        const an = String(a.tape_no ?? "").toLowerCase();
        const bn = String(b.tape_no ?? "").toLowerCase();
        return an < bn ? -1 : an > bn ? 1 : 0;
    });

    for (let i = 0; i < sortedTapes.length; i++) {
        const tape = sortedTapes[i];
        const logs = tape.logs || [];

        // Ensure there is space for the section header + at least a few rows
        if (!isFirstPage && currentY > pageHeight - margin - FOOTER_Y_OFFSET - 30) {
            doc.addPage();
            drawHeader(doc);
            currentY = margin + headerH + 6;
        }

        // Tape section header bar
        const tapeLabel = `Tape No: ${tape.tape_no ?? `Tape #${tape.tape_id}`}`;
        const diveLabel = tape.dive_no ? `Dive No: ${tape.dive_no}` : "";
        const chapterLabel = tape.chapter_no ? `Chapter: ${tape.chapter_no}` : "";
        const headerParts = [tapeLabel, diveLabel, chapterLabel].filter(Boolean).join("   |   ");

        if (isPrintFriendly) {
            doc.setFillColor(240, 240, 240);
        } else {
            doc.setFillColor(52, 86, 139);
        }
        doc.rect(margin, currentY, contentWidth, 7, "F");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
        doc.text(headerParts, margin + 3, currentY + 5);
        doc.setTextColor(0, 0, 0);
        currentY += 8;

        // Log rows
        const tableBody: any[][] = [];

        if (logs.length === 0) {
            tableBody.push([{ content: "No log entries for this tape.", colSpan: 4, styles: { halign: "center", textColor: [100, 100, 100] } }]);
        } else {
            logs.forEach((log: any, idx: number) => {
                const eventDateTime = log.event_time
                    ? new Date(log.event_time).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—";

                const timecode = log.timecode_start || "—";
                const action = friendlyEventType(log.event_type);
                const remarks = log.remarks || "";

                tableBody.push([
                    String(idx + 1),
                    tape.dive_no ?? "—",
                    `${action}${remarks ? `\n${remarks}` : ""}`,
                    timecode,
                    eventDateTime
                ]);
            });
        }

        autoTable(doc, {
            startY: currentY,
            head: [["#", "Dive No", "Action / Remarks", "Timecode", "Date & Time"]],
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
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 20, halign: "center" },
                2: { cellWidth: contentWidth - 10 - 20 - 28 - 36 },
                3: { cellWidth: 28, halign: "center" },
                4: { cellWidth: 36, halign: "center" }
            },
            margin: { left: margin, right: margin, top: margin + headerH + 6 },
            didDrawPage: (data: any) => {
                if (data.pageNumber > 1 || !isFirstPage) {
                    drawHeader(doc);
                }
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
        isFirstPage = false;
    }

    // ── Footer on every page ─────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    const printedDateStr = `Printed: ${new Date().toLocaleDateString("en-GB")}`;

    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");

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
    doc.save(`${config.reportNoPrefix}_VideoLog.pdf`);
};
