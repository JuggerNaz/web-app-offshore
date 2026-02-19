
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
    const headerH = 45; // Height of the header background
    const logoSize = 25;
    const logoPadding = 5;

    const drawHeader = (doc: jsPDF) => {
        const startX = margin;
        const startY = margin;

        // Blue Rect Background
        doc.setFillColor(31, 55, 93); // Dark Blue #1f375d
        doc.rect(startX, startY, contentWidth, headerH, "F");

        // --- Left Side: Contractor Logo + Name ---
        // Center the name relative to the logo
        // Logo is at startX + logoPadding. Width 25. Center X = startX + logoPadding + 12.5
        const logoX = startX + logoPadding;
        const logoCenterX = logoX + (logoSize / 2);

        if (contractorLogo) {
            // Logo image: X, Y, W, H
            doc.addImage(contractorLogo, "JPEG", logoX, startY + logoPadding, logoSize, logoSize);
        }

        if (contractorName) {
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7); // Small font

            // Place text below logo
            const textY = startY + logoPadding + logoSize + 4;

            // Allow more width for centering, but keep it constrained so it doesn't overlap title too much
            // Title is at center (pageWidth/2). Logo center is ~20-30.
            // Split text if it's too long
            const maxNameWidth = 50;
            const nameLines = doc.splitTextToSize(contractorName, maxNameWidth);

            // Center align the text at logoCenterX
            doc.text(nameLines, logoCenterX, textY, { align: "center" });
        }

        // --- Right Side: Client Logo ---
        if (clientLogo) {
            doc.addImage(clientLogo, "JPEG", pageWidth - margin - logoSize - logoPadding, startY + logoPadding, logoSize, logoSize);
        }

        // --- Center: Text ---
        doc.setTextColor(255, 255, 255); // White Text

        // Company Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        const companyName = (companySettings.company_name || "TANJUNG OFFSHORE SERVICES SDN BHD").toUpperCase();
        doc.text(companyName, pageWidth / 2, startY + 12, { align: "center" });

        // Department
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const deptName = companySettings.departmentName || "Engineering Department";
        doc.text(deptName, pageWidth / 2, startY + 18, { align: "center" });

        // Report Title (Slightly adjusted Y to fit everything)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("DEFECT / ANOMALY REPORT", pageWidth / 2, startY + 30, { align: "center" });

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

        drawHeader(doc);

        const priority = anomalyDetails.priority || "Normal";
        let priorityColor = [255, 255, 255]; // Default white

        if (priority === 'High' || priority === 'Critical' || priority === 'H') priorityColor = [249, 115, 22]; // Orange
        else if (priority === 'Observation' || priority === 'O') priorityColor = [237, 125, 49];
        else if (priority === 'Medium' || priority === 'M') priorityColor = [253, 224, 71]; // Yellow

        // Determine vessel 
        // If jobpack metadata provides multiple vessels (comma separated), they should be displayed.
        // We prioritize explicit anomaly vessel if present, otherwise jobpack vessel.
        let vessel = record.main_vessel || record.dive_vessel || jobPack.metadata?.vessel || "N/A";

        // Field/Install
        const field = structure.field_name || "N/A";
        const install = structure.str_name || "N/A";
        const ref = anomalyDetails.display_ref_no || "N/A";
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

        const headStylesString = { fillColor: [229, 231, 235], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] };

        // Increased top margin for table to account for taller header
        autoTable(doc, {
            startY: margin + headerH + 10,
            head: [],
            body: [
                [
                    { content: "Project Description:", styles: { ...headStylesString, cellWidth: 35 } },
                    { content: record.jobpack_name || jobPack.name || "N/A", styles: { cellWidth: 60 } },
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
            margin: { left: margin, right: margin, top: margin + headerH + 5 }
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

        // 1. Component Details & Elevation (First)
        let compLines: string[] = [];
        if (record.component_qid) {
            compLines.push(`Components: ${record.component_qid}`);
        }

        // Elevation / KP Logic
        const isPipeline = (structure.str_type || "").toUpperCase().includes("PIPE");

        let locInfo = "";
        if (isPipeline) {
            if (record.fp_kp) locInfo = `KP: ${record.fp_kp}`;
        } else {
            // Platform default
            if (record.elevation) locInfo = `Elevation: ${record.elevation}`;
            else if (record.fp_kp) locInfo = `KP: ${record.fp_kp}`; // Fallback
        }

        if (locInfo) compLines.push(locInfo);
        const compText = compLines.join("\n");

        // 2. Observations (Inspection Findings)
        // If "observations" is just the summary, use it. 
        const findings = record.observations ? `Inspection Findings: ${record.observations}` : "";

        // 3. Remarks (Original Defect Description)
        const defectDesc = anomalyDetails.description || "";

        // 4. Rectified Remarks (if any)
        const rectRemarks = anomalyDetails.rectified_remarks ? `Rectified Remarks: ${anomalyDetails.rectified_remarks}` : "";

        // Combine: Component -> Findings -> Description -> Rectified Remarks
        const fullText = [compText, findings, defectDesc, rectRemarks].filter(Boolean).join("\n\n");

        const descLines = doc.splitTextToSize(fullText || "No description provided.", contentWidth - 4);
        doc.text(descLines, margin + 2, lastY);
        lastY += (descLines.length * 4) + 5;

        // Removed redundant text as requested

        const images = record.attachments || [];

        const imageUrls = await Promise.all(images.map((img: any) => {
            if (!img.path) return "";
            const bucket = img.bucket_id || "attachments";
            return `/api/attachment/download?path=${encodeURIComponent(img.path)}&bucket=${bucket}`;
        }));

        const validUrls = imageUrls.filter(u => u.length > 0);
        const loadedImages = await Promise.all(validUrls.map(url => loadImage(url)));
        const validImages = loadedImages.filter(img => img.length > 0);

        // Define Footer Height
        const footerH = 25; // Compact height

        if (validImages.length > 0) {
            // First page available height
            // pageHeight - margin(bottom) - footerH - padding - currentY
            let availableH = (pageHeight - margin - footerH - 10) - lastY;

            for (let j = 0; j < validImages.length; j++) {
                // Determine if image fits
                // Check minimal height required (e.g. 50mm)
                if (availableH < 50) {
                    doc.addPage();
                    globalPage++;
                    drawHeader(doc);
                    lastY = margin + headerH + 10;
                    // Reset availableH for new page
                    availableH = (pageHeight - margin - footerH - 10) - lastY;
                }

                const imgW = contentWidth - 10;
                // Constrain image height to available space
                // Aspect ratio logic?
                // Just use max available.
                // But we also want to maintain aspect ratio if possible, or usually landscape photos.
                // Let's create an Image element to get dims? loadImage returns dataURL.
                // For simplicity, assume landscape or limit by width.

                // We want to avoid it hitting the footer.
                // Max height for this image on this page:
                let imgH = Math.min(availableH, imgW * 0.75);

                // If it's the last image, we might need space for caption?
                // Caption height ~5
                imgH -= 10; // Reserve space for caption and gap

                doc.addImage(validImages[j], "JPEG", margin + 5, lastY, imgW, imgH);
                doc.setFontSize(8);

                const caption = validImages.length > 1 ? `Photo ${j + 1}: ${defectDesc.substring(0, 50)}...` : `Photo 1: ${defectDesc.substring(0, 100)}`;
                doc.text(caption, pageWidth / 2, lastY + imgH + 5, { align: "center" });

                // Update lastY for next iteration (if multiple images per anomaly, though usually 1-2)
                lastY += imgH + 15;
                availableH -= (imgH + 15);
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
    }

    // Add Page Numbers and Date to Header
    const totalPages = doc.getNumberOfPages();
    const dateStr = `Date: ${new Date().toLocaleDateString("en-GB")}`;

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255); // White text on Blue Header
        doc.setFont("helvetica", "normal");

        // Align Center relative to Client Logo (Right Side)
        // Client Logo X was: pageWidth - margin - logoSize - logoPadding
        const clientLogoX = pageWidth - margin - logoSize - logoPadding;
        const clientLogoCenterX = clientLogoX + (logoSize / 2);

        const textYStart = margin + logoPadding + logoSize + 4;

        doc.text(dateStr, clientLogoCenterX, textYStart, { align: "center" });
        doc.text(`Page ${i} of ${totalPages}`, clientLogoCenterX, textYStart + 5, { align: "center" });
    }

    if (config.returnBlob) {
        return doc.output("blob");
    } else {
        doc.save(`${config.reportNoPrefix}_AnomalyReport.pdf`);
    }
};

const logosPadding = 5;
