import { jsPDF } from "jspdf";
import { PDFDocument, PDFName, PDFArray, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { loadLogoWithTransparency, REPORT_FOOTER_APP_TEXT } from "./shared-logo";

export interface TOCReportItem {
    id: string;
    name: string;
    mode?: string;
    pageNum?: number;
    pageCount?: number;
}

export interface TOCSectionItem {
    id: number | string;
    name: string;
    pageNum?: number;
    templates: TOCReportItem[];
}

export interface TOCLinkTarget {
    pageNum: number;
    tocPageIndex: number;
    rect: {
        x: number; // in mm
        y: number; // in mm
        w: number; // in mm
        h: number; // in mm
    };
}

export interface FinalDatasheetCoverOptions {
    structureName?: string;
    fieldName?: string;
    jobPackName?: string;
    sowReportNo?: string;
    clientName?: string;
    contractorName?: string;
    companyName?: string;
    logoUrl?: string;
    contractorLogoUrl?: string;
    inspectionModes?: string;
    dateStr?: string;
    isPipeline?: boolean;
    structureType?: "platform" | "pipeline";
    preparedBy?: { name?: string; date?: string; position?: string };
    reviewedBy?: { name?: string; date?: string; position?: string };
    approvedBy?: { name?: string; date?: string; position?: string };
}

/**
 * Generates an executive, professional Front Cover Page for the Final Inspection Datasheet
 */
export const generateMainCoverPage = async (options: FinalDatasheetCoverOptions = {}): Promise<Blob> => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth(); // 210mm
    const ph = doc.internal.pageSize.getHeight(); // 297mm

    // Background: Crisp Executive White
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, ph, "F");

    // Decorative Dual Borders
    doc.setDrawColor(37, 99, 235); // blue-600 accent
    doc.setLineWidth(1.6);
    doc.rect(10, 10, pw - 20, ph - 20);

    doc.setDrawColor(203, 213, 225); // slate-300 hairline
    doc.setLineWidth(0.4);
    doc.rect(13, 13, pw - 26, ph - 26);

    // Corner decorative accents
    doc.setFillColor(37, 99, 235);
    doc.rect(10, 10, 14, 2, "F");
    doc.rect(10, 10, 2, 14, "F");
    doc.rect(pw - 24, 10, 14, 2, "F");
    doc.rect(pw - 12, 10, 2, 14, "F");
    doc.rect(10, ph - 12, 14, 2, "F");
    doc.rect(10, ph - 24, 2, 14, "F");
    doc.rect(pw - 24, ph - 12, 14, 2, "F");
    doc.rect(pw - 12, ph - 24, 2, 14, "F");

    // 1. Company Logo at Top and Centre of the Cover Page
    let logoDrawn = false;
    const logoTargetUrl = options.logoUrl || options.contractorLogoUrl || "";
    if (logoTargetUrl) {
        try {
            const logoImg = await loadLogoWithTransparency(logoTargetUrl);
            if (logoImg && logoImg.data && logoImg.width && logoImg.height) {
                const maxLogoW = 54;
                const maxLogoH = 20;
                const scale = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height, 1);
                const drawW = logoImg.width * scale;
                const drawH = logoImg.height * scale;
                const drawX = (pw - drawW) / 2;
                const drawY = 20 + ((maxLogoH - drawH) / 2);
                doc.addImage(logoImg.data, "PNG", drawX, drawY, drawW, drawH);
                logoDrawn = true;
            }
        } catch (err) {
            console.warn("Failed to render company logo on cover page:", err);
        }
    }

    // Top Header Badge / Category
    const badgeY = logoDrawn ? 44 : 24;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(pw / 2 - 42, badgeY, 84, 6.5, 1.2, 1.2, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text("OFFSHORE INSPECTION DOSSIER", pw / 2, badgeY + 4.5, { align: "center" });

    // Main Title
    const titleY = badgeY + 16;
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(23);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL INSPECTION DATASHEET", pw / 2, titleY, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Comprehensive Inspection Results & Structural Verification Records", pw / 2, titleY + 7.5, { align: "center" });

    // Accent Divider Line
    const divY = titleY + 13.5;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1.0);
    doc.line(pw / 2 - 35, divY, pw / 2 + 35, divY);

    // Structure / Project Metadata Card (Detail Box)
    const cardX = 20;
    const cardY = divY + 8;
    const cardW = pw - 40; // 170mm
    const cardH = 86;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cardX, cardY, cardW, cardH, 2.5, 2.5, "F");
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.roundedRect(cardX, cardY, cardW, cardH, 2.5, 2.5, "S");

    // Card Header Bar
    doc.setFillColor(15, 23, 42); // slate-900 corporate header
    doc.rect(cardX, cardY, cardW, 9.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("PROJECT & ASSET SPECIFICATIONS", cardX + 8, cardY + 6.5);

    // Detail Box rows:
    // a. First the Client name : - Company name
    // d. Contractor name : fetch from the Jobpack details, not the client name, place after the Client name
    // b. if structure is Platform , then Platform Title otherwise Pipeline Title
    //    Field / Location
    // c. Just provide Jobpack: for the jobpack label
    //    SOW Report Number
    //    Inspection Modes
    // e. Remove issue name / date
    const isPlatform = !options.isPipeline && options.structureType !== "pipeline";
    const structureLabel = isPlatform ? "PLATFORM TITLE:" : "PIPELINE TITLE:";
    const clientVal = options.clientName || options.companyName || "Petronas Carigali Sdn Bhd (SKA)";
    const contractorVal = options.contractorName || "NasQuest Resources Sdn Bhd";

    const metaFields = [
        { label: "CLIENT:", val: clientVal },
        { label: "CONTRACTOR:", val: contractorVal },
        { label: structureLabel, val: options.structureName || "BODP-A" },
        { label: "FIELD / LOCATION:", val: options.fieldName || "BOKOR FIELD" },
        { label: "JOBPACK:", val: options.jobPackName || "UIMC2026/SKA/PLAT01" },
        { label: "SOW REPORT NUMBER:", val: options.sowReportNo || "N/A" },
        { label: "INSPECTION MODES:", val: options.inspectionModes || "ROV & Diving Consolidated" },
    ];

    metaFields.forEach((m, idx) => {
        const my = cardY + 16.5 + (idx * 10);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(m.label, cardX + 8, my);

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(m.val, cardX + 54, my);

        if (idx < metaFields.length - 1) {
            doc.setDrawColor(241, 245, 249); // slate-100 hairline
            doc.setLineWidth(0.15);
            doc.line(cardX + 6, my + 3.2, cardX + cardW - 6, my + 3.2);
        }
    });

    // Document Control Section (4 columns)
    // f. At Document Control Section add one entry. Report Produced By, NasQuest Resources Sdn Bhd, {Todays Date}
    // g. Rest Prepared By, Reviewed By and Approved By leave it as it is
    // h. But the designation Place just provide Position: and Date: as blank
    const sigY = cardY + cardH + 7; // around 187
    const sigH = 62;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cardX, sigY, cardW, sigH, 2.5, 2.5, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(cardX, sigY, cardW, sigH, 2.5, 2.5, "S");

    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(cardX, sigY, cardW, 8.5, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("DOCUMENT CONTROL & ENDORSEMENTS", cardX + 8, sigY + 5.8);

    const todayDateStr = options.dateStr || new Date().toISOString().split("T")[0];

    const sigCols = [
        {
            isProducedBy: true,
            title: "REPORT PRODUCED BY",
            company: "NasQuest Resources Sdn Bhd",
            date: todayDateStr,
        },
        {
            isProducedBy: false,
            title: "PREPARED BY",
            data: options.preparedBy,
        },
        {
            isProducedBy: false,
            title: "REVIEWED BY",
            data: options.reviewedBy,
        },
        {
            isProducedBy: false,
            title: "APPROVED BY",
            data: options.approvedBy,
        },
    ];

    const colW = (cardW - 8) / 4;

    sigCols.forEach((sc, cIdx) => {
        const cx = cardX + 4 + (cIdx * colW);
        const cy = sigY + 14;

        // Title
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(sc.title, cx + 2, cy);

        if (sc.isProducedBy) {
            // Report Produced By content:
            // Application Name & Version No. before company name
            doc.setFontSize(7.2);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(37, 99, 235); // blue-600 accent
            doc.text(REPORT_FOOTER_APP_TEXT, cx + 2, cy + 10);

            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text(sc.company || "NasQuest Resources Sdn Bhd", cx + 2, cy + 18);

            doc.setFontSize(6.8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text(`Date: ${sc.date}`, cx + 2, cy + 26);
        } else {
            // Signature Line
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.3);
            doc.line(cx + 2, cy + 18, cx + colW - 6, cy + 18);

            // Designation place: just provide Position: and Date: as blank
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text("Position: ________________", cx + 2, cy + 26);
            doc.text("Date:     ________________", cx + 2, cy + 34);
        }

        // Column separator
        if (cIdx < sigCols.length - 1) {
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.2);
            doc.line(cx + colW, sigY + 11, cx + colW, sigY + sigH - 4);
        }
    });

    // Bottom Branding Footer
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("CONFIDENTIAL  •  OFFSHORE STRUCTURAL INTEGRITY ASSESSMENT REPORT  •  NASQUEST RESOURCES", pw / 2, ph - 16, { align: "center" });

    // Application Name & Version Footer
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(REPORT_FOOTER_APP_TEXT, 14, ph - 6);

    const blob: any = doc.output("blob");
    if (!blob.arrayBuffer) {
        blob.arrayBuffer = async () => doc.output("arraybuffer");
    }
    return blob;
};

