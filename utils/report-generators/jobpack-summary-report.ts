import { jsPDF } from "jspdf";
import autoTablePlugin from "jspdf-autotable";
import { ReportConfig } from "../pdf-generator";

interface JobPackData {
    id: number;
    name: string;
    status: string;
    metadata: {
        istart?: string;
        iend?: string;
        contrac?: string; // Contractor ID
        contract_ref?: string;
        contractor_ref?: string;
        vessel?: string;
        vessel_history?: Array<{ name: string; date: string }>;
        site_hrs?: number;
        plantype?: string;
        tasktype?: string;
        remarks?: string;
        idesc?: string;
        structures?: Array<{
            id: number;
            type: "PLATFORM" | "PIPELINE";
            title: string;
            // other fields
        }>;
        inspections?: Record<string, Array<{ id: number; code: string; name: string }>> | Array<{ id: number; code: string; name: string }>;
        jobTypes?: Record<string, string>; // "TYPE-ID": "GVI"
        // other metadata
    };
    created_at: string;
    updated_at: string;
}

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    serial_no?: string;
    logo_url?: string;
}

import { loadLogoWithTransparency, drawLogo , applyWatermarkAndSignaturesGlobal , formatPdfDate, normalizeReportRecords , applyRecordCellStyling, formatReportFindingText , REPORT_FOOTER_APP_TEXT } from "./shared-logo";

const fetchContractorDetails = async (id: string): Promise<{ name: string; address: string; logoUrl?: string }> => {
    try {
        const res = await fetch(`/api/library/CONTR_NAM`);
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
            const found = json.data.find((c: any) => String(c.lib_id) === String(id));
            if (found) {
                return {
                    name: found.lib_desc,
                    address: found.lib_com || "",
                    logoUrl: found.logo_url
                };
            }
        }
        return { name: id, address: "" };
    } catch (e) {
        return { name: id, address: "" };
    }
};

