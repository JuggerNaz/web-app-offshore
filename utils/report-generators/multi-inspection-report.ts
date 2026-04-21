
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportConfig } from "../pdf-generator";
import { createClient } from "@/utils/supabase/client";
import { loadLogoWithTransparency, drawLogo } from "./shared-logo";

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

export const generateMultiInspectionReport = async (
    inspectionIds: number[],
    companySettings?: CompanySettings,
    config?: ReportConfig
) => {
    try {
        const supabase = createClient();
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - (margin * 2);
        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number]
        };
        const sectionBlue: [number, number, number] = [44, 82, 130];
        const isPrintFriendly = config?.printFriendly === true;

        for (let idx = 0; idx < inspectionIds.length; idx++) {
            const inspectionId = inspectionIds[idx];
            if (idx > 0) doc.addPage();

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

            if (inspError || !inspection) continue;

            // 2. Fetch Anomalies
            const { data: anomalies } = await supabase
                .from('insp_anomalies')
                .select('*')
                .eq('inspection_id', inspectionId);

            // 3. Fetch Attachments
            const { data: attachmentsData } = await supabase
                .from('attachment')
                .select('*')
                .eq('source_id', inspectionId)
                .eq('source_type', 'inspection');

            (inspection as any).insp_anomalies = anomalies || [];
            (inspection as any).attachment = attachmentsData || [];

            // --- HEADER ---
            const drawPremiumHeader = async (d: jsPDF) => {
                const headerH = 22;
                d.setFillColor(...colors.navy);
                d.rect(margin, margin, contentWidth, headerH, 'F');

                // 1. Company Logo (Right)
                if (companySettings?.logo_url) {
                    try {
                        const logoData = await loadLogoWithTransparency(companySettings.logo_url);
                        if (logoData) {
                            drawLogo(d, logoData, 16, 16, pageWidth - margin - 20, margin + 3, 'right', 'center');
                        }
                    } catch (e) {}
                }

                // 2. Contractor Logo (Left - if provided in config)
                const contractorLogoUrl = (config as any)?.contractorLogoUrl;
                if (contractorLogoUrl) {
                    try {
                        const logoData = await loadLogoWithTransparency(contractorLogoUrl);
                        if (logoData) {
                            drawLogo(d, logoData, 16, 16, margin + 4, margin + 3, 'left', 'center');
                        }
                    } catch (e) {}
                }

                d.setTextColor(255); d.setFontSize(10); d.setFont("helvetica", "bold");
                d.text(companySettings?.company_name || 'NASQUEST RESOURCES SDN BHD', margin + (contentWidth/2), margin + 6, { align: 'center' });
                d.setFontSize(8); d.setFont("helvetica", "normal");
                d.text(companySettings?.department_name || 'Technical Inspection Division', margin + (contentWidth/2), margin + 10, { align: 'center' });
                d.setFontSize(12); d.setFont("helvetica", "bold");
                const isAnomaly = inspection.has_anomaly;
                d.text(isAnomaly ? "ANOMALY REPORT" : "INSPECTION REPORT", margin + (contentWidth/2), margin + 18, { align: 'center' });
            };

            await drawPremiumHeader(doc);

            const isAnomaly = inspection.has_anomaly;

            // Subtitle / Reference
            doc.setTextColor(...colors.text);
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.text(`Record Ref: ${inspection.insp_id}`, margin, margin + 22 + 5);

            let yPos = margin + 22 + 12;

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
                ['Component Type', inspection.component_type || '-'],
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

            // --- ANOMALY DETAILS ---
            if (isAnomaly && inspection.insp_anomalies && inspection.insp_anomalies.length > 0) {
                const anomaly = inspection.insp_anomalies[0];
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
                    let meta = att.meta || {};
                    if (typeof meta === 'string') {
                        try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                    }
                    const title = meta.title || att.name || `Photo ${i + 1}`;
                    const description = meta.description || "";

                    if (yPos + imgHeight + 25 > pageHeight - 10) {
                        doc.addPage();
                        yPos = 20;
                    }

                    const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(att.path);
                    const url = publicUrlData.publicUrl;

                    try {
                        const colCenterX = currentX + (imgWidth / 2);
                        doc.setFontSize(8);
                        doc.setFont("helvetica", "bold");
                        doc.setTextColor(31, 55, 93);
                        doc.text(title.toUpperCase(), colCenterX, yPos + 4, { align: "center", maxWidth: imgWidth });

                        const imgData = await loadLogoWithTransparency(url);
                        if (imgData) doc.addImage(imgData.data, 'PNG', currentX, yPos + 7, imgWidth, imgHeight);

                        const descY = yPos + imgHeight + 11;
                        doc.setFontSize(7);
                        doc.setTextColor(60, 60, 60);
                        if (description) {
                            doc.setFont("helvetica", "normal");
                            const splitDesc = doc.splitTextToSize(description, imgWidth);
                            doc.text(splitDesc, colCenterX, descY, { align: "center" });
                        } else {
                            doc.setFont("helvetica", "italic");
                            doc.text(`Photo ${i + 1}`, colCenterX, descY, { align: "center" });
                        }
                    } catch (e) {
                        doc.setDrawColor(200, 200, 200);
                        doc.rect(currentX, yPos + 7, imgWidth, imgHeight);
                        doc.text("Image Load Failed", currentX + 5, yPos + 15);
                    }

                    if ((i + 1) % cols === 0) {
                        currentX = 10;
                        yPos += imgHeight + 25;
                    } else {
                        currentX += imgWidth + gap;
                    }
                }
            } // End of Attachments
        } // End of For Loop

        doc.save(`${config?.reportNoPrefix || 'Inspection'}_Combined_Report.pdf`);

    } catch (e) {
        console.error("Multi Report Generation Error", e);
        alert("Failed to generate combined report");
    }
};