/**
 * Generates Table of Contents (TOC) Pages with Page Numbers and records Clickable Link bounding boxes
 */
export const generateTOCPages = async (
    sections: TOCSectionItem[],
    totalDocumentPages: number,
    options: FinalDatasheetCoverOptions = {}
): Promise<{ blobs: Blob[]; linkTargets: TOCLinkTarget[] }> => {
    const pw = 210;
    const ph = 297;
    const linkTargets: TOCLinkTarget[] = [];
    const blobs: Blob[] = [];

    // Flatten items to determine pagination
    // A section header consumes ~9mm, a template item consumes ~6.8mm
    const maxItemsPerPage = 22;
    const allEntries: Array<{ isSection: boolean; title: string; mode?: string; pageNum: number; sectionName?: string }> = [];

    sections.forEach(sec => {
        allEntries.push({ isSection: true, title: sec.name, pageNum: sec.pageNum || 1 });
        sec.templates.forEach(t => {
            allEntries.push({ isSection: false, title: t.name, mode: t.mode, pageNum: t.pageNum || 1, sectionName: sec.name });
        });
    });

    // Chunk into pages
    const pageChunks: typeof allEntries[] = [];
    let currentChunk: typeof allEntries = [];

    allEntries.forEach(entry => {
        if (currentChunk.length >= maxItemsPerPage) {
            pageChunks.push(currentChunk);
            currentChunk = [];
        }
        currentChunk.push(entry);
    });
    if (currentChunk.length > 0 || pageChunks.length === 0) {
        pageChunks.push(currentChunk);
    }

    const totalTOCPages = pageChunks.length;

    pageChunks.forEach((chunk, pageIdx) => {
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

        // Header Background
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pw, 38, "F");
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(0, 38, pw, 38);

        // Header Titles
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42); // slate-900
        const headerTitle = totalTOCPages > 1 ? `TABLE OF CONTENTS (Page ${pageIdx + 1} of ${totalTOCPages})` : "TABLE OF CONTENTS";
        doc.text(headerTitle, 15, 17);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        const subInfo = [
            options.structureName ? `Structure: ${options.structureName}` : "",
            options.fieldName ? `Field: ${options.fieldName}` : "",
            options.jobPackName ? `Jobpack: ${options.jobPackName}` : "",
        ].filter(Boolean).join("  •  ");
        doc.text(subInfo || "Final Inspection Datasheet • Document Sections & Page Navigation", 15, 25);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 99, 235);
        doc.text(`Total Document Pages: ${totalDocumentPages}`, pw - 15, 25, { align: "right" });

        // Column Header Bar
        const colHeaderY = 42;
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(15, colHeaderY, pw - 30, 7.5, "F");
        doc.setDrawColor(51, 65, 85);
        doc.setLineWidth(0.15);
        doc.rect(15, colHeaderY, pw - 30, 7.5, "S");

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("SECTION / REPORT TEMPLATE", 20, colHeaderY + 5.0);
        doc.text("PAGE NO.", pw - 20, colHeaderY + 5.0, { align: "right" });

        // Render Entries
        let rowY = colHeaderY + 14.0;

        chunk.forEach(entry => {
            if (entry.isSection) {
                // Section Header Row
                const boxH = 7.0;
                doc.setFillColor(241, 245, 249); // slate-100
                doc.roundedRect(15, rowY - 5.0, pw - 30, boxH, 1, 1, "F");
                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.12);
                doc.roundedRect(15, rowY - 5.0, pw - 30, boxH, 1, 1, "S");

                doc.setFontSize(8.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text(entry.title.toUpperCase(), 19, rowY);

                doc.setFontSize(8.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(37, 99, 235);
                doc.text(`Page ${entry.pageNum}`, pw - 20, rowY, { align: "right" });

                // Link bounds
                linkTargets.push({
                    pageNum: entry.pageNum,
                    tocPageIndex: pageIdx,
                    rect: { x: 15, y: rowY - 5.0, w: pw - 30, h: boxH },
                });

                rowY += 9.0;
            } else {
                // Report Sub-Item Row
                const boxH = 6.2;
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(51, 65, 85);
                doc.text(entry.title, 24, rowY);

                // Dot Leader Line connecting title to page number (extended now that MODE column is removed)
                const titleW = doc.getTextWidth(entry.title);
                const dotStartX = 26 + titleW;
                const dotEndX = pw - 36;
                if (dotEndX > dotStartX) {
                    doc.setFontSize(7);
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(203, 213, 225);
                    let dots = "";
                    while (doc.getTextWidth(dots + " .") < (dotEndX - dotStartX)) {
                        dots += " .";
                    }
                    doc.text(dots, dotStartX, rowY);
                }

                // Page Number Tag
                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text(`Page ${entry.pageNum}`, pw - 20, rowY, { align: "right" });

                // Thin border line below the row
                doc.setDrawColor(226, 232, 240);
                doc.setLineWidth(0.12);
                doc.line(18, rowY + 2.8, pw - 18, rowY + 2.8);

                // Link bounds
                linkTargets.push({
                    pageNum: entry.pageNum,
                    tocPageIndex: pageIdx,
                    rect: { x: 15, y: rowY - 4.2, w: pw - 30, h: boxH },
                });

                rowY += 6.8;
            }
        });

        // Bottom Navigation Tip & Help
        doc.setFillColor(248, 250, 252);
        doc.rect(15, ph - 22, pw - 30, 8, "F");
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.1);
        doc.rect(15, ph - 22, pw - 30, 8, "S");

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(71, 85, 105);
        doc.text("Interactive Document Navigation: Click on any section title, sub-report, or page number to jump directly to that page.", pw / 2, ph - 17, { align: "center" });

        // Application Name & Version Footer
        doc.setFontSize(6.8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(REPORT_FOOTER_APP_TEXT, 15, ph - 6);

        const blob: any = doc.output("blob");
        if (!blob.arrayBuffer) {
            blob.arrayBuffer = async () => doc.output("arraybuffer");
        }
        blobs.push(blob);
    });

    return { blobs, linkTargets };
};

