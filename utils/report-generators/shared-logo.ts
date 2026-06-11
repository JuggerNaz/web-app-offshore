import { jsPDF } from "jspdf";

export const loadLogoWithTransparency = (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
    return new Promise((resolve) => {
        if (!url || typeof url !== 'string' || !url.trim()) {
            resolve(null);
            return;
        }

        const img = new window.Image();
        img.crossOrigin = "Anonymous";

        const timeout = setTimeout(() => {
            console.warn(`Logo loading timed out (3s limit) for URL: ${url}`);
            img.onload = null;
            img.onerror = null;
            resolve(null);
        }, 3000);

        img.onload = () => {
            clearTimeout(timeout);
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0);

                try {
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    const data = imageData.data;
                    const width = img.width;
                    const height = img.height;

                    const isWhite = (i: number) => data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230 && data[i + 3] > 0;

                    const stack: { x: number, y: number }[] = [];
                    const visited = new Uint8Array(width * height);

                    const pushIfWhite = (x: number, y: number) => {
                        if (x < 0 || x >= width || y < 0 || y >= height) return;
                        const idx = y * width + x;
                        if (!visited[idx]) {
                            const p = idx * 4;
                            if (isWhite(p)) {
                                visited[idx] = 1;
                                stack.push({ x, y });
                            }
                        }
                    };

                    for (let x = 0; x < width; x++) { pushIfWhite(x, 0); pushIfWhite(x, height - 1); }
                    for (let y = 0; y < height; y++) { pushIfWhite(0, y); pushIfWhite(width - 1, y); }

                    while (stack.length > 0) {
                        const pt = stack.pop();
                        if (!pt) continue;
                        const { x, y } = pt;
                        const p = (y * width + x) * 4;
                        data[p + 3] = 0; // make transparent

                        pushIfWhite(x + 1, y);
                        pushIfWhite(x - 1, y);
                        pushIfWhite(x, y + 1);
                        pushIfWhite(x, y - 1);
                    }

                    // Edge smoothing
                    for (let y = 1; y < height - 1; y++) {
                        for (let x = 1; x < width - 1; x++) {
                            const p = (y * width + x) * 4;
                            if (data[p + 3] !== 0) {
                                const hasTransparentNeighbor =
                                    data[((y) * width + x - 1) * 4 + 3] === 0 ||
                                    data[((y) * width + x + 1) * 4 + 3] === 0 ||
                                    data[((y - 1) * width + x) * 4 + 3] === 0 ||
                                    data[((y + 1) * width + x) * 4 + 3] === 0;
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
                } catch (e) { console.error("Canvas transparency error", e); }

                resolve({ data: canvas.toDataURL("image/png"), width: img.width, height: img.height });
            } else {
                resolve(null);
            }
        };
        img.onerror = () => {
            clearTimeout(timeout);
            console.warn(`Logo loading failed for URL: ${url}`);
            resolve(null);
        };

        // Assign src AFTER setting onload and onerror handlers to prevent race conditions
        img.src = url;
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
const formatPdfDate = (dateStr?: string): string => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
};

// Global watermark and signature overlay function
export function applyWatermarkAndSignaturesGlobal(doc: jsPDF, config: any) {
    console.log("applyWatermarkAndSignaturesGlobal: Started overlay process", { config });
    if (!config) {
        console.warn("applyWatermarkAndSignaturesGlobal: No config object passed!");
        return;
    }

    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const sigW = contentWidth / 3;
    const sigY = pageHeight - 38;

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

    // 2. Draw Signatures on the last page if enabled
    if (config.showSignatures !== false) {
        console.log("applyWatermarkAndSignaturesGlobal: Overlaying signatures block text");
        doc.setPage(pageCount);
        doc.saveGraphicsState();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(30, 41, 59); // default text color

        const prep = config.preparedBy || { name: "", date: "" };
        const rev = config.reviewedBy || { name: "", date: "" };
        const app = config.approvedBy || { name: "", date: "" };

        console.log("applyWatermarkAndSignaturesGlobal: Signatory details", { prep, rev, app });

        // Draw Prepared By details
        doc.text(prep.name || "", margin + 11, sigY + 10);
        doc.text(formatPdfDate(prep.date), margin + 10, sigY + 13.5);

        // Draw Reviewed By details
        doc.text(rev.name || "", margin + sigW + 11, sigY + 10);
        doc.text(formatPdfDate(rev.date), margin + sigW + 10, sigY + 13.5);

        // Draw Approved By details
        doc.text(app.name || "", margin + sigW * 2 + 11, sigY + 10);
        doc.text(formatPdfDate(app.date), margin + sigW * 2 + 10, sigY + 13.5);

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

