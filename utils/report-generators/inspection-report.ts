import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportConfig } from "../pdf-generator";
import { createClient } from "@/utils/supabase/client";
import { getAttachmentUrl } from "@/utils/attachment-utils";

// Helper to load image for PDF
import { loadLogoWithTransparency, drawLogo, draw3SectionHeader, applyWatermarkAndSignaturesGlobal, normalizeReportRecords, formatReportFindingText, applyRecordCellStyling , REPORT_FOOTER_APP_TEXT } from "./shared-logo";

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

        let inspection: any = null;
        if ((config as any)?.isBlankReport) {
            inspection = {
                insp_id: 0,
                sow_report_no: config?.reportNoPrefix || "____________________",
                created_at: new Date().toISOString(),
                inspection_type: { code: "GVI", name: "General Visual Inspection" },
                structure_components: { q_id: ". . . . . .", name: ". . . . . ." },
                inspection_data: {},
                description: "",
                insp_anomalies: [],
                attachment: []
            };
        } else {
            let fetchedInsp: any = null;
            let inspError: any = null;

            if (inspectionId && !isNaN(inspectionId) && inspectionId > 0) {
                const res = await supabase
                    .from('insp_records')
                    .select(`
                        *,
                        structure_components:component_id ( q_id, code )
                    `)
                    .eq('insp_id', inspectionId)
                    .maybeSingle();
                fetchedInsp = res.data;
                inspError = res.error;
            }

            if (!fetchedInsp && (config as any)?.jobPackId && (config as any)?.structureId) {
                let q = supabase
                    .from('insp_records')
                    .select(`
                        *,
                        structure_components:component_id ( q_id, code )
                    `)
                    .eq('jobpack_id', (config as any).jobPackId)
                    .eq('structure_id', (config as any).structureId);

                if ((config as any).sowReportNo) {
                    q = q.eq('sow_report_no', (config as any).sowReportNo);
                }

                const res = await q.order('insp_id', { ascending: false }).limit(1).maybeSingle();
                fetchedInsp = res.data;
            }

            if (!fetchedInsp) {
                console.error("Error fetching inspection for report:", inspError);
                throw new Error("Inspection not found");
            }
            if (!fetchedInsp.inspection_type) {
                fetchedInsp.inspection_type = {
                    code: fetchedInsp.inspection_type_code || "",
                    name: fetchedInsp.inspection_type_code || "General Inspection"
                };
            }
            inspection = fetchedInsp;
        }

        // 2. Fetch Anomalies
        const { data: anomalies } = await supabase
            .from('insp_anomalies')
            .select('*')
            .eq('inspection_id', inspectionId);

        // 3. Fetch Attachments (Polymorphic)
        let { data: attachmentsData } = await supabase
            .from('attachment')
            .select('*')
            .eq('source_id', inspectionId)
            .in('source_type', ['inspection', 'INSPECTION', 'insp_record', 'INSP_RECORD', 'anomaly', 'ANOMALY', 'defect', 'DEFECT', 'INSPECTION_RECORD'])
            .is('is_deleted', false);

        if (!attachmentsData || attachmentsData.length === 0) {
            const { data: mediaData } = await supabase
                .from('insp_media' as any)
                .select('*')
                .eq('inspection_id', inspectionId);
            if (mediaData && mediaData.length > 0) {
                attachmentsData = mediaData.map((m: any) => ({
                    id: m.media_id,
                    path: m.file_path,
                    file_path: m.file_path,
                    name: m.file_name || `Photo ${m.media_id}`,
                    source_id: m.inspection_id,
                    source_type: 'inspection',
                    meta: m.meta,
                    bucket: (m.meta as any)?.bucket || 'inspection-media'
                }));
            }
        }

        // Assign to inspection object for compatibility with rest of code
        (inspection as any).insp_anomalies = anomalies || [];
        (inspection as any).attachment = attachmentsData || [];

        const structureName = inspection.inspection_data?.structure_name || "Unknown Structure";

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);
        const colors = {
            navy: [7, 78, 136] as [number, number, number],
            teal: [20, 184, 166] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            text: [30, 41, 59] as [number, number, number]
        };
        const sectionBlue: [number, number, number] = [7, 78, 136];
        const isPrintFriendly = config?.printFriendly === true;
        const isAnomaly = inspection.has_anomaly;

        // Preload logos
        let coLogo: any = null;
        let ctLogo: any = null;
        if (companySettings?.logo_url) {
            try { coLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (e) {}
        }
        const contractorLogoUrl = (config as any)?.contractorLogoUrl;
        if (contractorLogoUrl) {
            try { ctLogo = await loadLogoWithTransparency(contractorLogoUrl); } catch (e) {}
        }

        const headerH = 25;
        // --- HEADER ---
        const drawPremiumHeader = (d: jsPDF) => {
            draw3SectionHeader(d, {
                reportTitle: isAnomaly ? "ANOMALY REPORT" : "INSPECTION REPORT",
                reportNo: inspection.sow_report_no || (config as any)?.sowReportNo || (config as any)?.reportNoPrefix || `ID-${inspection.insp_id}`,
                structureName: structureName,
                jobpackName: (config as any)?.jobpackName,
                companySettings,
                config,
                contractorLogoData: ctLogo,
                clientLogoData: coLogo,
                margin,
                headerH,
                headerY: 7,
            });
        };

        drawPremiumHeader(doc);

        let yPos = margin + headerH + 5;

        // --- INSPECTION DETAILS ---
        const drawSectionHeader = (text: string, y: number) => {
            if (isPrintFriendly) {
                doc.setFillColor(240, 240, 240);
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.rect(margin, y, contentWidth, 7, "FD");
                doc.setTextColor(0, 0, 0);
            } else {
                doc.setFillColor(...sectionBlue);
                doc.rect(margin, y, contentWidth, 7, "F");
                doc.setTextColor(255, 255, 255);
            }
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(text, margin + 4, y + 4.8);
        };

        drawSectionHeader("INSPECTION DETAILS", yPos);
        yPos += 9;

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
            theme: 'grid',
            tableLineWidth: 0.1,
            tableLineColor: [200, 200, 200],
            styles: {fontSize: 8.5, cellPadding: 2, lineWidth: 0.1, lineColor: [200, 200, 200]},
            columnStyles: { 0: { cellWidth: 63.33 }, 1: { cellWidth: 63.33 }, 2: { cellWidth: 63.34 } },
            margin: { left: margin, right: margin },
            tableWidth: contentWidth
        });
        yPos = (doc as any).lastAutoTable.finalY + 5;

        // --- ANOMALY DETAILS (If Applicable) ---
        if (isAnomaly && inspection.insp_anomalies && inspection.insp_anomalies.length > 0) {
            const anomaly = inspection.insp_anomalies[0]; // Assuming one anomaly per record for now

            drawSectionHeader(`ANOMALY: ${anomaly.anomaly_ref_no || 'Ref N/A'}`, yPos);
            yPos += 9;

            const anomalyData = [
                ['Defect Code', anomaly.defect_type_code || '-'],
                ['Defect Type', anomaly.defect_category_code || '-'],
                ['Dimensions', `L: ${anomaly.length || '-'} x W: ${anomaly.width || '-'} x D: ${anomaly.depth || '-'}`],
                ['Score', anomaly.description_score || '-']
            ];

            autoTable(doc, {
                startY: yPos,
                body: anomalyData,
                theme: 'grid',
                tableLineWidth: 0.1,
                tableLineColor: [200, 200, 200],
                headStyles: {fillColor: [200, 200, 200], textColor: 0, lineWidth: 0.1, lineColor: [200, 200, 200]},
                styles: {fontSize: 8.5, cellPadding: 2, lineWidth: 0.1, lineColor: [200, 200, 200]},
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 140 } },
                margin: { left: margin, right: margin },
                tableWidth: contentWidth
            });
            yPos = (doc as any).lastAutoTable.finalY + 5;

            // Description
            if (anomaly.description) {
                doc.setFontSize(8.5);
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text("Description:", margin, yPos + 4);

                doc.setFont("helvetica", "normal");
                const splitDesc = doc.splitTextToSize(anomaly.description, contentWidth - 25);
                doc.text(splitDesc, margin + 22, yPos + 4);
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
                drawPremiumHeader(doc);
                yPos = margin + headerH + 6;
            }

            drawSectionHeader(`ATTACHMENTS / PHOTOS (${attachments.length})`, yPos);
            yPos += 10;

            const cols = 2;
            const gap = 5;
            const imgWidth = (contentWidth - (gap * (cols - 1))) / cols;
            const imgHeight = 80;

            let currentX = margin;

            for (let i = 0; i < attachments.length; i++) {
                const att = attachments[i];

                // Robust meta parsing
                let meta = att.meta || {};
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                }

                const title = meta.title || att.name || `Photo ${i + 1}`;
                const description = meta.description || "";

                if (yPos + imgHeight + 25 > pageHeight - 10) {
                    doc.addPage();
                    drawPremiumHeader(doc);
                    yPos = margin + headerH + 6;
                }

                // Get Public URL
                const url = getAttachmentUrl(att, supabase);

                try {
                    const colCenterX = currentX + (imgWidth / 2);

                    // Draw Title above (Centered in Column)
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(7, 78, 136);
                    doc.text(title.toUpperCase(), colCenterX, yPos + 4, { align: "center", maxWidth: imgWidth });

                    const imgData = await loadLogoWithTransparency(url);
                    if (imgData) doc.addImage(imgData.data, 'PNG', currentX, yPos + 7, imgWidth, imgHeight);

                    // Draw Description below (Centered in Column)
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
                    console.error("Failed to load image for PDF", e);
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(currentX, yPos + 7, imgWidth, imgHeight);
                    doc.text("Image Load Failed", currentX + 5, yPos + 15);
                }

                // Grid Logic
                if ((i + 1) % cols === 0) {
                    currentX = margin;
                    yPos += imgHeight + 25;
                } else {
                    currentX += imgWidth + gap;
                }
            }
        }

        
        const totalPages = doc.getNumberOfPages();
        for (let j = 1; j <= totalPages; j++) {
            doc.setPage(j);
            const footerY = pageHeight - 5;
            doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.1);
            doc.line(margin, footerY - 2.5, pageWidth - margin, footerY - 2.5);
            doc.setFontSize(6.5); doc.setTextColor(150, 150, 150);
            doc.setFont("helvetica", "normal");
            doc.text(REPORT_FOOTER_APP_TEXT, margin, footerY);
            if (config?.showPageNumbers !== false) {
                doc.text(`Page ${j} of ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
            }
        }
        (doc as any)._footerApplied = true;

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config?.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`${isAnomaly ? 'Anomaly' : 'Inspection'}_Report_${inspectionId}.pdf`);

    } catch (e) {
        console.error("Report Generation Error", e);
        throw e;
    }
};
