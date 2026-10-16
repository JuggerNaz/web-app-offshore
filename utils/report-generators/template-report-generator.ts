import { normalizeReportRecords , applyRecordCellStyling, formatReportFindingText } from "./shared-logo";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
// @ts-ignore
import ImageModule from "docxtemplater-image-module-free";
import { saveAs } from "file-saver";
import { toast } from "sonner";



interface ReportOptions {
    templateUrl: string;
    preloadedTemplate?: ArrayBuffer;
    data: any;
    fileName: string;
    logoUrl?: string;
    contractorLogoUrl?: string;
    onProgress?: (percent: number, statusText: string) => void;
}

/**
 * Normalizes double-brace text tags {{TAG}} to single-brace {TAG}
 * inside the DOCX XML text runs (<w:t>), cleans up tag whitespace,
 * and resolves known tag aliases safely without breaking the XML tree.
 */
export function normalizeDelimiters(zip: PizZip) {
    const files = zip.files;
    for (const [relativePath, file] of Object.entries(files)) {
        if (!file.dir && relativePath.endsWith(".xml")) {
            let text = file.asText();

            // 0. Strip/unwrap hyperlinks, smart tags, track changes, and Word proofing that split tags
            text = text.replace(/<w:hyperlink\b[^>]*>([\s\S]*?)<\/w:hyperlink>/gi, (match, inner) => {
                if (inner.includes("{") || inner.includes("}")) {
                    return inner;
                }
                return match;
            });
            text = text.replace(/<w:smartTag\b[^>]*>([\s\S]*?)<\/w:smartTag>/gi, "$1");
            text = text.replace(/<w:ins\b[^>]*>([\s\S]*?)<\/w:ins>/gi, "$1");
            text = text.replace(/<w:del\b[^>]*>([\s\S]*?)<\/w:del>/gi, "");
            text = text.replace(/<w:proofErr\b[^>]*\/?>/gi, "");
            text = text.replace(/<w:noProof\b[^>]*\/?>/gi, "");

            // 0.1 Stitch tags that Word split across multiple <w:r><w:t> nodes within the same paragraph
            text = text.replace(/(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g, (_pMatch, pOpen, pBody, pClose) => {
                if (!pBody.includes("{")) return `${pOpen}${pBody}${pClose}`;

                // Extract all <w:t> nodes
                const wtRegex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
                let wtMatches: { full: string; open: string; content: string; close: string; index: number }[] = [];
                let m;
                while ((m = wtRegex.exec(pBody)) !== null) {
                    wtMatches.push({
                        full: m[0],
                        open: m[1],
                        content: m[2],
                        close: m[3],
                        index: m.index,
                    });
                }

                if (wtMatches.length <= 1) return `${pOpen}${pBody}${pClose}`;

                // Check if any `{` does not have a corresponding `}` inside the same <w:t>
                let modified = false;
                for (let i = 0; i < wtMatches.length; i++) {
                    let content = wtMatches[i].content;
                    const openBraces = (content.match(/\{/g) || []).length;
                    const closeBraces = (content.match(/\}/g) || []).length;

                    if (openBraces > closeBraces) {
                        // Unclosed brace in this <w:t>; stitch subsequent <w:t> nodes until balanced
                        let stitched = content;
                        let j = i + 1;
                        while (j < wtMatches.length) {
                            const nextContent = wtMatches[j].content;
                            stitched += nextContent;
                            wtMatches[j].content = "";
                            const currentOpens = (stitched.match(/\{/g) || []).length;
                            const currentCloses = (stitched.match(/\}/g) || []).length;
                            j++;
                            if (currentCloses >= currentOpens) break;
                        }
                        wtMatches[i].content = stitched;
                        modified = true;
                    }
                }

                if (!modified) return `${pOpen}${pBody}${pClose}`;

                // Rebuild paragraph body with stitched <w:t> nodes
                let newBody = "";
                let lastIndex = 0;
                for (const wm of wtMatches) {
                    newBody += pBody.substring(lastIndex, wm.index);
                    newBody += `${wm.open}${wm.content}${wm.close}`;
                    lastIndex = wm.index + wm.full.length;
                }
                newBody += pBody.substring(lastIndex);

                return `${pOpen}${newBody}${pClose}`;
            });

            // Safe XML Text node replacer: process text inside <w:t>...</w:t>
            text = text.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g, (_match, openTag, textContent, closeTag) => {
                let content = textContent;

                // 1. Collapse double braces {{ → { and }} → }
                content = content.replace(/\{\{/g, "{").replace(/\}\}/g, "}");

                // 2. Clean whitespace inside braces: { TAG } -> {TAG}, {# TAG } -> {#TAG}, {/ TAG } -> {/TAG}
                content = content.replace(/\{\s*([#/\%^!?$@]?)\s*([^{}\s]+)\s*\}/g, "{$1$2}");

                // 3. Fix singular to plural mismatches (for component anomaly lists like ANOMALY_ROV -> ANOMALIES_ROV, but preserving SUMMARY and STAT tags)
                content = content.replace(/\{([#/\%^!?$@]?)FINDING_(?!(?:SUMMARY|STAT))([A-Za-z0-9_]+)\}/g, "{$1FINDINGS_$2}");
                content = content.replace(/\{([#/\%^!?$@]?)ANOMALY_(?!(?:SUMMARY|STAT))([A-Za-z0-9_]+)\}/g, "{$1ANOMALIES_$2}");

                // 4. Fix caisson guard aliases
                content = content.replace(/\{([#/\%^!?$@]?)HAS_FINDINGS_CAISSON_GUARD_ABOVE_UNDERWATER\}/g, "{$1HAS_FINDINGS_CAISSON_GUARD_UNDERWATER}");
                content = content.replace(/\{([#/\%^!?$@]?)ANOMALIES_DCAISSONGUARD([A-Za-z0-9_]*)\}/g, "{$1ANOMALIES_CAISSON_GUARD_UNDERWATER$2}");
                content = content.replace(/\{([#/\%^!?$@]?)FINDINGS_DCAISSONGUARD([A-Za-z0-9_]*)\}/g, "{$1FINDINGS_CAISSON_GUARD_UNDERWATER$2}");

                return `${openTag}${content}${closeTag}`;
            });

            // 5. Document-level inverted loop disambiguation:
            // Convert {^XYZ_PAGES}...{/XYZ_PAGES} to {#NO_XYZ_PAGES}...{/NO_XYZ_PAGES} across XML runs
            text = text.replace(/\{\^([A-Za-z0-9_]+_PAGES)\}([\s\S]*?)\{\/\1\}/g, '{#NO_$1}$2{/NO_$1}');
            text = text.replace(/\{\^HAS_([A-Za-z0-9_]+)\}([\s\S]*?)\{\/HAS_\1\}/g, '{#NO_$1}$2{/NO_$1}');
            text = text.replace(/\{\^([A-Za-z0-9_]+)\}([\s\S]*?)\{\/\1\}/g, '{#NO_$1}$2{/NO_$1}');

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

    // JPEG: scan for any SOF marker
    if (img[0] === 0xFF && img[1] === 0xD8) {
        let offset = 2;
        while (offset < img.length - 8) {
            if (img[offset] !== 0xFF) { offset++; continue; }
            const marker = img[offset + 1];
            // SOF0 (0xC0) through SOF15 (0xCF) except DHT (0xC4), JPG (0xC8), and DAC (0xCC)
            if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
                const h = (img[offset + 5] << 8) | img[offset + 6];
                const w = (img[offset + 7] << 8) | img[offset + 8];
                return [w, h];
            }
            const len = (img[offset + 2] << 8) | img[offset + 3];
            offset += 2 + len;
        }
    }

    // GIF: GIF87a or GIF89a
    if (img[0] === 0x47 && img[1] === 0x49 && img[2] === 0x46 && img[3] === 0x38) {
        const w = img[6] | (img[7] << 8);
        const h = img[8] | (img[9] << 8);
        return [w, h];
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
 * Rotates an image 90 degrees clockwise using HTML5 canvas.
 */
async function rotateImage90Degrees(bytes: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const canvas = document.createElement("canvas");
                canvas.width = img.height;
                canvas.height = img.width;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(bytes);
                    return;
                }
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(-90 * Math.PI / 180);
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
                
                canvas.toBlob((resultBlob) => {
                    if (resultBlob) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            resolve(new Uint8Array(reader.result as ArrayBuffer));
                        };
                        reader.onerror = reject;
                        reader.readAsArrayBuffer(resultBlob);
                    } else {
                        resolve(bytes);
                    }
                }, "image/jpeg", 0.95);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        img.src = url;
    });
}

/**
 * Scans the DOCX XML for anomaly/finding filter tags and automatically resolves:
 * 1. Missing boolean opposites: NO_<TAG> = !HAS_<TAG> (or arr.length === 0)
 * 2. Defect-specific tags: ANOMALIES_DEFECT_<DEFECT_NAME>, HAS_ANOMALIES_DEFECT_<DEFECT_NAME>, NO_ANOMALIES_DEFECT_<DEFECT_NAME>
 * 3. Inspection-specific tags: ANOMALIES_INSP_<INSP_TYPE>, FINDINGS_INSP_<INSP_TYPE>
 * 4. Component code tags: ANOMALIES_CODE_<COMP_CODE>, FINDINGS_CODE_<COMP_CODE>
 * 5. General aliases and inverted checks.
 */
function resolveDynamicTags(finalData: Record<string, any>, zip: PizZip) {
    // 1. First pass: ensure all existing arrays have HAS_ and NO_ flags
    for (const [key, value] of Object.entries(finalData)) {
        if (Array.isArray(value)) {
            if (finalData[`HAS_${key}`] === undefined) {
                finalData[`HAS_${key}`] = value.length > 0;
            }
            if (finalData[`NO_${key}`] === undefined) {
                finalData[`NO_${key}`] = value.length === 0;
            }
            if (finalData[`NO_HAS_${key}`] === undefined) {
                finalData[`NO_HAS_${key}`] = value.length === 0;
            }
        } else if (typeof value === "boolean") {
            if (key.startsWith("HAS_")) {
                const baseName = key.replace(/^HAS_/, "");
                if (finalData[`NO_${baseName}`] === undefined) {
                    finalData[`NO_${baseName}`] = !value;
                }
                if (finalData[`NO_HAS_${baseName}`] === undefined) {
                    finalData[`NO_HAS_${baseName}`] = !value;
                }
            } else if (key.startsWith("NO_")) {
                const baseName = key.replace(/^NO_/, "");
                if (finalData[`HAS_${baseName}`] === undefined) {
                    finalData[`HAS_${baseName}`] = !value;
                }
            }
        }
    }

    // 2. Extract all raw items to filter from
    const rawAnomalies: any[] = Array.isArray(finalData.RAW_ANOMALIES) 
        ? finalData.RAW_ANOMALIES 
        : (Array.isArray(finalData.ANOMALIES) ? finalData.ANOMALIES : []);
    
    const rawFindings: any[] = Array.isArray(finalData.RAW_FINDINGS)
        ? finalData.RAW_FINDINGS
        : (Array.isArray(finalData.FINDINGS) ? finalData.FINDINGS : []);

    const isROV = (item: any) => {
        const type = String(item.inspection_type_code || item.inspection_type?.code || item.inspectionType || item.method || item.type || "").toUpperCase();
        const desc = String(item.description || item.defect_description || item.findings || "").toUpperCase();
        return type.includes("ROV") || type.startsWith("R") || desc.includes("ROV");
    };
    const isDiving = (item: any) => {
        const type = String(item.inspection_type_code || item.inspection_type?.code || item.inspectionType || item.method || item.type || "").toUpperCase();
        const desc = String(item.description || item.defect_description || item.findings || "").toUpperCase();
        return type.includes("DIVE") || type.includes("DIVING") || type.startsWith("D") || desc.includes("DIVER") || desc.includes("DIVING");
    };

    const normalizeTagText = (str: string) => str.toUpperCase().replace(/[^A-Z0-9]/g, "");

    // 3. Scan XML files in zip for referenced tags
    const docTags = new Set<string>();
    for (const [relativePath, file] of Object.entries(zip.files)) {
        if (!file.dir && relativePath.endsWith(".xml")) {
            const xml = file.asText();
            const tagRegex = /\{([#/]|\^|HAS_|NO_)?([A-Za-z0-9_]+)\}/g;
            let m;
            while ((m = tagRegex.exec(xml)) !== null) {
                docTags.add(m[2]);
            }
        }
    }

    // 4. Dynamically resolve any tags found in the template
    docTags.forEach(tag => {
        const cleanTag = tag.toUpperCase();
        let targetType: "ANOMALIES" | "FINDINGS" | null = null;
        let suffix = "";

        if (cleanTag.startsWith("ANOMALIES_") || cleanTag.startsWith("ANOMALY_")) {
            targetType = "ANOMALIES";
            suffix = cleanTag.replace(/^(ANOMALIES_|ANOMALY_)/, "");
        } else if (cleanTag.startsWith("FINDINGS_") || cleanTag.startsWith("FINDING_")) {
            targetType = "FINDINGS";
            suffix = cleanTag.replace(/^(FINDINGS_|FINDING_)/, "");
        }

        if (targetType && suffix && !finalData[tag]) {
            const sourceList = targetType === "ANOMALIES" ? rawAnomalies : rawFindings;
            let filterFn: ((item: any) => boolean) | null = null;

            // Pattern A: DEFECT filter (e.g. DEFECT_CP, DEFECT_CATHODIC_POTENTIAL, DEFECT_ANODE_WASTAGE, DEFECT_DEBRIS, DEFECT_VARIATION_TO_SPEC, etc.)
            if (suffix.startsWith("DEFECT_") || suffix.startsWith("FILTER_DEFECT_")) {
                const defectTarget = suffix.replace(/^(FILTER_)?DEFECT_/, "");
                const methodROV = defectTarget.endsWith("_ROV");
                const methodDive = defectTarget.endsWith("_DIVE") || defectTarget.endsWith("_DIVING");
                const pureDefect = defectTarget.replace(/_(ROV|DIVE|DIVING)$/, "");
                const normTarget = normalizeTagText(pureDefect);

                filterFn = (item: any) => {
                    if (methodROV && !isROV(item)) return false;
                    if (methodDive && !isDiving(item)) return false;

                    const defType = normalizeTagText(String(item.defect_type_code || item.defect_type || item.defect || ""));
                    const defCat = normalizeTagText(String(item.defect_category_code || item.defect_category || ""));
                    const defCode = normalizeTagText(String(item.defect_code || item.defectCode || ""));
                    const desc = normalizeTagText(String(item.defect_description || item.description || item.findings || item.comments || ""));

                    // CP special case alias: if searching CP / CATHODIC_POTENTIAL, match CP, CATHODIC POTENTIAL, etc. but exclude Anodes
                    if (normTarget === "CP" || normTarget === "CATHODICPOTENTIAL" || normTarget === "CATHODICPROTECTION" || normTarget === "RCP") {
                        const isAnode = defType.includes("ANODE") || defCat.includes("ANODE") || defCode.includes("ANODE");
                        if (isAnode) return false;
                        return defType.includes("CP") || defType.includes("CATHODIC") || defType.includes("POTENTIAL") ||
                               defCat.includes("CP") || defCat.includes("CATHODIC") || defCat.includes("POTENTIAL") ||
                               defCode.includes("CP") || desc.includes("CATHODIC") || desc.includes("POTENTIAL");
                    }

                    return defType.includes(normTarget) || defCat.includes(normTarget) || defCode.includes(normTarget) || desc.includes(normTarget);
                };
            }
            // Pattern B: COMPONENT CODE / TYPE filter (e.g. CODE_AN, CODE_BL, CODE_CA, CODE_CD, etc.)
            else if (suffix.startsWith("CODE_") || suffix.startsWith("FILTER_CODE_") || suffix.startsWith("COMP_") || suffix.startsWith("FILTER_COMP_")) {
                const codeTarget = suffix.replace(/^(FILTER_)?(CODE|COMP)_/, "");
                const methodROV = codeTarget.endsWith("_ROV");
                const methodDive = codeTarget.endsWith("_DIVE") || codeTarget.endsWith("_DIVING");
                const pureCode = codeTarget.replace(/_(ROV|DIVE|DIVING)$/, "");
                const normCode = normalizeTagText(pureCode);

                filterFn = (item: any) => {
                    if (methodROV && !isROV(item)) return false;
                    if (methodDive && !isDiving(item)) return false;

                    const ct = normalizeTagText(String(item.component_type || item.component_code || ""));
                    const qid = normalizeTagText(String(item.qid || item.component_qid || ""));
                    return ct === normCode || ct.startsWith(normCode) || qid.startsWith(normCode);
                };
            }
            // Pattern C: INSPECTION TYPE filter (e.g. INSP_RCP, INSP_CPSURV, INSP_RFMD, INSP_RMGI, etc.)
            else if (suffix.startsWith("INSP_") || suffix.startsWith("FILTER_INSP_") || suffix.startsWith("TYPE_") || suffix.startsWith("FILTER_TYPE_")) {
                const inspTarget = suffix.replace(/^(FILTER_)?(INSP|TYPE)_/, "");
                const normInsp = normalizeTagText(inspTarget);

                filterFn = (item: any) => {
                    const insp = normalizeTagText(String(item.inspection_type_code || item.inspectionType || item.inspection_type?.code || item.inspection_type_name || ""));
                    return insp.includes(normInsp);
                };
            }

            if (filterFn) {
                const filtered = sourceList.filter(filterFn).map((item: any, idx: number) => {
                    const refVal = item.ref || item.ref_no || item.anom_no || item.defect_ref_no || item.id || "-";
                    const defCode = item.defect_code || item.defectCode || item.defect || item.defect_type || "-";
                    const qidVal = item.qid || item.structure_components?.q_id || item.component_code || item.component_id || "N/A";
                    const elvVal = item.elevation || item.elev || item.inspection_data?.elevation || "-";
                    const descVal = item.defect_description || item.description || item.findings || item.comments || "-";

                    return {
                        ...item,
                        no: idx + 1,
                        NO: idx + 1,
                        id: idx + 1,
                        ID: idx + 1,
                        qid: qidVal,
                        QID: qidVal,
                        elevation: elvVal,
                        elev: elvVal,
                        ELEVATION: elvVal,
                        ELEV: elvVal,
                        defect_code: defCode,
                        defect: defCode,
                        DEFECT_CODE: defCode,
                        DEFECT: defCode,
                        ref: refVal,
                        ref_no: refVal,
                        anom_no: refVal,
                        REF: refVal,
                        description: descVal,
                        DESCRIPTION: descVal,
                        defect_description: descVal,
                        DEFECT_DESCRIPTION: descVal,
                    };
                });

                finalData[tag] = filtered;
                finalData[`ANOMALIES_${suffix}`] = filtered;
                finalData[`FINDINGS_${suffix}`] = filtered;
                finalData[`HAS_${tag}`] = filtered.length > 0;
                finalData[`NO_${tag}`] = filtered.length === 0;
                finalData[`HAS_ANOMALIES_${suffix}`] = filtered.length > 0;
                finalData[`NO_ANOMALIES_${suffix}`] = filtered.length === 0;
                finalData[`HAS_FINDINGS_${suffix}`] = filtered.length > 0;
                finalData[`NO_FINDINGS_${suffix}`] = filtered.length === 0;
            }
        }
    });

    // 5. Final pass on all HAS_ and NO_ tags to ensure complete symmetry
    for (const key of Object.keys(finalData)) {
        if (key.startsWith("HAS_")) {
            const base = key.substring(4);
            if (finalData[`NO_${base}`] === undefined) {
                finalData[`NO_${base}`] = !finalData[key];
            }
        }
        if (Array.isArray(finalData[key])) {
            if (finalData[`HAS_${key}`] === undefined) {
                finalData[`HAS_${key}`] = finalData[key].length > 0;
            }
            if (finalData[`NO_${key}`] === undefined) {
                finalData[`NO_${key}`] = finalData[key].length === 0;
            }
        }
    }

    // 6. Guarantee fallbacks for any _PAGES, NO_, HAS_ tags found in docTags
    docTags.forEach(tag => {
        const clean = tag.toUpperCase();
        if (clean.endsWith("_PAGES")) {
            if (finalData[clean] === undefined) {
                finalData[clean] = [];
            }
            if (finalData[`HAS_${clean}`] === undefined) {
                finalData[`HAS_${clean}`] = false;
            }
            if (finalData[`NO_${clean}`] === undefined) {
                finalData[`NO_${clean}`] = true;
            }
        }
        if (clean.startsWith("NO_")) {
            const base = clean.substring(3);
            if (finalData[clean] === undefined) {
                if (finalData[base] !== undefined) {
                    finalData[clean] = Array.isArray(finalData[base]) 
                        ? finalData[base].length === 0 
                        : !finalData[base];
                } else if (finalData[`HAS_${base}`] !== undefined) {
                    finalData[clean] = !finalData[`HAS_${base}`];
                } else {
                    finalData[clean] = true;
                }
            }
        }
        if (clean.startsWith("HAS_")) {
            const base = clean.substring(4);
            if (finalData[clean] === undefined) {
                if (finalData[base] !== undefined) {
                    finalData[clean] = Array.isArray(finalData[base]) 
                        ? finalData[base].length > 0 
                        : Boolean(finalData[base]);
                } else if (finalData[`NO_${base}`] !== undefined) {
                    finalData[clean] = !finalData[`NO_${base}`];
                } else {
                    finalData[clean] = false;
                }
            }
        }
    });
}

/**
 * Generates a DOCX report from a template.
 * - Text tags: {TAG_NAME}
 * - Image tags: {%TAG_NAME}
 * - Loop tags: {#LOOP}...{/LOOP}
 */
export const generateTemplateReport = async ({ templateUrl, preloadedTemplate, data, fileName, logoUrl, contractorLogoUrl, onProgress }: ReportOptions) => {
    const imageCache: Record<string, Uint8Array> = {};
    const finalData: Record<string, any> = {};

    try {
        let content: ArrayBuffer;
        if (preloadedTemplate) {
            content = preloadedTemplate;
        } else {
            onProgress?.(80, "Fetching report template...");
            console.log(`[ReportGen] Fetching template: ${templateUrl}`);
            const tUrl = templateUrl.includes("?") ? `${templateUrl}&_t=${Date.now()}` : `${templateUrl}?_t=${Date.now()}`;
            const response = await fetch(tUrl, { cache: "no-store" });
            if (!response.ok) throw new Error(`Template fetch failed: ${response.statusText}`);
            content = await response.arrayBuffer();
        }

        // ── Pre-fetch Logos ───────────────────────────────────────
        let logoBytes: Uint8Array | null = null;
        const resolvedLogoUrl = logoUrl || data?.CLIENT_LOGO_URL || data?.client_logo_url || data?.COMPANY_LOGO_URL || data?.company_logo_url;
        if (resolvedLogoUrl) {
            try {
                onProgress?.(84, "Loading company logo...");
                console.log(`[ReportGen] Fetching logo: ${resolvedLogoUrl}`);
                const lRes = await fetch(resolvedLogoUrl);
                if (lRes.ok) {
                    const buf = await lRes.arrayBuffer();
                    logoBytes = toUint8Array(buf);
                    console.log(`[ReportGen] Logo OK: ${logoBytes.byteLength} bytes`);
                }
            } catch (e) {
                console.warn("[ReportGen] Logo fetch error:", e);
            }
        }

        let contractorLogoBytes: Uint8Array | null = null;
        const resolvedContractorLogoUrl = contractorLogoUrl || data?.CONTRACTOR_LOGO_URL || data?.contractor_logo_url || (typeof data?.CONTRACTOR_LOGO === "string" && data.CONTRACTOR_LOGO.startsWith("http") ? data.CONTRACTOR_LOGO : null);
        if (resolvedContractorLogoUrl) {
            try {
                onProgress?.(86, "Loading contractor logo...");
                console.log(`[ReportGen] Fetching contractor logo: ${resolvedContractorLogoUrl}`);
                const clRes = await fetch(resolvedContractorLogoUrl);
                if (clRes.ok) {
                    const buf = await clRes.arrayBuffer();
                    contractorLogoBytes = toUint8Array(buf);
                    console.log(`[ReportGen] Contractor logo OK: ${contractorLogoBytes.byteLength} bytes`);
                }
            } catch (e) {
                console.warn("[ReportGen] Contractor logo fetch error:", e);
            }
        }

        // ── Image cache (tagValue → Uint8Array) ─────────────────
        onProgress?.(88, "Processing embedded media and charts...");
        if (logoBytes) {
            imageCache["CLIENT_LOGO"] = logoBytes;
            imageCache["client_logo"] = logoBytes;
            imageCache["COMPANY_LOGO"] = logoBytes;
            imageCache["company_logo"] = logoBytes;
            imageCache["LOGO"] = logoBytes;
            imageCache["logo"] = logoBytes;
        }
        if (contractorLogoBytes) {
            imageCache["CONTRACTOR_LOGO"] = contractorLogoBytes;
            imageCache["contractor_logo"] = contractorLogoBytes;
        }

        const base64ToUint8Array = (base64: string): Uint8Array => {
            const binaryString = atob(base64.trim());
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        };

        // In-memory promise cache to guarantee every distinct image is fetched EXACTLY ONCE
        const imageFetchPromiseCache = new Map<string, Promise<Uint8Array | null>>();

        if (logoBytes && resolvedLogoUrl) {
            const cleanLUrl = resolvedLogoUrl.replace(/([?&])_t=\d+/g, "").replace(/[?&]$/, "").trim();
            imageFetchPromiseCache.set(cleanLUrl, Promise.resolve(logoBytes));
        }
        if (contractorLogoBytes && resolvedContractorLogoUrl) {
            const cleanClUrl = resolvedContractorLogoUrl.replace(/([?&])_t=\d+/g, "").replace(/[?&]$/, "").trim();
            imageFetchPromiseCache.set(cleanClUrl, Promise.resolve(contractorLogoBytes));
        }

        const fetchImageBytes = (dataUriOrUrl: string): Promise<Uint8Array | null> => {
            if (!dataUriOrUrl || typeof dataUriOrUrl !== "string") return Promise.resolve(null);
            const cleanUrl = dataUriOrUrl.replace(/([?&])_t=\d+/g, "").replace(/[?&]$/, "").trim();
            if (!cleanUrl) return Promise.resolve(null);

            if (imageFetchPromiseCache.has(cleanUrl)) {
                return imageFetchPromiseCache.get(cleanUrl)!;
            }

            const promise = (async (): Promise<Uint8Array | null> => {
                if (cleanUrl.startsWith("data:image")) {
                    const base64 = cleanUrl.split(",")[1];
                    return base64ToUint8Array(base64);
                }

                if (cleanUrl.startsWith("/") || cleanUrl.startsWith("http")) {
                    try {
                        const rawUrl = cleanUrl.startsWith("/") ? window.location.origin + cleanUrl : cleanUrl;
                        let imgRes = await fetch(rawUrl).catch(() => null);
                        if (!imgRes || !imgRes.ok) {
                            const proxyUrl = `/api/attachment/url?path=${encodeURIComponent(cleanUrl)}`;
                            imgRes = await fetch(proxyUrl).catch(() => null);
                        }
                        if (!imgRes || !imgRes.ok) {
                            const dlUrl = `/api/attachment/download?path=${encodeURIComponent(cleanUrl)}&bucket=attachments`;
                            imgRes = await fetch(dlUrl).catch(() => null);
                        }
                        if (imgRes && imgRes.ok) {
                            return toUint8Array(await imgRes.arrayBuffer());
                        }
                    } catch (e) {
                        console.warn("Failed to fetch image:", e);
                    }
                    return null;
                }

                try {
                    return base64ToUint8Array(cleanUrl);
                } catch {
                    return null;
                }
            })();

            imageFetchPromiseCache.set(cleanUrl, promise);
            return promise;
        };

        let imageCounter = 0;
        for (const [key, value] of Object.entries(data)) {
            const upperKey = key.toUpperCase();
            // Reuse pre-fetched logo bytes without redundant network calls
            if (["CLIENT_LOGO", "COMPANY_LOGO", "LOGO"].includes(upperKey) && logoBytes) {
                finalData[key] = "CLIENT_LOGO";
                continue;
            }
            if (upperKey === "CONTRACTOR_LOGO" && contractorLogoBytes) {
                finalData[key] = "CONTRACTOR_LOGO";
                continue;
            }

            if (typeof value === "object" && value !== null && (value as any).data && (value as any).extension) {
                // Single image
                const imgObj = value as any;
                let bytes: Uint8Array | null = null;
                if (imgObj.data instanceof Uint8Array) {
                    bytes = imgObj.data;
                } else if (typeof imgObj.data === "string") {
                    bytes = await fetchImageBytes(imgObj.data);
                }
                if (bytes) {
                    const dims = getImageDimensions(bytes);
                    if (dims && dims[0] > dims[1] && (key.toUpperCase().includes("PAGE_IMAGE") || (imgObj as any)?.rotate)) {
                        try {
                            bytes = await rotateImage90Degrees(bytes);
                        } catch (rotErr) {
                            console.warn("Failed to rotate landscape image:", rotErr);
                        }
                    }
                    const imgKey = `nested_img_${imageCounter++}`;
                    imageCache[imgKey] = bytes;
                    finalData[key] = imgKey;
                } else {
                    finalData[key] = "";
                }
            } else if (Array.isArray(value)) {
                finalData[key] = await Promise.all(value.map(async (item) => {
                    if (typeof item === "object" && item !== null) {
                        const newItem = { ...item };
                        for (const [k, v] of Object.entries(newItem)) {
                            if (typeof v === "object" && v !== null && (v as any).data && (v as any).extension) {
                                const imgObj = v as any;
                                let bytes: Uint8Array | null = null;
                                if (imgObj.data instanceof Uint8Array) {
                                    bytes = imgObj.data;
                                } else if (typeof imgObj.data === "string") {
                                    bytes = await fetchImageBytes(imgObj.data);
                                }
                                if (bytes) {
                                    const dims = getImageDimensions(bytes);
                                    if (dims && dims[0] > dims[1] && (k.toUpperCase().includes("PAGE_IMAGE") || (item as any)?.is_landscape || (imgObj as any)?.rotate)) {
                                        try {
                                            bytes = await rotateImage90Degrees(bytes);
                                        } catch (rotErr) {
                                            console.warn("Failed to rotate landscape image:", rotErr);
                                        }
                                    }
                                    const imgKey = `nested_img_${imageCounter++}`;
                                    imageCache[imgKey] = bytes;
                                    newItem[k] = imgKey;
                                }
                            }
                        }
                        return newItem;
                    }
                    return item;
                }));
            } else {
                finalData[key] = value;
            }
        }

        // Set logo data — the image module will call getImage(tag)
        if (logoBytes) {
            finalData["CLIENT_LOGO"] = "CLIENT_LOGO";
            finalData["client_logo"] = "CLIENT_LOGO";
            finalData["COMPANY_LOGO"] = "CLIENT_LOGO";
            finalData["company_logo"] = "CLIENT_LOGO";
            finalData["LOGO"] = "CLIENT_LOGO";
            finalData["logo"] = "CLIENT_LOGO";
        }
        if (contractorLogoBytes) {
            finalData["CONTRACTOR_LOGO"] = "CONTRACTOR_LOGO";
            finalData["contractor_logo"] = "CONTRACTOR_LOGO";
        }

        // Legacy aliases
        finalData["T_STR_TITLE"] = finalData["PLATFORM_TITLE"] || finalData["PLATFORM_NAME"] || "";
        finalData["T_MON_YR"] = finalData["DATE"] || "";
        finalData["T_REPORT_NO"] = finalData["REPORT_NO"] || finalData["SOW_REPORT_NO"] || "";
        finalData["T_CLIENT"] = finalData["CLIENT_NAME"] || "";
        finalData["T_PROJECT"] = finalData["PROJECT_NO"] || "";
        finalData["T_VESSEL"] = finalData["VESSEL_NAME"] || "";
        finalData["T_INSPECTION_YEAR"] = finalData["INSPECTION_YEAR"] || "";
        finalData["T_VESSELS_INVOLVED"] = finalData["VESSELS_INVOLVED"] || "";
        finalData["T_CLIENT_SHORT"] = finalData["CLIENT_SHORT"] || "";
        finalData["CLIENT_SHORT_UPPER"] = (finalData["CLIENT_SHORT"] || "").toUpperCase();
        finalData["client_short_upper"] = (finalData["CLIENT_SHORT"] || "").toUpperCase();
        finalData["client_short"] = finalData["CLIENT_SHORT"] || "";
        finalData["client_name"] = finalData["CLIENT_NAME"] || "";

        onProgress?.(92, "Sanitizing template and compiling Word document...");
        // ── Build and render ─────────────────────────────────────
        const zip = new PizZip(content);
        normalizeDelimiters(zip);

        // Dynamically resolve custom filter tags and ensure NO_ and HAS_ symmetry
        resolveDynamicTags(finalData, zip);

        const imageModule = new ImageModule({
            centered: false,
            getImage: (tagValue: string) => {
                console.log("[ReportGen] getImage called for:", tagValue);
                const cached = imageCache[tagValue];
                if (cached) return cached;
                return null;
            },
            getSize: (img: Uint8Array, tagValue: string, tagName: string) => {
                if (!img) return [100, 50];

                const dims = getImageDimensions(img);
                if (dims) {
                    const [origW, origH] = dims;
                    const ratio = origW / origH;
                    const tagUpper = (tagName || "").toUpperCase();
                    
                    if (tagUpper.includes("LOGO")) {
                        // Fit to max height of 80px for logos
                        const maxH = 80;
                        const h = Math.min(origH, maxH);
                        const w = Math.round(h * ratio);
                        console.log(`[ReportGen] Logo size (${tagName}): ${origW}x${origH} → ${w}x${h}`);
                        return [w, h];
                    } else if (tagUpper.includes("PAGE_IMAGE") || (tagUpper.includes("PHOTO") && origH >= 900)) {
                        // Fit inside portrait page with header table without pushing to a new page
                        console.log(`[ReportGen] Page image scaled to fit page: 680x800`);
                        return [680, 800];
                    } else {
                        // Fit to page width (550px for portrait, 750px for landscape content images)
                        const maxW = ratio > 1.0 ? 750 : 550;
                        const w = maxW;
                        const h = Math.round(w / ratio);
                        console.log(`[ReportGen] Content image size (${tagName}): ${origW}x${origH} → ${w}x${h}`);
                        return [w, h];
                    }
                }

                // Fallback: square-ish default
                return [80, 80];
            },
        });

        // Attach image module
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            modules: [imageModule],
            nullGetter: () => "",
        });
        doc.setData(finalData);

        onProgress?.(96, "Rendering document tables and pages...");
        try {
            doc.render();
            console.log("[ReportGen] Render succeeded with image module.");
        } catch (renderErr: any) {
            console.warn("[ReportGen] Render with images failed, attempting fallback:", renderErr.message);

            // Fallback: text-only, fresh zip
            const textData = { ...finalData };
            delete textData["CLIENT_LOGO"];
            delete textData["MGI_GRAPH"];

            const zip2 = new PizZip(content);
            normalizeDelimiters(zip2);

            const doc2 = new Docxtemplater(zip2, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: () => "",
            });
            doc2.setData(textData);
            doc2.render();

            onProgress?.(99, "Generating final file...");
            const out2 = doc2.getZip().generate({
                type: "blob",
                mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });
            saveAs(out2, fileName.endsWith(".docx") ? fileName : `${fileName}.docx`);
            console.log("[ReportGen] Saved text-only fallback.");
            onProgress?.(100, "Done!");
            return;
        }

        onProgress?.(99, "Generating final DOCX file...");
        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        saveAs(out, fileName.endsWith(".docx") ? fileName : `${fileName}.docx`);
        console.log("[ReportGen] Saved with logo.");
        onProgress?.(100, "Done!");

    } catch (error: any) {
        if (error.properties?.errors instanceof Array) {
            const msgs = error.properties.errors
                .map((e: any) => e.properties?.explanation || e.message)
                .join("\n");
            console.error("[ReportGen] Template errors:\n", msgs);
            toast.error("Template syntax issue: " + msgs.substring(0, 200));
        } else {
            console.error("[ReportGen] Error:", error);
            toast.error(error.message || "Report generation failed");
        }
        throw error;
    } finally {
        // Explicitly clean up all in-memory image buffers and dictionary data
        console.log(`[ReportGen] Cleaning up ${Object.keys(imageCache).length} in-memory image buffers and ${Object.keys(finalData).length} data entries...`);
        for (const k of Object.keys(imageCache)) {
            delete imageCache[k];
        }
        for (const k of Object.keys(finalData)) {
            delete finalData[k];
        }
    }
};
