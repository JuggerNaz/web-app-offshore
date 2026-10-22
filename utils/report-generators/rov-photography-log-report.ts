import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, draw3SectionHeader, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, formatReportFindingText, applyRecordCellStyling, getRecordStatusInfo, REPORT_FOOTER_APP_TEXT } from "./shared-logo";
import { 
    PhotoCategory, 
    getPhotoAnomalyRef, 
    getPhotoFindingRef, 
    categorizePhotoItem, 
    sortNormalPhotos, 
    sortAnomalyPhotos, 
    sortFindingPhotos 
} from "./rov-photography-report";
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

        let supabase: any = null;
        try {
            supabase = createClient();
        } catch (_) {}

        // Extract and flatten attachments if inspection records were passed
        const flatPhotos: any[] = [];
        (photos || []).forEach((item: any) => {
            if (!item) return;
            const atts = item.attachments || item.attachment || item.insp_attachments || item.insp_photos || item.photos;
            // STRICT: Use only inspection date and inspection time from record, NEVER file creation created_at / captured_at
            const itemDate = item.inspection_date || item.insp_date || item.date || item.inspection_data?.inspection_date || item.inspection_data?.insp_date || item.inspection_data?.date || null;
            const itemTime = item.inspection_time || item.inspection_data?.inspection_time || item.inspection_data?.time || item._inspTime || null;
            const itemInspId = item.insp_id !== undefined ? item.insp_id : (item.id !== undefined ? item.id : 0);

            const recStatus = getRecordStatusInfo(item);

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

                    const isFinding = Boolean(
                        a.is_finding || 
                        recStatus.isFinding || 
                        item.is_finding || 
                        a.source_type === 'finding' || 
                        (a.anomaly_ref && String(a.anomaly_ref).toUpperCase().startsWith('F-')) ||
                        (item.anomaly_ref && String(item.anomaly_ref).toUpperCase().startsWith('F-'))
                    );
                    const findingRef = getPhotoFindingRef(a) || (isFinding ? (recStatus.anomalyRefNo || item.finding_ref || a.finding_ref || a.anomaly_ref || null) : null);
                    const isAnomaly = !isFinding && Boolean(
                        a.is_anomaly || 
                        recStatus.isAnomaly || 
                        item.has_anomaly || 
                        a.source_type === 'anomaly' || 
                        a.anomaly_id || 
                        a.anomaly_ref || 
                        item.anomaly_ref ||
                        (item.insp_anomalies && item.insp_anomalies.length > 0)
                    );
                    const anomRef = getPhotoAnomalyRef(a) || (!isFinding && (a.anomaly_ref || recStatus.anomalyRefNo || item.anomaly_ref || item.insp_anomalies?.[0]?.anomaly_ref_no || null));

                    flatPhotos.push({
                        ...a,
                        _inspDate: photoDate,
                        _inspTime: photoTime,
                        _inspId: photoInspId,
                        _sortOrder: sortOrder,
                        is_finding: isFinding,
                        finding_ref: findingRef,
                        is_anomaly: isAnomaly,
                        anomaly_ref: anomRef,
                        _meta_status: isFinding ? 'finding' : (isAnomaly ? 'anomaly' : 'normal'),
                        source_type: a.source_type || (isFinding ? 'finding' : (isAnomaly ? 'anomaly' : 'inspection'))
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

                const isFinding = Boolean(
                    item.is_finding || 
                    recStatus.isFinding || 
                    item.source_type === 'finding' || 
                    (item.anomaly_ref && String(item.anomaly_ref).toUpperCase().startsWith('F-'))
                );
                const findingRef = getPhotoFindingRef(item) || (isFinding ? (recStatus.anomalyRefNo || item.finding_ref || item.anomaly_ref || null) : null);
                const isAnomaly = !isFinding && Boolean(
                    item.is_anomaly || 
                    recStatus.isAnomaly || 
                    item.has_anomaly || 
                    item.source_type === 'anomaly' || 
                    item.anomaly_id || 
                    item.anomaly_ref || 
                    (item.insp_anomalies && item.insp_anomalies.length > 0)
                );
                const anomRef = getPhotoAnomalyRef(item) || (!isFinding && (item.anomaly_ref || recStatus.anomalyRefNo || item.insp_anomalies?.[0]?.anomaly_ref_no || null));

                flatPhotos.push({
                    ...item,
                    _inspDate: photoDate,
                    _inspTime: photoTime,
                    _inspId: photoInspId,
                    _sortOrder: sortOrder,
                    is_finding: isFinding,
                    finding_ref: findingRef,
                    is_anomaly: isAnomaly,
                    anomaly_ref: anomRef,
                    _meta_status: isFinding ? 'finding' : (isAnomaly ? 'anomaly' : 'normal'),
                    source_type: item.source_type || (isFinding ? 'finding' : (isAnomaly ? 'anomaly' : 'inspection'))
                });
            }
        });

        // Fallback: If any photos lack inspection dates or status but have an inspection ID, look up insp_records
        const missingInspIds = Array.from(new Set(
            flatPhotos
                .filter(p => (!p._inspDate || (!p.anomaly_ref && !p.finding_ref)) && p._inspId && Number(p._inspId) > 0)
                .map(p => Number(p._inspId))
        ));

        if (supabase && missingInspIds.length > 0) {
            try {
                const { data: recDates } = await supabase
                    .from("insp_records")
                    .select("insp_id, inspection_date, inspection_time, inspection_data, status, has_anomaly, finding_type, insp_anomalies(anomaly_id, anomaly_ref_no)")
                    .in("insp_id", missingInspIds);

                if (recDates && recDates.length > 0) {
                    const recMap = new Map<number, any>();
                    recDates.forEach((r: any) => {
                        recMap.set(Number(r.insp_id), r);
                    });
                    flatPhotos.forEach(p => {
                        if (p._inspId && recMap.has(Number(p._inspId))) {
                            const r = recMap.get(Number(p._inspId))!;
                            if (!p._inspDate) {
                                p._inspDate = r.inspection_date || r.inspection_data?.inspection_date || r.inspection_data?.insp_date || r.inspection_data?.date || null;
                            }
                            if (!p._inspTime) {
                                p._inspTime = r.inspection_time || r.inspection_data?.inspection_time || r.inspection_data?.time || null;
                            }
                            const rStatus = getRecordStatusInfo(r);
                            if (!p.is_finding && rStatus.isFinding) {
                                p.is_finding = true;
                                p.finding_ref = p.finding_ref || rStatus.anomalyRefNo || r.finding_ref;
                                p._meta_status = 'finding';
                            } else if (!p.is_anomaly && !p.is_finding && rStatus.isAnomaly) {
                                p.is_anomaly = true;
                                p.anomaly_ref = p.anomaly_ref || rStatus.anomalyRefNo || r.insp_anomalies?.[0]?.anomaly_ref_no;
                                p._meta_status = 'anomaly';
                            }
                        }
                    });
                }
            } catch (lookupErr) {
                console.warn("[ROV Photography Log] Failed to fetch inspection date for records:", lookupErr);
            }
        }

        // Fallback: If any photos have anomaly_id or source_type === 'anomaly' but missing anomaly_ref, look up insp_anomalies
        const missingAnomIds = Array.from(new Set(
            flatPhotos
                .filter(p => (p.anomaly_id || p.source_type === 'anomaly') && !p.anomaly_ref)
                .map(p => Number(p.anomaly_id || p.source_id))
                .filter(id => !isNaN(id) && id > 0)
        ));
        if (supabase && missingAnomIds.length > 0) {
            try {
                const { data: anomRows } = await supabase
                    .from("insp_anomalies")
                    .select("anomaly_id, anomaly_ref_no")
                    .in("anomaly_id", missingAnomIds);
                if (anomRows && anomRows.length > 0) {
                    const anomMap = new Map<number, string>();
                    anomRows.forEach((ar: any) => {
                        if (ar.anomaly_ref_no) anomMap.set(Number(ar.anomaly_id), ar.anomaly_ref_no);
                    });
                    flatPhotos.forEach(p => {
                        const anomId = Number(p.anomaly_id || (p.source_type === 'anomaly' ? p.source_id : 0));
                        if (anomMap.has(anomId) && !p.anomaly_ref) {
                            p.anomaly_ref = anomMap.get(anomId);
                            p.is_anomaly = true;
                        }
                    });
                }
            } catch (_) {}
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

        // Partition into 3 distinct categories requested by the user:
        // 1. Normal inspection attachments (status is not anomaly or finding)
        // 2. Anomaly attachments
        // 3. Finding attachments
        const bucketNormal: any[] = [];
        const bucketAnomaly: any[] = [];
        const bucketFinding: any[] = [];

        uniquePhotos.forEach(p => {
            const cat = categorizePhotoItem(p);
            p._category = cat.category;
            p._referenceNo = cat.referenceNo;
            if (cat.category === 'FINDING') {
                bucketFinding.push(p);
            } else if (cat.category === 'ANOMALY') {
                bucketAnomaly.push(p);
            } else {
                bucketNormal.push(p);
            }
        });

        // Sort each category by its designated ordering rule
        const normalPhotos = sortNormalPhotos(bucketNormal);
        const anomalyPhotos = sortAnomalyPhotos(bucketAnomaly);
        const findingPhotos = sortFindingPhotos(bucketFinding);

        // Build active sections
        const rawSections = [
            { id: 'NORMAL' as PhotoCategory, title: "SECTION 1: INSPECTION ATTACHMENTS (ROUTINE)", photos: normalPhotos },
            { id: 'ANOMALY' as PhotoCategory, title: "SECTION 2: ANOMALY ATTACHMENTS", photos: anomalyPhotos },
            { id: 'FINDING' as PhotoCategory, title: "SECTION 3: FINDING ATTACHMENTS", photos: findingPhotos },
        ];
        const activeSections = rawSections.filter(s => s.photos.length > 0);

        // If no photos across all sections, return a document with an empty state message
        if (activeSections.length === 0) {
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
                if (typeof window !== 'undefined') {
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
                }
            } catch (_) {}
        }

        const HEADER_H = 25;

        const drawHeader = (d: jsPDF) => {
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
        };

        const isPF = config.printFriendly;
        const startY = margin + HEADER_H + 12;

        // Build table body with section headers and item rows
        let itemCounter = 1;
        const tableBody: any[] = [];

        activeSections.forEach(sec => {
            // Full width Section Header Row across 4 columns
            tableBody.push([
                {
                    content: `${sec.title} (${sec.photos.length} ${sec.photos.length === 1 ? 'Photo' : 'Photos'})`,
                    colSpan: 4,
                    styles: {
                        fillColor: isPF ? [240, 244, 248] : colors.navy,
                        textColor: isPF ? colors.navy : [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 8,
                        halign: 'left',
                        cellPadding: 2.5
                    }
                }
            ]);

            sec.photos.forEach((p) => {
                let meta = p.meta || {};
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                }

                const itemNo = (itemCounter++).toString();
                
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

                // Format photo title according to section
                let photoTitle = "";
                if (sec.id === 'ANOMALY') {
                    const anomRef = getPhotoAnomalyRef(p) || p.anomaly_ref || p._referenceNo || "ANOMALY";
                    photoTitle = anomRef.toUpperCase().startsWith("ANOMALY") 
                        ? anomRef.toUpperCase() 
                        : `ANOMALY NO. ${anomRef}`.toUpperCase();
                } else if (sec.id === 'FINDING') {
                    const findRef = getPhotoFindingRef(p) || p.finding_ref || p._referenceNo || "FINDING";
                    photoTitle = findRef.toUpperCase().startsWith("FINDING") 
                        ? findRef.toUpperCase() 
                        : `FINDING NO. ${findRef}`.toUpperCase();
                } else {
                    photoTitle = (meta.title || p.name || p.file_name || `Photo ${itemNo}`).toUpperCase();
                }
                
                let details = meta.description || p.description || "";
                if (sec.id === 'ANOMALY') {
                    const anomRef = getPhotoAnomalyRef(p) || p.anomaly_ref;
                    if (anomRef && !details.toLowerCase().includes(anomRef.toLowerCase())) {
                        details = details ? `${details} (Anomaly Ref: ${anomRef})` : `Anomaly Ref: ${anomRef}`;
                    }
                } else if (sec.id === 'FINDING') {
                    const findRef = getPhotoFindingRef(p) || p.finding_ref;
                    if (findRef && !details.toLowerCase().includes(findRef.toLowerCase())) {
                        details = details ? `${details} (Finding Ref: ${findRef})` : `Finding Ref: ${findRef}`;
                    }
                }

                tableBody.push([itemNo, formattedDate, photoTitle, details]);
            });
        });

        autoTable(doc, {
            startY: startY,
            margin: { left: margin, right: margin, top: margin + HEADER_H + 12 },
            head: [
                ['Item No.', 'Inspection Date', 'Photo Title', 'Details']
            ],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: config?.printFriendly ? [255, 255, 255] : colors.navy, 
                textColor: config?.printFriendly ? colors.navy : 255, 
                fontSize: 8, 
                fontStyle: 'bold', 
                halign: 'center', 
                lineWidth: 0.1, 
                lineColor: config?.printFriendly ? colors.border : [255, 255, 255]
            },
            styles: {
                fontSize: 7.5, 
                cellPadding: 2, 
                textColor: colors.text, 
                lineColor: colors.border, 
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 20, halign: 'center' },
                1: { cellWidth: 35, halign: 'center' },
                2: { cellWidth: 50 },
                3: { cellWidth: 'auto' }
            },
            didDrawPage: () => {
                drawHeader(doc);
            }
        });

        // Add Signatures if requested
        if (config.showSignatures !== false) {
            const finalY = (doc as any).lastAutoTable?.finalY ?? (pageHeight - 50);
            let sigY = pageHeight - 35;
            
            // If the table ended too low, push signatures to a new page
            if (finalY > sigY - 10) {
                doc.addPage();
                drawHeader(doc);
                sigY = pageHeight - 35;
            }
            
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

            drawSig('PREPARED BY', margin, config?.preparedBy);
            drawSig('REVIEWED BY', margin + sigW, config?.reviewedBy);
            drawSig('APPROVED BY', margin + (sigW * 2), config?.approvedBy);
        }

        // Two-pass footer drawing to guarantee accurate total pages across all pages
        const totalPages = doc.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setDrawColor(...colors.border); doc.setLineWidth(0.1);
            doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
            doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(30, 41, 59);
            doc.text(REPORT_FOOTER_APP_TEXT, margin, pageHeight - 6);
            if (config.showPageNumbers !== false) {
                doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
            }
        }

        applyWatermarkAndSignaturesGlobal(doc, config);
        if (config.returnBlob) return doc.output("blob");
        doc.save(`ROV_Photography_Log_${(config?.reportNoPrefix || headerData?.sowReportNo)}_${format(new Date(), 'yyyyMMdd')}.pdf`);
        return;

    } catch (e) {
        console.error("Photography Log Report Error", e);
        throw e;
    }
};
