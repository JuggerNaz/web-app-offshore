
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface CompanySettings {
    company_name: string;
    logo_url?: string;
    [key: string]: any;
}

export interface ReportConfig {
    reportNoPrefix: string;
    reportYear: string;
    preparedBy: { name: string; date: string };
    reviewedBy: { name: string; date: string };
    approvedBy: { name: string; date: string };
    watermark: { enabled: boolean; text: string; transparency: number };
    showContractorLogo: boolean;
    showPageNumbers: boolean;
    returnBlob?: boolean;
}

const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
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
                resolve(canvas.toDataURL("image/jpeg"));
            } else {
                reject(new Error("Canvas context is null"));
            }
        };
        img.onerror = (e) => resolve("");
    });
};

export const generateDefectAnomalyReport = async (
    jobPack: any,
    structure: any,
    sowReportNo: string,
    companySettings: CompanySettings,
    config: ReportConfig
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    const grayHeader: [number, number, number] = [229, 231, 235];

    let anomalies: any[] = [];
    try {
        const res = await fetch(`/api/reports/anomaly-report?jobpack_id=${jobPack.id}&sow_report_no=${sowReportNo}&structure_id=${structure.id}`);
        const json = await res.json();
        if (json.data) anomalies = json.data;
    } catch (e) {
        console.error("Error fetching anomaly data", e);
    }

    let clientLogo = "";
    if (companySettings.logo_url) {
        clientLogo = await loadImage(companySettings.logo_url);
    }

    const drawHeader = (doc: jsPDF, pageNo: number, totalPages: string | number = "X") => {
        const startX = margin;
        const startY = margin;
        const headerH = 25;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);

        doc.rect(startX, startY, contentWidth, headerH);

        const col1W = 35;
        const col3W = 50;
        const col2W = contentWidth - col1W - col3W;

        doc.line(startX + col1W, startY, startX + col1W, startY + headerH);
        doc.line(startX + col1W + col2W, startY, startX + col1W + col2W, startY + headerH);

        if (clientLogo) {
            try {
                const logoSize = 20;
                doc.addImage(clientLogo, "JPEG", startX + (col1W - logoSize) / 2, startY + (headerH - logoSize) / 2, logoSize, logoSize);
            } catch (e) { }
        } else {
            doc.setFillColor(200, 200, 200);
            doc.circle(startX + col1W / 2, startY + headerH / 2, 8, "F");
        }

        const cx = startX + col1W + col2W / 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);

        doc.text((companySettings.company_name || "TANJUNG OFFSHORE SERVICES SDN BHD").toUpperCase(), cx, startY + 8, { align: "center" });
        const textW = doc.getTextWidth((companySettings.company_name || "TANJUNG OFFSHORE SERVICES SDN BHD").toUpperCase());
        doc.line(cx - textW / 2, startY + 9, cx + textW / 2, startY + 9);

        doc.setFontSize(10);
        doc.text("Form Title: ", cx - 15, startY + 18, { align: "center" });
        doc.setFontSize(11);
        doc.text("ANOMALY REPORT", cx + 15, startY + 18, { align: "center" });

        const rowH = headerH / 3;
        doc.line(startX + col1W + col2W, startY + rowH, startX + contentWidth, startY + rowH);
        doc.line(startX + col1W + col2W, startY + 2 * rowH, startX + contentWidth, startY + 2 * rowH);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");

        doc.text("Revision: 0", startX + col1W + col2W + 2, startY + 6);
        doc.line(startX + col1W + col2W + 25, startY, startX + col1W + col2W + 25, startY + rowH);
        doc.text(`Page ${pageNo} of ${totalPages}`, startX + col1W + col2W + 27, startY + 6);

        doc.text(`Date: ${new Date().toLocaleDateString()}`, startX + col1W + col2W + 2, startY + rowH + 6);
        doc.text("Form No: 1", startX + col1W + col2W + 2, startY + 2 * rowH + 6);

        const footerH = 15;
        const fy = pageHeight - margin - footerH;

        doc.setLineWidth(0.5);
        doc.line(margin, fy, pageWidth - margin, fy);

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        const disclaimer = "This document and its content is the property of Tanjung Offshore Services Sdn Bhd. It shall not be revealed to any unauthorised person.\nIMPORTANT: NO CHANGES SHALL BE MADE WITHOUT THE PRIOR AUTHORISATION OF THE DOCUMENT CUSTODIAN";
        doc.text(disclaimer, pageWidth / 2, fy + 5, { align: "center", maxWidth: contentWidth });

        doc.rect(margin, margin, contentWidth, pageHeight - (margin * 2));
    };

    if (anomalies.length === 0) {
        drawHeader(doc, 1, 1);
        doc.setFontSize(12);
        doc.text("No anomalies found.", pageWidth / 2, 60, { align: "center" });
        if (config.returnBlob) return doc.output("blob");
        doc.save(`${config.reportNoPrefix}_AnomalyReport.pdf`);
        return;
    }

    let globalPage = 1;

    for (let i = 0; i < anomalies.length; i++) {
        const anomaly = anomalies[i];
        const record = anomaly; // View returns flattened data

        // Prioritize View columns
        const anomalyDetails = {
            ...anomaly,
            priority: anomaly.priority,
            display_ref_no: anomaly.display_ref_no,
            description: anomaly.description
        };

        if (i > 0) doc.addPage();

        drawHeader(doc, globalPage, "{total_pages_count_string}");

        const priority = anomalyDetails.priority || "Normal";
        let priorityColor = [255, 255, 255];

        if (priority === 'High' || priority === 'Critical' || priority === 'H') priorityColor = [249, 115, 22];
        else if (priority === 'Observation' || priority === 'O') priorityColor = [237, 125, 49];
        else if (priority === 'Medium' || priority === 'M') priorityColor = [253, 224, 71];

        // Map View Columns
        const vessel = record.main_vessel || record.dive_vessel || jobPack.metadata?.vessel || "N/A";

        const field = structure.field_name || "N/A";
        const install = structure.str_name || "N/A";
        const ref = anomalyDetails.display_ref_no || "N/A";
        const inspDate = record.inspection_date ? new Date(record.inspection_date).toLocaleDateString() : "N/A";

        // Recording Logic
        const tapeStr = record.tape_no ? `${record.tape_no} ` : "";
        const refStr = record.video_ref || "";
        const recording = (tapeStr + refStr).trim() || "N/A";
        // View 'video_ref' maps to 'tape_count_no'. 'tape_no' maps to 'insp_video_tapes.tape_no'. 
        // We prioritize tape_no if present? Or video_ref?
        // Report field is "DVD/Recording No.". Usually "Tape 1 00:01:23".
        // Let's combine if both? Or just use what we have.
        // Let's use video_ref (count) if available, possibly prefixed by tape_no?
        // Let's stick to: if video_ref (count) exists, use it. If tape_no exists, maybe append?
        // Simple: record.video_ref || record.tape_no || "N/A"

        let rovDiverVal = "N/A";
        let rovDiverLabel = "ROV/Diver:";

        if (record.diver_name) {
            rovDiverVal = record.diver_name;
            rovDiverLabel = "Diver:";
        } else if (record.rov_name) {
            rovDiverVal = record.rov_name;
            rovDiverLabel = "ROV:";
        } else if (record.deployment_no) {
            rovDiverVal = record.deployment_no;
            rovDiverLabel = "ROV Dep:";
        }

        const headStylesString = { fillColor: [229, 231, 235], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] };

        autoTable(doc, {
            startY: margin + 30,
            head: [],
            body: [
                [
                    { content: "Project Description:", styles: { ...headStylesString, cellWidth: 35 } },
                    { content: jobPack.name || "N/A", styles: { cellWidth: 60 } },
                    { content: "Priority:", styles: { ...headStylesString, cellWidth: 25 } },
                    { content: priority, styles: { fillColor: priorityColor, fontStyle: 'bold', halign: 'center' } }
                ],
                [
                    { content: "Field :", styles: headStylesString }, { content: field },
                    { content: "Installation:", styles: headStylesString }, { content: install }
                ],
                [
                    { content: "Anomaly Ref. No.:", styles: headStylesString }, { content: ref },
                    { content: "Report No.:", styles: headStylesString }, { content: sowReportNo }
                ],
                [
                    { content: "Date :", styles: headStylesString }, { content: inspDate },
                    { content: "Vessel :", styles: headStylesString }, { content: vessel }
                ],
                [
                    { content: "DVD/Recording No.:", styles: headStylesString }, { content: recording },
                    { content: rovDiverLabel, styles: headStylesString }, { content: rovDiverVal }
                ]
            ] as any,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
            margin: { left: margin, right: margin }
        });

        let lastY = (doc as any).lastAutoTable.finalY + 5;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Anomaly Description:", margin + 2, lastY + 5);
        lastY += 10;

        doc.setFont("helvetica", "bold");
        const defectTitle = anomalyDetails.defect_type || anomalyDetails.defect_type_code || "VARIATION TO SPECIFICATION";
        doc.text(defectTitle.toUpperCase(), margin + 2, lastY);
        const titleW = doc.getTextWidth(defectTitle.toUpperCase());
        doc.line(margin + 2, lastY + 1, margin + 2 + titleW, lastY + 1);
        lastY += 5;

        doc.setFont("helvetica", "normal");
        const desc = anomalyDetails.description || "No description provided.";
        const descLines = doc.splitTextToSize(desc, contentWidth - 4);
        doc.text(descLines, margin + 2, lastY);
        lastY += (descLines.length * 4) + 5;

        doc.setFontSize(8);
        doc.text("Refer to photo & sketch shown below for the finding.", margin + 2, lastY);
        lastY += 8;

        doc.line(margin, lastY, pageWidth - margin, lastY);
        lastY += 5;

        doc.setFontSize(9);
        doc.text("Photo/Video Capture/Sketch:", margin + 2, lastY);
        lastY += 5;

        const images = record.attachments || [];
        console.log(`[Report] Anomaly ${ref}: Found ${images.length} attachments.`);

        const imageUrls = await Promise.all(images.map((img: any) => {
            if (!img.path) return "";
            // Use bucket from DB record if available, else default to 'attachments'
            const bucket = img.bucket_id || "attachments";
            return `/api/attachment/download?path=${encodeURIComponent(img.path)}&bucket=${bucket}`;
        }));

        // Filter out empty URLs before loading
        const validUrls = imageUrls.filter(u => u.length > 0);
        const loadedImages = await Promise.all(validUrls.map(url => loadImage(url)));
        const validImages = loadedImages.filter(img => img.length > 0);

        if (validImages.length > 0) {
            const availableH = (pageHeight - margin - 15) - lastY - 10;

            for (let j = 0; j < validImages.length; j++) {
                if (j > 0) {
                    doc.addPage();
                    globalPage++;
                    drawHeader(doc, globalPage, "{total_pages_count_string}");
                    lastY = margin + 30 + 5;
                    doc.text("Photo/Video Capture/Sketch (Cont.):", margin + 2, lastY);
                    lastY += 5;
                }

                const imgW = contentWidth - 10;
                const imgH = Math.min(availableH, imgW * 0.75);

                doc.addImage(validImages[j], "JPEG", margin + 5, lastY, imgW, imgH);
                doc.setFontSize(8);

                const caption = validImages.length > 1 ? `Photo ${j + 1}: ${desc.substring(0, 50)}...` : `Photo 1: ${desc.substring(0, 100)}`;
                doc.text(caption, pageWidth / 2, lastY + imgH + 5, { align: "center" });
            }
        }
        globalPage++;
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        const contentW = pageWidth - 30;
        const col1 = 35;
        const col3 = 50;
        const col2 = contentW - col1 - col3;
        const cellX = 15 + col1 + col2;
        const cellY = 15;

        doc.setFillColor(255, 255, 255);
        doc.rect(cellX + 25, cellY + 1, 24, 6, "F");

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`Page ${i} of ${totalPages}`, cellX + 27, cellY + 6);
    }

    if (config.returnBlob) {
        return doc.output("blob");
    } else {
        doc.save(`${config.reportNoPrefix}_AnomalyReport.pdf`);
    }
};
