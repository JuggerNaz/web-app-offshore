import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, draw3SectionHeader, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, formatReportFindingText, applyRecordCellStyling , REPORT_FOOTER_APP_TEXT } from "./shared-logo";
import { createClient } from "@/utils/supabase/client";
import { getAttachmentUrl } from "@/utils/attachment-utils";

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

interface ReportConfig {
    reportNoPrefix?: string;
    printFriendly?: boolean;
    jobPackId?: number;
    structureId?: number;
    sowReportNo?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

interface LoadedPhoto {
    data: string;
    width: number;
    height: number;
    aspect: number;
}

const photoDataCache = new Map<string, LoadedPhoto>();

// Multi-strategy image loader for PDF generation (with aggressive downsampling to prevent V8 string overflow)
const loadPhotoData = async (url: string): Promise<LoadedPhoto | null> => {
    if (!url || typeof url !== "string" || !url.trim()) {
        return null;
    }

    if (photoDataCache.has(url)) {
        return photoDataCache.get(url)!;
    }

    const tryViaImageElement = (src: string, useCrossOrigin = true): Promise<LoadedPhoto | null> => {
        return new Promise((resolve) => {
            const img = new Image();
            if (useCrossOrigin && !src.startsWith("data:") && !src.startsWith("blob:")) {
                img.crossOrigin = "Anonymous";
            }
            const timeout = setTimeout(() => {
                img.onload = null;
                img.onerror = null;
                resolve(null);
            }, 4000);

            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const origW = img.naturalWidth || img.width || 800;
                    const origH = img.naturalHeight || img.height || 600;
                    const aspect = origH > 0 ? origW / origH : 1.333;

                    // Bound dimensions to max 800x600 for PDF rendering (rendered inside 92mm x 48mm grid boxes)
                    // 800px wide @ 92mm yields >220 DPI for crystal-clear prints while keeping file payload <50KB
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 600;
                    let targetW = origW;
                    let targetH = origH;

                    if (targetW > MAX_WIDTH || targetH > MAX_HEIGHT) {
                        const scale = Math.min(MAX_WIDTH / targetW, MAX_HEIGHT / targetH);
                        targetW = Math.max(1, Math.round(targetW * scale));
                        targetH = Math.max(1, Math.round(targetH * scale));
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = "medium";
                        ctx.drawImage(img, 0, 0, targetW, targetH);
                        const optimizedData = canvas.toDataURL("image/jpeg", 0.72);
                        // Release canvas GPU and backing memory immediately
                        canvas.width = 0;
                        canvas.height = 0;

                        resolve({
                            data: optimizedData,
                            width: targetW,
                            height: targetH,
                            aspect
                        });
                    } else {
                        resolve(null);
                    }
                } catch {
                    resolve(null);
                }
            };

            img.onerror = () => {
                clearTimeout(timeout);
                resolve(null);
            };

            img.src = src;
        });
    };

    // 1. Direct Base64 / Data URI
    if (url.startsWith("data:")) {
        const directRes = await tryViaImageElement(url, false);
        if (directRes) {
            photoDataCache.set(url, directRes);
            return directRes;
        }
        return null;
    }

    // 2. Fetch as Blob -> Object URL (direct native decode without allocating giant base64 strings)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            try {
                const res = await tryViaImageElement(blobUrl, false);
                if (res) {
                    photoDataCache.set(url, res);
                    return res;
                }
            } finally {
                URL.revokeObjectURL(blobUrl);
            }
        }
    } catch (e) {
        // Fallback to Image element
    }

    // 3. Fallback: Image element with crossOrigin
    const resCrossOrigin = await tryViaImageElement(url, true);
    if (resCrossOrigin) {
        photoDataCache.set(url, resCrossOrigin);
        return resCrossOrigin;
    }

    // 4. Fallback: Image element without crossOrigin
    const resFallback = await tryViaImageElement(url, false);
    if (resFallback) {
        photoDataCache.set(url, resFallback);
    }
    return resFallback;
};

/**
 * Safely parses an inspection date value (string, Date, etc.) into timestamp ms without timezone shift.
 */
