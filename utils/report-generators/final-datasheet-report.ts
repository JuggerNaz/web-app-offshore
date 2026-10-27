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
    revision?: string;
    issuedDate?: string;
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
    const titleY = badgeY + 15;
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL INSPECTION DATASHEET", pw / 2, titleY, { align: "center" });

    // Platform or Pipeline Title Below Main Title (Same Font Size)
    const assetTitle = (options.structureName || "BODP-A").toUpperCase();
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(assetTitle, pw / 2, titleY + 9.5, { align: "center" });

    // Accent Divider Line
    const divY = titleY + 17;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1.0);
    doc.line(pw / 2 - 35, divY, pw / 2 + 35, divY);

    // Structure / Project Metadata Card (Detail Box)
    const cardX = 20;
    const cardY = divY + 7;
    const cardW = pw - 40; // 170mm
    const cardH = 76;

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

    // Detail Box rows (platform/pipeline title removed as it is now below the main title):
    const clientVal = options.clientName || options.companyName || "Petronas Carigali Sdn Bhd (SKA)";
    const contractorVal = options.contractorName || "NasQuest Resources Sdn Bhd";
    const todayDateStr = options.issuedDate || options.dateStr || new Date().toISOString().split("T")[0];
    const revisionVal = options.revision || "0";

    const metaFields = [
        { label: "CLIENT:", val: clientVal },
        { label: "CONTRACTOR:", val: contractorVal },
        { label: "FIELD / LOCATION:", val: options.fieldName || "BOKOR FIELD" },
        { label: "JOBPACK:", val: options.jobPackName || "UIMC2026/SKA/PLAT01" },
        { label: "SOW REPORT NUMBER:", val: options.sowReportNo || "N/A" },
        { label: "REVISION:", val: revisionVal },
        { label: "ISSUED DATE:", val: todayDateStr },
    ];

    metaFields.forEach((m, idx) => {
        const my = cardY + 15 + (idx * 8.6);
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
            doc.line(cardX + 6, my + 2.6, cardX + cardW - 6, my + 2.6);
        }
    });

    // Document Control Section (3 columns: PREPARED BY, REVIEWED BY, APPROVED BY)
    const sigY = cardY + cardH + 7;
    const sigH = 58;
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

    const sigCols = [
        {
            title: "PREPARED BY",
            data: options.preparedBy,
        },
        {
            title: "REVIEWED BY",
            data: options.reviewedBy,
        },
        {
            title: "APPROVED BY",
            data: options.approvedBy,
        },
    ];

    const colW = (cardW - 8) / 3;

    sigCols.forEach((sc, cIdx) => {
        const cx = cardX + 4 + (cIdx * colW);
        const cy = sigY + 13;

        // Title
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(sc.title, cx + 4, cy);

        // Signature Line
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(cx + 4, cy + 14, cx + colW - 8, cy + 14);

        // Signatory details: Name: before Position:, then Date:
        doc.setFontSize(7.2);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        const nameText = sc.data?.name ? `Name:     ${sc.data.name}` : "Name:     ________________";
        const posText = sc.data?.position ? `Position: ${sc.data.position}` : "Position: ________________";
        const dateText = sc.data?.date ? `Date:     ${sc.data.date}` : "Date:     ________________";
        doc.text(nameText, cx + 4, cy + 22);
        doc.text(posText, cx + 4, cy + 29);
        doc.text(dateText, cx + 4, cy + 36);

        // Column separator
        if (cIdx < sigCols.length - 1) {
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.2);
            doc.line(cx + colW, sigY + 11, cx + colW, sigY + sigH - 4);
        }
    });

    // Application Name & Producer Attribution - Just below the signatory box after one line break
    const genByY = sigY + sigH + 6.5;
    const generatedByText = `Generated By: ${REPORT_FOOTER_APP_TEXT} (NasQuest Resources Sdn Bhd)`;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text(generatedByText, pw / 2, genByY, { align: "center" });

    // Bottom Branding Footer
    doc.setFontSize(6.8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("CONFIDENTIAL  •  OFFSHORE STRUCTURAL INTEGRITY ASSESSMENT REPORT", pw / 2, ph - 12, { align: "center" });

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
 * Matches other section cover pages in style and layout.
 */
export const generateEndOfReportCoverPage = async (options: FinalDatasheetCoverOptions = {}): Promise<Blob> => {
    return generateSectionDividerPage("END OF REPORT", options);
};