/**
 * Generates an executive, dedicated Cover Page for the Inspection Summary section
 */
export const generateInspectionSummaryCoverPage = async (options: FinalDatasheetCoverOptions = {}): Promise<Blob> => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth(); // 210mm
    const ph = doc.internal.pageSize.getHeight(); // 297mm

    // Background: Executive Crisp Off-White
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, 0, pw, ph, "F");

    // Dual Decorative Borders
    doc.setDrawColor(37, 99, 235); // blue-600 accent
    doc.setLineWidth(1.6);
    doc.rect(14, 14, pw - 28, ph - 28);

    doc.setDrawColor(203, 213, 225); // slate-300 hairline
    doc.setLineWidth(0.4);
    doc.rect(17, 17, pw - 34, ph - 34);

    // Corner decorative brackets (top-left, top-right, bottom-left, bottom-right)
    doc.setFillColor(37, 99, 235);
    // Top-left
    doc.rect(14, 14, 12, 1.8, "F");
    doc.rect(14, 14, 1.8, 12, "F");
    // Top-right
    doc.rect(pw - 26, 14, 12, 1.8, "F");
    doc.rect(pw - 15.8, 14, 1.8, 12, "F");
    // Bottom-left
    doc.rect(14, ph - 15.8, 12, 1.8, "F");
    doc.rect(14, ph - 26, 1.8, 12, "F");
    // Bottom-right
    doc.rect(pw - 26, ph - 15.8, 12, 1.8, "F");
    doc.rect(pw - 15.8, ph - 26, 1.8, 12, "F");

    // Top Category Pill Badge
    doc.setFillColor(238, 242, 255); // indigo-50
    doc.roundedRect(pw / 2 - 44, 28, 88, 7.5, 1.5, 1.5, "F");
    doc.setDrawColor(199, 210, 254); // indigo-200
    doc.setLineWidth(0.3);
    doc.roundedRect(pw / 2 - 44, 28, 88, 7.5, 1.5, 1.5, "S");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(67, 56, 202); // indigo-700
    doc.text("EXECUTIVE INTEGRITY & OVERVIEW SECTION", pw / 2, 33, { align: "center" });

    // Section Category Subtitle
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text("FINAL INSPECTION DATASHEET", pw / 2, 47, { align: "center" });

    // Main Section Title
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text("INSPECTION SUMMARY", pw / 2, 58, { align: "center" });

    // Subtitle
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Operational Scope Coverage, Asset Integrity & Anomaly Assessment", pw / 2, 65.5, { align: "center" });

    // Decorative Graphic Divider with Center Circle
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(pw / 2 - 45, 72, pw / 2 - 5, 72);
    doc.line(pw / 2 + 5, 72, pw / 2 + 45, 72);

    doc.setFillColor(37, 99, 235);
    doc.circle(pw / 2, 72, 1.5, "F");

    // 1. Asset & Scope Parameters Card
    const cardX = 22;
    const cardY = 80;
    const cardW = pw - 44;
    const cardH = 74;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, "F");
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.4);
    doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, "S");

    // Card Header Bar
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(cardX, cardY, cardW, 8.5, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("ASSET & INSPECTION SCOPE PARAMETERS", cardX + 8, cardY + 5.8);

    const metaFields = [
        { label: "STRUCTURE / PLATFORM:", val: options.structureName || "BODP-A" },
        { label: "FIELD / LOCATION:", val: options.fieldName || "BOKOR FIELD" },
        { label: "JOBPACK REFERENCE:", val: options.jobPackName || "UIMC2026/SKA/PLAT01" },
        { label: "SOW REPORT NUMBER:", val: options.sowReportNo || "AM26-016-01" },
        { label: "INSPECTION SCOPE / MODE:", val: options.inspectionModes || "ROV & Diving Consolidated" },
        { label: "INSPECTION CONTRACTOR:", val: options.contractorName || options.companyName || "NasQuest Resources Sdn Bhd" },
        { label: "REPORT ISSUE DATE:", val: options.dateStr || new Date().toISOString().split("T")[0] },
    ];

    metaFields.forEach((m, idx) => {
        const my = cardY + 15.5 + (idx * 8);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(m.label, cardX + 8, my);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(m.val, cardX + 62, my);

        if (idx < metaFields.length - 1) {
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.1);
            doc.line(cardX + 6, my + 2.4, cardX + cardW - 6, my + 2.4);
        }
    });

    // 2. Included Executive Integrity Modules Card
    const modY = 160;
    const modH = 78;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cardX, modY, cardW, modH, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.roundedRect(cardX, modY, cardW, modH, 2, 2, "S");

    // Module Header Bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(cardX, modY, cardW, 8.5, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("EXECUTIVE INTEGRITY EVALUATIONS INCLUDED IN THIS SECTION", cardX + 8, modY + 5.8);

    const modules = [
        {
            title: "Task Coverage & SOW Progress",
            desc: "Operational completion metrics tracking ROV and Diving tasks against planned scope.",
            badge: "COVERAGE"
        },
        {
            title: "Anomaly & Defect Priority Breakdown",
            desc: "Active anomaly status distribution across Priority 1, 2, 3 and Observations.",
            badge: "DEFECTS"
        },
        {
            title: "Cathodic Protection Potential (CP)",
            desc: "Structural polarization measurements and sacrificial anode health evaluation.",
            badge: "CP SURVEY"
        },
        {
            title: "Marine Growth Survey Profiles (MGI)",
            desc: "Depth-wise biological growth thickness profiles and hard/soft band classification.",
            badge: "MARINE GROWTH"
        },
        {
            title: "Base Level & Seabed Scour Survey",
            desc: "Platform leg seabed depression readings compared against allowable scour thresholds.",
            badge: "SCOUR SURVEY"
        }
    ];

    modules.forEach((mod, idx) => {
        const itemY = modY + 15 + (idx * 12);

        // Badge pill
        doc.setFillColor(239, 246, 255); // blue-50
        doc.roundedRect(cardX + 7, itemY - 3.8, 24, 5.2, 1, 1, "F");
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 99, 235); // blue-600
        doc.text(mod.badge, cardX + 19, itemY - 0.2, { align: "center" });

        // Title
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(mod.title, cardX + 34, itemY - 0.2);

        // Description
        doc.setFontSize(6.8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(mod.desc, cardX + 34, itemY + 3.8);

        if (idx < modules.length - 1) {
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.1);
            doc.line(cardX + 6, itemY + 6.2, cardX + cardW - 6, itemY + 6.2);
        }
    });

    // Signatures / Personnel Summary Footer Block
    const signY = 244;
    const signH = 22;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(cardX, signY, cardW, signH, 1.5, 1.5, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(cardX, signY, cardW, signH, 1.5, 1.5, "S");

    const signCols = [
        { label: "PREPARED BY", name: options.preparedBy?.name || "Inspection Lead", date: options.preparedBy?.date || options.dateStr || "" },
        { label: "REVIEWED BY", name: options.reviewedBy?.name || "Senior QA Engineer", date: options.reviewedBy?.date || options.dateStr || "" },
        { label: "APPROVED BY", name: options.approvedBy?.name || "Technical Director", date: options.approvedBy?.date || options.dateStr || "" },
    ];

    const colW = cardW / 3;
    signCols.forEach((col, idx) => {
        const cx = cardX + (idx * colW);
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text(col.label, cx + 6, signY + 5.5);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(col.name, cx + 6, signY + 11.5);

        if (col.date) {
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(148, 163, 184);
            doc.text(`Date: ${col.date}`, cx + 6, signY + 16.5);
        }

        if (idx < 2) {
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.line(cx + colW, signY + 3, cx + colW, signY + signH - 3);
        }
    });

    // Bottom Subtle Watermark / Confidentiality Notice
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("CONFIDENTIAL  •  OFFSHORE STRUCTURAL INTEGRITY ASSESSMENT REPORT  •  NASQUEST RESOURCES", pw / 2, ph - 18, { align: "center" });

    // Application Name & Version Footer
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(REPORT_FOOTER_APP_TEXT, 14, ph - 6);

    const blob: any = doc.output("blob");
    if (!blob.arrayBuffer) {
        blob.arrayBuffer = async () => doc.output("arraybuffer");
    }
    return blob;
};

