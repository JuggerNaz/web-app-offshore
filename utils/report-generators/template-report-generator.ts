import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import { saveAs } from "file-saver";
import { toast } from "sonner";

interface ReportOptions {
    templateUrl: string;
    data: any;
    fileName: string;
    logoUrl?: string;
}

/**
 * Normalizes double-brace text tags {{TAG}} to single-brace {TAG}
 * inside the DOCX XML, so all tags work with default delimiters.
 * Leaves image tags {%TAG} and loop tags {#TAG}{/TAG} untouched.
 */
function normalizeDelimiters(zip: PizZip) {
    const files = zip.files;
    for (const [relativePath, file] of Object.entries(files)) {
        if (!file.dir && relativePath.endsWith(".xml")) {
            let text = file.asText();

            // Pass 1: Within each <w:t> node, collapse {{ → { and }} → }
            text = text.replace(/(<w:t[^>]*>)([^<]*)/g, (_m, tag, content) => {
                content = content.replace(/\{\{/g, "{").replace(/\}\}/g, "}");
                return tag + content;
            });

            // Pass 2: Cross-node — { at end of one <w:t>, { at start of next <w:t>
            // Remove the duplicate opening brace at the next node's start
            let changed = true;
            while (changed) {
                const before = text;
                text = text.replace(
                    /\{(<\/w:t>(?:<[^>]*>)*?<w:t[^>]*>)\{/g,
                    "{$1"
                );
                text = text.replace(
                    /\}(<\/w:t>(?:<[^>]*>)*?<w:t[^>]*>)\}/g,
                    "}$1"
                );
                changed = text !== before;
            }

            zip.file(relativePath, text);
        }
    }
}

/**
 * Reads image dimensions from binary data (PNG or JPEG).
 * Returns [width, height] or null if unable to parse.
 */
function getImageDimensions(img: Uint8Array): [number, number] | null {
    if (!img || img.length < 24) return null;

    // PNG: bytes 16-23 contain width (4 bytes) and height (4 bytes)
    if (img[0] === 0x89 && img[1] === 0x50 && img[2] === 0x4E && img[3] === 0x47) {
        const w = (img[16] << 24) | (img[17] << 16) | (img[18] << 8) | img[19];
        const h = (img[20] << 24) | (img[21] << 16) | (img[22] << 8) | img[23];
        return [w, h];
    }

    // JPEG: scan for SOF0 (0xFFC0) or SOF2 (0xFFC2) marker
    if (img[0] === 0xFF && img[1] === 0xD8) {
        let offset = 2;
        while (offset < img.length - 8) {
            if (img[offset] !== 0xFF) { offset++; continue; }
            const marker = img[offset + 1];
            if (marker === 0xC0 || marker === 0xC2) {
                const h = (img[offset + 5] << 8) | img[offset + 6];
                const w = (img[offset + 7] << 8) | img[offset + 8];
                return [w, h];
            }
            const len = (img[offset + 2] << 8) | img[offset + 3];
            offset += 2 + len;
        }
    }

    return null;
}

/**
 * Converts an ArrayBuffer to a Uint8Array (the format the image module expects).
 */
function toUint8Array(buf: ArrayBuffer): Uint8Array {
    return new Uint8Array(buf);
}

/**
 * Generates a DOCX report from a template.
 * - Text tags: {TAG_NAME}
 * - Image tags: {%TAG_NAME}
 * - Loop tags: {#LOOP}...{/LOOP}
 */
