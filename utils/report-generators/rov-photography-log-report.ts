import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, draw3SectionHeader, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, formatReportFindingText, applyRecordCellStyling , REPORT_FOOTER_APP_TEXT } from "./shared-logo";
import { createClient } from "@/utils/supabase/client";

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
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

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
 * ROV Photography Log Report (Portrait)
 * Displays a tabular list of photos attached to inspections.
 */
export const generateROVPhotographyLogReport = async (
    photos: any[],
    headerData: any,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void | null> => {
    try {
        const doc = new jsPDF({ orientation: "portrait" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        const colors = {
            navy: [7, 78, 136] as [number, number, number],
            text: [30, 41, 59] as [number, number, number],
            border: [203, 213, 225] as [number, number, number],
            lightGray: [248, 250, 252] as [number, number, number],
        };

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
            } else if (item.path || item.file_path || item.url || item.file_url || item.storage_path || item.id || item.name) {
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
                console.warn("[ROV Photography Log] Failed to fetch inspection date for records:", lookupErr);
            }
        }

        // Deduplicate photos by ID or storage path to avoid redundant rows
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


        // Pre-load logos
        let companyLogo: any = null;
        let contractorLogo: any = null;
        if (companySettings.logo_url) {
            try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }
        const contrLogoUrl = headerData?.contractorLogoUrl || (config as any)?.contractorLogoUrl || (config as any)?.contrLogoUrl;
        if (contrLogoUrl) {
            try { contractorLogo = await loadLogoWithTransparency(contrLogoUrl); } catch (_) {}
        }
        if (!contractorLogo) {
            try {
                const contrId = (headerData as any)?.contractorId || (headerData as any)?.contrac || headerData?.jobpack?.metadata?.contrac || (config as any)?.jobPack?.metadata?.contrac;
                const cRes = await fetch(`/api/library/CONTR_NAM`);
                if (cRes.ok) {
                    const cJson = await cRes.json();
                    if (Array.isArray(cJson?.data)) {
                        let found = contrId ? cJson.data.find((c: any) =>
                            String(c.lib_id) === String(contrId) ||
                            String(c.code) === String(contrId) ||
                            String(c.lib_desc).toLowerCase() === String(contrId).toLowerCase()
                        ) : null;
                        if (!found && contrId) {
                            found = cJson.data.find((c: any) =>
                                (c.lib_id && String(contrId).toLowerCase().includes(String(c.lib_id).toLowerCase())) ||
                                (c.code && String(contrId).toLowerCase().includes(String(c.code).toLowerCase()))
                            );
                        }
                        if (!found) {
                            found = cJson.data.find((c: any) => Boolean(c.logo_url));
                        }
                        if (found?.logo_url) {
                            contractorLogo = await loadLogoWithTransparency(found.logo_url);
                        }
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
                reportTitle: "Photography Log Report (ROV)",
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

        const isPF = config.printFriendly;
        const startY = margin + HEADER_H + 12;

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 12 },
            head: [
                ['Item No.', 'Inspection Date', 'Photo Title', 'Details']
            ],
            body: resolvedPhotos.map((p, idx) => {
                let meta = p.meta || {};
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                }

                const itemNo = (idx + 1).toString();
                
                // Format the inspection date (strictly inspection date/time, NOT file upload timestamp)
                let formattedDate = 'N/A';
                const dateVal = p._inspDate || p.inspection_date || p.insp_date || p.date;
                if (dateVal) {
                    const parsedMs = parseSafeDate(dateVal);
                    if (parsedMs > 0) {
                        formattedDate = format(new Date(parsedMs), 'dd MMM yyyy');
                        const timeVal = p._inspTime || p.inspection_time || p.time;
                        if (timeVal && typeof timeVal === 'string' && timeVal.trim()) {
                            formattedDate += ` ${timeVal.trim().substring(0, 5)}`;
                        }
                    } else if (typeof dateVal === 'string' && dateVal.trim()) {
                        formattedDate = dateVal.trim();
                    }
                }

                const photoTitle = (meta.title || p.name || `Photo ${idx + 1}`).toUpperCase();
                
                let details = meta.description || "";
                if (p.anomaly_ref) {
                    details = details ? `${details} (Anomaly Ref: ${p.anomaly_ref})` : `Anomaly Ref: ${p.anomaly_ref}`;
                }

                return [itemNo, formattedDate, photoTitle, details];
            }),
            theme: 'grid',
            headStyles: {fillColor: config?.printFriendly ? [255,255,255] : colors.navy, 
                textColor: config?.printFriendly ? colors.navy : 255, 
                fontSize: 8, 
                fontStyle: 'bold', 
                halign: 'center', lineWidth: 0.1, lineColor: config?.printFriendly ? colors.border : [255, 255, 255]},
            styles: {fontSize: 7.5, 
                cellPadding: 2, 
                textColor: colors.text, 
                lineColor: colors.border, lineWidth: 0.1},
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                1: { cellWidth: 35, halign: 'center' },
                2: { cellWidth: 50 },
                3: { cellWidth: 'auto' }
            },
            didDrawPage: (data) => {
                drawHeaderFooter(doc, data.pageNumber, doc.internal.pages.length - 1);
            }
        });

        // Add Signatures if requested
        if (config.showSignatures !== false) {
            const finalY = (doc as any).lastAutoTable?.finalY ?? (pageHeight - 50);
            let sigY = pageHeight - 35;
            
            // If the table ended too low, push signatures to a new page
            if (finalY > sigY - 10) {
                doc.addPage();
                // Redraw header/footer for the new page
                const totalPages = doc.internal.pages.length - 1;
                drawHeaderFooter(doc, totalPages, totalPages);
                sigY = pageHeight - 35;
            }
            
            const sigW = contentWidth / 3;
            const drawSig = (label: string, lx: number, person?: { name?: string; date?: string }) => {
                doc.setDrawColor(...colors.navy); doc.setLineWidth(0.1); doc.rect(lx, sigY, sigW - 5, 15);
                doc.setFillColor(...colors.navy); doc.rect(lx, sigY, sigW - 5, 4, 'F');
                doc.setTextColor(255); doc.setFontSize(7); doc.text(label, lx + 2, sigY + 3);
                doc.setTextColor(...colors.text); doc.setFontSize(6); 
                doc.text('Name:', lx + 2, sigY + 10);
                if (person?.name) doc.text(person.name, lx + 14, sigY + 10);
                doc.text('Date:', lx + 2, sigY + 13);
                if (person?.date) doc.text(formatPdfDate(person.date), lx + 14, sigY + 13);
            };

            drawSig('PREPARED BY', margin, config?.preparedBy);
            drawSig('REVIEWED BY', margin + sigW, config?.reviewedBy);
            drawSig('APPROVED BY', margin + (sigW * 2), config?.approvedBy);
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`ROV_Photography_Log_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("Photography Log Report Error", e);
        throw e;
    }
};