const parseSafeDate = (d: any): number => {
    if (!d) return 0;
    if (d instanceof Date) return isNaN(d.getTime()) ? 0 : d.getTime();
    if (typeof d === 'number') return isNaN(d) ? 0 : d;
    if (typeof d === 'string') {
        const s = d.trim();
        if (!s || s.toUpperCase() === 'N/A' || s === '-' || s === '--') return 0;

        // Match YYYY-MM-DD or YYYY/MM/DD with optional time
        const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
        if (ymd) {
            const dt = new Date(
                parseInt(ymd[1], 10),
                parseInt(ymd[2], 10) - 1,
                parseInt(ymd[3], 10),
                ymd[4] ? parseInt(ymd[4], 10) : 0,
                ymd[5] ? parseInt(ymd[5], 10) : 0,
                ymd[6] ? parseInt(ymd[6], 10) : 0
            );
            return isNaN(dt.getTime()) ? 0 : dt.getTime();
        }

        // Match DD/MM/YYYY or DD-MM-YYYY with optional time
        const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
        if (dmy) {
            const dt = new Date(
                parseInt(dmy[3], 10),
                parseInt(dmy[2], 10) - 1,
                parseInt(dmy[1], 10),
                dmy[4] ? parseInt(dmy[4], 10) : 0,
                dmy[5] ? parseInt(dmy[5], 10) : 0,
                dmy[6] ? parseInt(dmy[6], 10) : 0
            );
            return isNaN(dt.getTime()) ? 0 : dt.getTime();
        }

        const dt = new Date(s);
        return isNaN(dt.getTime()) ? 0 : dt.getTime();
    }
    return 0;
};

/**
 * Returns exact timestamp ms incorporating inspection date and optional inspection time.
 * Explicitly ignores file upload / attachment creation timestamps.
 */
