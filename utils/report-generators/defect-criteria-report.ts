import { jsPDF } from "jspdf";
import autoTablePlugin from "jspdf-autotable";

import { loadLogoWithTransparency, drawLogo, draw3SectionHeader, applyWatermarkAndSignaturesGlobal , formatPdfDate, normalizeReportRecords , applyRecordCellStyling, formatReportFindingText , REPORT_FOOTER_APP_TEXT } from "./shared-logo";

interface ReportConfig {
    sowReportNo?: string;
    reportNoPrefix?: string;
    reportYear?: string;
    jobPackId?: string | number;
    contractorLogoUrl?: string;
    contractorLogo?: string;
    jobPack?: any;
    preparedBy?: { name: string; date: string; position?: string };
    reviewedBy?: { name: string; date: string; position?: string };
    approvedBy?: { name: string; date: string; position?: string };
    watermark?: { enabled: boolean; text: string; transparency?: number; color?: string };
    showContractorLogo?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
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

        // Preload logos
        let clientLogoData: any = null;
        if (companySettings?.logo_url) {
            try { clientLogoData = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) {}
        }

        // Resolve Contractor Logo URL
        let contractorLogoUrl = (config as any)?.contractorLogoUrl || 
                                (config as any)?.contractorLogo || 
                                (config as any)?.headerData?.contractorLogoUrl || 
                                (config as any)?.headerData?.contrLogoUrl || 
                                (companySettings as any)?.contractorLogoUrl || 
                                (companySettings as any)?.contractor_logo_url;

        // 1. If not yet found, check jobPack passed in config or headerData
        const jobPackObj = (config as any)?.jobPack || (config as any)?.headerData?.jobPack || (config as any)?.headerData?.jobpack;
        const contractorId = (config as any)?.contractorId || (config as any)?.headerData?.contractorId || jobPackObj?.metadata?.contrac || (jobPackObj as any)?.contractor_id;

        if (!contractorLogoUrl && contractorId) {
            try {
                const contrRes = await fetch(`/api/libraries/contractors?id=${contractorId}`);
                if (contrRes.ok) {
                    const contrData = await contrRes.json();
                    if (contrData?.logo_url) contractorLogoUrl = contrData.logo_url;
                }
            } catch (_) {}
            if (!contractorLogoUrl) {
                try {
                    const cRes = await fetch(`/api/library/CONTR_NAM`);
                    if (cRes.ok) {
                        const cJson = await cRes.json();
                        const cList = Array.isArray(cJson?.data) ? cJson.data : (Array.isArray(cJson) ? cJson : []);
                        const cLow = String(contractorId).toLowerCase();
                        const found = cList.find((c: any) =>
                            String(c.lib_id).toLowerCase() === cLow ||
                            String(c.id).toLowerCase() === cLow ||
                            String(c.code || "").toLowerCase() === cLow ||
                            String(c.lib_desc || "").toLowerCase() === cLow
                        );
                        if (found?.logo_url) contractorLogoUrl = found.logo_url;
                    }
                } catch (_) {}
            }
        }

        // 2. If still not found and jobPackId is available, fetch jobpack to get contractor ID
        const jobPackId = config?.jobPackId || (config as any)?.headerData?.jobPackId;
        if (!contractorLogoUrl && jobPackId) {
            try {
                const jpRes = await fetch(`/api/jobpack/${jobPackId}`);
                if (jpRes.ok) {
                    const jpData = await jpRes.json();
                    const jp = jpData?.data || jpData;
                    const cId = jp?.metadata?.contrac || jp?.contractor_id;
                    if (cId) {
                        const contrRes = await fetch(`/api/libraries/contractors?id=${cId}`);
                        if (contrRes.ok) {
                            const contrData = await contrRes.json();
                            if (contrData?.logo_url) contractorLogoUrl = contrData.logo_url;
                        }
                        if (!contractorLogoUrl) {
                            const cRes = await fetch(`/api/library/CONTR_NAM`);
                            if (cRes.ok) {
                                const cJson = await cRes.json();
                                const cList = Array.isArray(cJson?.data) ? cJson.data : (Array.isArray(cJson) ? cJson : []);
                                const cLow = String(cId).toLowerCase();
                                const found = cList.find((c: any) =>
                                    String(c.lib_id).toLowerCase() === cLow ||
                                    String(c.id).toLowerCase() === cLow ||
                                    String(c.code || "").toLowerCase() === cLow
                                );
                                if (found?.logo_url) contractorLogoUrl = found.logo_url;
                            }
                        }
                    }
                }
            } catch (_) {}
        }

        // 3. Fallback: fetch any active contractor with a valid logo from library
        if (!contractorLogoUrl) {
            try {
                const contrRes = await fetch('/api/libraries/contractors');
                if (contrRes.ok) {
                    const contrJson = await contrRes.json();
                    const contrList = Array.isArray(contrJson) ? contrJson : (contrJson?.data || []);
                    const found = contrList.find((c: any) => Boolean(c.logo_url));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                }
            } catch (_) {}
        }
        if (!contractorLogoUrl) {
            try {
                const cRes = await fetch('/api/library/CONTR_NAM');
                if (cRes.ok) {
                    const cJson = await cRes.json();
                    const cList = Array.isArray(cJson?.data) ? cJson.data : (Array.isArray(cJson) ? cJson : []);
                    const found = cList.find((c: any) => Boolean(c.logo_url));
                    if (found?.logo_url) contractorLogoUrl = found.logo_url;
                }
            } catch (_) {}
        }

