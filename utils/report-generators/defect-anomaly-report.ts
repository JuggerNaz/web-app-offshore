
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
        // Ensure JobPack metadata is available (fetch if missing)
        // Access 'contrac' field which stores the Contractor Library ID
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
            (anomalies.length > 0 ? anomalies[0].contractor_ref : null);

        if (contractorId) {
            try {
                // Fetch logo_url and description (name) from u_lib_list
                // We check both id (PK) and lib_id (Legacy/User Code) just in case
                const { data } = await supabase
                    .from('u_lib_list')
                    .select('logo_url, lib_desc')
                    .eq('lib_code', 'CONTR_NAM')
                    .or(`id.eq.${contractorId},lib_id.eq.${contractorId}`)
                    .maybeSingle();

                if (data) {
                    if (data.logo_url) contractorLogo = await loadImage(data.logo_url);
                    if (data.lib_desc) contractorName = data.lib_desc;
                }
            } catch (e) {
                console.error("Error fetching contractor logo", e);
            }
        }
    }

    // Header Dimensions
    const headerH = 45; // Increased specificially to avoid overlap
    const logoSize = 25;
    const logoPadding = 5;

    const drawHeader = (doc: jsPDF) => {
        const startX = margin;
        const startY = margin;

        // Blue Rect Background
        doc.setFillColor(31, 55, 93); // Dark Blue #1f375d
        doc.rect(startX, startY, contentWidth, headerH, "F");

        // --- Left Side: Contractor Logo + Name ---
        if (contractorLogo) {
            doc.addImage(contractorLogo, "JPEG", startX + logoPadding, startY + logoPadding, logoSize, logoSize);
        }

        if (contractorName) {
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7); // Small font

            // Align with logo left edge, below logo
            // Y = margin + padding + logo + gap
            const textY = startY + logoPadding + logoSize + 4;
            const maxNameWidth = 45;
            const nameLines = doc.splitTextToSize(contractorName, maxNameWidth);
            doc.text(nameLines, startX + logoPadding, textY);
        }

        // --- Right Side: Client Logo ---
        if (clientLogo) {
            doc.addImage(clientLogo, "JPEG", pageWidth - margin - logoSize - logoPadding, startY + logoPadding, logoSize, logoSize);
        }

        // Date and Page No placeholders (Simulated visually if needed, but added in loop later)
        // We leave space below Client Logo

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

        // Report Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("DEFECT / ANOMALY REPORT", pageWidth / 2, startY + 28, { align: "center" });

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

        // Determine vessel from various sources
        const vessel = record.main_vessel || record.dive_vessel || jobPack.metadata?.vessel || "N/A";
        // Field/Install
        const field = structure.field_name || "N/A";
        const install = structure.str_name || "N/A";
        const ref = anomalyDetails.display_ref_no || "N/A";
        const inspDate = record.inspection_date ? new Date(record.inspection_date).toLocaleDateString() : "N/A";

        // Recording Logic
        const recording = (record.video_ref || record.tape_no || "").trim() || "N/A";

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

        const imageUrls = await Promise.all(images.map((img: any) => {
            if (!img.path) return "";
            const bucket = img.bucket_id || "attachments";
            return `/api/attachment/download?path=${encodeURIComponent(img.path)}&bucket=${bucket}`;
        }));

        const validUrls = imageUrls.filter(u => u.length > 0);
        const loadedImages = await Promise.all(validUrls.map(url => loadImage(url)));
        const validImages = loadedImages.filter(img => img.length > 0);

        if (validImages.length > 0) {
            const availableH = (pageHeight - margin - 15) - lastY - 10;

            for (let j = 0; j < validImages.length; j++) {
                if (j > 0) {
                    doc.addPage();
                    globalPage++;
                    drawHeader(doc);
                    lastY = margin + headerH + 10;
                    doc.setFontSize(9);
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

    // Add Page Numbers and Date to Header
    const totalPages = doc.getNumberOfPages();
    const dateStr = `Date: ${new Date().toLocaleDateString("en-GB")}`;

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255); // White text on Blue Header
        doc.setFont("helvetica", "normal");

        // Position: Below Client Logo, Right Side
        // Align Right to Page Margin
        const textRight = pageWidth - margin;

        // Y Position: Below Logo.
        // Logo Y: margin + padding. Height: logoSize.
        // End of Logo: margin + padding + logoSize = 15 + 5 + 25 = 45.
        // Header Height: 45. Bottom at 15+45=60.
        // Text at Y=49 and Y=53. Fits.

        const textYStart = margin + logoPadding + logoSize + 4;

        doc.text(dateStr, textRight, textYStart, { align: "right" });
        doc.text(`Page ${i} of ${totalPages}`, textRight, textYStart + 5, { align: "right" });
    }

    if (config.returnBlob) {
        return doc.output("blob");
    } else {
        doc.save(`${config.reportNoPrefix}_AnomalyReport.pdf`);
    }
};

const logosPadding = 5;
