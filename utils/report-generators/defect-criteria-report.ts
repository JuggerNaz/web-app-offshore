import { jsPDF } from "jspdf";
import autoTablePlugin from "jspdf-autotable";

// Helper to load image for PDF (reused from pdf-generator.ts logic)
import { loadLogoWithTransparency, drawLogo , applyWatermarkAndSignaturesGlobal , formatPdfDate, normalizeReportRecords , applyRecordCellStyling, formatReportFindingText , REPORT_FOOTER_APP_TEXT } from "./shared-logo";

interface ReportConfig {
    sowReportNo?: string;
    reportNoPrefix?: string;
    reportYear?: string;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    showContractorLogo?: boolean;
    showPageNumbers?: boolean;
    returnBlob?: boolean;
    printFriendly?: boolean;
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
        const headerBlue: [number, number, number] = [7, 78, 136];
        const sectionBlue: [number, number, number] = [7, 78, 136];
        const tableHeaderColor: [number, number, number] = [240, 240, 240];
        const isPrintFriendly = config?.printFriendly === true;

        // Fetch Data
        let procedures: any[] = [];
        const allRules: any = {}; // Map procedureId -> rules[]
        const libraryData: any = {};

        // 1. Fetch Procedures
        try {
            const procRes = await fetch('/api/defect-criteria/procedures');
            if (procRes.ok) {
                const allProcs: any[] = await procRes.json();

                // If specific procedure selected by user in config, use that
                if (config?.procedureId && config.procedureId !== "ALL") {
                    procedures = allProcs.filter(p => p.id === config.procedureId);
                } else {
                    // Only print the active procedure(s)
                    const activeProcs = allProcs.filter(p => String(p.status || "").trim().toLowerCase() === "active");
                    if (activeProcs.length > 0) {
                        procedures = activeProcs;
                    } else {
                        // Fallback to first/latest procedure if none explicitly marked active
                        procedures = allProcs.slice(0, 1);
                    }
                }

                // Sort latest first
                procedures.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
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

        // 4. Fetch Active MGI Profiles (Active only)
        let activeMgiProfiles: any[] = [];
        try {
            const mgiRes = await fetch('/api/mgi-profiles');
            if (mgiRes.ok) {
                const mgiData = await mgiRes.json();
                const allMgi = Array.isArray(mgiData) ? mgiData : (mgiData.data || []);
                activeMgiProfiles = allMgi.filter((p: any) => p.is_active && !p.is_archived);
            }
        } catch (e) {
            console.error("Error fetching MGI profiles", e);
        }

        // --- REPORT GENERATION helper ---
        const addHeader = async (pageNum: number) => {
            if (isPrintFriendly) {
                // Print-Friendly: White background with light gray border
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.rect(0, 0, pageWidth, 28);
            } else {
                doc.setFillColor(...headerBlue);
                doc.rect(0, 0, pageWidth, 28, "F");
            }

            // Logo
            if (companySettings?.logo_url) {
                try {
                    const logoData = await loadLogoWithTransparency(companySettings.logo_url);
                    drawLogo(doc, logoData, 18, 18, pageWidth - 24, 4, 'right', 'center');
                } catch (e) {
                    // fallback text
                    doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
                    doc.setFontSize(8);
                    doc.text("LOGO", pageWidth - 16, 13);
                }
            }

            // Company Name - SAME size as Report Title
            doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(companySettings?.company_name || "NasQuest Resources Sdn Bhd", pageWidth / 2, 7.5, { align: "center" });

            // Dept
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");
            doc.text(companySettings?.department_name || "Engineering Department", pageWidth / 2, 12, { align: "center" });

            // Title
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("Defect Criteria Specification Report", pageWidth / 2, 17.5, { align: "center" });

            // Report No - Centered below Report Title
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            const rawReportNo = (config as any)?.sowReportNo || (config as any)?.sow_report_no || config?.reportNoPrefix || (config?.reportYear ? `${config.reportNoPrefix || ''}-${config.reportYear}` : "") || companySettings?.serial_no || "";
            const repNoTrimmed = rawReportNo.toString().trim();
            if (repNoTrimmed && repNoTrimmed !== "N/A") {
                const formattedRepNo = repNoTrimmed.toLowerCase().startsWith("report no") ? repNoTrimmed : `Report No: ${repNoTrimmed}`;
                doc.text(formattedRepNo, pageWidth / 2, 22.5, { align: "center" });
            } else {
                doc.text("Report No: N/A", pageWidth / 2, 22.5, { align: "center" });
            }
        };

        const addFooter = (pageNum: number, pageCount: number) => {
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);

            doc.setFontSize(6.5);
            doc.setTextColor(30, 41, 59);
            doc.setFont("helvetica", "normal");

            // System Name
            doc.text(REPORT_FOOTER_APP_TEXT, 10, pageHeight - 6);

            // Page Number
            if (config?.showPageNumbers !== false) {
                doc.text(`Page ${pageNum} of ${pageCount}`, pageWidth - 10, pageHeight - 6, { align: "right" });
            }
        };

        // We'll use autoTable for the content
        const autoTable = (doc as any).autoTable || autoTablePlugin;

        if (!autoTable) {
            // Fallback if autoTable not found
            doc.text("Error: jspdf-autotable plugin not loaded.", 10, 50);
            applyWatermarkAndSignaturesGlobal(doc, config);
            if (config?.returnBlob) return doc.output('blob');
            applyWatermarkAndSignaturesGlobal(doc, config);
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
            if (isPrintFriendly) {
                doc.setFillColor(240, 240, 240);
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.rect(10, currentY, pageWidth - 20, 8, "FD");
                doc.setTextColor(0, 0, 0);
            } else {
                doc.setFillColor(...sectionBlue);
                doc.rect(10, currentY, pageWidth - 20, 8, "F");
                doc.setTextColor(255, 255, 255);
            }
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
                tableBody.push([{ content: groupKey, colSpan: 6, styles: {fillColor: [245, 245, 245], fontStyle: 'bold', halign: 'left', lineWidth: 0.1, lineColor: [203, 213, 225]} }]);

                // Add Rules
                groupRules.forEach(rule => {
                    // Format Threshold
                    let condition = "N/A";
                    if (rule.thresholdOperator || rule.thresholdText) {
                        const op = rule.thresholdOperator || (rule.thresholdText ? 'LIKE' : '');
                        const val = rule.thresholdText || rule.thresholdValue;
                        condition = `${op} ${val}`.trim();
                    }

                    // Format Priority
                    const prioLabel = getLibraryLabel(libraryData.priorities, rule.priorityId);

                    // Labels - Defect Type in Proper Case
                    const defectTypeRaw = getLibraryLabel(libraryData.defectTypes, rule.defectTypeId);
                    const defectType = toProperCase(defectTypeRaw);

                    const structureGroupDisplay = rule.structureGroup 
                        ? rule.structureGroup.split(',').map((s: string) => s.trim()).filter(Boolean).join(', ')
                        : "-";

                    tableBody.push([
                        rule.order || "-",
                        structureGroupDisplay,
                        defectType,
                        condition,
                        { content: prioLabel, styles: {halign: 'center', lineWidth: 0.1, lineColor: [203, 213, 225]}, rawPriorityId: rule.priorityId },
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
                    0: { cellWidth: 10, halign: 'center' }, // Order
                    1: { cellWidth: 34, halign: 'center' }, // Structure Group
                    2: { cellWidth: 46, halign: 'left' },   // Defect Type
                    3: { cellWidth: 24, halign: 'center' }, // Condition
                    4: { cellWidth: 24, halign: 'center' }, // Priority
                    5: { cellWidth: 'auto', halign: 'left' } // Alert Message (Remaining space)
                },
                didDrawPage: (data: any) => {
                    if (data.pageNumber > 1) addHeader(data.pageNumber);
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
                margin: { top: 35, bottom: 20, left: 10, right: 10 },
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;
        }

        // --- SECTION: Active Marine Growth Inspection (MGI) Profile Settings ---
        if (activeMgiProfiles.length > 0 || hasContent) {
            if (activeMgiProfiles.length === 0) {
                // Check for page break space
                if (currentY > pageHeight - 55) {
                    doc.addPage();
                    currentY = 35;
                } else if (hasContent) {
                    currentY += 2;
                }

                // Section Header Banner
                if (isPrintFriendly) {
                    doc.setFillColor(240, 240, 240);
                    doc.setDrawColor(180, 180, 180);
                    doc.setLineWidth(0.3);
                    doc.rect(10, currentY, pageWidth - 20, 8, "FD");
                    doc.setTextColor(0, 0, 0);
                } else {
                    doc.setFillColor(...sectionBlue);
                    doc.rect(10, currentY, pageWidth - 20, 8, "F");
                    doc.setTextColor(255, 255, 255);
                }
                doc.setFontSize(10);
                doc.setFont("helvetica", "bold");
                doc.text("Marine Growth Inspection (MGI)", 12, currentY + 5.5);

                currentY += 12;

                doc.setTextColor(100, 100, 100);
                doc.setFontSize(8);
                doc.setFont("helvetica", "italic");
                doc.text("(No active MGI profiles currently configured in system settings)", 12, currentY);
                currentY += 10;
            } else {
                hasContent = true;
                for (const profile of activeMgiProfiles) {
                    // Check for page break space
                    if (currentY > pageHeight - 55) {
                        doc.addPage();
                        currentY = 35;
                    } else if (hasContent) {
                        currentY += 2;
                    }

                    // Section Header Banner
                    if (isPrintFriendly) {
                        doc.setFillColor(240, 240, 240);
                        doc.setDrawColor(180, 180, 180);
                        doc.setLineWidth(0.3);
                        doc.rect(10, currentY, pageWidth - 20, 8, "FD");
                        doc.setTextColor(0, 0, 0);
                    } else {
                        doc.setFillColor(...sectionBlue);
                        doc.rect(10, currentY, pageWidth - 20, 8, "F");
                        doc.setTextColor(255, 255, 255);
                    }
                    doc.setFontSize(10);
                    doc.setFont("helvetica", "bold");
                    doc.text("Marine Growth Inspection (MGI)", 12, currentY + 5.5);

                    doc.setFontSize(8.5);
                    doc.setFont("helvetica", "bold");
                    const profileDisplayName = profile.name?.toLowerCase().startsWith("profile")
                        ? profile.name
                        : `Profile: ${profile.name || "Default"}`;
                    doc.text(profileDisplayName, pageWidth - 12, currentY + 5.5, { align: "right" });

                    currentY += 11;

                    if (profile.description) {
                        doc.setFontSize(7.5);
                        doc.setFont("helvetica", "normal");
                        doc.setTextColor(100, 116, 139);
                        doc.text(`Description: ${profile.description}`, 12, currentY);
                        currentY += 4.5;
                    }

                    // Thresholds Table
                    const rawThresholds = Array.isArray(profile.thresholds) ? profile.thresholds : [];
                    const mgiTableBody: any[] = [];

                    if (rawThresholds.length === 0) {
                        mgiTableBody.push([
                            { content: "No elevation thresholds defined for this profile", colSpan: 4, styles: { halign: 'center', textColor: [120, 120, 120] } }
                        ]);
                    } else {
                        rawThresholds.forEach((t: any, idx: number) => {
                            let elevLabel = String(t.from_elevation ?? "-").trim();
                            if (elevLabel.toUpperCase() === "MSL") elevLabel = "MSL (0.00m)";
                            else if (elevLabel.toUpperCase() === "MUDLINE") elevLabel = "Mudline (Seabed Level)";
                            else if (!isNaN(Number(elevLabel))) elevLabel = `${Number(elevLabel).toFixed(2)} m`;

                            const maxThick = t.max_thickness != null ? `${t.max_thickness} mm` : "N/A";
                            const ruleDesc = idx === 0 
                                ? "From surface level downwards to next segment"
                                : (idx === rawThresholds.length - 1 
                                    ? "From this elevation downwards to Mudline" 
                                    : "Interpolated depth segment limit");

                            mgiTableBody.push([
                                idx + 1,
                                elevLabel,
                                maxThick,
                                ruleDesc
                            ]);
                        });
                    }

                    autoTable(doc, {
                        startY: currentY,
                        head: [['Segment', 'From Elevation / Reference Level', 'Max Allowable Thickness', 'Application Rule']],
                        body: mgiTableBody,
                        theme: 'grid',
                        headStyles: {
                            fillColor: tableHeaderColor,
                            textColor: [0, 0, 0],
                            fontStyle: 'bold',
                            lineWidth: 0.1,
                            lineColor: [200, 200, 200],
                            halign: 'center',
                            valign: 'middle',
                            minCellHeight: 8
                        },
                        styles: {
                            fontSize: 7.5,
                            cellPadding: 2,
                            lineColor: [200, 200, 200],
                            lineWidth: 0.1,
                            textColor: [50, 50, 50],
                            valign: 'middle'
                        },
                        columnStyles: {
                            0: { cellWidth: 18, halign: 'center' }, // Segment
                            1: { cellWidth: 55, halign: 'center' }, // From Elevation
                            2: { cellWidth: 45, halign: 'center', fontStyle: 'bold' }, // Max Allowable Thickness
                            3: { cellWidth: 'auto', halign: 'left' }  // Application Rule
                        },
                        didDrawPage: (data: any) => {
                            if (data.pageNumber > 1) addHeader(data.pageNumber);
                        },
                        margin: { top: 35, bottom: 20, left: 10, right: 10 },
                    });

                    currentY = (doc as any).lastAutoTable.finalY + 8;
                }
            }
        }

        const finalY = (doc as any).lastAutoTable?.finalY ?? (currentY);
        if (config?.reviewedBy || config?.approvedBy) {
            let sigY = pageHeight - 38;
            if (finalY > sigY - 10) {
                doc.addPage();
                await addHeader(doc.getNumberOfPages());
                sigY = pageHeight - 38;
            }
            const contentWidth = pageWidth - 20;
            const sigW = contentWidth / 3;
            const drawSig = (label: string, name?: string, date?: string, lx: number = 10) => {
                doc.setDrawColor(7, 78, 136); doc.setLineWidth(0.1);
                doc.rect(lx, sigY, sigW - 2, 18);
                if (!isPrintFriendly) {
                    doc.setFillColor(7, 78, 136);
                    doc.rect(lx, sigY, sigW - 2, 4.5, "F");
                    doc.setTextColor(255);
                } else {
                    doc.setTextColor(7, 78, 136);
                }
                doc.setFontSize(7); doc.setFont("helvetica", "bold");
                doc.text(label, lx + 2, sigY + 3.5);
                doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
                doc.text(`Name: ${name || ""}`, lx + 2, sigY + 10);
                doc.text(`Date: ${date || ""}`, lx + 2, sigY + 13.5);
                doc.text("Signature:", lx + 2, sigY + 17);
            };

            drawSig('PREPARED BY', config.preparedBy?.name, config.preparedBy?.date, 10);
            drawSig('REVIEWED BY', config.reviewedBy?.name, config.reviewedBy?.date, 10 + sigW);
            drawSig('APPROVED BY', config.approvedBy?.name, config.approvedBy?.date, 10 + (sigW * 2));
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
            applyWatermarkAndSignaturesGlobal(doc, config);
            return doc.output('blob');
        } else {
            applyWatermarkAndSignaturesGlobal(doc, config);
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
