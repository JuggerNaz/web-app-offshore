import { jsPDF } from "jspdf";

export const APP_NAME = "OFFSHOREPRO";
export const APP_VERSION = "1.0";
export const REPORT_FOOTER_APP_TEXT = `${APP_NAME} Version ${APP_VERSION}`;

const logoCache = new Map<string, { data: string; width: number; height: number; }>();

export const loadLogoWithTransparency = async (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
    if (!url || typeof url !== 'string' || !url.trim()) {
        return null;
    }

    const isAttachmentUrl = url.includes("/api/attachment/");

    if (!isAttachmentUrl && logoCache.has(url)) {
        return logoCache.get(url)!;
    }

    // Convert to Data URI via fetch + blob if possible to avoid canvas taint / CORS errors
    let finalSrc = url;
    if (!url.startsWith("data:")) {
        const fetchCandidate = async (targetUrl: string): Promise<string | null> => {
            try {
                const response = await fetch(targetUrl);
                if (response.ok) {
                    const blob = await response.blob();
                    return await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                }
            } catch (_) {}
            return null;
        };

        const directData = await fetchCandidate(url);
        if (directData) {
            finalSrc = directData;
        } else {
            // Fallback via server-side proxies (handles S3 / Backblaze / multi-tenant assets without CORS restrictions)
            const proxyUrl = `/api/attachment/url?path=${encodeURIComponent(url)}`;
            const proxyData = await fetchCandidate(proxyUrl);
            if (proxyData) {
                finalSrc = proxyData;
            } else {
                const downloadUrl = `/api/attachment/download?path=${encodeURIComponent(url)}&bucket=company-assets`;
                const dlData = await fetchCandidate(downloadUrl);
                if (dlData) finalSrc = dlData;
            }
        }
    }

    const result = await new Promise<{ data: string; width: number; height: number; } | null>((resolve) => {
        const img = new window.Image();
        if (!finalSrc.startsWith("data:")) {
            img.crossOrigin = "Anonymous";
        }

        const timeout = setTimeout(() => {
            console.warn(`Logo loading timed out (4s limit) for URL: ${url}`);
            img.onload = null;
            img.onerror = null;
            resolve(null);
        }, 4000);

        img.onload = () => {
            clearTimeout(timeout);
            const w = img.naturalWidth || img.width || 100;
            const h = img.naturalHeight || img.height || 100;

            try {
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve({ data: finalSrc, width: w, height: h });
                    return;
                }

                // Draw original image onto canvas and return standard PNG data URL without altering colors/background
                ctx.drawImage(img, 0, 0);
                resolve({ data: canvas.toDataURL("image/png"), width: w, height: h });
            } catch {
                resolve({ data: finalSrc, width: w, height: h });
            }
        };

        img.onerror = () => {
            clearTimeout(timeout);
            console.warn(`Logo loading failed for URL: ${url}`);
            resolve(null);
        };

        img.src = finalSrc;
    });

    if (result && !isAttachmentUrl) {
        logoCache.set(url, result);
    }
    return result;
};

export const loadLogo = loadLogoWithTransparency;


