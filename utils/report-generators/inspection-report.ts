
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportConfig } from "../pdf-generator";
import { createClient } from "@/utils/supabase/client";

// Helper to load image for PDF
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
        img.onerror = (e) => reject(e);
    });
};

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

export const generateInspectionReport = async (
    inspectionId: number,
    companySettings?: CompanySettings,
    config?: ReportConfig
) => {
    try {
        const supabase = createClient();

        // 1. Fetch Inspection Data
        const { data: inspection, error: inspError } = await supabase
            .from('insp_records')
            .select(`
                *,
                inspection_type ( code, name ),
                structure_components ( q_id, name )
            `)
            .eq('insp_id', inspectionId)
            .single();

        if (inspError || !inspection) {
            console.error("Error fetching inspection for report:", inspError);
            throw new Error("Inspection not found");
        }

        // 2. Fetch Anomalies
        const { data: anomalies } = await supabase
            .from('insp_anomalies')
            .select('*')
            .eq('inspection_id', inspectionId);

        // 3. Fetch Attachments (Polymorphic)
        const { data: attachmentsData } = await supabase
            .from('attachment')
            .select('*')
            .eq('source_id', inspectionId)
            .eq('source_type', 'inspection');

        // Assign to inspection object for compatibility with rest of code
        (inspection as any).insp_anomalies = anomalies || [];
        (inspection as any).attachment = attachmentsData || [];

        // 2. Fetch Structure Name (Separate query if needed, or if stored in metadata)
        // Check if we need structure info. inspection.structure_id?
        // Usually context is needed.
        let structureName = inspection.inspection_data?.structure_name || "Unknown Structure";
        if (!structureName || structureName === "Unknown Structure") {
            // Try fetching from structure_components -> u_structure?
            // Or simpler, fetch from u_structure if we have structure_id on record?
            // insp_records usually has structure_id? No, usually component_id.
            // But component -> structure lookup might be needed.
            // For now, use metadata or fallback.
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const headerBlue: [number, number, number] = [26, 54, 93];
        const sectionBlue: [number, number, number] = [44, 82, 130];
        const isPrintFriendly = config?.printFriendly === true;

        // --- HEADER ---
        if (isPrintFriendly) {
            // Print-Friendly: White background with light gray border
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.rect(0, 0, pageWidth, 28);
        } else {
            doc.setFillColor(...headerBlue);
            doc.rect(0, 0, pageWidth, 28, "F");
        }

        // Logo
        if (companySettings?.logo_url) {
            try {
                const logoData = await loadImage(companySettings.logo_url);
                doc.addImage(logoData, 'PNG', pageWidth - 24, 5, 16, 16);
            } catch (e) {
                doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
                doc.setFontSize(8);
                doc.text("LOGO", pageWidth - 16, 13);
            }
        }

        // Company
        doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(companySettings?.company_name || "NasQuest Resources Sdn Bhd", 10, 9);

        // Dept
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(companySettings?.department_name || "Engineering Department", 10, 14);

        // Title
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        const isAnomaly = inspection.has_anomaly;
        doc.text(isAnomaly ? "ANOMALY REPORT" : "INSPECTION REPORT", 10, 22);

        // Subtitle
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Ref: ${inspection.insp_id}`, pageWidth - 30, 22, { align: "right" });

        let yPos = 35;

        // --- INSPECTION DETAILS ---
        const drawSectionHeader = (text: string, y: number) => {
            if (isPrintFriendly) {
                doc.setFillColor(240, 240, 240);
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.rect(10, y, pageWidth - 20, 7, "FD");
                doc.setTextColor(0, 0, 0);
            } else {
                doc.setFillColor(...sectionBlue);
                doc.rect(10, y, pageWidth - 20, 7, "F");
                doc.setTextColor(255, 255, 255);
            }
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
        };

        drawSectionHeader("INSPECTION DETAILS", yPos);
        doc.text("INSPECTION DETAILS", 12, yPos + 5);
        yPos += 10;

        const details = [
            ['Date', new Date(inspection.inspection_date).toLocaleDateString()],
            ['Time', inspection.inspection_time?.slice(0, 5) || '-'],
            ['Component', inspection.structure_components?.q_id || '-'],
            ['Type', inspection.inspection_type?.name || inspection.inspection_type_code || '-'],
            ['Location', inspection.elevation ? `EL: ${inspection.elevation}m` : `KP: ${inspection.fp_kp || '-'}`],
            ['Status', inspection.status || 'PENDING']
        ];

        autoTable(doc, {
            startY: yPos,
            body: [
                details.slice(0, 3).map(d => `${d[0]}: ${d[1]}`),
                details.slice(3).map(d => `${d[0]}: ${d[1]}`)
            ],
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 60 }, 2: { cellWidth: 60 } },
            margin: { left: 10 }
        });
        yPos = (doc as any).lastAutoTable.finalY + 5;

        // --- ANOMALY DETAILS (If Applicable) ---
        if (isAnomaly && inspection.insp_anomalies && inspection.insp_anomalies.length > 0) {
            const anomaly = inspection.insp_anomalies[0]; // Assuming one anomaly per record for now

            drawSectionHeader(`ANOMALY: ${anomaly.anomaly_ref_no || 'Ref N/A'}`, yPos);
            doc.text(`ANOMALY: ${anomaly.anomaly_ref_no || 'Ref N/A'}`, 12, yPos + 5);
            yPos += 10;

            const anomalyData = [
                ['Defect Code', anomaly.defect_type_code || '-'],
                ['Defect Type', anomaly.defect_category_code || '-'],
                ['Dimensions', `L: ${anomaly.length || '-'} x W: ${anomaly.width || '-'} x D: ${anomaly.depth || '-'}`],
                ['Score', anomaly.description_score || '-']
            ];

            autoTable(doc, {
                startY: yPos,
                body: anomalyData,
                theme: 'striped',
                headStyles: { fillColor: [200, 200, 200], textColor: 0 },
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
                margin: { left: 10 }
            });
            yPos = (doc as any).lastAutoTable.finalY + 5;

            // Description
            if (anomaly.description) {
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text("Description:", 10, yPos + 4);

                doc.setFont("helvetica", "normal");
                const splitDesc = doc.splitTextToSize(anomaly.description, pageWidth - 25);
                doc.text(splitDesc, 25, yPos + 4);
                yPos += (splitDesc.length * 4) + 8;
            }
        }

        // --- ATTACHMENTS (PHOTOS) ---
        // Filter for images
        const attachments = inspection.attachment?.filter((a: any) =>
            a.path.match(/\.(jpg|jpeg|png|webp)$/i) || a.path.includes('image')
        ) || [];

        if (attachments.length > 0) {
            if (yPos > pageHeight - 60) {
                doc.addPage();
                yPos = 20;
            }

            drawSectionHeader(`ATTACHMENTS / PHOTOS (${attachments.length})`, yPos);
            doc.text(`ATTACHMENTS / PHOTOS (${attachments.length})`, 12, yPos + 5);
            yPos += 10;

            const cols = 2;
            const gap = 5;
            const imgWidth = (pageWidth - 20 - (gap * (cols - 1))) / cols;
            const imgHeight = 80;

            let currentX = 10;

            for (let i = 0; i < attachments.length; i++) {
                const att = attachments[i];

                if (yPos + imgHeight > pageHeight - 10) {
                    doc.addPage();
                    yPos = 20;
                }

                // Get Public URL
                const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(att.path);
                const url = publicUrlData.publicUrl;

                try {
                    const imgData = await loadImage(url);
                    doc.addImage(imgData, 'JPEG', currentX, yPos, imgWidth, imgHeight);

                    // Add caption/filename
                    doc.setFontSize(8);
                    doc.setTextColor(50, 50, 50);
                    doc.text(att.name || `Photo ${i + 1}`, currentX, yPos + imgHeight + 4);

                } catch (e) {
                    console.error("Failed to load image for PDF", e);
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(currentX, yPos, imgWidth, imgHeight);
                    doc.text("Image Load Failed", currentX + 5, yPos + 10);
                }

                // Grid Logic
                if ((i + 1) % cols === 0) {
                    currentX = 10;
                    yPos += imgHeight + 10;
                } else {
                    currentX += imgWidth + gap;
                }
            }
        }

        doc.save(`${isAnomaly ? 'Anomaly' : 'Inspection'}_Report_${inspectionId}.pdf`);

    } catch (e) {
        console.error("Report Generation Error", e);
        alert("Failed to generate report");
    }
};