const getInspDateTimeMs = (item: any): number => {
    const rawDate = item._inspDate || item.inspection_date || item.insp_date || item.date;
    const baseMs = parseSafeDate(rawDate);
    if (baseMs === 0) return 0;

    const rawTime = item._inspTime || item.inspection_time || item.time || item.inspection_data?.inspection_time;
    if (rawTime && typeof rawTime === 'string') {
        const tm = rawTime.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        if (tm) {
            const timeHours = parseInt(tm[1], 10);
            const timeMins = parseInt(tm[2], 10);
            const timeSecs = tm[3] ? parseInt(tm[3], 10) : 0;
            return baseMs + (timeHours * 3600 + timeMins * 60 + timeSecs) * 1000;
        }
    }
    return baseMs;
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
): Promise<Blob | void | null> => {
    try {
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        const supabase = createClient();

        // Extract and flatten attachments if inspection records were passed
        const flatPhotos: any[] = [];
        (photos || []).forEach((item: any) => {
            if (!item) return;
            const atts = item.attachments || item.attachment || item.insp_attachments || item.insp_photos || item.photos;
            // STRICT: Use only inspection date and inspection time from record, NEVER file creation created_at / captured_at
            const itemDate = item.inspection_date || item.insp_date || item.date || item.inspection_data?.inspection_date || item.inspection_data?.insp_date || item.inspection_data?.date || null;
            const itemTime = item.inspection_time || item.inspection_data?.inspection_time || item.inspection_data?.time || item._inspTime || null;
            const itemInspId = item.insp_id !== undefined ? item.insp_id : (item.id !== undefined ? item.id : 0);

            if (Array.isArray(atts) && atts.length > 0) {
                atts.forEach((a: any, aIdx: number) => {
                    if (!a) return;
                    const sortOrder = a.meta?.sort_order !== undefined 
                        ? Number(a.meta.sort_order) 
                        : (a.sort_order !== undefined 
                            ? Number(a.sort_order) 
                            : (a.attachment_order !== undefined ? Number(a.attachment_order) : aIdx));
                    // STRICT: Use only inspection date from record or attachment metadata, NEVER image file upload created_at / captured_at
                    const photoDate = a.inspection_date || a.insp_date || a.date || itemDate || (a.meta as any)?.inspection_date || (a.meta as any)?.insp_date || null;
                    const photoTime = a.inspection_time || a.time || itemTime || (a.meta as any)?.inspection_time || null;
                    const photoInspId = a.insp_id || a.inspection_id || itemInspId || a.source_id || 0;
                    flatPhotos.push({
                        ...a,
                        _inspDate: photoDate,
                        _inspTime: photoTime,
                        _inspId: photoInspId,
                        _sortOrder: sortOrder,
                        anomaly_ref: a.anomaly_ref || item.insp_anomalies?.[0]?.anomaly_ref_no || item.anomaly_ref || null
                    });
                });
            } else if (item.path || item.file_path || item.url || item.file_url || item.storage_path || item.previewUrl || item.id) {
                const sortOrder = item.meta?.sort_order !== undefined 
                    ? Number(item.meta.sort_order) 
                    : (item.sort_order !== undefined 
                        ? Number(item.sort_order) 
                        : (item.attachment_order !== undefined ? Number(item.attachment_order) : 0));
                // STRICT: Use only inspection date from record or metadata, NEVER image file upload created_at / captured_at
                const photoDate = item.inspection_date || item.insp_date || item.date || itemDate || (item.meta as any)?.inspection_date || (item.meta as any)?.insp_date || null;
                const photoTime = item.inspection_time || item.time || itemTime || (item.meta as any)?.inspection_time || null;
                const photoInspId = item.insp_id || item.inspection_id || itemInspId || item.source_id || 0;
                flatPhotos.push({
                    ...item,
                    _inspDate: photoDate,
                    _inspTime: photoTime,
                    _inspId: photoInspId,
                    _sortOrder: sortOrder,
                });
            }
        });

        // Fallback: If any photos lack inspection dates but have an inspection ID, look up inspection_date from insp_records
        const missingInspIds = Array.from(new Set(
            flatPhotos
                .filter(p => !p._inspDate && p._inspId && Number(p._inspId) > 0)
                .map(p => Number(p._inspId))
        ));

        if (missingInspIds.length > 0) {
            try {
                const { data: recDates } = await supabase
                    .from("insp_records")
                    .select("insp_id, inspection_date, inspection_time, inspection_data")
                    .in("insp_id", missingInspIds);

                if (recDates && recDates.length > 0) {
                    const dateMap = new Map<number, { date: string | null; time: string | null }>();
                    recDates.forEach((r: any) => {
                        const d = r.inspection_date || r.inspection_data?.inspection_date || r.inspection_data?.insp_date || r.inspection_data?.date || null;
                        const t = r.inspection_time || r.inspection_data?.inspection_time || r.inspection_data?.time || null;
                        dateMap.set(Number(r.insp_id), { date: d, time: t });
                    });
                    flatPhotos.forEach(p => {
                        if (!p._inspDate && p._inspId && dateMap.has(Number(p._inspId))) {
                            const info = dateMap.get(Number(p._inspId))!;
                            p._inspDate = info.date;
                            if (info.time && !p._inspTime) p._inspTime = info.time;
                        }
                    });
                }
            } catch (lookupErr) {
                console.warn("[ROV Photography Report] Failed to fetch inspection date for records:", lookupErr);
            }
        }

        // Deduplicate photos by ID or storage path to avoid redundant pages and memory consumption
        const seenPhotoKeys = new Set<string>();
        const uniquePhotos: any[] = [];
        flatPhotos.forEach((p: any) => {
            if (!p) return;
            const key = p.id ? `id_${p.id}` : (p.path || p.file_path || p.url || p.file_url || p.storage_path || p.name || JSON.stringify(p));
            if (!seenPhotoKeys.has(key)) {
                seenPhotoKeys.add(key);
                uniquePhotos.push(p);
            }
        });

        // Sort photos: 1) Inspection date order -> 2) Group by inspection id -> 3) Attachment order
        const resolvedPhotos = uniquePhotos.sort((a: any, b: any) => {
            // 1. Inspection Date Order (Chronological by inspection date only, NEVER file created_at / captured_at)
            const timeA = getInspDateTimeMs(a);
            const timeB = getInspDateTimeMs(b);
            if (timeA !== timeB) {
                if (timeA === 0) return 1;
                if (timeB === 0) return -1;
                return timeA - timeB;
            }

            // 2. Group by Inspection ID
            const idA = String(a._inspId ?? '');
            const idB = String(b._inspId ?? '');
            if (idA !== idB) {
                return idA.localeCompare(idB, undefined, { numeric: true });
            }

            // 3. Attachment Order
            const orderA = a._sortOrder !== undefined ? Number(a._sortOrder) : 999999;
            const orderB = b._sortOrder !== undefined ? Number(b._sortOrder) : 999999;
            if (orderA !== orderB) return orderA - orderB;

            const photoIdA = Number(a.id || 0);
            const photoIdB = Number(b.id || 0);
            return photoIdA - photoIdB;
        });

        // If no photos, return a document with an empty state message
        if (!resolvedPhotos || resolvedPhotos.length === 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.setTextColor(150, 150, 150);
            doc.text("NO PHOTOS FOUND FOR THIS SELECTION", pageWidth / 2, 140, { align: "center" });
            doc.setFontSize(10);
            doc.text("Please ensure photos are attached to the inspection records.", pageWidth / 2, 150, { align: "center" });
            
            applyWatermarkAndSignaturesGlobal(doc, config);
            if (config.returnBlob) return doc.output("blob");
            return;
        }

        const colors = {
            navy: [7, 78, 136] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
        };

        // Pre-load logos
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        
        const contrLogoUrl = headerData.contractorLogoUrl || (config as any)?.contractorLogoUrl || (config as any)?.contrLogoUrl;
        if (contrLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(contrLogoUrl); } catch (_) {}
        }

        if (!contractorLogo) {
            const contrId = (headerData as any)?.contractorId || (headerData as any)?.contrac || headerData?.jobpack?.metadata?.contrac || (config as any)?.jobPack?.metadata?.contrac || (config as any)?.jobPackId;
            if (contrId) {
                try {
                    const cid = String(contrId);
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);
                    let query = supabase.from('u_lib_list' as any).select('logo_url').eq('lib_code', 'CONTR_NAM');
                    if (isUUID) {
                        query = query.or(`id.eq.${cid},lib_id.eq.${cid}`);
                    } else {
                        query = query.or(`lib_id.eq.${cid},code.eq.${cid}`);
                    }
                    const { data: cData } = await query.maybeSingle();
                    if ((cData as any)?.logo_url) {
                        contractorLogo = await loadLogoWithTransparency((cData as any).logo_url);
                    }
                } catch (_) {}
            }
        }

        if (!contractorLogo) {
            try {
                const cRes = await fetch(`/api/library/CONTR_NAM`);
                const cJson = await cRes.json();
                if (cJson.data && Array.isArray(cJson.data)) {
                    const contrId = (headerData as any)?.contractorId || (headerData as any)?.contrac || headerData?.jobpack?.metadata?.contrac || (config as any)?.jobPack?.metadata?.contrac;
                    let found: any = null;
                    if (contrId) {
                        found = cJson.data.find((c: any) => 
                            String(c.lib_id) === String(contrId) || 
                            String(c.id) === String(contrId) || 
                            String(c.code) === String(contrId) ||
                            String(c.lib_desc).toLowerCase() === String(contrId).toLowerCase()
                        );
                    }
                    if (!found) {
                        found = cJson.data.find((c: any) => Boolean(c.logo_url));
                    }
                    if (found && found.logo_url) {
                        contractorLogo = await loadLogoWithTransparency(found.logo_url);
                    }
                }
            } catch (_) {}
        }

        const HEADER_H = 25;

        const drawHeaderFooter = (d: jsPDF, pageNum: number, totalPages: number) => {
            const isPF = config.printFriendly;
            const reportNo = (config?.reportNoPrefix || headerData?.sowReportNo) || "N/A";
            const structName = headerData.platformName || "N/A";

            draw3SectionHeader(d, {
                reportTitle: "Photography Report (ROV)",
                reportNo,
                structureName: structName,
                companySettings,
                config,
                contractorLogoData: contractorLogo,
                clientLogoData: companyLogo,
                isPrintFriendly: isPF,
                margin: 10,
                headerY: 7,
                headerH: 25,
                orientation: "portrait"
            });

            // Context Row
            const rowY = margin + HEADER_H + 2;
            const half = contentWidth / 2;
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            if (!isPF) {
                d.setFillColor(...colors.lightGray);
                d.rect(margin, rowY, contentWidth, 7, "F");
            }
            d.rect(margin, rowY, contentWidth, 7, "S");
            d.line(margin + half, rowY, margin + half, rowY + 7);
            d.setTextColor(...colors.text); d.setFontSize(7.5); d.setFont("helvetica", "bold");
            d.text("Structure:", margin + 2, rowY + 4.8);
            d.setFont("helvetica", "normal");
            d.text(headerData.platformName || "N/A", margin + 22, rowY + 4.8);

            d.setFont("helvetica", "bold");
            d.text("Vessel:", margin + half + 2, rowY + 4.8);
            d.setFont("helvetica", "normal");
            d.text(headerData.vessel || "N/A", margin + half + 18, rowY + 4.8);

            // Footer
            d.setDrawColor(...colors.border); d.setLineWidth(0.1);
            d.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
            d.setFontSize(6.5); d.setFont("helvetica", "normal"); d.setTextColor(30, 41, 59);
            d.text(REPORT_FOOTER_APP_TEXT, margin, pageHeight - 6);
            if (config.showPageNumbers !== false) {
                d.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
            }
        };

        const PHOTOS_PER_PAGE = 6;
        const totalPages = Math.max(1, Math.ceil(resolvedPhotos.length / PHOTOS_PER_PAGE));
        
        const imgGap = 6;
        const imgWidth = (contentWidth - imgGap) / 2;
        const imgHeight = 48;
        const rowHeight = 70;
        
        let currentPhotoIdx = 0;

        for (let p = 1; p <= totalPages; p++) {
            if (p > 1) doc.addPage();
            
            drawHeaderFooter(doc, p, totalPages);
            
            // Start grid below context row (context row ends at y = margin + HEADER_H + 2 + 7 = 47mm)
            const gridStartY = margin + HEADER_H + 15; // 53mm
            
            for (let i = 0; i < PHOTOS_PER_PAGE; i++) {
                if (currentPhotoIdx >= resolvedPhotos.length) break;
                
                const photo = resolvedPhotos[currentPhotoIdx];
                const col = i % 2;
                const row = Math.floor(i / 2);
                
                const xPos = margin + (col * (imgWidth + imgGap));
                const rowSlotY = gridStartY + (row * rowHeight);
                
                // 1. Photo Title (Top of card)
                let meta = photo.meta || {};
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                }
                
                const title = (meta.title || photo.name || photo.file_name || `Photo ${currentPhotoIdx + 1}`).toUpperCase();
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                doc.text(title, xPos + imgWidth / 2, rowSlotY + 3.5, { align: "center", maxWidth: imgWidth - 2 });

                // 2. Image Loading & Rendering
                const imgY = rowSlotY + 5.5;
                try {
                    const rawPath = photo.path || photo.file_path || photo.url || photo.file_url || photo.storage_path || photo.previewUrl || "";
                    const bucket = photo.bucket_id || photo.bucket || photo.meta?.bucket || "attachments";

                    const urlCandidates: string[] = [];
                    // 1. Prioritize internal server proxy endpoints (immune to CORS)
                    if (photo.id) {
                        urlCandidates.push(`/api/attachment/url?id=${encodeURIComponent(photo.id)}${rawPath ? `&path=${encodeURIComponent(rawPath)}` : ""}`);
                    }
                    const fallbackUrl = getAttachmentUrl(photo, supabase);
                    if (fallbackUrl && !urlCandidates.includes(fallbackUrl)) {
                        urlCandidates.push(fallbackUrl);
                    }
                    if (rawPath) {
                        urlCandidates.push(`/api/attachment/url?path=${encodeURIComponent(rawPath)}`);
                        urlCandidates.push(`/api/attachment/download?path=${encodeURIComponent(rawPath)}&bucket=${bucket}`);
                    }
                    // 2. Direct HTTP or Data URL
                    if (typeof rawPath === "string" && (rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("data:") || rawPath.startsWith("blob:"))) {
                        urlCandidates.push(rawPath);
                    }
                    if (photo.meta?.file_url && !urlCandidates.includes(photo.meta.file_url)) {
                        urlCandidates.push(photo.meta.file_url);
                    }
                    if (rawPath && typeof rawPath === "string" && !rawPath.startsWith("http") && !rawPath.startsWith("data:")) {
                        try {
                            const cleanStoragePath = rawPath.replace(/^attachments\//, "");
                            const pub = supabase.storage.from(bucket).getPublicUrl(cleanStoragePath);
                            if (pub?.data?.publicUrl && !urlCandidates.includes(pub.data.publicUrl)) {
                                urlCandidates.push(pub.data.publicUrl);
                            }
                            const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(cleanStoragePath, 3600);
                            if (signed?.signedUrl && !urlCandidates.includes(signed.signedUrl)) {
                                urlCandidates.push(signed.signedUrl);
                            }
                        } catch (_) {}
                    }
                    if (photo.meta?.file_path && typeof photo.meta.file_path === 'string' && !urlCandidates.includes(photo.meta.file_path)) {
                        try {
                            const cleanPath = photo.meta.file_path.replace(/^attachments\//, "");
                            const pub = supabase.storage.from(bucket).getPublicUrl(cleanPath);
                            if (pub?.data?.publicUrl && !urlCandidates.includes(pub.data.publicUrl)) {
                                urlCandidates.push(pub.data.publicUrl);
                            }
                            const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 3600);
                            if (signed?.signedUrl && !urlCandidates.includes(signed.signedUrl)) {
                                urlCandidates.push(signed.signedUrl);
                            }
                        } catch (_) {}
                    }

                    let imgData: LoadedPhoto | null = null;
                    for (const testUrl of urlCandidates) {
                        try {
                            imgData = await loadPhotoData(testUrl);
                            if (imgData && imgData.data) break;
                        } catch (_) {}
                    }

                    if (imgData) {
                        // Maintain aspect ratio inside the box
                        const boxAspect = imgWidth / imgHeight;
                        let renderW = imgWidth;
                        let renderH = imgHeight;
                        let renderX = xPos;
                        let renderY = imgY;

                        if (imgData.aspect > boxAspect) {
                            renderH = imgWidth / imgData.aspect;
                            renderY = imgY + (imgHeight - renderH) / 2;
                        } else {
                            renderW = imgHeight * imgData.aspect;
                            renderX = xPos + (imgWidth - renderW) / 2;
                        }

                        // Light border box
                        doc.setDrawColor(220, 226, 235);
                        doc.setLineWidth(0.2);
                        doc.rect(xPos, imgY, imgWidth, imgHeight);
                        doc.addImage(imgData.data, "JPEG", renderX, renderY, renderW, renderH, undefined, "FAST");
                    } else {
                        doc.setDrawColor(200);
                        doc.setLineWidth(0.2);
                        doc.rect(xPos, imgY, imgWidth, imgHeight);
                        doc.setFontSize(8);
                        doc.setTextColor(150);
                        doc.text("Image Load Failed", xPos + imgWidth / 2, imgY + imgHeight / 2, { align: "center" });
                    }
                } catch (e) {
                    doc.setDrawColor(200);
                    doc.rect(xPos, imgY, imgWidth, imgHeight);
                }

                // 3. Description (Bottom of card)
                let description = meta.description || photo.description || "";
                if (photo.anomaly_ref) {
                    description = description ? `${description} (Anomaly Ref: ${photo.anomaly_ref})` : `Anomaly Ref: ${photo.anomaly_ref}`;
                }
                
                if (description) {
                    doc.setFontSize(6.5); 
                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(51, 65, 85);
                    const splitDesc = doc.splitTextToSize(description, imgWidth - 2);
                    const linesToPrint = splitDesc.slice(0, 3);
                    doc.text(linesToPrint, xPos + imgWidth / 2, imgY + imgHeight + 3.5, { align: "center" });
                }

                currentPhotoIdx++;
            }
        }

        // Add Signatures if requested
        if (config.showSignatures !== false) {
            const lastPage = doc.internal.pages.length - 1;
            doc.setPage(lastPage);
            
            const sigY = pageHeight - 28;
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1); doc.rect(lx, sigY, sigW - 5, 15);
                if (!config.printFriendly) {
                    doc.setFillColor(...colors.navy); doc.rect(lx, sigY, sigW - 5, 4, 'F');
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(...colors.navy);
                }
                doc.setFontSize(7); doc.text(label, lx + 2, sigY + 3);
                doc.setTextColor(...colors.text); doc.setFontSize(6); 
                doc.text('Name:', lx + 2, sigY + 10);
                if (person?.name) doc.text(person.name, lx + 14, sigY + 10);
                doc.text('Date:', lx + 2, sigY + 13);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 13);
            };

            drawSig("PREPARED BY", margin, config?.preparedBy);
            drawSig("REVIEWED BY", margin + sigW, config?.reviewedBy);
            drawSig("APPROVED BY", margin + (sigW * 2), config?.approvedBy);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) {
            try {
                return doc.output("blob");
            } catch (blobErr) {
                console.warn("doc.output('blob') failed, falling back to arraybuffer:", blobErr);
                const buffer = doc.output("arraybuffer");
                return new Blob([buffer], { type: "application/pdf" });
            }
        }
        doc.save(`ROV_Photography_Report_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);

    } catch (e) {
        console.error("Photography Report Error", e);
        throw e;
    } finally {
        photoDataCache.clear();
    }
};