export const drawLogo = (
    doc: any,
    logo: any,
    maxW: number,
    maxH: number,
    x: number,
    y: number,
    alignX: string = 'left',
    alignY: string = 'center'
) => {
    if (!logo || !logo.data || !logo.width || !logo.height) return;

    // Aspect ratio of the image (width / height)
    const aspectRatio = logo.width / logo.height;

    // Determine effective max width:
    // If it's a single logo (roughly square or portrait, aspect ratio <= 1.25), keep current maxW.
    // If it contains multiple logos or is a wide rectangle (aspect ratio > 1.25),
    // scale the allowed width proportionally (e.g. current size x no. of logos in image)
    // so that the height stays at maxH and logos inside are not shrunk down.
    // Capped at 50mm to prevent overlapping header title text.
    let effectiveMaxW = maxW;
    if (aspectRatio > 1.25) {
        effectiveMaxW = Math.min(maxW, Math.max(maxW * 0.8, maxH * aspectRatio));
    }

    const ratio = Math.min(effectiveMaxW / logo.width, maxH / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;

    let dx = x;
    let dy = y;

    if (alignX === 'right') {
        dx = x + maxW - w;
    } else if (alignX === 'center') {
        dx = x + (maxW - w) / 2;
    }

    if (alignY === 'center' || alignY === 'middle') {
        dy = y + (maxH - h) / 2;
    } else if (alignY === 'bottom') {
        dy = y + maxH - h;
    }

    doc.addImage(logo.data, 'PNG', dx, dy, w, h);
};

export interface Draw3SectionHeaderOptions {
    reportTitle: string;
    reportNo?: string;
    structureName?: string;
    jobpackName?: string;
    subtitle?: string;
    companySettings?: {
        company_name?: string;
        department_name?: string;
        departmentName?: string;
        logo_url?: string;
        serial_no?: string;
    };
    config?: {
        reportNoPrefix?: string;
        reportYear?: string | number;
        contractorLogoUrl?: string;
        contractorLogo?: string;
        showContractorLogo?: boolean;
        printFriendly?: boolean;
        headerBlue?: [number, number, number];
        [key: string]: any;
    };
    headerData?: {
        contractorLogoUrl?: string;
        sowReportNo?: string;
        platformName?: string;
        jobpackName?: string;
        [key: string]: any;
    };
    contractorLogoData?: any;
    clientLogoData?: any;
    pageWidth?: number;
    pageHeight?: number;
    orientation?: "portrait" | "landscape";
    margin?: number;
    headerY?: number;
    headerH?: number;
    isPrintFriendly?: boolean;
    headerBlue?: [number, number, number];
    showCompanyInMiddle?: boolean;
}

/**
 * Converts a word to title case while preserving offshore engineering acronyms
 * (e.g. ROV, ACFM, CP, UT, FMD, MPI, NDT, etc.) and company abbreviations (e.g. Sdn Bhd).
 */
export function toTitleCaseWord(word: string): string {
    const match = word.match(/^([^a-zA-Z0-9]*)(.*?)([^a-zA-Z0-9]*)$/);
    if (!match) return word;
    const [, prefix, core, suffix] = match;
    if (!core) return word;
    if (!/[a-zA-Z]/.test(core)) return word;

    // Handle hyphenated words like 'J-TUBE', 'I-TUBE', 'MULTI-DROP'
    if (core.includes("-")) {
        const parts = core.split("-");
        return prefix + parts.map(p => toTitleCaseWord(p)).join("-") + suffix;
    }

    // Handle slash words like 'DEFECT / ANOMALY' or 'AND/OR'
    if (core.includes("/")) {
        const parts = core.split("/");
        return prefix + parts.map(p => toTitleCaseWord(p)).join("/") + suffix;
    }

    const upper = core.toUpperCase();

    // Acronyms that MUST remain uppercase (ROV is explicitly required)
    const acronyms = new Set([
        "ROV", "ACFM", "CP", "UT", "UTWT", "FMD", "MPI", "NDT", "GVI", "CVI",
        "SOW", "SKA", "PCSB", "SKO", "PMO", "SBO", "KP", "N/A", "CO2", "ID",
        "II", "III", "IV", "VI", "VII", "VIII", "IX", "X"
    ]);

    if (acronyms.has(upper)) return prefix + upper + suffix;
    if (/^v\d+$/i.test(core)) return prefix + core.toLowerCase() + suffix;
    if (/^[0-9]+[a-zA-Z]+$/.test(core) || /^[a-zA-Z]+[0-9]+$/.test(core)) {
        return prefix + (core === core.toLowerCase() ? core : upper) + suffix;
    }
    if (upper === "SDN") return prefix + "Sdn" + suffix;
    if (upper === "BHD") return prefix + "Bhd" + suffix;
    if (upper === "PTY") return prefix + "Pty" + suffix;
    if (upper === "LTD") return prefix + "Ltd" + suffix;
    if (upper === "INC") return prefix + "Inc" + suffix;

    return prefix + core.charAt(0).toUpperCase() + core.slice(1).toLowerCase() + suffix;
}

/**
 * Transforms report header title text to Title Case (capital letter on first letter of words)
 * while keeping acronyms like ROV in all caps.
 */
export function formatReportHeaderTitle(title: string): string {
    if (!title || typeof title !== "string") return title;
    return title.split(/(\s+)/).map(token => {
        if (/^\s+$/.test(token)) return token;
        return toTitleCaseWord(token);
    }).join("");
}

/**
 * Formats header info lines (Company Name, Department, Report Title, Report No prefix)
 * to Title Case while preserving uppercase codes and prefixes.
 */
export function formatHeaderInfoText(text: string): string {
    if (!text || typeof text !== "string") return text;
    // Check if string is report number like 'Report No: ...' or 'REPORT NO: ...'
    if (/^report\s*no\.?\s*:/i.test(text.trim())) {
        return text.replace(/^(\s*report\s*no)(\.?\s*:)/i, (_m, _p1, p2) => {
            const hasDot = p2.includes(".");
            return hasDot ? "Report No. :" : "Report No:";
        });
    }
    return formatReportHeaderTitle(text);
}

/**
 * Universal 3-Section Header matching Jobpack Summary Report (Contractor Box | Middle Navy Info Box | Client Box)
 * Supports both Portrait (210mm) and Landscape (297mm) orientations with perfectly aligned borders.
 */
export const draw3SectionHeader = (
    doc: any,
    options: Draw3SectionHeaderOptions
) => {
    const pageWidth = options.pageWidth || doc.internal.pageSize.getWidth();
    const pageHeight = options.pageHeight || doc.internal.pageSize.getHeight();
    const orientation = options.orientation || (pageWidth > pageHeight ? "landscape" : "portrait");

    const margin = options.margin !== undefined ? options.margin : 10;
    const headerY = options.headerY !== undefined ? options.headerY : 7;
    const headerH = options.headerH !== undefined ? options.headerH : 25;

    const totalW = pageWidth - margin * 2;

    let col1W: number;
    let col2W: number;
    let col3W: number;

    if (orientation === "landscape") {
        col1W = 75;
        col3W = 75;
        col2W = totalW - col1W - col3W;
    } else {
        col1W = 55;
        col3W = 55;
        col2W = totalW - col1W - col3W;
    }

    const x1 = margin;
    const x2 = x1 + col1W;
    const x3 = x2 + col2W;

    const isPrintFriendly = options.isPrintFriendly ?? options.config?.printFriendly === true;
    const headerBlue: [number, number, number] = options.headerBlue || options.config?.headerBlue || [7, 78, 136];
    const headerBorderColor: [number, number, number] = [200, 200, 200];
    const headerLineWidth = 0.2;
    const titleTextColor: [number, number, number] = isPrintFriendly ? [7, 78, 136] : [255, 255, 255];
    const titleSubTextColor: [number, number, number] = isPrintFriendly ? [51, 65, 85] : [219, 234, 254];

    // --- 1. LEFT BOX: CONTRACTOR (White Background + Border) ---
    doc.setFillColor(255, 255, 255);
    doc.rect(x1, headerY, col1W, headerH, "F");
    doc.setDrawColor(...headerBorderColor);
    doc.setLineWidth(headerLineWidth);
    doc.rect(x1, headerY, col1W, headerH, "S");

    if (options.contractorLogoData) {
        const logoMaxW = col1W - 7;
        const logoMaxH = headerH - 5;
        drawLogo(doc, options.contractorLogoData, logoMaxW, logoMaxH, x1 + (col1W - logoMaxW) / 2, headerY + (headerH - logoMaxH) / 2, 'center', 'center');
    }

    // --- 2. MIDDLE BOX: REPORT TITLE (Navy/White + Border) ---
    if (isPrintFriendly) {
        doc.setFillColor(255, 255, 255);
    } else {
        doc.setFillColor(...headerBlue);
    }
    doc.rect(x2, headerY, col2W, headerH, "F");
    doc.setDrawColor(...headerBorderColor);
    doc.setLineWidth(headerLineWidth);
    doc.rect(x2, headerY, col2W, headerH, "S");

    const titleCenterX = x2 + col2W / 2;

    const rawCompanyName = options.companySettings?.company_name || options.headerData?.companyName || "Petronas Carigali Sdn Bhd (SKA)";
    const companyName = formatHeaderInfoText(rawCompanyName);

    const rawDeptName = options.companySettings?.department_name || (options.companySettings as any)?.departmentName || options.headerData?.departmentName || "Technical Services Department";
    const deptName = formatHeaderInfoText(rawDeptName);

    const reportTitleText = formatReportHeaderTitle(options.reportTitle || "Inspection Report");

    const rawReportNo = options.reportNo || options.headerData?.sowReportNo || options.config?.sowReportNo ||
        (options.config?.reportNoPrefix ? `${options.config.reportNoPrefix}-${options.config.reportYear || new Date().getFullYear()}` : "") ||
        (options.companySettings?.serial_no ? `${options.companySettings.serial_no}` : "");

    const baseReportNoStr = rawReportNo && String(rawReportNo).trim() !== "" && String(rawReportNo).trim() !== "N/A"
        ? (String(rawReportNo).trim().toLowerCase().startsWith("report no") ? String(rawReportNo).trim() : `Report No: ${String(rawReportNo).trim()}`)
        : "Report No: N/A";
    const reportNoStr = formatHeaderInfoText(baseReportNoStr);

    // Line 1: Company Name (bold, size 8)
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...titleTextColor);
    const compLines = doc.splitTextToSize(companyName, col2W - 8);
    doc.text(compLines[0] || companyName, titleCenterX, headerY + 5.8, { align: "center" });

    // Line 2: Department Name (no bold, size 8)
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...titleSubTextColor);
    const deptLines = doc.splitTextToSize(deptName, col2W - 8);
    doc.text(deptLines[0] || deptName, titleCenterX, headerY + 10.6, { align: "center" });

    // Line 3: Report Title (bold, size 8, dynamically adjusted for very long titles)
    let titleFontSize = 8;
    if (orientation === "portrait" && reportTitleText.length > 36) {
        titleFontSize = reportTitleText.length > 44 ? 6.8 : 7.2;
    }
    doc.setFontSize(titleFontSize);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...titleTextColor);
    const titleLines = doc.splitTextToSize(reportTitleText, col2W - 8);
    doc.text(titleLines[0] || reportTitleText, titleCenterX, headerY + 15.4, { align: "center" });

    // Line 4: Report No (no bold, size 8)
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...titleSubTextColor);
    doc.text(reportNoStr, titleCenterX, headerY + 20.2, { align: "center" });

    // --- 3. RIGHT BOX: CLIENT (White Background + Border) ---
    doc.setFillColor(255, 255, 255);
    doc.rect(x3, headerY, col3W, headerH, "F");
    doc.setDrawColor(...headerBorderColor);
    doc.setLineWidth(headerLineWidth);
    doc.rect(x3, headerY, col3W, headerH, "S");

    if (options.clientLogoData) {
        const logoMaxW = col3W - 7;
        const logoMaxH = headerH - 5;
        drawLogo(doc, options.clientLogoData, logoMaxW, logoMaxH, x3 + (col3W - logoMaxW) / 2, headerY + (headerH - logoMaxH) / 2, 'center', 'center');
    }

    // Reset drawing state
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
};