export const generateTemplateReport = async ({ templateUrl, data, fileName, logoUrl }: ReportOptions) => {
    try {
        console.log(`[ReportGen] Fetching template: ${templateUrl}`);
        const response = await fetch(templateUrl);
        if (!response.ok) throw new Error(`Template fetch failed: ${response.statusText}`);
        const content = await response.arrayBuffer();

        // ── Pre-fetch Logo ───────────────────────────────────────
        let logoBytes: Uint8Array | null = null;
        if (logoUrl) {
            try {
                console.log(`[ReportGen] Fetching logo: ${logoUrl}`);
                const lRes = await fetch(logoUrl);
                if (lRes.ok) {
                    const buf = await lRes.arrayBuffer();
                    logoBytes = toUint8Array(buf);
                    console.log(`[ReportGen] Logo OK: ${logoBytes.byteLength} bytes`);
                }
            } catch (e) {
                console.warn("[ReportGen] Logo fetch error:", e);
            }
        }

        // ── Build clean data ─────────────────────────────────────
        const finalData: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null) {
                finalData[key] = "";
            } else if (Array.isArray(value)) {
                finalData[key] = value.map((item: any) => {
                    if (item && typeof item === 'object') {
                        const cleaned: any = {};
                        for (const [k, v] of Object.entries(item)) {
                            cleaned[k] = (v === undefined || v === null) ? "" : v;
                        }
                        return cleaned;
                    }
                    return item ?? "";
                });
            } else {
                finalData[key] = value;
            }
        }

        // Set logo data — the image module will call getImage("CLIENT_LOGO")
        // and we return the bytes. The tag in Word is {%CLIENT_LOGO}.
        if (logoBytes) {
            finalData["CLIENT_LOGO"] = "CLIENT_LOGO";
        }

        // Legacy aliases
        finalData["T_STR_TITLE"] = finalData["PLATFORM_TITLE"] || finalData["PLATFORM_NAME"] || "";
        finalData["T_MON_YR"] = finalData["DATE"] || "";
        finalData["T_REPORT_NO"] = finalData["REPORT_NO"] || finalData["SOW_REPORT_NO"] || "";
        finalData["T_CLIENT"] = finalData["CLIENT_NAME"] || "";
        finalData["T_PROJECT"] = finalData["PROJECT_NO"] || "";
        finalData["T_VESSEL"] = finalData["VESSEL_NAME"] || "";

        console.log("[ReportGen] Data keys:", Object.keys(finalData).join(", "));

        // ── Image cache (tagValue → Uint8Array) ─────────────────
        const imageCache: Record<string, Uint8Array> = {};
        if (logoBytes) {
            imageCache["CLIENT_LOGO"] = logoBytes;
        }

        // ── Build and render ─────────────────────────────────────
        const zip = new PizZip(content);
        normalizeDelimiters(zip);

        const imageModule = new ImageModule({
            centered: false,
            getImage: (tagValue: string) => {
                console.log("[ReportGen] getImage called for:", tagValue);
                const cached = imageCache[tagValue];
                if (cached) return cached;
                return null;
            },
            getSize: (img: Uint8Array) => {
                if (!img) return [100, 50];

                const dims = getImageDimensions(img);
                if (dims) {
                    const [origW, origH] = dims;
                    const ratio = origW / origH;
                    // Fit to max height of 80px, scale width proportionally
                    const maxH = 80;
                    const h = Math.min(origH, maxH);
                    const w = Math.round(h * ratio);
                    console.log(`[ReportGen] Image size: ${origW}x${origH} → ${w}x${h}`);
                    return [w, h];
                }

                // Fallback: square-ish default
                return [80, 80];
            },
        });

        // CRITICAL: attachModule BEFORE loadZip (per official docs)
        const doc = new Docxtemplater();
        doc.attachModule(imageModule);
        doc.loadZip(zip);
        doc.setData(finalData);

        try {
            doc.render();
            console.log("[ReportGen] Render succeeded with image module.");
        } catch (renderErr: any) {
            console.warn("[ReportGen] Render with images failed:", renderErr.message);

            // Fallback: text-only, fresh zip
            const textData = { ...finalData };
            delete textData["CLIENT_LOGO"];
            delete textData["MGI_GRAPH"];

            const zip2 = new PizZip(content);
            normalizeDelimiters(zip2);

            const doc2 = new Docxtemplater(zip2, {
                paragraphLoop: true,
                linebreaks: true,
            });
            doc2.setData(textData);
            doc2.render();

            const out2 = doc2.getZip().generate({
                type: "blob",
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });
            saveAs(out2, fileName.endsWith(".docx") ? fileName : `${fileName}.docx`);
            console.log("[ReportGen] Saved text-only fallback.");
            return;
        }

        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        saveAs(out, fileName.endsWith(".docx") ? fileName : `${fileName}.docx`);
        console.log("[ReportGen] Saved with logo.");

    } catch (error: any) {
        if (error.properties?.errors instanceof Array) {
            const msgs = error.properties.errors
                .map((e: any) => e.properties?.explanation || e.message)
                .join("\n");
            console.error("[ReportGen] Template errors:\n", msgs);
            toast.error("Template: " + msgs.substring(0, 200));
        } else {
            console.error("[ReportGen] Error:", error);
            toast.error(error.message || "Report generation failed");
        }
        throw error;
    }
};
