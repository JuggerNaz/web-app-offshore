import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo } from "./shared-logo";

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

interface ReportConfig {
    printFriendly?: boolean;
    jobPackId?: number;
    structureId?: number;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

/**
 * ROV Photography Log Report (Portrait)
 * Displays a tabular list of photos attached to inspections.
 */
export const generateROVPhotographyLogReport = async (
    photos: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 12;
        const contentWidth = pageWidth - (margin * 2);

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
        };

        // If no photos, return a document with an empty state message
        if (!photos || photos.length === 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(150, 150, 150);
            doc.text("NO PHOTOS FOUND FOR THIS SELECTION", pageWidth / 2, 140, { align: "center" });
            doc.setFontSize(10);
            doc.text("Please ensure photos are attached to the inspection records.", pageWidth / 2, 150, { align: "center" });
            
            if (config.returnBlob) return doc.output("blob");
            return;
        }

        // Pre-load logos
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        const HEADER_H = 22;

        const drawHeaderFooter = (d: jsPDF, pageNum: number, totalPages: number) => {
            const isPF = config.printFriendly;
            
            // Header
            if (isPF) {
                d.setDrawColor(...colors.navy);
                d.setLineWidth(0.5);
                d.rect(margin, margin, contentWidth, HEADER_H, "S");
                d.setTextColor(...colors.navy);
            } else {
                d.setFillColor(...colors.navy);
                d.rect(margin, margin, contentWidth, HEADER_H, "F");
                d.setTextColor(255);
            }

            if (companyLogo) drawLogo(d, companyLogo, 16, 16, pageWidth - margin - 20, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 16, 16, margin + 4, margin + 3, "left", "center");

            d.setFontSize(8); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Inspection Division", margin + contentWidth / 2, margin + 10, { align: "center" });
            d.setFontSize(12); d.setFont("helvetica", "bold");
            d.text("ROV Photography Log Report", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`, margin + contentWidth / 2, margin + 21, { align: "center" });

            // Context Row
            const rowY = margin + HEADER_H + 2;
            const half = contentWidth / 2;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            d.rect(margin, rowY, contentWidth, 7, "S");
            d.setTextColor(...colors.text); d.setFontSize(7); d.setFont("helvetica", "bold");
            d.text("Structure:", margin + 2, rowY + 4.5);
            d.setFont("helvetica", "normal");
            d.text(headerData.platformName || "N/A", margin + 18, rowY + 4.5);

            d.setFont("helvetica", "bold");
            d.text("Vessel:", margin + half + 2, rowY + 4.5);
            d.setFont("helvetica", "normal");
            d.text(headerData.vessel || "N/A", margin + half + 14, rowY + 4.5);

            // Footer
            if (config.showPageNumbers !== false) {
                d.setFontSize(7);
                d.setTextColor(100);
                d.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
                d.text(format(new Date(), "dd MMM yyyy HH:mm"), margin, pageHeight - 10);
            }
        };

        const isPF = config.printFriendly;
        const startY = margin + HEADER_H + 12;

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin },
            head: [
                ['Item No.', 'Real Time', 'Photo Title', 'Details']
            ],
            body: photos.map((p, idx) => {
                let meta = p.meta || {};
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                }

                const itemNo = (idx + 1).toString();
                const realTime = p.created_at ? format(new Date(p.created_at), 'dd MMM yyyy HH:mm') : 'N/A';
                const photoTitle = (meta.title || p.name || `Photo ${idx + 1}`).toUpperCase();
                
                let details = meta.description || "";
                if (p.anomaly_ref) {
                    details = details ? `${details} (Anomaly Ref: ${p.anomaly_ref})` : `Anomaly Ref: ${p.anomaly_ref}`;
                }

                return [itemNo, realTime, photoTitle, details];
            }),
            theme: 'grid',
            headStyles: { 
                fillColor: isPF ? [255,255,255] : colors.navy, 
                textColor: isPF ? colors.navy : 255, 
                fontSize: 8, 
                fontStyle: 'bold', 
                halign: 'center' 
            },
            styles: { 
                fontSize: 7.5, 
                cellPadding: 2, 
                textColor: colors.text, 
                lineColor: colors.border 
            },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                1: { cellWidth: 35, halign: 'center' },
                2: { cellWidth: 50 },
                3: { cellWidth: 'auto' }
            },
            didDrawPage: (data) => {
                drawHeaderFooter(doc, data.pageNumber, doc.internal.pages.length - 1);
            }
        });

        // Add Signatures if requested
        if (config.showSignatures !== false) {
            const totalPages = doc.internal.pages.length - 1;
            // Go to the last page
            doc.setPage(totalPages);
            
            const sigY = pageHeight - 35;
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1); doc.rect(lx, sigY, sigW - 5, 15);
                doc.setFillColor(...colors.navy); doc.rect(lx, sigY, sigW - 5, 4, 'F');
                doc.setTextColor(255); doc.setFontSize(7); doc.text(label, lx + 2, sigY + 3);
                doc.setTextColor(...colors.text); doc.setFontSize(6); 
                doc.text('Name:', lx + 2, sigY + 10);
                doc.text('Date:', lx + 2, sigY + 13);
            };

            drawSig('PREPARED BY', margin);
            drawSig('REVIEWED BY', margin + sigW);
            drawSig('APPROVED BY', margin + (sigW * 2));
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Photography_Log_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("Photography Log Report Error", e);
        throw e;
    }
};