/**
 * Standard Context / Metadata Row (Structure, Vessel, Jobpack, Insp. Date Range)
 * Aligns perfectly with margin 10 down the left and right sides without jagged edges.
 */
export const drawStandardContextRow = (
    doc: any,
    y: number,
    data: {
        structure?: string;
        vessel?: string;
        jobpack?: string;
        dateRange?: string;
    },
    isPrintFriendly: boolean = false,
    margin: number = 10
): number => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    const half = contentWidth / 2;
    const ROW_H = 6.5;

    const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.1);
        if (!isPrintFriendly) {
            doc.setFillColor(248, 250, 252);
            doc.rect(x, ty, w, ROW_H, "F");
        }
        doc.rect(x, ty, w, ROW_H, "S");
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.text(label, x + 2, ty + 4.5);
        doc.setFont("helvetica", "normal");
        const valLines = doc.splitTextToSize(String(value || "N/A"), w - 38);
        doc.text(valLines[0] || "N/A", x + 36, ty + 4.5);
    };

    drawBox("Structure:", data.structure || "N/A", margin, half, y);
    drawBox("Vessel:", data.vessel || "N/A", margin + half, half, y);
    drawBox("Job Pack:", data.jobpack || "N/A", margin, half, y + ROW_H);
    drawBox("Insp. Date Range:", data.dateRange || "N/A", margin + half, half, y + ROW_H);

    return y + ROW_H * 2 + 4;
};