/**
 * Generates a clean Section Divider Cover Page
 */
export const generateSectionDividerPage = async (sectionName: string, options: FinalDatasheetCoverOptions = {}): Promise<Blob> => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Background: Clean Executive White
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, ph, "F");

    // Decorative Borders
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1.8);
    doc.rect(15, 15, pw - 30, ph - 30);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(18, 18, pw - 36, ph - 36);

    // Corner decorative accents
    doc.setFillColor(37, 99, 235);
    doc.rect(15, 15, 12, 1.8, "F");
    doc.rect(15, 15, 1.8, 12, "F");
    doc.rect(pw - 27, 15, 12, 1.8, "F");
    doc.rect(pw - 16.8, 15, 1.8, 12, "F");
    doc.rect(15, ph - 16.8, 12, 1.8, "F");
    doc.rect(15, ph - 27, 1.8, 12, "F");
    doc.rect(pw - 27, ph - 16.8, 12, 1.8, "F");
    doc.rect(pw - 16.8, ph - 27, 1.8, 12, "F");

    // Main Section Title - Aligned to exact centre of the page vertically and horizontally!
    // Subheaders above ("FINAL DATASHEET SECTION") and below ("Detailed Inspection Sheets...") are removed.
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    const splitTitle = doc.splitTextToSize(sectionName.toUpperCase(), pw - 60);
    const lineHeight = 12; // mm
    const totalH = splitTitle.length * lineHeight;
    const centerY = (ph / 2) - (totalH / 2) + (lineHeight * 0.7);
    doc.text(splitTitle, pw / 2, centerY, { align: "center", lineHeightFactor: 1.25 });

    // Metadata Footer at bottom
    if (options.structureName || options.jobPackName) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(148, 163, 184);
        const sub = [options.structureName, options.fieldName, options.jobPackName].filter(Boolean).join("  •  ");
        doc.text(sub, pw / 2, ph - 26, { align: "center" });
    }

    // Application Name & Version Footer
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(REPORT_FOOTER_APP_TEXT, 15, ph - 6);

    const blob: any = doc.output("blob");
    if (!blob.arrayBuffer) {
        blob.arrayBuffer = async () => doc.output("arraybuffer");
    }
    return blob;
};

