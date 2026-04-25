import jsPDF from "jspdf";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo } from "./shared-logo";
import { createClient } from "@/utils/supabase/client";

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
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

// Helper to load images with better error handling
const loadPhotoData = async (url: string) => {
    try {
        const result = await loadLogoWithTransparency(url);
        return result;
    } catch (e) {
        console.warn(`Failed to load photo: ${url}`, e);
        return null;
    }
};

/**
 * ROV Photography Report (Portrait)
 * Displays images in a 2-column grid, 6 photos per page.
 */
export const generateROVPhotographyReport = async (
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

        const supabase = createClient();

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

        const colors = {
            navy: [31, 55, 93] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
        };

        // Pre-load logos
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        if (headerData.contractorLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(headerData.contractorLogoUrl); } catch (_) {}
        }

        const HEADER_H = 24;

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

            if (companyLogo) drawLogo(d, companyLogo, 18, 18, pageWidth - margin - 22, margin + 3, "right", "center");
            if (contractorLogo) drawLogo(d, contractorLogo, 18, 18, margin + 4, margin + 3, "left", "center");

            d.setFontSize(9); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
            d.setFontSize(7); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Inspection Division", margin + contentWidth / 2, margin + 10, { align: "center" });
            d.setFontSize(13); d.setFont("helvetica", "bold");
            d.text("ROV Photography Report", margin + contentWidth / 2, margin + 17, { align: "center" });
            d.setFontSize(7.5); d.setFont("helvetica", "normal");
            d.text(`SOW Report No: ${headerData.sowReportNo || "N/A"}`, margin + contentWidth / 2, margin + 22, { align: "center" });

            // Context Row
            const rowY = margin + HEADER_H + 2;
            const half = contentWidth / 2;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            d.rect(margin, rowY, contentWidth, 7, "S");
            d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold");
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

        const PHOTOS_PER_PAGE = 6;
        const totalPages = Math.max(1, Math.ceil(photos.length / PHOTOS_PER_PAGE));
        
        const imgGap = 6;
        const imgWidth = (contentWidth - imgGap) / 2;
        const imgHeight = 65;
        const rowHeight = imgHeight + 18; // 5 for title, 8 for description gap
        
        let currentPhotoIdx = 0;

        for (let p = 1; p <= totalPages; p++) {
            if (p > 1) doc.addPage();
            
            drawHeaderFooter(doc, p, totalPages);
            
            let yPos = margin + HEADER_H + 15;
            
            for (let i = 0; i < PHOTOS_PER_PAGE; i++) {
                if (currentPhotoIdx >= photos.length) break;
                
                const photo = photos[currentPhotoIdx];
                const col = i % 2;
                const row = Math.floor(i / 2);
                
                const xPos = margin + (col * (imgWidth + imgGap));
                const currentY = yPos + (row * rowHeight);
                
                // 1. Photo Title (Top)
                let meta = photo.meta || {};
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                }
                
                const title = (meta.title || photo.name || `Photo ${currentPhotoIdx + 1}`).toUpperCase();
                doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                doc.text(title, xPos + imgWidth / 2, currentY - 2, { align: "center", maxWidth: imgWidth });

                // 2. Image
                try {
                    // Sanitize path - ensure it's not a filter string or malformed
                    const path = photo.path || "";
                    if (!path || path.includes('=') || path.length < 5) {
                        console.warn("Skipping invalid photo path:", path);
                        continue;
                    }

                    const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(path);
                    const url = publicUrlData.publicUrl;
                    const imgData = await loadPhotoData(url);
                    if (imgData) {
                        doc.addImage(imgData.data, 'PNG', xPos, currentY, imgWidth, imgHeight);
                    } else {
                        doc.setDrawColor(200); doc.rect(xPos, currentY, imgWidth, imgHeight);
                        doc.setFontSize(8); doc.text("Image Load Failed", xPos + imgWidth / 2, currentY + imgHeight / 2, { align: "center" });
                    }
                } catch (e) {
                    doc.setDrawColor(200); doc.rect(xPos, currentY, imgWidth, imgHeight);
                }

                // 3. Description (Bottom)
                let description = meta.description || "";
                if (photo.anomaly_ref) {
                    description = description ? `${description} (Anomaly Ref: ${photo.anomaly_ref})` : `Anomaly Ref: ${photo.anomaly_ref}`;
                }
                
                if (description) {
                    doc.setFontSize(7); doc.setFont("helvetica", "normal");
                    doc.setTextColor(60);
                    const splitDesc = doc.splitTextToSize(description, imgWidth);
                    doc.text(splitDesc, xPos + imgWidth / 2, currentY + imgHeight + 4, { align: "center" });
                }

                currentPhotoIdx++;
            }
        }

        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Photography_Report_${headerData.sowReportNo}_${format(new Date(), 'yyyyMMdd')}.pdf`);

    } catch (e) {
        console.error("Photography Report Error", e);
        throw e;
    }
};
