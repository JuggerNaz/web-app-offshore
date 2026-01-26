import jsPDF from "jspdf";
import "jspdf-autotable";

// Helper to load image for PDF (reused from pdf-generator.ts logic)
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

interface ReportConfig {
    reportNoPrefix: string;
    reportYear: string;
    preparedBy: { name: string; date: string };
    reviewedBy: { name: string; date: string };
    approvedBy: { name: string; date: string };
    watermark: { enabled: boolean; text: string; transparency: number };
    showContractorLogo: boolean;
    showPageNumbers: boolean;
    returnBlob?: boolean;
    procedureId?: string;
}

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    serial_no?: string;
    logo_url?: string;
}

const getLibraryLabel = (library: any[], id: string) => {
    if (!library || !id) return id;
    const item = library.find(item => item.lib_id === id); // assuming string id comparison
    return item ? item.lib_desc : id;
};

export const generateDefectCriteriaReport = async (
    companySettings?: CompanySettings,
    config?: ReportConfig
) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Colors
        const headerBlue: [number, number, number] = [26, 54, 93];
        const sectionBlue: [number, number, number] = [44, 82, 130];
        const tableHeaderColor: [number, number, number] = [240, 240, 240];

        // Fetch Data
        let procedures: any[] = [];
        let allRules: any = {}; // Map procedureId -> rules[]
        let libraryData: any = {};

        // 1. Fetch Procedures
        try {
            const procRes = await fetch('/api/defect-criteria/procedures');
            if (procRes.ok) {
                procedures = await procRes.json();
                // Sort latest first
                procedures.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

                // Filter if specific procedure selected
                if (config?.procedureId && config.procedureId !== "ALL") {
                    procedures = procedures.filter(p => p.id === config.procedureId);
                }
            }
        } catch (e) {
            console.error("Error fetching procedures", e);
        }

        // 2. Fetch Library Data for labels
        try {
            const [prioRes, codesRes, groupsRes, typesRes, colorsRes] = await Promise.all([
                fetch('/api/defect-criteria/library/priorities'),
                fetch('/api/defect-criteria/library/codes'),
                fetch('/api/defect-criteria/library/structure-groups'),
                fetch('/api/defect-criteria/library/types'), // Fetch ALL types
                fetch('/api/library/combo/ANMLYCLR')
            ]);

            libraryData.priorities = prioRes.ok ? await prioRes.json() : [];
            libraryData.defectCodes = codesRes.ok ? await codesRes.json() : [];
            libraryData.structureGroups = groupsRes.ok ? await groupsRes.json() : [];
            libraryData.defectTypes = typesRes.ok ? await typesRes.json() : [];

            const colorsData = colorsRes.ok ? await colorsRes.json() : {};
            libraryData.anomalyColors = colorsData.data || [];

        } catch (e) {
            console.error("Error fetching library data", e);
        }

        // 3. Fetch Rules for each procedure
        try {
            for (const proc of procedures) {
                const rulesRes = await fetch(`/api/defect-criteria/rules?procedureId=${proc.id}`);
                if (rulesRes.ok) {
                    const rules = await rulesRes.json();
                    // Sort rules by order or priority
                    rules.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
                    allRules[proc.id] = rules;
                }
            }
        } catch (e) {
            console.error("Error fetching rules", e);
        }

        // --- REPORT GENERATION helper ---
        const addHeader = async (pageNum: number) => {
            doc.setFillColor(...headerBlue);
            doc.rect(0, 0, pageWidth, 28, "F");

            // Logo
            if (companySettings?.logo_url) {
                try {
                    const logoData = await loadImage(companySettings.logo_url);
                    doc.addImage(logoData, 'PNG', pageWidth - 24, 5, 16, 16);
                } catch (e) {
                    // fallback text
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(8);
                    doc.text("LOGO", pageWidth - 16, 13);
                }
            }

            // Company Name
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(companySettings?.company_name || "NasQuest Resources Sdn Bhd", 10, 9);

            // Dept
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(companySettings?.department_name || "Engineering Department", 10, 14);

            // Title
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text("DEFECT CRITERIA SPECIFICATION REPORT", 10, 22);
        };

        const addFooter = (pageNum: number, pageCount: number) => {
            const footerY = pageHeight - 10;
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.1);
            doc.line(10, footerY - 5, pageWidth - 10, footerY - 5);

            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.setFont("helvetica", "normal");

            // System Name
            doc.text(`WebApp Offshore - Defect Criteria System`, 10, footerY);

            // Version / Date
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, footerY, { align: "center" });

            // Page Number
            doc.text(`Page ${pageNum} of ${pageCount}`, pageWidth - 10, footerY, { align: "right" });
        };

        // We'll use autoTable for the content
        let autoTable = (doc as any).autoTable;
        if (!autoTable) {
            try {
                autoTable = require('jspdf-autotable').default;
            } catch (e) {
                console.warn("AutoTable require failed", e);
            }
        }

        if (!autoTable) {
            // Fallback if autoTable not found
            doc.text("Error: jspdf-autotable plugin not loaded.", 10, 50);
            if (config?.returnBlob) return doc.output('blob');
            doc.save("error.pdf");
            return;
        }

        let currentY = 35;
        let hasContent = false;

        for (const proc of procedures) {
            const rules = allRules[proc.id] || [];
            hasContent = true;

            // Check for page break space
            if (currentY > pageHeight - 40) {
                doc.addPage();
                currentY = 35;
            }

            // Procedure Header
            doc.setFillColor(...sectionBlue);
            doc.rect(10, currentY, pageWidth - 20, 8, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            const procTitle = `${proc.procedureNumber} - ${proc.procedureName} (Ver. ${proc.version})`;
            doc.text(procTitle, 12, currentY + 5.5);

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text(`Effective: ${new Date(proc.effectiveDate).toLocaleDateString()}`, pageWidth - 12, currentY + 5.5, { align: "right" });

            currentY += 10;

            if (rules.length === 0) {
                doc.setTextColor(100, 100, 100);
                doc.setFontSize(8);
                doc.text("(No rules defined in this procedure)", 10, currentY + 5);
                currentY += 15;
                continue;
            }

            // Helper for Proper Case
            const toProperCase = (str: string) => {
                return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
            };

            // Group rules by Defect Code
            const groupedRules: Record<string, any[]> = {};
            rules.forEach((rule: any) => {
                // Construct label: "Description (Code)"
                // rule.defectCodeId is likely the code itself (e.g. 'DB') based on previous context 
                // OR it's a UUID and we need to look up the code.
                // Looking at `getLibraryLabel`, it finds item by `lib_id`.
                // Assuming `lib_id` is the code for defect codes.
                const desc = getLibraryLabel(libraryData.defectCodes, rule.defectCodeId);
                const codeKey = `${desc} (${rule.defectCodeId})`;

                if (!groupedRules[codeKey]) groupedRules[codeKey] = [];
                groupedRules[codeKey].push(rule);
            });

            // Sort groups by Defect Code Label
            const sortedGroups = Object.keys(groupedRules).sort();

            const tableBody: any[] = [];

            sortedGroups.forEach(groupKey => {
                const groupRules = groupedRules[groupKey];

                // Sort by Priority (Priority 1, 2, 3... then Observation)
                groupRules.sort((a, b) => {
                    const pA = getLibraryLabel(libraryData.priorities, a.priorityId);
                    const pB = getLibraryLabel(libraryData.priorities, b.priorityId);

                    const isObsA = pA.toUpperCase().includes("OBSERVATION");
                    const isObsB = pB.toUpperCase().includes("OBSERVATION");

                    if (isObsA && !isObsB) return 1;
                    if (!isObsA && isObsB) return -1;

                    return pA.localeCompare(pB, undefined, { numeric: true });
                });

                // Add Group Header
                tableBody.push([{ content: groupKey, colSpan: 6, styles: { fillColor: [245, 245, 245], fontStyle: 'bold', halign: 'left' } }]);

                // Add Rules
                groupRules.forEach(rule => {
                    // Format Threshold
                    let condition = "N/A";
                    if (rule.thresholdOperator) {
                        const val = rule.thresholdText || rule.thresholdValue;
                        condition = `${rule.thresholdOperator} ${val}`;
                    }

                    // Format Priority
                    const prioLabel = getLibraryLabel(libraryData.priorities, rule.priorityId);

                    // Labels - Defect Type in Proper Case
                    const defectTypeRaw = getLibraryLabel(libraryData.defectTypes, rule.defectTypeId);
                    const defectType = toProperCase(defectTypeRaw);

                    tableBody.push([
                        rule.order || "-",
                        rule.structureGroup,
                        defectType,
                        condition,
                        { content: prioLabel, styles: { halign: 'center' }, rawPriorityId: rule.priorityId },
                        rule.alertMessage
                    ]);
                });
            });

            autoTable(doc, {
                startY: currentY,
                head: [['Order', 'Structure Group', 'Defect Type', 'Condition', 'Priority', 'Alert Message']],
                body: tableBody,
                theme: 'grid',
                headStyles: {
                    fillColor: tableHeaderColor,
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    lineWidth: 0.1,
                    lineColor: [200, 200, 200],
                    halign: 'center',
                    valign: 'middle',
                    minCellHeight: 10
                },
                styles: {
                    fontSize: 7,
                    cellPadding: 2,
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1,
                    textColor: [50, 50, 50],
                    valign: 'middle'
                },
                columnStyles: {
                    0: { cellWidth: 12, halign: 'center' }, // Order
                    1: { cellWidth: 30, halign: 'center' }, // Structure Group
                    2: { cellWidth: 50, halign: 'left' },   // Defect Type (Increased)
                    3: { cellWidth: 25, halign: 'center' }, // Condition
                    4: { cellWidth: 25, halign: 'center' }, // Priority
                    5: { cellWidth: 'auto', halign: 'left' } // Alert Message (Remaining space)
                },
                didParseCell: (data: any) => {
                    if (data.section === 'body' && data.column.index === 4) {
                        const rawPriorityId = data.cell.raw.rawPriorityId;
                        if (rawPriorityId && libraryData.anomalyColors) {
                            // Find color for this priority
                            const colorItem = libraryData.anomalyColors.find((c: any) =>
                                c.code_1 === rawPriorityId &&
                                (c.lib_delete === null || c.lib_delete === 0)
                            );

                            if (colorItem && colorItem.code_2) {
                                // Parse RGB string "255,165,000" or "255,0,0"
                                const rgbParts = colorItem.code_2.split(',').map((p: string) => parseInt(p.trim()));
                                if (rgbParts.length === 3 && !rgbParts.some((n: any) => isNaN(n))) {
                                    data.cell.styles.fillColor = rgbParts;
                                    // Optional: Adjust text color for contrast? defaulting blacklist for now
                                    // If dark background, set white text. Simple heuristic.
                                    const brightness = (rgbParts[0] * 299 + rgbParts[1] * 587 + rgbParts[2] * 114) / 1000;
                                    if (brightness < 125) {
                                        data.cell.styles.textColor = [255, 255, 255];
                                    } else {
                                        data.cell.styles.textColor = [0, 0, 0];
                                    }
                                }
                            }
                        }
                    }
                },
                margin: { top: 30, bottom: 20, left: 10, right: 10 },
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;
        }

        if (!hasContent) {
            doc.text("No defect criteria procedures found.", 10, 40);
        }

        // Add Headers and Footers to all pages
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            await addHeader(i);
            addFooter(i, pageCount);

            // Watermark
            if (config?.watermark?.enabled) {
                doc.saveGraphicsState();
                doc.setGState(new (doc as any).GState({ opacity: config.watermark.transparency || 0.1 }));
                doc.setTextColor(150, 150, 150);
                doc.setFontSize(60);
                doc.text(config.watermark.text, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
                doc.restoreGraphicsState();
            }
        }

        if (config?.returnBlob) {
            return doc.output('blob');
        } else {
            doc.save("Defect_Criteria_Report.pdf");
        }
    } catch (criticalError) {
        console.error("Critical PDF Generation Error", criticalError);
        // Attempt to return error pdf
        try {
            const errDoc = new jsPDF();
            errDoc.text("Critical Error Generating PDF", 10, 10);
            errDoc.text(String(criticalError), 10, 20);
            return errDoc.output('blob');
        } catch (e) {
            return null;
        }
    }
};