/**
 * Attaches interactive PDF Link Annotations to the TOC pages in a merged PDFDocument
 */
export const applyTOCLinksToPdf = (
    mergedPdf: PDFDocument,
    tocPages: PDFPage[],
    linkTargets: TOCLinkTarget[]
): void => {
    const context = mergedPdf.context;

    linkTargets.forEach(lt => {
        const targetPageIndex = lt.pageNum - 1;
        if (targetPageIndex >= 0 && targetPageIndex < mergedPdf.getPageCount() && lt.tocPageIndex < tocPages.length) {
            const targetPage = mergedPdf.getPage(targetPageIndex);
            const tocPage = tocPages[lt.tocPageIndex];
            const ph = tocPage.getHeight(); // in points

            // Convert mm to PDF points (1 mm = 72 / 25.4 = 2.83465 points)
            // PDF origin is at bottom-left: y1 = ph - (y + h), y2 = ph - y
            const x1 = lt.rect.x * 2.83465;
            const x2 = (lt.rect.x + lt.rect.w) * 2.83465;
            const y1 = ph - ((lt.rect.y + lt.rect.h) * 2.83465);
            const y2 = ph - (lt.rect.y * 2.83465);

            const linkAnnot = context.obj({
                Type: "Annot",
                Subtype: "Link",
                Rect: [x1, y1, x2, y2],
                Border: [0, 0, 0],
                Dest: [targetPage.ref, "Fit"],
            });
            const linkRef = context.register(linkAnnot);

            const annots = tocPage.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
            if (annots) {
                annots.push(linkRef);
            } else {
                tocPage.node.set(PDFName.of("Annots"), context.obj([linkRef]));
            }
        }
    });
};

