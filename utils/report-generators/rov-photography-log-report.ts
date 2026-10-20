import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { loadLogoWithTransparency, drawLogo, draw3SectionHeader, applyWatermarkAndSignaturesGlobal, formatPdfDate, normalizeReportRecords, formatReportFindingText, applyRecordCellStyling , REPORT_FOOTER_APP_TEXT } from "./shared-logo";

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

        // Extract and flatten attachments if inspection records were passed
        const flatPhotos: any[] = [];
        (photos || []).forEach((item: any) => {
            if (!item) return;
            const atts = item.attachments || item.attachment || item.insp_attachments || item.insp_photos || item.photos;
            if (Array.isArray(atts) && atts.length > 0) {
                const sortedAtts = [...atts].sort((a: any, b: any) => {
                    const orderA = a.meta?.sort_order !== undefined ? Number(a.meta.sort_order) : (a.sort_order !== undefined ? Number(a.sort_order) : 999999);
                    const orderB = b.meta?.sort_order !== undefined ? Number(b.meta.sort_order) : (b.sort_order !== undefined ? Number(b.sort_order) : 999999);
                    if (orderA !== orderB) return orderA - orderB;
                    return new Date(a.created_at || a.captured_at || 0).getTime() - new Date(b.created_at || b.captured_at || 0).getTime();
                });
                sortedAtts.forEach((a: any) => {
                    flatPhotos.push({
                        ...a,
                        anomaly_ref: a.anomaly_ref || item.insp_anomalies?.[0]?.anomaly_ref_no || item.anomaly_ref || null
                    });
                });
            } else if (item.path || item.file_path || item.url || item.file_url || item.storage_path || item.id || item.name) {
                flatPhotos.push(item);
            }
        });
        const resolvedPhotos = flatPhotos.length > 0 ? flatPhotos : [...(photos || [])].sort((a: any, b: any) => {
            const orderA = a.meta?.sort_order !== undefined ? Number(a.meta.sort_order) : (a.sort_order !== undefined ? Number(a.sort_order) : 999999);
            const orderB = b.meta?.sort_order !== undefined ? Number(b.meta.sort_order) : (b.sort_order !== undefined ? Number(b.sort_order) : 999999);
            if (orderA !== orderB) return orderA - orderB;
            return new Date(a.created_at || a.captured_at || 0).getTime() - new Date(b.created_at || b.captured_at || 0).getTime();
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
                ['Item No.', 'Real Time', 'Photo Title', 'Details']
            ],
            body: resolvedPhotos.map((p, idx) => {
                let meta = p.meta || {};
                if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                }

                const itemNo = (idx + 1).toString();
                const realTime = p.created_at ? format(new Date(p.created_at), 'dd MMM yyyy HH:mm') : 'N/A';
                const photoTitle = (meta.title || p.name || `Photo ${idx + 1}`).toUpperCase();
                
                let details = meta.description || "";
                if (p.anomaly_ref) {
                    details = details ? `${details} (Anomaly Ref: ${p.anomaly_ref})` : `Anomaly Ref: ${p.anomaly_ref}`;
                }

                return [itemNo, realTime, photoTitle, details];
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
