import { jsPDF } from "jspdf";

export const loadLogoWithTransparency = async (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
    if (!url || typeof url !== 'string' || !url.trim()) {
        return null;
    }

    // Convert to Data URI via fetch + blob if possible to avoid canvas taint / CORS errors
    let finalSrc = url;
    if (!url.startsWith("data:")) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const blob = await response.blob();
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                if (dataUrl) finalSrc = dataUrl;
            }
        } catch (_) {}
    }

    return new Promise((resolve) => {
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

                ctx.drawImage(img, 0, 0);

                try {
                    const imageData = ctx.getImageData(0, 0, w, h);
                    const data = imageData.data;

                    const isWhite = (i: number) => data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230 && data[i + 3] > 0;

                    const stack: { x: number, y: number }[] = [];
                    const visited = new Uint8Array(w * h);

                    const pushIfWhite = (x: number, y: number) => {
                        if (x < 0 || x >= w || y < 0 || y >= h) return;
                        const idx = y * w + x;
                        if (!visited[idx]) {
                            const p = idx * 4;
                            if (isWhite(p)) {
                                visited[idx] = 1;
                                stack.push({ x, y });
                            }
                        }
                    };

                    for (let x = 0; x < w; x++) { pushIfWhite(x, 0); pushIfWhite(x, h - 1); }
                    for (let y = 0; y < h; y++) { pushIfWhite(0, y); pushIfWhite(w - 1, y); }

                    while (stack.length > 0) {
                        const pt = stack.pop();
                        if (!pt) continue;
                        const { x, y } = pt;
                        const p = (y * w + x) * 4;
                        data[p + 3] = 0; // make transparent

                        pushIfWhite(x + 1, y);
                        pushIfWhite(x - 1, y);
                        pushIfWhite(x, y + 1);
                        pushIfWhite(x, y - 1);
                    }

                    // Edge smoothing
                    for (let y = 1; y < h - 1; y++) {
                        for (let x = 1; x < w - 1; x++) {
                            const p = (y * w + x) * 4;
                            if (data[p + 3] !== 0) {
                                const hasTransparentNeighbor =
                                    data[((y) * w + x - 1) * 4 + 3] === 0 ||
                                    data[((y) * w + x + 1) * 4 + 3] === 0 ||
                                    data[((y - 1) * w + x) * 4 + 3] === 0 ||
                                    data[((y + 1) * w + x) * 4 + 3] === 0;
                                if (hasTransparentNeighbor) {
                                    const avgColor = (data[p] + data[p + 1] + data[p + 2]) / 3;
                                    if (avgColor > 200) {
                                        data[p + 3] = Math.max(0, 255 - (avgColor - 180) * 3);
                                    }
                                }
                            }
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                    resolve({ data: canvas.toDataURL("image/png"), width: w, height: h });
                } catch {
                    // If canvas security or getImageData throws, return data URL or original source
                    try {
                        resolve({ data: canvas.toDataURL("image/png"), width: w, height: h });
                    } catch {
                        resolve({ data: finalSrc, width: w, height: h });
                    }
                }
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
};


export const drawLogo = (doc: any, logo: any, maxW: number, maxH: number, x: number, y: number, alignX = 'left', alignY = 'center') => {
    if (!logo || !logo.data) return;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    let dx = x;
    let dy = y;
    if (alignX === 'right') dx = x + maxW - w;
    if (alignX === 'center') dx = x + (maxW - w) / 2;
    if (alignY === 'center') dy = y + (maxH - h) / 2;
    if (alignY === 'bottom') dy = y + maxH - h;
    doc.addImage(logo.data, 'PNG', dx, dy, w, h);
};

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