export const generateJobPackSummaryReport = async (
    jobPack: JobPackData,
    companySettings?: CompanySettings,
    config?: ReportConfig
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const autoTable = (doc as any).autoTable || autoTablePlugin;

    // Colors
    const headerBlue: [number, number, number] = [7, 78, 136];
    const sectionBlue: [number, number, number] = [7, 78, 136];
    const isPrintFriendly = config?.printFriendly === true;

    // ===== RESOLVE CONTRACTOR & LOGOS =====
    const contractor = jobPack.metadata?.contrac
        ? await fetchContractorDetails(jobPack.metadata.contrac)
        : { name: "N/A", address: "", logoUrl: undefined };

    let contractorLogoUrl = (config as any)?.contractorLogoUrl || (config as any)?.contractorLogo || contractor.logoUrl;
    if (!contractorLogoUrl && ((jobPack as any)?.contractor_id || jobPack?.metadata?.contrac)) {
        try {
            const cDetails = await fetchContractorDetails(((jobPack as any)?.contractor_id || jobPack?.metadata?.contrac));
            if (cDetails?.logoUrl) contractorLogoUrl = cDetails.logoUrl;
        } catch (e) {}
    }

    let contractorLogoData: any = null;
    if (contractorLogoUrl) {
        try {
            contractorLogoData = await loadLogoWithTransparency(contractorLogoUrl);
        } catch (e) {}
    }

    let clientLogoData: any = null;
    if (companySettings?.logo_url) {
        try {
            clientLogoData = await loadLogoWithTransparency(companySettings.logo_url);
        } catch (e) {}
    }

    // ===== 3-BORDER HEADER (CONTRACTOR | REPORT TITLE | CLIENT) =====
    const headerMargin = 10;
    const headerY = 7;
    const headerH = 25;
    const col1W = 55; // Left: Contractor
    const col2W = 80; // Middle: Report Title
    const col3W = 55; // Right: Client
    const x1 = headerMargin;
    const x2 = x1 + col1W;
    const x3 = x2 + col2W;

    const headerBorderColor: [number, number, number] = [200, 200, 200];
    const headerLineWidth = 0.2;
    const titleTextColor: [number, number, number] = isPrintFriendly ? [7, 78, 136] : [255, 255, 255];
    const titleSubTextColor: [number, number, number] = isPrintFriendly ? [51, 65, 85] : [219, 234, 254];

    const drawHeader = (d: jsPDF) => {
        // --- 1. LEFT BOX: CONTRACTOR (White Background + Border) ---
        d.setFillColor(255, 255, 255);
        d.rect(x1, headerY, col1W, headerH, "F");
        d.setDrawColor(...headerBorderColor);
        d.setLineWidth(headerLineWidth);
        d.rect(x1, headerY, col1W, headerH, "S");

        if (contractorLogoData) {
            drawLogo(d, contractorLogoData, 48, 20, x1 + (col1W - 48) / 2, headerY + (headerH - 20) / 2, 'center', 'center');
        }

        // --- 2. MIDDLE BOX: REPORT TITLE (Navy/White + Border) ---
        if (isPrintFriendly) {
            d.setFillColor(255, 255, 255);
        } else {
            d.setFillColor(...headerBlue);
        }
        d.rect(x2, headerY, col2W, headerH, "F");
        d.setDrawColor(...headerBorderColor);
        d.setLineWidth(headerLineWidth);
        d.rect(x2, headerY, col2W, headerH, "S");

        const titleCenterX = x2 + col2W / 2;
        d.setFontSize(10.5);
        d.setFont("helvetica", "bold");
        d.setTextColor(...titleTextColor);
        d.text("JOB PACK SUMMARY REPORT", titleCenterX, headerY + 8, { align: "center" });

        const reportNo = config?.reportNoPrefix
            ? `${config.reportNoPrefix}-${config.reportYear || new Date().getFullYear()}-${jobPack.id}`
            : (jobPack.metadata?.contract_ref || `JP-${jobPack.id}`);

        d.setFontSize(8);
        d.setFont("helvetica", "normal");
        d.setTextColor(...titleSubTextColor);
        d.text(`Report No: ${reportNo}`, titleCenterX, headerY + 14, { align: "center" });

        if (jobPack.name) {
            d.setFontSize(7.5);
            d.setFont("helvetica", "bold");
            d.setTextColor(...titleTextColor);
            const jpLines = d.splitTextToSize(jobPack.name, col2W - 8);
            d.text(jpLines[0] || "", titleCenterX, headerY + 19.5, { align: "center" });
        }

        // --- 3. RIGHT BOX: CLIENT (White Background + Border) ---
        d.setFillColor(255, 255, 255);
        d.rect(x3, headerY, col3W, headerH, "F");
        d.setDrawColor(...headerBorderColor);
        d.setLineWidth(headerLineWidth);
        d.rect(x3, headerY, col3W, headerH, "S");

        if (clientLogoData) {
            drawLogo(d, clientLogoData, 48, 20, x3 + (col3W - 48) / 2, headerY + (headerH - 20) / 2, 'center', 'center');
        }

        d.setTextColor(0, 0, 0);
        d.setDrawColor(200, 200, 200);
        d.setLineWidth(0.2);
    };

    // Draw header on initial page
    drawHeader(doc);

    let yPos = 35;

    // ===== JOB PACK DETAILS =====
    if (isPrintFriendly) {
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.3);
        doc.rect(10, yPos, pageWidth - 20, 6, "FD");
        doc.setTextColor(0, 0, 0);
    } else {
        doc.setFillColor(...sectionBlue);
        doc.rect(10, yPos, pageWidth - 20, 6, "F");
        doc.setTextColor(255, 255, 255);
    }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("JOB PACK DETAILS", 12, yPos + 4);
    yPos += 10;

    const startDate = jobPack.metadata?.istart || "N/A";
    const endDate = jobPack.metadata?.iend || "TBD";

    // Resolve Vessel (Single or History)
    let vesselStr = jobPack.metadata?.vessel || "N/A";
    if (jobPack.metadata?.vessel_history && Array.isArray(jobPack.metadata.vessel_history) && jobPack.metadata.vessel_history.length > 0) {
        // Sort by date descending usually, but for history list maybe ascending?
        // Let's list unique names with dates
        vesselStr = jobPack.metadata.vessel_history
            .map(v => `${v.name} (${v.date})`)
            .join(", ");
    }

    const status = jobPack.status || "OPEN";
    const planType = jobPack.metadata?.plantype || "N/A";
    const taskType = jobPack.metadata?.tasktype || "N/A";

    const leftColX = 12;
    const rightColX = pageWidth / 2 + 5;
    const valueOffset = 35;
    const rightValueOffset = 35;

    let currentY = yPos;

    // -- ROW 1: Name & Status --
    doc.setTextColor(0, 0, 0); // Reset to black
    doc.setFont("helvetica", "bold"); doc.text("Job Pack Name:", leftColX, currentY);
    doc.setFont("helvetica", "normal"); doc.text(jobPack.name, leftColX + valueOffset, currentY);

    doc.setFont("helvetica", "bold"); doc.text("Status:", rightColX, currentY);
    doc.setFont("helvetica", "normal"); doc.text(status, rightColX + rightValueOffset, currentY);

    currentY += 6;

    // -- ROW 2: Dates --
    doc.setFont("helvetica", "bold"); doc.text("Start Date:", leftColX, currentY);
    doc.setFont("helvetica", "normal"); doc.text(startDate, leftColX + valueOffset, currentY);

    doc.setFont("helvetica", "bold"); doc.text("End Date:", rightColX, currentY);
    doc.setFont("helvetica", "normal"); doc.text(endDate, rightColX + rightValueOffset, currentY);

    currentY += 6;

    // -- ROW 3: Types --
    doc.setFont("helvetica", "bold"); doc.text("Plan Type:", leftColX, currentY);
    doc.setFont("helvetica", "normal"); doc.text(planType, leftColX + valueOffset, currentY);

    doc.setFont("helvetica", "bold"); doc.text("Task Type:", rightColX, currentY);
    doc.setFont("helvetica", "normal"); doc.text(taskType, rightColX + rightValueOffset, currentY);

    currentY += 6;

    // -- ROW 4: Refs --
    doc.setFont("helvetica", "bold"); doc.text("Contract Ref:", leftColX, currentY);
    doc.setFont("helvetica", "normal"); doc.text(jobPack.metadata?.contract_ref || "N/A", leftColX + valueOffset, currentY);

    doc.setFont("helvetica", "bold"); doc.text("Contractor Ref:", rightColX, currentY);
    doc.setFont("helvetica", "normal"); doc.text(jobPack.metadata?.contractor_ref || "N/A", rightColX + rightValueOffset, currentY);

    currentY += 6;

    // -- ROW 5: Remarks --
    doc.setFont("helvetica", "bold"); doc.text("Remarks:", leftColX, currentY);
    const remarks = jobPack.metadata?.idesc || jobPack.metadata?.remarks || "None";
    // Wrap remarks
    const wrappedRemarks = doc.splitTextToSize(remarks, pageWidth - 30);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(wrappedRemarks, leftColX + valueOffset, currentY);

    // Ensure sufficient height for remarks
    const remarksHeight = Math.max(wrappedRemarks.length * 4, 6);
    currentY += remarksHeight + 2;


    // -- CONTRACTOR & VESSEL SECTION --
    const contractorY = currentY + 4;

    // Horizontal Divider
    doc.setDrawColor(220, 220, 220);
    doc.line(10, contractorY, pageWidth - 10, contractorY);

    // -- LEFT COLUMN: Contractor --
    const contentStart = contractorY + 5;

    const labelX = 12; // Same as leftColX
    const valueX = 47; // Same as leftColX + valueOffset

    doc.setFont("helvetica", "bold");
    doc.text("Contractor:", labelX, contentStart + 4);

    doc.setFont("helvetica", "normal");
    doc.text(contractor.name, valueX, contentStart + 4);

    // Address Label
    const addressLabelY = contentStart + 9;
    doc.setFont("helvetica", "bold");
    doc.text("Address:", labelX, addressLabelY);

    // Address Text
    doc.setFont("helvetica", "normal");
    const addressWrap = doc.splitTextToSize(contractor.address, (pageWidth / 2) - valueX - 5);
    doc.text(addressWrap, valueX, addressLabelY);

    const addressTextBottom = addressLabelY + (addressWrap.length * 4);
    const leftBottom = Math.max(addressTextBottom, contentStart + 14);


    // -- RIGHT COLUMN: Vessel --
    // "Vessel names in record style" -> List them vertically
    const rightLabelX = pageWidth / 2 + 5; // rightColX
    const rightValueX = rightLabelX + 35; // rightColX + rightValueOffset

    doc.setFont("helvetica", "bold");
    doc.text("Vessel(s):", rightLabelX, contentStart + 4);
    doc.setFont("helvetica", "normal");

    let vesselBottom = contentStart + 4;

    if (jobPack.metadata?.vessel_history && jobPack.metadata.vessel_history.length > 0) {
        jobPack.metadata.vessel_history.forEach((v, i) => {
            const vText = `${v.name} (${v.date})`;
            doc.text(`• ${vText}`, rightValueX, contentStart + 4 + (i * 5));
        });
        vesselBottom = contentStart + 4 + (jobPack.metadata.vessel_history.length * 5);
    } else {
        doc.text(vesselStr, rightValueX, contentStart + 4);
        vesselBottom = contentStart + 4 + 4;
    }

    // Determine section height based on tallest content
    const contentBottom = Math.max(leftBottom, vesselBottom);
    yPos = contentBottom + 5;

    // Outer Border for Job Pack Details
    doc.setDrawColor(200, 200, 200);
    doc.rect(10, 35, pageWidth - 20, yPos - 35);

    // ===== STRUCTURES & INSPECTIONS LIST =====
    yPos += 5; // Spacing

    const structures = jobPack.metadata?.structures || [];
    const inspectionsByStruct = jobPack.metadata?.inspections || {};
    const jobTypes = jobPack.metadata?.jobTypes || {};

    // Prepare Table Data
    const tableBody = structures.map(s => {
        const key = `${s.type}-${s.id}`;

        // Resolve Inspection Types
        let inspectionList: any[] = [];
        if (Array.isArray(inspectionsByStruct)) {
            // If it's a global array
            inspectionList = inspectionsByStruct;
        } else if (inspectionsByStruct[key]) {
            // Specific to structure
            inspectionList = inspectionsByStruct[key];
        }

        const inspectionNames = inspectionList.map(i => i.name || i.code).join(", ");

        // Resolve Job Type
        const jobType = jobTypes[key] || "N/A";

        return [
            s.title,
            s.type,
            jobType,
            inspectionList.length > 0 ? inspectionList.map(i => i.name || i.code) : "None"
        ];
    });

    autoTable(doc, {
        startY: yPos,
        head: [['Structure', 'Type', 'Job Type', 'Inspection Scope']],
        body: tableBody,
        theme: 'grid',
        headStyles: {fillColor: isPrintFriendly ? [240, 240, 240] : sectionBlue, textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255], fontSize: 8, halign: 'left', fontStyle: 'bold', lineWidth: 0.1, lineColor: isPrintFriendly ? [203, 213, 225] : [255, 255, 255]},
        bodyStyles: { fontSize: 8, halign: 'left' },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 'auto' }
        },
        margin: { top: 35, left: 10, right: 10 },
        didDrawPage: (data: any) => {
            if (data.pageNumber > 1) {
                drawHeader(doc);
            }
        },
        didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
                const raw = data.cell.raw;
                if (Array.isArray(raw)) {
                    // Calculate required height for 2-column layout
                    const count = raw.length;
                    const rows = Math.ceil(count / 2);
                    const lineHeight = 4; // mm
                    const padding = 4;
                    const requiredHeight = (rows * lineHeight) + padding;

                    data.cell.styles.minCellHeight = requiredHeight;
                    data.cell.styles.valign = 'middle';
                    data.cell.text = []; // Prevent default rendering
                }
            }
        },
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
                const raw = data.cell.raw;
                if (Array.isArray(raw)) {
                    const cell = data.cell;
                    const x = cell.x;
                    const y = cell.y;
                    const w = cell.width;

                    doc.setFontSize(7);
                    doc.setTextColor(50, 50, 50);

                    const half = Math.ceil(raw.length / 2);
                    const col1 = raw.slice(0, half);
                    const col2 = raw.slice(half);

                    const lineHeight = 4;
                    const colWidth = (w / 2) - 3;

                    // Draw Column 1
                    col1.forEach((text: string, i: number) => {
                        // Truncate text if too long to prevent overlap
                        // Note: doc.text with maxWidth wraps text, which messes up our simple grid calculation.
                        // For simplicity, we assume text fits or we let it compact.
                        // Ideally checking getTextWidth would be better but expensive here.
                        doc.text(`• ${text}`, x + 2, y + 4 + (i * lineHeight), { maxWidth: colWidth });
                    });

                    // Draw Column 2
                    col2.forEach((text: string, i: number) => {
                        doc.text(`• ${text}`, x + (w / 2) + 2, y + 4 + (i * lineHeight), { maxWidth: colWidth });
                    });
                }
            }
        }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // ===== FOOTER =====
    const footerY = pageHeight - 8;
    doc.setDrawColor(sectionBlue[0], sectionBlue[1], sectionBlue[2]);
    doc.setLineWidth(0.3);
    doc.line(10, footerY - 3, pageWidth - 10, footerY - 3);

    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text(REPORT_FOOTER_APP_TEXT, 10, footerY);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, footerY, { align: "center" });
    doc.text("CONFIDENTIAL", pageWidth - 10, footerY, { align: "right" });

    // ===== CONFIGURATION (Watermark / Signatures) =====
    if (config) {
        if (config.watermark?.enabled) {
            doc.saveGraphicsState();
            doc.setGState(new (doc as any).GState({ opacity: config.watermark.transparency || 0.1 }));
            doc.setTextColor(150, 150, 150);
            doc.setFontSize(60);
            const text = config.watermark.text || "DRAFT";
            doc.text(text, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
            doc.restoreGraphicsState();
        }

        // Signatures (Copy logic from pdf-generator if strictly needed, mostly similar)
        const hasSignatures = config.preparedBy?.name || config.reviewedBy?.name || config.approvedBy?.name;
        if (hasSignatures && yPos < pageHeight - 40) { // Only if space remains
            const sigY = pageHeight - 25;
            doc.setFontSize(7);
            doc.setTextColor(0, 0, 0);

            const sigWidth = (pageWidth - 20) / 3;

            if (config.preparedBy?.name) {
                doc.text("Prepared By:", 10, sigY);
                doc.text(config.preparedBy.name, 10, sigY + 5);
                doc.text(formatPdfDate(config.preparedBy.date), 10, sigY + 9);
                doc.line(10, sigY + 10, 10 + sigWidth - 5, sigY + 10);
            }

            if (config.reviewedBy?.name) {
                const x = 10 + sigWidth;
                doc.text("Reviewed By:", x, sigY);
                doc.text(config.reviewedBy.name, x, sigY + 5);
                doc.text(formatPdfDate(config.reviewedBy.date), x, sigY + 9);
                doc.line(x, sigY + 10, x + sigWidth - 5, sigY + 10);
            }

            if (config.approvedBy?.name) {
                const x = 10 + (sigWidth * 2);
                doc.text("Approved By:", x, sigY);
                doc.text(config.approvedBy.name, x, sigY + 5);
                doc.text(formatPdfDate(config.approvedBy.date), x, sigY + 9);
                doc.line(x, sigY + 10, x + sigWidth - 5, sigY + 10);
            }
        }
    }

    if (config?.returnBlob) {
        applyWatermarkAndSignaturesGlobal(doc, config);
        return doc.output('blob');
    } else {
        applyWatermarkAndSignaturesGlobal(doc, config);
        doc.save(`JobPack_Summary_${jobPack.id}.pdf`);
    }
};