/**
 * Common autoTable styling tokens to ensure uniform straight-line borders and appearance.
 */
export const getStandardTableStyles = (isPrintFriendly: boolean = false, margin: number = 10) => ({
    theme: 'grid' as const,
    tableLineWidth: 0.1,
    tableLineColor: [200, 200, 200] as [number, number, number],
    margin: { left: margin, right: margin },
    styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        lineColor: [200, 200, 200] as [number, number, number],
        lineWidth: 0.1,
        textColor: [30, 41, 59] as [number, number, number],
        valign: 'middle' as const,
    },
    headStyles: isPrintFriendly ? {
        fillColor: [255, 255, 255] as [number, number, number],
        textColor: [7, 78, 136] as [number, number, number],
        fontStyle: 'bold' as const,
        lineWidth: 0.1,
        lineColor: [200, 200, 200] as [number, number, number],
    } : {
        fillColor: [7, 78, 136] as [number, number, number],
        textColor: [255, 255, 255] as [number, number, number],
        fontStyle: 'bold' as const,
        lineWidth: 0.1,
        lineColor: [200, 200, 200] as [number, number, number],
    },
    alternateRowStyles: isPrintFriendly ? {
        fillColor: [255, 255, 255] as [number, number, number],
    } : {
        fillColor: [248, 250, 252] as [number, number, number],
    }
});