/**
 * Generates an executive, professional "End of Report" Cover Page for the Final Inspection Datasheet
 */
export const generateEndOfReportCoverPage = async (options: FinalDatasheetCoverOptions = {}): Promise<Blob> => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth(); // 210mm
    const ph = doc.internal.pageSize.getHeight(); // 297mm

    // Background: Crisp Executive White matching Front Cover
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pw, ph, "F");

    // Dual Decorative Borders matching Front Cover
    doc.setDrawColor(37, 99, 235); // blue-600 accent
    doc.setLineWidth(1.6);
    doc.rect(10, 10, pw - 20, ph - 20);

    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.rect(13, 13, pw - 26, ph - 26);

    // Corner decorative accents
    doc.setFillColor(37, 99, 235);
    doc.rect(10, 10, 14, 2, "F");
    doc.rect(10, 10, 2, 14, "F");
    doc.rect(pw - 24, 10, 14, 2, "F");
    doc.rect(pw - 12, 10, 2, 14, "F");
    doc.rect(10, ph - 12, 14, 2, "F");
    doc.rect(10, ph - 24, 2, 14, "F");
    doc.rect(pw - 24, ph - 12, 14, 2, "F");
    doc.rect(pw - 12, ph - 24, 2, 14, "F");

    // Top Header Badge
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(pw / 2 - 46, 22, 92, 7, 1.5, 1.5, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text("OFFSHORE INSPECTION DOSSIER  •  TECHNICAL CONCLUSION", pw / 2, 26.8, { align: "center" });

    // Center Decorative Concluded Seal
    const sealY = 56;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1.2);
    doc.circle(pw / 2, sealY, 13, "S");

    doc.setDrawColor(56, 189, 248); // sky-400
    doc.setLineWidth(0.5);
    doc.circle(pw / 2, sealY, 10.5, "S");

    doc.setFillColor(241, 245, 249);
    doc.circle(pw / 2, sealY, 9.5, "F");

    // Checkmark icon inside seal
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1.5);
    doc.line(pw / 2 - 4.2, sealY - 0.2, pw / 2 - 1.0, sealY + 3.2);
    doc.line(pw / 2 - 1.0, sealY + 3.2, pw / 2 + 4.5, sealY - 3.5);

    // Main Title
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text("END OF REPORT", pw / 2, 84, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Final Inspection Datasheet compilation package successfully concluded.", pw / 2, 92, { align: "center" });

    // Decorative Graphic Divider
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(pw / 2 - 40, 98, pw / 2 - 5, 98);
    doc.line(pw / 2 + 5, 98, pw / 2 + 40, 98);
    doc.setFillColor(37, 99, 235);
    doc.circle(pw / 2, 98, 1.5, "F");

    // Dossier Parameters Card
    const cardX = 20;
    const cardY = 107;
    const cardW = pw - 40;
    const cardH = 82;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cardX, cardY, cardW, cardH, 2.5, 2.5, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(cardX, cardY, cardW, cardH, 2.5, 2.5, "S");

    // Card Header Bar
    doc.setFillColor(15, 23, 42);
    doc.rect(cardX, cardY, cardW, 9.5, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("DOSSIER SUMMARY & ASSET SPECIFICATIONS", cardX + 8, cardY + 6.5);

    const isPlatform = !options.isPipeline && options.structureType !== "pipeline";
    const structureLabel = isPlatform ? "PLATFORM TITLE:" : "PIPELINE TITLE:";

    const metaFields = [
        { label: "CLIENT:", val: options.clientName || options.companyName || "Petronas Carigali Sdn Bhd (SKA)" },
        { label: "CONTRACTOR:", val: options.contractorName || "NasQuest Resources Sdn Bhd" },
        { label: structureLabel, val: options.structureName || "BODP-A" },
        { label: "FIELD / LOCATION:", val: options.fieldName || "BOKOR FIELD" },
        { label: "JOBPACK:", val: options.jobPackName || "UIMC2026/SKA/PLAT01" },
        { label: "SOW REPORT NUMBER:", val: options.sowReportNo || "AM26-016-01" },
        { label: "DATE OF CONCLUSION:", val: options.dateStr || new Date().toISOString().split("T")[0] },
    ];

    metaFields.forEach((m, idx) => {
        const my = cardY + 18 + (idx * 9);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(m.label, cardX + 8, my);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text(m.val, cardX + 54, my);

        if (idx < metaFields.length - 1) {
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.15);
            doc.line(cardX + 6, my + 2.8, cardX + cardW - 6, my + 2.8);
        }
    });

    // Quality Assurance & Archive Statement Box
    const qaY = 196;
    const qaH = 46;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(cardX, qaY, cardW, qaH, 2.5, 2.5, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(cardX, qaY, cardW, qaH, 2.5, 2.5, "S");

    // QA Header
    doc.setFillColor(15, 23, 42);
    doc.rect(cardX, qaY, cardW, 8.5, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("QUALITY ASSURANCE & DIGITAL ARCHIVE VERIFICATION", cardX + 8, qaY + 5.8);

    const statementLines = [
        "1. All visual inspection records, dimensional measurements, cathodic protection surveys, and anomaly logs",
        "   contained within this compilation have been verified against applicable offshore integrity specifications.",
        "2. This document represents the official and concluded Final Inspection Datasheet package.",
        "3. Raw inspection sensor streams, video logs, and photographic media have been archived securely.",
    ];

    statementLines.forEach((line, idx) => {
        doc.setFontSize(7.2);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85); // slate-700
        doc.text(line, cardX + 8, qaY + 15 + (idx * 6.5));
    });

    // Bottom Branding Footer
    const footY = 249;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(cardX, footY, cardW, 16, 1.5, 1.5, "F");
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.roundedRect(cardX, footY, cardW, 16, 1.5, 1.5, "S");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    const contractorText = options.contractorName || "NasQuest Resources Sdn Bhd";
    doc.text(`${contractorText.toUpperCase()}  •  SUBSEA ASSET INTEGRITY DIVISION`, pw / 2, footY + 6.5, { align: "center" });

    doc.setFontSize(6.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("CONFIDENTIAL & PROPRIETARY  •  OFFSHORE STRUCTURAL INTEGRITY RECORDS  •  ALL RIGHTS RESERVED", pw / 2, footY + 12, { align: "center" });

    // Application Name & Version Footer
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text(REPORT_FOOTER_APP_TEXT, 14, ph - 6);

    const blob: any = doc.output("blob");
    if (!blob.arrayBuffer) {
        blob.arrayBuffer = async () => doc.output("arraybuffer");
    }
    return blob;
};
