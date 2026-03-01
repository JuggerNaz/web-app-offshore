
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/utils/supabase/client";
import { CompanySettings, ReportConfig } from "./defect-anomaly-report";

const loadImage = (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0);

        try {
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;
            const width = img.width;
            const height = img.height;
            
            const isWhite = (i: number) => data[i] > 230 && data[i+1] > 230 && data[i+2] > 230 && data[i+3] > 0;
            
            const stack: {x: number, y: number}[] = [];
            const visited = new Uint8Array(width * height);
            
            const pushIfWhite = (x: number, y: number) => {
                if (x < 0 || x >= width || y < 0 || y >= height) return;
                const idx = y * width + x;
                if (!visited[idx]) {
                    const p = idx * 4;
                    if (isWhite(p)) {
                        visited[idx] = 1;
                        stack.push({x, y});
                    }
                }
            };
            
            for (let x = 0; x < width; x++) { pushIfWhite(x, 0); pushIfWhite(x, height - 1); }
            for (let y = 0; y < height; y++) { pushIfWhite(0, y); pushIfWhite(width - 1, y); }
            
            while (stack.length > 0) {
                const pt = stack.pop();
                if (!pt) continue;
                const {x, y} = pt;
                const p = (y * width + x) * 4;
                data[p + 3] = 0; 
                
                pushIfWhite(x + 1, y);
                pushIfWhite(x - 1, y);
                pushIfWhite(x, y + 1);
                pushIfWhite(x, y - 1);
            }
            
            // Edge smoothing
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const p = (y * width + x) * 4;
                    if (data[p + 3] !== 0) {
                        const hasTransparentNeighbor = 
                            data[((y)*width + x - 1)*4 + 3] === 0 ||
                            data[((y)*width + x + 1)*4 + 3] === 0 ||
                            data[((y - 1)*width + x)*4 + 3] === 0 ||
                            data[((y + 1)*width + x)*4 + 3] === 0;
                        if (hasTransparentNeighbor) {
                            const avgColor = (data[p] + data[p+1] + data[p+2]) / 3;
                            if (avgColor > 200) {
                                data[p+3] = Math.max(0, 255 - (avgColor - 180) * 3); 
                            }
                        }
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
        } catch(e) { console.error("Canvas transparency error", e); }

                resolve({ data: canvas.toDataURL("image/png"), width: img.width, height: img.height });
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
    });
};

const drawLogo = (doc: any, logo: any, maxW: number, maxH: number, x: number, y: number, alignX = 'left', alignY = 'center') => {
    if (!logo || !logo.data) return;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    let dx = x;
    let dy = y;
    if (alignX === 'right') dx = x + maxW - w;
    if (alignX === 'center') dx = x + (maxW - w) / 2;
    if (alignY === 'center') dy = y + (maxH - h) / 2;
    if (alignY === 'bottom') dy = y + maxH - h;
    doc.addImage(logo.data, 'PNG', dx, dy, w, h);
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
    let clientLogo: any = null;
    if (companySettings.logo_url) clientLogo = await loadImage(companySettings.logo_url);

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
            drawLogo(d, contractorLogo, logoSize, logoSize, sx + logoPadding, sy + logoPadding, 'left', 'center');
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
            drawLogo(d, clientLogo, logoSize, logoSize, pageWidth - margin - logoSize - logoPadding, sy + logoPadding, 'right', 'center');
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