// Helper to format date as dd-mm-yyyy
export const formatPdfDate = (dateStr?: any): string => {
    if (!dateStr) return "";
    if (dateStr instanceof Date) {
        const d = String(dateStr.getDate()).padStart(2, "0");
        const m = String(dateStr.getMonth() + 1).padStart(2, "0");
        const y = dateStr.getFullYear();
        return `${d}-${m}-${y}`;
    }
    const str = String(dateStr).trim();
    if (str.includes("/")) {
        return str;
    }
    const parts = str.split("-");
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return str;
};

// Global watermark and signature overlay function
export function applyWatermarkAndSignaturesGlobal(doc: jsPDF, config: any) {
    if ((doc as any)._watermarkApplied) {
        console.log("applyWatermarkAndSignaturesGlobal: Watermark already applied, skipping.");
        return;
    }

    console.log("applyWatermarkAndSignaturesGlobal: Started overlay process", { config });

    if (!config) {
        console.warn("applyWatermarkAndSignaturesGlobal: No config object passed!");
        return;
    }

    (doc as any)._watermarkApplied = true;

    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const sigY = typeof config?.sigY === 'number' ? config.sigY : (pageHeight - margin - 32);

    console.log("applyWatermarkAndSignaturesGlobal: Document properties", { pageCount, pageWidth, pageHeight, sigY });

    const originalPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

    // 1. Draw Watermark on all pages if enabled
    if (config.watermark?.enabled && config.watermark.text) {
        console.log("applyWatermarkAndSignaturesGlobal: Overlaying Watermark", config.watermark);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.saveGraphicsState();
            
            // Set watermark color
            const color = config.watermark.color || "gray";
            if (color === "red") {
                doc.setTextColor(220, 38, 38);
            } else if (color === "blue") {
                doc.setTextColor(37, 99, 235);
            } else {
                doc.setTextColor(150, 150, 150); // Default gray
            }

            // Set transparency
            const opacity = config.watermark.transparency !== undefined ? config.watermark.transparency : 0.15;
            doc.setGState(new (doc as any).GState({ opacity }));
            
            doc.setFontSize(60);
            doc.setFont("helvetica", "bold");
            doc.text(config.watermark.text, pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 });
            doc.restoreGraphicsState();
        }
    }

    // 2. Draw Signatures on the last page if enabled and overlay requested
    if (config.showSignatures !== false && config.overlaySignatureText) {
        console.log("applyWatermarkAndSignaturesGlobal: Overlaying signatures block text");
        doc.setPage(pageCount);
        doc.saveGraphicsState();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(30, 41, 59); // default text color

        const prep = config.preparedBy || { name: "", date: "" };
        const rev = config.reviewedBy || { name: "", date: "" };
        const app = config.approvedBy || { name: "", date: "" };

        const sigW = (pageWidth - margin * 2) / 3;

        // Draw Prepared By details: Name on Name: row (sigY + 9), Date on Date: row (sigY + 19)
        if (prep.name) doc.text(prep.name, margin + 14, sigY + 9);
        if (prep.date) doc.text(formatPdfDate(prep.date), margin + 14, sigY + 19);

        // Draw Reviewed By details
        if (rev.name) doc.text(rev.name, margin + sigW + 14, sigY + 9);
        if (rev.date) doc.text(formatPdfDate(rev.date), margin + sigW + 14, sigY + 19);

        // Draw Approved By details
        if (app.name) doc.text(app.name, margin + sigW * 2 + 14, sigY + 9);
        if (app.date) doc.text(formatPdfDate(app.date), margin + sigW * 2 + 14, sigY + 19);

        doc.restoreGraphicsState();
    }

    // Restore active page to original
    doc.setPage(originalPage);
}

