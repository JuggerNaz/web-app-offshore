import jsPDF from "jspdf";
import "jspdf-autotable";
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

// Helper to load image
const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL("image/jpeg"));
            } else {
                reject(new Error("Canvas context is null"));
            }
        };
        img.onerror = (e) => reject(e);
    });
};

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
    const autoTable = (doc as any).autoTable || require('jspdf-autotable').default;

    // Colors
    const headerBlue: [number, number, number] = [26, 54, 93];
    const sectionBlue: [number, number, number] = [44, 82, 130];

    // ===== HEADER =====
    doc.setFillColor(...headerBlue);
    doc.rect(0, 0, pageWidth, 28, "F");

    // Logo
    if (companySettings?.logo_url) {
        try {
            const logoData = await loadImage(companySettings.logo_url);
            doc.addImage(logoData, 'PNG', pageWidth - 24, 5, 16, 16);
        } catch (error) {
            // Placeholder
            doc.setDrawColor(255, 255, 255);
            doc.rect(pageWidth - 25, 4, 18, 18);
            doc.setFontSize(7);
            doc.setTextColor(255, 255, 255);
            doc.text("LOGO", pageWidth - 16, 13.5, { align: "center" });
        }
    }

    // Company & Dept
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(companySettings?.company_name || "NasQuest Resources Sdn Bhd", 10, 9);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(companySettings?.department_name || "Engineering Department", 10, 14);

    // Title
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("JOB PACK SUMMARY REPORT", 10, 20);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Overview of job pack details and assignments", 10, 24);

    // Report Number
    if (config) {
        const reportNo = `${config.reportNoPrefix}-${config.reportYear}-${jobPack.id}`;
        doc.text(`Report: ${reportNo}`, pageWidth - 10, 24, { align: "right" });
    }

    let yPos = 35;

    // ===== JOB PACK DETAILS =====
    doc.setFillColor(...sectionBlue);
    doc.rect(10, yPos, pageWidth - 20, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("JOB PACK DETAILS", 12, yPos + 4);
    yPos += 10;

    // Resolve details
    const contractor = jobPack.metadata?.contrac ? await fetchContractorDetails(jobPack.metadata.contrac) : { name: "N/A", address: "" };
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

    // Logo (Placed under Address Label)
    let logoHeightUsed = 0;
    if (contractor.logoUrl) {
        try {
            const cLogo = await loadImage(contractor.logoUrl);
            const lWidth = 20;
            const lHeight = 20;
            // Place under "Address:" label (approx Y + 5)
            doc.addImage(cLogo, 'PNG', labelX, addressLabelY + 4, lWidth, lHeight);
            logoHeightUsed = lHeight + 4;
        } catch (e) { }
    }

    const leftBottom = Math.max(addressTextBottom, addressLabelY + logoHeightUsed + 2);


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
        headStyles: { fillColor: sectionBlue, fontSize: 8, halign: 'left', fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, halign: 'left' },
        columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 'auto' }
        },
        margin: { left: 10, right: 10 },
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
    doc.text(`Generated: ${new Date().toLocaleString()}`, 10, footerY);
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

            if (config.preparedBy.name) {
                doc.text("Prepared By:", 10, sigY);
                doc.text(config.preparedBy.name, 10, sigY + 5);
                doc.text(config.preparedBy.date || "", 10, sigY + 9);
                doc.line(10, sigY + 10, 10 + sigWidth - 5, sigY + 10);
            }

            if (config.reviewedBy.name) {
                const x = 10 + sigWidth;
                doc.text("Reviewed By:", x, sigY);
                doc.text(config.reviewedBy.name, x, sigY + 5);
                doc.text(config.reviewedBy.date || "", x, sigY + 9);
                doc.line(x, sigY + 10, x + sigWidth - 5, sigY + 10);
            }

            if (config.approvedBy.name) {
                const x = 10 + (sigWidth * 2);
                doc.text("Approved By:", x, sigY);
                doc.text(config.approvedBy.name, x, sigY + 5);
                doc.text(config.approvedBy.date || "", x, sigY + 9);
                doc.line(x, sigY + 10, x + sigWidth - 5, sigY + 10);
            }
        }
    }

    if (config?.returnBlob) {
        return doc.output('blob');
    } else {
        doc.save(`JobPack_Summary_${jobPack.id}.pdf`);
    }
};
