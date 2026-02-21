
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { createClient } from "@/utils/supabase/client";

export interface CompanySettings {
    company_name: string;
    logo_url?: string;
    departmentName?: string;
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
    inspectionId?: number;
    printFriendly?: boolean;
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
    const supabase = createClient();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    let anomalies: any[] = [];
    try {
        let url = `/api/reports/anomaly-report?`;

        if (jobPack?.id) url += `jobpack_id=${jobPack.id}&`;
        if (sowReportNo) url += `sow_report_no=${sowReportNo}&`;
        if (structure?.id) url += `structure_id=${structure.id}&`;
        if (config.inspectionId) url += `inspection_id=${config.inspectionId}&`;

        const res = await fetch(url);
        const json = await res.json();
        if (json.data) anomalies = json.data;
    } catch (e) {
        console.error("Error fetching anomaly data", e);
    }

    // Load Client Logo (Right Side)
    let clientLogo = "";
    if (companySettings.logo_url) {
        clientLogo = await loadImage(companySettings.logo_url);
    }

    // Load Contractor Logo (Left Side)
    let contractorLogo = "";
    let contractorName = "";

    if (config.showContractorLogo) {
        // 1. Try to get from View Data Details first (Efficient)
        if (anomalies.length > 0) {
            const first = anomalies[0];
            if (first.contractor_name) contractorName = first.contractor_name;

            if (first.logo_url) {
                try {
                    const loaded = await loadImage(first.logo_url);
                    if (loaded) contractorLogo = loaded;
                } catch (e) {
                    console.warn("Failed to load logo from view url", e);
                }
            }
        }

        // 2. Fallback: Fetch manually if missing (e.g. no anomalies or view missing data)
        if (!contractorName || !contractorLogo) {
            // Ensure JobPack metadata is available (fetch if missing)
            if (!jobPack.metadata || !jobPack.metadata.contrac) {
                if (jobPack.id) {
                    try {
                        const { data: jpData } = await supabase.from('jobpack').select('metadata').eq('id', jobPack.id).single();
                        if (jpData) {
                            if (!jobPack.metadata) jobPack.metadata = {};
                            jobPack.metadata = { ...jobPack.metadata, ...jpData.metadata };
                        }
                    } catch (e) { console.error("Error fetching jobpack metadata", e); }
                }
            }

            // 'contrac' in metadata usually holds the library ID
            // Fallback to 'contractor_ref' from view if 'contrac' missing
            const contractorId = jobPack.metadata?.contrac ||
                (anomalies.length > 0 ? (anomalies[0].contractor_id || anomalies[0].contractor_ref) : null);

            if (contractorId) {
                try {
                    // Fetch logo_url and description (name) from u_lib_list
                    const cid = String(contractorId);
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);

                    let query = supabase
                        .from('u_lib_list')
                        .select('logo_url, lib_desc')
                        .eq('lib_code', 'CONTR_NAM');

                    if (isUUID) {
                        query = query.or(`id.eq.${cid},lib_id.eq.${cid}`);
                    } else {
                        // For non-UUIDs (like 'AMSB'), query lib_id only to avoid type errors on 'id' column
                        query = query.eq('lib_id', cid);
                    }

                    const { data } = await query.maybeSingle();

                    if (data) {
                        if (data.logo_url && !contractorLogo) contractorLogo = await loadImage(data.logo_url);
                        if (data.lib_desc && !contractorName) contractorName = data.lib_desc;
                    }
                } catch (e) {
                    console.error("Error fetching contractor logo", e);
                }
            }
        }
    }

    // Header Dimensions
    const headerH = 28; // Reduced Height
    const logoSize = 18; // Reduced Logo Size
    const logoPadding = 4;

    const isPrintFriendly = config.printFriendly === true;

    const drawHeader = (doc: jsPDF) => {
        const startX = margin;
        const startY = margin;

        if (isPrintFriendly) {
            // Print-Friendly: White background with light border (matches table lines)
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.rect(startX, startY, contentWidth, headerH);
        } else {
            // Screen/Color: Dark Blue Filled Background
            doc.setFillColor(31, 55, 93); // Dark Blue #1f375d
            doc.rect(startX, startY, contentWidth, headerH, "F");
        }

        // --- Left Side: Contractor Logo + Name ---
        const logoX = startX + logoPadding;
        const logoCenterX = logoX + (logoSize / 2);

        if (contractorLogo) {
            doc.addImage(contractorLogo, "JPEG", logoX, startY + logoPadding, logoSize, logoSize);
        }

        if (contractorName) {
            doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6); // Smaller font

            const textY = startY + logoPadding + logoSize + 3;
            const maxNameWidth = 40;
            const nameLines = doc.splitTextToSize(contractorName, maxNameWidth);
            doc.text(nameLines, logoCenterX, textY, { align: "center" });
        }

        // --- Right Side: Client Logo ---
        if (clientLogo) {
            doc.addImage(clientLogo, "JPEG", pageWidth - margin - logoSize - logoPadding, startY + logoPadding, logoSize, logoSize);
        }

        // --- Center: Text ---
        // Print-Friendly: Dark text on white. Normal: White text on dark blue.
        doc.setTextColor(isPrintFriendly ? 31 : 255, isPrintFriendly ? 55 : 255, isPrintFriendly ? 93 : 255);

        // Company Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        const companyName = (companySettings.company_name || "TANJUNG OFFSHORE SERVICES SDN BHD").toUpperCase();
        doc.text(companyName, pageWidth / 2, startY + 8, { align: "center" });

        // Department
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        const deptName = companySettings.departmentName || "Engineering Department";
        doc.text(deptName, pageWidth / 2, startY + 12, { align: "center" });

        // Report Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("DEFECT / ANOMALY REPORT", pageWidth / 2, startY + 20, { align: "center" });

        // Reset Text Color
        doc.setTextColor(0, 0, 0);
    };

    if (anomalies.length === 0) {
        drawHeader(doc);
        doc.setFontSize(12);
        doc.text("No anomalies found.", pageWidth / 2, 80, { align: "center" });
        if (config.returnBlob) return doc.output("blob");
        doc.save(`${config.reportNoPrefix}_AnomalyReport.pdf`);
        return;
    }

    let globalPage = 1;
    const anomalyPageRanges: { start: number; end: number }[] = [];

    for (let i = 0; i < anomalies.length; i++) {
        const anomaly = anomalies[i];
        const record = anomaly;

        const anomalyDetails = {
            ...anomaly,
            priority: anomaly.priority,
            display_ref_no: anomaly.display_ref_no,
            description: anomaly.description
        };

        if (i > 0) doc.addPage();

        const startPage = doc.getNumberOfPages();

        drawHeader(doc);

        const priority = anomalyDetails.priority || "Normal";
        let priorityColor: any = [255, 255, 255]; // Default white

        // Check if DB provides a color (e.g. from u_lib_combo ANMLYCLR)
        const dbColor = (record as any).priority_color;
        if (dbColor && typeof dbColor === 'string') {
            // Handle "R,G,B" format (e.g. "255, 0, 0")
            if (dbColor.includes(',')) {
                const parts = dbColor.split(',').map(p => parseInt(p.trim()));
                if (parts.length === 3 && parts.every(n => !isNaN(n))) {
                    priorityColor = parts;
                }
            }
            // Handle Hex
            else if (dbColor.startsWith('#')) {
                priorityColor = dbColor;
            }
            // Handle named colors? (Not standard in RGB array requirement for pdf-autotable unless using hex)
            else {
                priorityColor = dbColor;
            }
        } else {
            // Fallback to hardcoded defaults
            if (priority === 'High' || priority === 'Critical' || priority === 'H') priorityColor = [249, 115, 22]; // Orange
            else if (priority === 'Observation' || priority === 'O') priorityColor = [237, 125, 49];
            else if (priority === 'Medium' || priority === 'M') priorityColor = [253, 224, 71]; // Yellow
        }

        // Determine vessel 
        // If jobpack metadata provides multiple vessels (comma separated), they should be displayed.
        // We prioritize explicit anomaly vessel if present, otherwise jobpack vessel.
        let vessel = record.main_vessel || record.dive_vessel || jobPack.metadata?.vessel || "N/A";

        // Field/Install
        // Field/Install
        const field = record.field_name || structure.field_name || "N/A";
        const install = record.structure_name || structure.str_name || "N/A";
        const ref = anomalyDetails.display_ref_no || "N/A";
        // Report No resolution
        // Check record first, then jobPack metadata, then fallback
        const reportNoDisplay = record.sow_report_no || (jobPack.metadata && jobPack.metadata.report_no) || "N/A";
        // Format date to show time if needed? Usually just date.
        const inspDate = record.inspection_date ? new Date(record.inspection_date).toLocaleDateString("en-GB") : "N/A";

        // Format video_ref (tape_count_no) as time if it's a number (seconds -> HH:MM:SS)
        let videoRefTime = record.video_ref || "";
        if (videoRefTime && !isNaN(Number(videoRefTime))) {
            const totalSeconds = Number(videoRefTime);
            if (totalSeconds >= 0) {
                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = Math.floor(totalSeconds % 60);

                const pad = (n: number) => n.toString().padStart(2, '0');
                videoRefTime = `${pad(h)}:${pad(m)}:${pad(s)}`;
            }
        }

        // Display format: TapeNo (Time)
        let recording = (record.tape_no || "").trim();
        if (videoRefTime) {
            recording += ` (${videoRefTime})`;
        }
        recording = recording.trim() || "N/A";

        // Diver / ROV Logic
        let rovDiverVal = "N/A";
        let rovDiverLabel = "ROV/Diver:";

        if (record.diver_name) {
            rovDiverVal = record.diver_name;
            rovDiverLabel = "Diver:";
        } else if (record.rov_name || record.rov_machine) {
            // ROV Job: ROV Name and Pilot Name
            const machine = record.rov_machine || "ROV";
            const pilot = record.rov_name || "Unknown";
            rovDiverVal = `${machine} / ${pilot}`; // "ROV Name / Pilot Name"
            rovDiverLabel = "ROV / Pilot:";
        } else if (record.deployment_no) {
            rovDiverVal = record.deployment_no;
            rovDiverLabel = "ROV Dep:";
        }

        const headStylesString = isPrintFriendly
            ? { fillColor: [255, 255, 255], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] }
            : { fillColor: [229, 231, 235], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] };


        // Component & Elevation Vals
        const compVal = record.component_qid || "";
        let elevVal = "";
        let elevLabel = "Elevation:";

        // Check if DB provides unit or assume meters
        const unit = "m"; // Default unit

        if (record.elevation) {
            const el = Number(record.elevation);
            if (!isNaN(el)) {
                if (el < 0) elevVal = `(-) ${Math.abs(el)}${unit}`;
                else elevVal = `(+) ${el}${unit}`;
            } else {
                elevVal = `${record.elevation}`;
            }
        } else if (record.fp_kp) {
            elevLabel = "KP:";
            elevVal = `${record.fp_kp}`;
        } else {
            elevVal = "N/A";
        }

        // Details table with consistent column widths
        const labelColWidth = 32;
        const valueColWidth = (contentWidth - (labelColWidth * 2)) / 2;

        autoTable(doc, {
            startY: margin + headerH + 10,
            head: [],
            body: [
                [
                    { content: "Project Description:", styles: headStylesString },
                    { content: record.jobpack_name || jobPack.name || "N/A" },
                    { content: "Priority:", styles: headStylesString },
                    { content: priority, styles: { fillColor: priorityColor, fontStyle: 'bold', halign: 'center' } }
                ],
                [
                    { content: "Field :", styles: headStylesString }, { content: field },
                    { content: "Installation:", styles: headStylesString }, { content: install }
                ],
                [
                    { content: "Anomaly Ref. No.:", styles: headStylesString }, { content: ref },
                    { content: "Report No.:", styles: headStylesString }, { content: reportNoDisplay }
                ],
                [
                    { content: "Date :", styles: headStylesString }, { content: inspDate },
                    { content: "Vessel :", styles: headStylesString }, { content: vessel }
                ],
                [
                    { content: "DVD/Recording No.:", styles: headStylesString }, { content: recording },
                    { content: rovDiverLabel, styles: headStylesString }, { content: rovDiverVal }
                ],
                [
                    { content: "Component:", styles: headStylesString }, { content: compVal },
                    { content: elevLabel, styles: headStylesString }, { content: elevVal }
                ]
            ] as any,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
            columnStyles: {
                0: { cellWidth: labelColWidth },
                1: { cellWidth: valueColWidth },
                2: { cellWidth: labelColWidth },
                3: { cellWidth: valueColWidth }
            },
            margin: { left: margin, right: margin, top: margin + headerH + 5 }
        });

        let lastY = (doc as any).lastAutoTable.finalY + 5;

        // --- Anomaly Description Box ---
        // 1. Prepare Content
        const defectTitle = anomalyDetails.defect_type || anomalyDetails.defect_type_code || "VARIATION TO SPECIFICATION";

        // 2. Observations (Inspection Findings)
        const findings = record.observations ? `Inspection Findings: ${record.observations}` : "";

        // 3. Remarks (Original Defect Description)
        const defectDesc = anomalyDetails.description || "";

        // 4. Rectified Remarks (if any)
        const rectRemarks = anomalyDetails.rectified_remarks ? `Rectified Remarks: ${anomalyDetails.rectified_remarks}` : "";

        // Combine: Findings -> Description -> Rectified Remarks
        const fullText = [findings, defectDesc, rectRemarks].filter(Boolean).join("\n\n");

        // Set font BEFORE splitTextToSize so width calculation matches rendering
        const descFontSize = 8;
        const descLineHeight = 3.5; // ~line height for 8pt font
        const textPadding = 3; // padding from box edge
        const textAreaWidth = contentWidth - (textPadding * 2); // full usable width inside box

        doc.setFontSize(descFontSize);
        doc.setFont("helvetica", "normal");
        const descLines = doc.splitTextToSize(fullText || "No description provided.", textAreaWidth);

        // Calculate Box Height
        const boxHeaderH = 7;
        const boxContentH = (descLines.length * descLineHeight) + 6; // padding
        const totalBoxH = boxHeaderH + boxContentH;

        // Draw Light Box - border only, no background fill
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, lastY, contentWidth, totalBoxH);

        // Draw light background for Anomaly Description sub-header row
        doc.setFillColor(isPrintFriendly ? 240 : 229, isPrintFriendly ? 240 : 231, isPrintFriendly ? 240 : 235);
        doc.rect(margin, lastY, contentWidth, boxHeaderH, 'F');
        // Re-draw border on top of fill
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, lastY, contentWidth, totalBoxH);

        // Title
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text(`Anomaly Description: ${defectTitle.toUpperCase()}`, margin + textPadding, lastY + 5);

        // Content - use same font size as splitTextToSize calculation
        doc.setFontSize(descFontSize);
        doc.setFont("helvetica", "normal");
        doc.text(descLines, margin + textPadding, lastY + boxHeaderH + 4);

        lastY += totalBoxH + 5;

        // Removed redundant text as requested

        const images = record.attachments || [];
        const processedImages: { data: string; att: any }[] = [];

        // Load images while maintaining association with their metadata
        for (const att of images) {
            if (!att.path) continue;
            const bucket = att.bucket_id || "attachments";
            const url = `/api/attachment/download?path=${encodeURIComponent(att.path)}&bucket=${bucket}`;
            try {
                const data = await loadImage(url);
                if (data) {
                    // Robust meta parsing
                    let meta = att.meta || {};
                    if (typeof meta === 'string') {
                        try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                    }
                    processedImages.push({ data, att: { ...att, meta } });
                }
            } catch (e) {
                console.warn("Failed to load image for report", att.name);
            }
        }

        // Define Footer Height
        const footerH = 25; // Compact height

        if (processedImages.length > 0) {
            let availableH = (pageHeight - margin - footerH - 10) - lastY;

            for (let j = 0; j < processedImages.length; j++) {
                const { data: imgData, att: attObj } = processedImages[j];
                const meta = attObj.meta || {};
                const title = meta.title || attObj.name || `Attachment ${j + 1}`;
                const description = meta.description || "";

                const imgW = contentWidth - 10;

                // Content Preparation - Centered look (no labels as requested)
                const titleText = title.toUpperCase();
                const splitDesc = doc.splitTextToSize(description || `Photo ${j + 1}`, imgW - 10);

                // Heights
                const headerH_box = 8;
                const footerH_box = (splitDesc.length * 4) + 6;
                const minImgH = 40;

                // Check page jump
                if (availableH < (headerH_box + footerH_box + minImgH + 10)) {
                    doc.addPage();
                    globalPage++;
                    drawHeader(doc);
                    lastY = margin + headerH + 10;
                    availableH = (pageHeight - margin - footerH - 10) - lastY;
                }

                // Target Image Height (Landscape preferred)
                let targetImgH = Math.min(availableH - headerH_box - footerH_box - 10, imgW * 0.7);
                const totalBlockH = headerH_box + targetImgH + footerH_box;

                // 1. Draw Container Box
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.2);
                doc.rect(margin, lastY, contentWidth, totalBlockH);

                // 2. Draw Header for Title (Centered)
                doc.setFillColor(245, 245, 245);
                doc.rect(margin, lastY, contentWidth, headerH_box, 'F');
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(31, 55, 93);
                doc.text(titleText, pageWidth / 2, lastY + 5.5, { align: "center" });

                // 3. Draw Image
                doc.addImage(imgData, "JPEG", margin + 5, lastY + headerH_box + 2, imgW, targetImgH - 4);

                // 4. Draw Footer for Description (Centered)
                const footerY_pos = lastY + headerH_box + targetImgH;
                doc.setFontSize(8);
                doc.setTextColor(60, 60, 60);
                doc.setFont("helvetica", "normal");

                if (description) {
                    doc.text(splitDesc, pageWidth / 2, footerY_pos + 4, { align: "center" });
                } else {
                    doc.setFont("helvetica", "italic");
                    doc.text(`Photo ${j + 1}`, pageWidth / 2, footerY_pos + 4, { align: "center" });
                }

                // Update Y for next photo
                const blockGap = 10;
                lastY += totalBlockH + blockGap;
                availableH -= (totalBlockH + blockGap);
            }
        }
        // Draw Signatories at the bottom of the current page (or new page if no space)
        // Actually, usually "Sign off" is on the bottom of the report page.
        // We will assume a fixed footer height reserved at the bottom margin.

        // Define Signatory Footer function to be called on each page or just the last?
        // User requested "footer part". Usually implies on the report page.
        // Let's add it to the LAST page of the anomaly (where photos end).

        // const footerH = 30; // Already defined as 25 above
        const footerY = pageHeight - margin - footerH;

        // Check if we need a new page for footer if content overlapped?
        // Photos logic uses availableH. We should reduce availableH to reserve space for footer.
        // But for now, let's just draw it at the bottom.

        const drawSignatories = () => {
            const colW = contentWidth / 3;
            const names = [
                { title: "Prepared By", name: config.preparedBy?.name, date: config.preparedBy?.date },
                { title: "Reviewed By", name: config.reviewedBy?.name, date: config.reviewedBy?.date },
                { title: "Approved By", name: config.approvedBy?.name, date: config.approvedBy?.date }
            ];

            doc.setDrawColor(0);
            doc.setLineWidth(0.1);
            doc.setFontSize(8);

            names.forEach((p, idx) => {
                const x = margin + (idx * colW);
                const y = footerY;

                // Box
                doc.rect(x, y, colW, footerH);

                // Title
                doc.setFont("helvetica", "bold");
                doc.text(p.title, x + 2, y + 3);

                // Name Label
                doc.setFont("helvetica", "normal");
                doc.text("Name:", x + 2, y + 9);
                if (p.name) doc.text(p.name, x + 12, y + 9);

                // Sign Label
                doc.text("Sign:", x + 2, y + 15);

                // Date Label
                doc.text("Date:", x + 2, y + 21);
                if (p.date) doc.text(p.date, x + 12, y + 21);
            });
        };

        drawSignatories();

        globalPage++;

        const endPage = doc.getNumberOfPages();
        anomalyPageRanges.push({ start: startPage, end: endPage });
    }

    // Add Page Numbers footer and Date to every page
    const totalPages = doc.getNumberOfPages();
    const printedDateStr = `Printed: ${new Date().toLocaleDateString("en-GB")}`;

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");


        // Local Page Number (per anomaly)
        const range = anomalyPageRanges.find(r => i >= r.start && i <= r.end);
        if (range) {
            const localPage = i - range.start + 1;
            const localTotal = range.end - range.start + 1;
            if (config.showPageNumbers) {
                doc.setTextColor(80, 80, 80);
                doc.setFontSize(8);
                doc.text(`Page ${localPage} of ${localTotal}`, pageWidth - margin, margin + headerH + 4, { align: "right" });
            }
        }

        // ===== PAGE FOOTER =====
        const footerLineY = pageHeight - 10;

        // Horizontal line across content width
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.line(margin, footerLineY, pageWidth - margin, footerLineY);

        // Page number - centered
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, footerLineY + 4, { align: "center" });

        // Printed date - right aligned
        doc.text(printedDateStr, pageWidth - margin, footerLineY + 4, { align: "right" });
    }

    if (config.returnBlob) {
        return doc.output("blob");
    } else {
        doc.save(`${config.reportNoPrefix}_AnomalyReport.pdf`);
    }
};

const logosPadding = 5;