// Self-executing prototype patch inside the module bundle of templates
if (typeof window !== "undefined") {
    const patchJsPdfPrototypeGlobal = () => {
        const proto = jsPDF.prototype as any;
        if (proto._isPatchedForWatermarksGlobal) return;
        proto._isPatchedForWatermarksGlobal = true;

        console.log("shared-logo.ts: Patching jsPDF prototype globally...");
        const originalOutput = proto.output;
        const originalSave = proto.save;

        proto.output = function (this: jsPDF, ...args: any[]) {
            console.log("jsPDF.prototype.output (patched via shared-logo.ts): Intercepted call", args);
            const config = (window as any).__reportConfig;
            if (config) {
                applyWatermarkAndSignaturesGlobal(this, config);
            } else {
                console.warn("jsPDF.prototype.output (patched via shared-logo.ts): No window.__reportConfig found!");
            }
            return originalOutput.apply(this, args);
        };

        proto.save = function (this: jsPDF, ...args: any[]) {
            console.log("jsPDF.prototype.save (patched via shared-logo.ts): Intercepted call", args);
            const config = (window as any).__reportConfig;
            if (config) {
                applyWatermarkAndSignaturesGlobal(this, config);
            } else {
                console.warn("jsPDF.prototype.save (patched via shared-logo.ts): No window.__reportConfig found!");
            }
            return originalSave.apply(this, args);
        };
        console.log("shared-logo.ts: jsPDF prototype successfully patched");
    };
    
// Run the patch
    patchJsPdfPrototypeGlobal();
}

/**
 * Resolves the effective description/findings for an inspection record.
 * Where the record status is 'INCOMPLETE' (case-insensitive):
 * - Priority is for the Reason for Incomplete Task value.
 * - If blank or null, fallback to the inspection finding value.
 * - Never prints both.
 */