        let contractorLogoData: any = null;
        if (contractorLogoUrl) {
            try { contractorLogoData = await loadLogoWithTransparency(contractorLogoUrl); } catch (_) {}
        }

        const rawReportNo = (config as any)?.sowReportNo || (config as any)?.sow_report_no || config?.reportNoPrefix || (config?.reportYear ? `${config.reportNoPrefix || ''}-${config.reportYear}` : "") || companySettings?.serial_no || "N/A";
        // --- REPORT GENERATION helper ---
        const addHeader = (pageNum: number) => {
            draw3SectionHeader(doc, {
                reportTitle: "Defect Criteria Specification Report",
                reportNo: rawReportNo,
                companySettings,
                config,
                contractorLogoData,
                clientLogoData,
                isPrintFriendly,
                margin: 10,
                headerY: 7,
                headerH: 25,
                orientation: "portrait"
            });
        };

        const sigPages = new Set<number>();

        const addFooter = (pageNum: number, pageCount: number) => {
            // Only draw horizontal divider line on pages that do NOT have the signatory boxes,
            // so the 3 signatory cards remain completely detached with no connecting lines across the bottom gaps
            if (!sigPages.has(pageNum)) {
                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.2);
                doc.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);
            }

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

        const signatoryH = 21; // Standard box height (21mm)
        const signatoryBottomY = pageHeight - 10 - 0.5; // 286.5mm
        const sigTopY = signatoryBottomY - signatoryH; // 265.5mm
        const contentWidth = pageWidth - 20;
        const gap = 2;
        const colW = (contentWidth - gap * 2) / 3;
        const headerBarH = 4.5;

        const drawSignatories = () => {
            const y = sigTopY;
            const names = [
                { title: "PREPARED BY", name: config?.preparedBy?.name, position: config?.preparedBy?.position, date: config?.preparedBy?.date },
                { title: "REVIEWED BY", name: config?.reviewedBy?.name, position: config?.reviewedBy?.position, date: config?.reviewedBy?.date },
                { title: "APPROVED BY", name: config?.approvedBy?.name, position: config?.approvedBy?.position, date: config?.approvedBy?.date }
            ];

            names.forEach((p, idx) => {
                const x = 10 + idx * (colW + gap);

                // 1. Box Outer Border - closed individual rectangle with no connecting lines across the gaps
                doc.setDrawColor(7, 78, 136);
                doc.setLineWidth(0.1);
                doc.rect(x, y, colW, signatoryH);

                // 2. Blue Column Header Bar (like in Pic 1)
                if (!isPrintFriendly) {
                    doc.setFillColor(7, 78, 136);
                    doc.rect(x, y, colW, headerBarH, "F");
                    doc.setTextColor(255, 255, 255);
                } else {
                    doc.setFillColor(240, 240, 240);
                    doc.rect(x, y, colW, headerBarH, "F");
                    doc.setTextColor(7, 78, 136);
                }

                doc.setFont("helvetica", "bold");
                doc.setFontSize(7);
                doc.text(p.title, x + 2.5, y + 3.2);

                // 3. Space for signature:
                // Dedicated blank signing space from (y + headerBarH) down to (nameY - 2)

                // 4. Content fields: Name, Position, Date moved lower with closer spacing
                doc.setTextColor(30, 41, 59);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(6.5);

                const labelX = x + 2.5;
                const valueX = x + 15;

                const lineSpacing = 2.6; // closer spacing with each other
                const dateY = signatoryBottomY - 1.5; // moved lower, neatly placed near bottom border
                const posY = dateY - lineSpacing; // signatoryBottomY - 4.1
                const nameY = posY - lineSpacing; // signatoryBottomY - 6.7

                // Name:
                doc.text("Name:", labelX, nameY);
                if (p.name) doc.text(p.name, valueX, nameY);

                // Position:
                doc.text("Position:", labelX, posY);
                if (p.position) doc.text(p.position, valueX, posY);

                // Date:
                doc.text("Date:", labelX, dateY);
                if (p.date) doc.text(formatPdfDate(p.date), valueX, dateY);
            });
        };

        for (let procIdx = 0; procIdx < procedures.length; procIdx++) {
            const proc = procedures[procIdx];
            const rules = allRules[proc.id] || [];
            hasContent = true;

            if (procIdx > 0) {
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

            currentY = (doc as any).lastAutoTable?.finalY ?? currentY;
        }

        // --- SECTION: Active Marine Growth Inspection (MGI) Profile Settings ---
        currentY = (doc as any).lastAutoTable?.finalY ?? currentY;
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

        // Draw Signatures block at the end of the report if enabled (standalone report mode; omitted in final datasheet)
        if (config?.showSignatures !== false && hasContent) {
            const finalReportY = (doc as any).lastAutoTable?.finalY ?? currentY;
            if (finalReportY > sigTopY - 5) {
                doc.addPage();
                addHeader(doc.getNumberOfPages());
            }
            sigPages.add(doc.getNumberOfPages());
            drawSignatories();
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
