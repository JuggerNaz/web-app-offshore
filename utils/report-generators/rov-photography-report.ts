import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal, formatPdfDate } from "./shared-logo";
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

// Multi-strategy image loader for PDF generation (immune to CORS & canvas tainting)
const loadPhotoData = async (url: string): Promise<LoadedPhoto | null> => {
    if (!url || typeof url !== "string" || !url.trim()) {
        return null;
    }

    const tryViaImageElement = (src: string, useCrossOrigin = true): Promise<LoadedPhoto | null> => {
        return new Promise((resolve) => {
            const img = new Image();
            if (useCrossOrigin && !src.startsWith("data:")) {
                img.crossOrigin = "Anonymous";
            }
            const timeout = setTimeout(() => {
                img.onload = null;
                img.onerror = null;
                resolve(null);
            }, 6000);

            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const w = img.naturalWidth || img.width || 800;
                    const h = img.naturalHeight || img.height || 600;
                    const aspect = h > 0 ? w / h : 1.333;

                    if (src.startsWith("data:")) {
                        resolve({ data: src, width: w, height: h, aspect });
                        return;
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        resolve({
                            data: canvas.toDataURL("image/jpeg", 0.9),
                            width: w,
                            height: h,
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
        return await tryViaImageElement(url, false);
    }

    // 2. Fetch as Blob -> FileReader as Data URL (immune to CORS taint for relative and proxied API endpoints)
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
            if (dataUrl) {
                const res = await tryViaImageElement(dataUrl, false);
                if (res) return res;
            }
        }
    } catch (e) {
        // Fallback to Image element
    }

    // 3. Fallback: Image element with crossOrigin
    const resCrossOrigin = await tryViaImageElement(url, true);
    if (resCrossOrigin) return resCrossOrigin;

    // 4. Fallback: Image element without crossOrigin
    return await tryViaImageElement(url, false);
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

        // Extract and flatten attachments if inspection records were passed
        const flatPhotos: any[] = [];
        (photos || []).forEach((item: any) => {
            if (!item) return;
            const atts = item.attachments || item.attachment || item.insp_attachments || item.insp_photos || item.photos;
            if (Array.isArray(atts) && atts.length > 0) {
                atts.forEach((a: any) => {
                    flatPhotos.push({
                        ...a,
                        anomaly_ref: a.anomaly_ref || item.insp_anomalies?.[0]?.anomaly_ref_no || item.anomaly_ref || null
                    });
                });
            } else if (item.path || item.file_path || item.url || item.file_url || item.storage_path || item.previewUrl || item.id) {
                flatPhotos.push(item);
            }
        });
        const resolvedPhotos = flatPhotos.length > 0 ? flatPhotos : (photos || []);

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
        
        let contrLogoUrl = headerData.contractorLogoUrl || (config as any)?.contractorLogoUrl || (config as any)?.contrLogoUrl;
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

        const HEADER_H = 26;

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

            d.setFontSize(11); d.setFont("helvetica", "bold");
            d.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
            d.setFontSize(8.5); d.setFont("helvetica", "normal");
            d.text(companySettings.department_name || "Technical Inspection Division", margin + contentWidth / 2, margin + 10.5, { align: "center" });
            d.setFontSize(11); d.setFont("helvetica", "bold");
            d.text("Photography Report (ROV)", margin + contentWidth / 2, margin + 16.5, { align: "center" });
            d.setFontSize(8); d.setFont("helvetica", "normal");
            d.text(`Report No: ${(config?.reportNoPrefix || headerData?.sowReportNo) || "N/A"}`, margin + contentWidth / 2, margin + 21, { align: "center" });

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
        const totalPages = Math.max(1, Math.ceil(resolvedPhotos.length / PHOTOS_PER_PAGE));
        
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
                if (currentPhotoIdx >= resolvedPhotos.length) break;
                
                const photo = resolvedPhotos[currentPhotoIdx];
                const col = i % 2;
                const row = Math.floor(i / 2);
                
                const xPos = margin + (col * (imgWidth + imgGap));
                const currentY = yPos + (row * rowHeight);
                
                // 1. Photo Title (Top)
                let meta = photo.meta || {};
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                }
                
                const title = (meta.title || photo.name || photo.file_name || `Photo ${currentPhotoIdx + 1}`).toUpperCase();
                doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
                doc.setTextColor(...colors.navy);
                doc.text(title, xPos + imgWidth / 2, currentY - 2, { align: "center", maxWidth: imgWidth });

                // 2. Image Loading & Rendering
                try {
                    const rawPath = photo.path || photo.file_path || photo.url || photo.file_url || photo.storage_path || photo.previewUrl || "";
                    const bucket = photo.bucket_id || photo.bucket || photo.meta?.bucket || "attachments";

                    const urlCandidates: string[] = [];
                    if (typeof rawPath === "string" && (rawPath.startsWith("http://") || rawPath.startsWith("https://") || rawPath.startsWith("data:") || rawPath.startsWith("blob:"))) {
                        urlCandidates.push(rawPath);
                    }
                    if (photo.id) {
                        urlCandidates.push(`/api/attachment/url?id=${encodeURIComponent(photo.id)}${rawPath ? `&path=${encodeURIComponent(rawPath)}` : ""}`);
                    }
                    if (rawPath) {
                        urlCandidates.push(`/api/attachment/download?path=${encodeURIComponent(rawPath)}&bucket=${bucket}`);
                    }
                    if (rawPath && typeof rawPath === "string" && !rawPath.startsWith("http") && !rawPath.startsWith("data:")) {
                        try {
                            const cleanStoragePath = rawPath.replace(/^attachments\//, "");
                            const pub = supabase.storage.from(bucket).getPublicUrl(cleanStoragePath);
                            if (pub?.data?.publicUrl) urlCandidates.push(pub.data.publicUrl);
                        } catch (_) {}
                    }
                    const fallbackUrl = getAttachmentUrl(photo, supabase);
                    if (fallbackUrl && !urlCandidates.includes(fallbackUrl)) {
                        urlCandidates.push(fallbackUrl);
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
                        let renderY = currentY;

                        if (imgData.aspect > boxAspect) {
                            renderH = imgWidth / imgData.aspect;
                            renderY = currentY + (imgHeight - renderH) / 2;
                        } else {
                            renderW = imgHeight * imgData.aspect;
                            renderX = xPos + (imgWidth - renderW) / 2;
                        }

                        // Light border box
                        doc.setDrawColor(220, 226, 235);
                        doc.rect(xPos, currentY, imgWidth, imgHeight);
                        doc.addImage(imgData.data, "JPEG", renderX, renderY, renderW, renderH);
                    } else {
                        doc.setDrawColor(200);
                        doc.rect(xPos, currentY, imgWidth, imgHeight);
                        doc.setFontSize(8);
                        doc.setTextColor(150);
                        doc.text("Image Load Failed", xPos + imgWidth / 2, currentY + imgHeight / 2, { align: "center" });
                    }
                } catch (e) {
                    doc.setDrawColor(200);
                    doc.rect(xPos, currentY, imgWidth, imgHeight);
                }

                // 3. Description (Bottom)
                let description = meta.description || photo.description || "";
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

        // Add Signatures if requested
        if (config.showSignatures !== false) {
            const lastPage = doc.internal.pages.length - 1;
            doc.setPage(lastPage);
            
            const sigY = pageHeight - 35;
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
        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Photography_Report_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);

    } catch (e) {
        console.error("Photography Report Error", e);
        throw e;
    }
};