export const getEffectiveFindings = (r: any, explicitFindings?: string | null): string => {
    if (!r) return "";

    const d = r.inspection_data || r.inspection_dat || {};

    const rawDesc = explicitFindings !== undefined && explicitFindings !== null 
        ? explicitFindings 
        : (r.findings ?? r.description ?? r.remarks ?? d.findings ?? d.finding ?? d.description ?? d.remarks ?? "");
    
    const cleanDesc = typeof rawDesc === "string" ? rawDesc.trim() : (rawDesc ? String(rawDesc).trim() : "");

    const isStatusIncomplete = 
        String(r.status || "").trim().toUpperCase() === "INCOMPLETE" || 
        String(d.status || "").trim().toUpperCase() === "INCOMPLETE" ||
        String(d.finding_type || "").trim().toUpperCase() === "INCOMPLETE" ||
        String(r.finding_type || "").trim().toUpperCase() === "INCOMPLETE" ||
        String(r.findingType || "").trim().toUpperCase() === "INCOMPLETE";

    const incReason = (
        r.incomplete_reason || 
        r.incompleteReason || 
        d.incomplete_reason || 
        d.incompleteReason || 
        r.inspection_dat?.incomplete_reason ||
        ""
    ).toString().trim();

    if (isStatusIncomplete) {
        const hasSubstantiveDesc = Boolean(cleanDesc && cleanDesc !== "No significant findings" && cleanDesc !== "N/A" && cleanDesc !== "—" && cleanDesc !== "-" && cleanDesc !== "None");
        if (hasSubstantiveDesc && incReason) {
            return `${cleanDesc}\nIncomplete Reason: ${incReason}`;
        }
        if (incReason) {
            return `Incomplete Reason: ${incReason}`;
        }
        if (hasSubstantiveDesc) {
            return cleanDesc;
        }
        return "Incomplete";
    }

    return cleanDesc;
};

const safeParseJson = (val: any): any => {
    if (!val) return {};
    if (typeof val === "object") return val;
    if (typeof val === "string") {
        try {
            const parsed = JSON.parse(val);
            return typeof parsed === "object" && parsed !== null ? parsed : {};
        } catch (_) {
            return {};
        }
    }
    return {};
};

/**
 * Resolves the nominal thickness from inspection record data or component metadata.
 */
export const getRecordNominalThickness = (r: any): string => {
    if (!r) return "-";

    const d = safeParseJson(r.inspection_data || r.inspection_dat);
    
    // Resolve component object which could be object, array, or nested
    let rawComp = r.structure_components || r.structure_component || r.component || r.comp || {};
    if (Array.isArray(rawComp)) {
        rawComp = rawComp[0] || {};
    }
    const comp = safeParseJson(rawComp);
    const compRaw = safeParseJson(comp.raw);
    const compMeta = safeParseJson(comp.metadata || compRaw.metadata || comp.component_metadata || comp.additionalInfo || comp.props);
    const compSpec = safeParseJson(comp.spec || compRaw.spec || compMeta.spec || compMeta.specs || compMeta.details || compMeta.additional_details);
    const compData = safeParseJson(comp.data || compRaw.data);
    const compAddInfo = safeParseJson(compMeta.additionalInfo || comp.additionalInfo || compRaw.additionalInfo);

    const sources = [
        d,
        r,
        compAddInfo,
        compMeta,
        compSpec,
        compData,
        comp,
        compRaw,
        safeParseJson(r.component_metadata),
        safeParseJson(r.component_spec),
        safeParseJson(r.metadata),
        safeParseJson(r.spec)
    ];

    const keys = [
        'nominal_thickness',
        'nominal_wall_thickness',
        'nominalThickness',
        'nominal_thk',
        'nominalThk',
        'wall_thk',
        'wall_thickness',
        'nom_wt',
        'nom_thickness',
        'nom_thick',
        'nominal_wt',
        'wt_nom',
        'wt',
        'design_wt',
        'pipe_wt',
        'thickness',
        'nc_wall_thk',
        'memb_wall_thk',
        'member_wall_thickness'
    ];

    for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        for (const k of keys) {
            const val = src[k];
            if (val !== undefined && val !== null && val !== '' && val !== '-') {
                const str = String(val).trim();
                if (str && str !== 'null' && str !== 'undefined' && str !== 'NaN' && str !== '-') {
                    return str;
                }
            }
        }
    }

    return "-";
};

/**
 * Normalizes a single inspection record so that:
 * 1. If status = 'INCOMPLETE' and description/findings is null, blank, or empty,
 *    it replaces description, findings, and inspection_data.findings/description with incomplete_reason.
 * 2. If nominal_thickness is missing in inspection_data, it populates it from alternative fields or component metadata.
 */
export const normalizeRecordFindings = (r: any): any => {
    if (!r) return r;
    let modified = false;
    const inspData = { ...(r.inspection_data || r.inspection_dat || {}) };
    const recordCopy = { ...r };

    // 1. Nominal Thickness Normalization
    const resolvedNomThk = getRecordNominalThickness(r);
    if (resolvedNomThk !== "-") {
        const curNom = inspData.nominal_thickness;
        if (curNom === undefined || curNom === null || curNom === "" || curNom === "-") {
            inspData.nominal_thickness = resolvedNomThk;
            recordCopy.nominal_thickness = resolvedNomThk;
            modified = true;
        }
    }

    // 2. Incomplete Reason for findings/description (priority: incomplete_reason, fallback: inspection finding)
    const isStatusIncomplete = 
        String(r.status || "").trim().toUpperCase() === "INCOMPLETE" || 
        String(inspData.status || "").trim().toUpperCase() === "INCOMPLETE" ||
        String(inspData.finding_type || "").trim().toUpperCase() === "INCOMPLETE" ||
        String(r.finding_type || "").trim().toUpperCase() === "INCOMPLETE" ||
        String(r.findingType || "").trim().toUpperCase() === "INCOMPLETE";

    const incReason = (
        r.incomplete_reason || 
        r.incompleteReason || 
        inspData.incomplete_reason || 
        inspData.incompleteReason || 
        r.inspection_dat?.incomplete_reason ||
        ""
    ).toString().trim();

    if (isStatusIncomplete) {
        const desc = (r.description ?? r.findings ?? r.remarks ?? inspData.findings ?? inspData.description ?? "").toString().trim();
        const hasSubstantiveDesc = Boolean(desc && desc !== "No significant findings" && desc !== "N/A" && desc !== "—" && desc !== "-" && desc !== "None");

        if (!hasSubstantiveDesc) {
            const effectiveText = incReason || "Incomplete";
            inspData.description = effectiveText;
            inspData.findings = effectiveText;
            inspData.remarks = effectiveText;
            inspData.finding = effectiveText;
            recordCopy.description = effectiveText;
            recordCopy.findings = effectiveText;
            recordCopy.remarks = effectiveText;
            modified = true;
        }
    }

    if (modified) {
        recordCopy.inspection_data = inspData;
        recordCopy.inspection_dat = inspData;
        return recordCopy;
    }
    return r;
};

/**
 * Normalizes an array of inspection records for all report templates.
 */
export const normalizeReportRecords = (records: any[]): any[] => {
    if (!Array.isArray(records)) return [];
    return records.map(normalizeRecordFindings);
};

export { getInspectionDateRange, extractRecordTapeNo, enrichRecordsWithTapesAndDeployments } from "./date-range-utils";
export { sortScourFaceRecords, buildScourFaceTopology } from "./scour-sorting-utils";
export {
    getRecordStatusInfo,
    formatReportFindingText,
    applyRecordCellStyling,
    REPORT_COLORS,
    type RecordStatusType,
    type RecordStatusInfo
} from "./finding-color-helper";
