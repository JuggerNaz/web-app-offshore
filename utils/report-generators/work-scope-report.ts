
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportConfig } from "../pdf-generator";

const loadImage = (url: string): Promise<{ data: string; width: number; height: number; } | null> => {
    return new Promise((resolve) => {
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

        try {
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const data = imageData.data;
            const width = img.width;
            const height = img.height;
            
            const isWhite = (i: number) => data[i] > 230 && data[i+1] > 230 && data[i+2] > 230 && data[i+3] > 0;
            
            const stack: {x: number, y: number}[] = [];
            const visited = new Uint8Array(width * height);
            
            const pushIfWhite = (x: number, y: number) => {
                if (x < 0 || x >= width || y < 0 || y >= height) return;
                const idx = y * width + x;
                if (!visited[idx]) {
                    const p = idx * 4;
                    if (isWhite(p)) {
                        visited[idx] = 1;
                        stack.push({x, y});
                    }
                }
            };
            
            for (let x = 0; x < width; x++) { pushIfWhite(x, 0); pushIfWhite(x, height - 1); }
            for (let y = 0; y < height; y++) { pushIfWhite(0, y); pushIfWhite(width - 1, y); }
            
            while (stack.length > 0) {
                const pt = stack.pop();
                if (!pt) continue;
                const {x, y} = pt;
                const p = (y * width + x) * 4;
                data[p + 3] = 0; 
                
                pushIfWhite(x + 1, y);
                pushIfWhite(x - 1, y);
                pushIfWhite(x, y + 1);
                pushIfWhite(x, y - 1);
            }
            
            // Edge smoothing
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const p = (y * width + x) * 4;
                    if (data[p + 3] !== 0) {
                        const hasTransparentNeighbor = 
                            data[((y)*width + x - 1)*4 + 3] === 0 ||
                            data[((y)*width + x + 1)*4 + 3] === 0 ||
                            data[((y - 1)*width + x)*4 + 3] === 0 ||
                            data[((y + 1)*width + x)*4 + 3] === 0;
                        if (hasTransparentNeighbor) {
                            const avgColor = (data[p] + data[p+1] + data[p+2]) / 3;
                            if (avgColor > 200) {
                                data[p+3] = Math.max(0, 255 - (avgColor - 180) * 3); 
                            }
                        }
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
        } catch(e) { console.error("Canvas transparency error", e); }

                resolve({ data: canvas.toDataURL("image/png"), width: img.width, height: img.height });
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
    });
};

const drawLogo = (doc: any, logo: any, maxW: number, maxH: number, x: number, y: number, alignX = 'left', alignY = 'center') => {
    if (!logo || !logo.data) return;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    let dx = x;
    let dy = y;
    if (alignX === 'right') dx = x + maxW - w;
    if (alignX === 'center') dx = x + (maxW - w) / 2;
    if (alignY === 'center') dy = y + (maxH - h) / 2;
    if (alignY === 'bottom') dy = y + maxH - h;
    doc.addImage(logo.data, 'PNG', dx, dy, w, h);
};

interface JobPackData {
    id: number;
    name: string;
    status: string;
    metadata: {
        istart?: string;
        iend?: string;
        contrac?: string;
        contract_ref?: string;
        contractor_ref?: string;
        vessel?: string;
        vessel_history?: Array<{ name: string; date: string }>;
        site_hrs?: number;
        plantype?: string;
        tasktype?: string;
        idesc?: string;
        remarks?: string;
        structures?: Array<{ id: number; type: string; title: string }>;
        inspections?: Record<string, Array<{ id: number; code: string; name: string }>> | Array<{ id: number; code: string; name: string }>;
        jobTypes?: Record<string, string>;
    }
}

interface SOWData {
    id: number;
    items: Array<{
        id: number;
        component_qid: string;
        component_name: string;
        inspection_type_code: string;
        inspection_type_name: string;
        report_number?: string;
        description?: string;
        elevation_required?: boolean;
        elevation_data?: Array<{ start: number; end: number; status?: string }>; // Assuming status is tracked here
    }>;
    report_numbers?: Array<{
        number: string;
        date: string;
        contractor_ref?: string;
    }>;
}

const fetchInspectionTypes = async (): Promise<any[]> => {
    try {
        const res = await fetch(`/api/inspection-type?pageSize=1000`);
        const json = await res.json();
        return json.data || [];
    } catch (e) {
        return [];
    }
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

export const generateWorkScopeReport = async (
    jobPack: JobPackData,
    structure: any,
    sowData: SOWData,
    companySettings?: any,
    config?: ReportConfig
) => {
    // Landscape Mode
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // Fetch Inspection Types for lookup
    const inspectionTypes = await fetchInspectionTypes();
    const inspectionTypeMap: Record<number, string> = {};
    const inspectionTypeNameMap: Record<number, string> = {};
    if (inspectionTypes && inspectionTypes.length > 0) {
        inspectionTypes.forEach((t: any) => {
            inspectionTypeMap[t.id] = t.code;
            inspectionTypeNameMap[t.id] = t.name;
        });
    }

    // Enrich SOW Data if codes are missing
    sowData.items.forEach(item => {
        if (!item.inspection_type_code && (item as any).inspection_type_id) {
            const id = (item as any).inspection_type_id;
            if (inspectionTypeMap[id]) item.inspection_type_code = inspectionTypeMap[id];
            if (inspectionTypeNameMap[id]) item.inspection_type_name = inspectionTypeNameMap[id];
        }
    });

    // Header Colors
    const headerBlue: [number, number, number] = [26, 54, 93];
    const sectionBlue: [number, number, number] = [44, 82, 130];
    const subHeaderGrey: [number, number, number] = [240, 240, 240];
    const isPrintFriendly = config?.printFriendly === true;

    // -- HEADER GENERATION Helper --
    const drawHeader = async (pageNo: number) => {
        if (isPrintFriendly) {
            // Print-Friendly: White background with light gray border
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.rect(0, 0, pageWidth, 28);
        } else {
            // Normal: Dark Blue Filled Background
            doc.setFillColor(...headerBlue);
            doc.rect(0, 0, pageWidth, 28, "F");
        }

        // Logo
        if (companySettings?.logo_url) {
            try {
                const logoData = await loadImage(companySettings.logo_url);
                drawLogo(doc, logoData, 16, 16, pageWidth - 24, 5, 'right', 'center');
            } catch (error) {
                if (!isPrintFriendly) {
                    doc.setDrawColor(255, 255, 255);
                    doc.rect(pageWidth - 25, 4, 18, 18);
                }
            }
        }

        // Company & Dept
        doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(companySettings?.company_name || "NasQuest Resources Sdn Bhd", 10, 9);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(companySettings?.department_name || "Engineering Department", 10, 14);

        // Title
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("WORK SCOPE REPORT", 10, 20);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        // Platform removed from header as per request
        // Report Number in Header
        if (config?.reportNoPrefix) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
            doc.text(`${config.reportNoPrefix}-${config.reportYear}`, pageWidth - 10, 24, { align: "right" });
        }
    };

    // We should pre-fetch contractor for the header usage
    const contractor = jobPack.metadata?.contrac ? await fetchContractorDetails(jobPack.metadata.contrac) : { name: "N/A", address: "" };

    // Group items by Report Number
    const groupedItems: Record<string, typeof sowData.items> = {};
    const reportMeta: Record<string, any> = {};

    sowData.report_numbers?.forEach(r => {
        groupedItems[r.number] = [];
        reportMeta[r.number] = r;
    });

    sowData.items.forEach(item => {
        const rpt = item.report_number || "Pending Assignment";
        if (!groupedItems[rpt]) groupedItems[rpt] = [];
        groupedItems[rpt].push(item);
    });

    const reportGroups = Object.keys(groupedItems).sort();

    if (reportGroups.length === 0) {
        await drawHeader(1);
    }

    let isFirstPage = true;

    for (const reportNum of reportGroups) {
        const rawItems = groupedItems[reportNum];
        if (rawItems.length === 0 && reportNum === "Pending Assignment") {
            if (reportGroups.length > 1) continue;
        }

        if (!isFirstPage) {
            doc.addPage("a4", "landscape");
        }
        isFirstPage = false;

        await drawHeader(doc.getNumberOfPages());

        let yPos = 35;

        // Custom Report Ref Sub-Header (Moved from Header)
        if (reportNum !== "Pending Assignment") {
            doc.setFillColor(240, 240, 240); // Light Grey
            doc.rect(10, yPos, pageWidth - 20, 8, "F");
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`Scope Ref: ${reportNum}`, 14, yPos + 5.5);
            yPos += 12;
        }

        // ===== JOB PACK DETAILS SECTION =====
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

        const leftColX = 12;
        const rightColX = pageWidth / 2 + 5;
        const valueOffset = 35;
        const rightValueOffset = 35;

        // Row 1
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold"); doc.text("Job Pack Name:", leftColX, yPos);
        doc.setFont("helvetica", "normal"); doc.text(jobPack.name, leftColX + valueOffset, yPos);

        doc.setFont("helvetica", "bold"); doc.text("Status:", rightColX, yPos);
        doc.setFont("helvetica", "normal"); doc.text(jobPack.status || "OPEN", rightColX + rightValueOffset, yPos);
        yPos += 6;

        // Row 2
        doc.setFont("helvetica", "bold"); doc.text("Start Date:", leftColX, yPos);
        doc.setFont("helvetica", "normal"); doc.text(jobPack.metadata?.istart || "N/A", leftColX + valueOffset, yPos);

        doc.setFont("helvetica", "bold"); doc.text("Contract Ref:", rightColX, yPos);
        doc.setFont("helvetica", "normal"); doc.text(jobPack.metadata?.contract_ref || "N/A", rightColX + rightValueOffset, yPos);
        yPos += 6;

        // Row 3 (Contractor Ref)
        doc.setFont("helvetica", "bold"); doc.text("Contractor Ref:", rightColX, yPos);
        doc.setFont("helvetica", "normal"); doc.text(jobPack.metadata?.contractor_ref || "N/A", rightColX + rightValueOffset, yPos);
        yPos += 6;

        // Contractor, Platform & Vessel
        const contractorY = yPos + 4;
        doc.setDrawColor(220, 220, 220);
        doc.line(10, contractorY, pageWidth - 10, contractorY);

        const contentStart = contractorY + 5;

        // Col 1: Contractor
        doc.setFont("helvetica", "bold"); doc.text("Contractor:", leftColX, contentStart + 4);
        doc.setFont("helvetica", "normal"); doc.text(contractor.name, leftColX + valueOffset, contentStart + 4);

        // Logo under contractor name
        let logoH = 0;
        if (contractor.logoUrl) {
            try {
                const cLogo = await loadImage(contractor.logoUrl);
                drawLogo(doc, cLogo, 20, 20, leftColX, contentStart + 9, 'left', 'middle');
                logoH = 20;
            } catch (e) { }
        }

        // Col 2: Vessel (Right side)
        // Platform removed as per request

        // Vessel Logic
        doc.setFont("helvetica", "bold"); doc.text("Vessel:", rightColX, contentStart + 4);
        doc.setFont("helvetica", "normal");

        // Check for history
        if (jobPack.metadata?.vessel_history && jobPack.metadata.vessel_history.length > 0) {
            const history = jobPack.metadata.vessel_history;
            let vY = contentStart + 4;
            history.forEach((h, idx) => {
                const vText = `${h.name} (${h.date})`;
                doc.text(vText, rightColX + rightValueOffset, vY);
                vY += 4;
            });
            // Calculate extra height needed
            yPos = Math.max(contentStart + 14 + logoH + 5, contentStart + (history.length * 4) + 10);
        } else {
            const vesselStr = jobPack.metadata?.vessel || "N/A";
            doc.text(vesselStr, rightColX + rightValueOffset, contentStart + 4);
            yPos = Math.max(contentStart + 14 + logoH + 5, contentStart + 24);
        }



        doc.setDrawColor(200, 200, 200);
        doc.rect(10, 35, pageWidth - 20, yPos - 35);

        yPos += 10;

        // ===== PROCESS ITEMS BY ELEVATION =====
        // 1. Identify all unique inspection types used in the ENTIRE Job Pack
        const allInspectionTypes = Array.from(new Set(sowData.items.map(i => i.inspection_type_code))).sort();

        // 2. Process items to handle Elevation splitting
        // We need to group items by Component. If an item has elevation_data, it splits into sub-items.
        // But the request asks to "Sub header the elevation and then the components below that elevation".
        // This implies we group primarily by Elevation Range? 
        // Or group by component and show its elevation ranges?
        // "Split the section by elevation blocks" -> 
        // Assuming: Group 1: Elevation +10m to +20m
        //             - Component A [GVI] [CVI] ...
        //             - Component B [GVI] ...
        // This is tricky if components span multiple ranges or have different arbitrary ranges.
        // Alternative interpretation: For each component, list its inspection requirements. 
        // If elevation is involved, list the specific ranges.
        // But user said: "sub header the elevation and then the components below that elevation". 
        // This suggests grouping by elevation zones.
        // HOWEVER, user data (SOW item) has `elevation_data` array: [{start: 0, end: 10}, {start:10, end:20}].
        // Let's create "Virtual Rows" for the table.
        // Strategy: 
        // Map all unique Elevation Ranges found? Or just arbitrary grouping?
        // Most likely: "EL (+) 20.000m - (+) 10.000m" -> List components within.
        // Since we blindly have ranges, let's group by unique string representation of range "start-end"
        // If no elevation, "General / Full Length"

        // ===== PROCESSING LOGIC Refactored for Multi-Structure Support =====

        // 1. Group items by Structure
        // If single structure, all items naturally belong to it.
        // If "ALL STRUCTURES", items should have 'structure_title' injected.
        const groupedByStructure: Record<string, typeof rawItems> = {};

        rawItems.forEach(item => {
            // Use injected title, or fallback to main structure name
            const sTitle = (item as any).structure_title || structure.str_name || "Unknown Structure";
            if (!groupedByStructure[sTitle]) groupedByStructure[sTitle] = [];
            groupedByStructure[sTitle].push(item);
        });

        const structureNames = Object.keys(groupedByStructure).sort();

        // 2. Iterate each Structure
        for (const structName of structureNames) {
            const structItems = groupedByStructure[structName];

            // --- Structure Sub-Header ---
            // Only strictly needed if we have multiple structures OR if user explicitly requested sub-headers "for all structure"
            // We'll draw it to be safe and consistent.

            // Avoid drawing header if we are at bottom of page
            if (yPos > pageHeight - 40) {
                doc.addPage("a4", "landscape");
                await drawHeader(doc.getNumberOfPages());
                yPos = 35;
            }

            // Draw Structure Blue Band
            if (isPrintFriendly) {
                doc.setFillColor(240, 240, 240);
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.rect(10, yPos, pageWidth - 20, 8, "FD");
                doc.setTextColor(0, 0, 0);
            } else {
                doc.setFillColor(30, 41, 59); // Dark Slate Blue
                doc.rect(10, yPos, pageWidth - 20, 8, "F");
                doc.setTextColor(255, 255, 255);
            }
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`STRUCTURE: ${structName.toUpperCase()}`, 12, yPos + 5.5);
            yPos += 12;

            // 3. Group by Elevation (Existing Logic, scoped to structItems)
            const groupedByElevation: Record<string, any[]> = {};

            structItems.forEach(item => {
                if (item.elevation_required && item.elevation_data && item.elevation_data.length > 0) {
                    item.elevation_data.forEach((range: any) => {
                        const key = `EL (+) ${range.end.toFixed(3)}m - (+) ${range.start.toFixed(3)}m`;
                        if (!groupedByElevation[key]) groupedByElevation[key] = [];
                        groupedByElevation[key].push({ ...item, _range: range });
                    });
                } else {
                    const key = "General / Full Length";
                    if (!groupedByElevation[key]) groupedByElevation[key] = [];
                    groupedByElevation[key].push(item);
                }
            });

            const elevationKeys = Object.keys(groupedByElevation).sort((a, b) => {
                if (a === "General / Full Length") return -1;
                if (b === "General / Full Length") return 1;
                return b.localeCompare(a);
            });

            // 4. Draw Matrix for each Elevation
            for (const elevKey of elevationKeys) {
                const rowsInBlock = groupedByElevation[elevKey];

                // Sub-Header for Elevation
                const uniqueComps = new Set(rowsInBlock.map(r => r.component_qid)).size;

                // Check space
                if (yPos > pageHeight - 40) {
                    doc.addPage("a4", "landscape");
                    await drawHeader(doc.getNumberOfPages());
                    yPos = 35;
                }

                doc.setFillColor(240, 240, 240); // Grey header
                doc.rect(10, yPos, pageWidth - 20, 8, "F");
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0);
                doc.text(`${elevKey}`, 12, yPos + 5.5);

                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.text(`Components: ${uniqueComps} | Total Tasks: ${rowsInBlock.length}`, pageWidth - 15, yPos + 5.5, { align: 'right' });

                yPos += 8;

                // Prepare Matrix Data
                const compMap: Record<string, { qid: string; inspections: Record<string, any> }> = {};

                rowsInBlock.forEach(r => {
                    if (!compMap[r.component_qid]) {
                        compMap[r.component_qid] = {
                            qid: r.component_qid,
                            inspections: {}
                        };
                    }
                    compMap[r.component_qid].inspections[r.inspection_type_code] = {
                        status: 'PENDING',
                        selected: true
                    };
                });

                const compRows = Object.values(compMap).sort((a, b) => a.qid.localeCompare(b.qid));

                const tableHead = ['Component ID', ...allInspectionTypes];
                const tableBody = compRows.map(c => {
                    const row = [c.qid];
                    allInspectionTypes.forEach(type => {
                        const info = c.inspections[type];
                        if (info && info.selected) {
                            row.push({ content: 'X', styles: { halign: 'center' }, _status: info.status } as any);
                        } else {
                            row.push("");
                        }
                    });
                    return row;
                });

                // Calculate dynamic widths for matrix
                const fixedWidth = 40;
                const remainingWidth = (pageWidth - 20) - fixedWidth;
                const colWidth = remainingWidth / Math.max(1, allInspectionTypes.length);

                autoTable(doc, {
                    startY: yPos,
                    head: [tableHead],
                    body: tableBody,
                    theme: 'grid',
                    headStyles: {
                        fillColor: isPrintFriendly ? [240, 240, 240] : sectionBlue,
                        textColor: isPrintFriendly ? [0, 0, 0] : [255, 255, 255],
                        fontStyle: 'bold',
                        fontSize: 8,
                        halign: 'center',
                        valign: 'middle'
                    },
                    styles: {
                        fontSize: 8,
                        cellPadding: 2,
                        lineColor: [200, 200, 200],
                        lineWidth: 0.1,
                    },
                    columnStyles: {
                        0: { cellWidth: 40, halign: 'left' },
                    },
                    didParseCell: (data: any) => {
                        if (data.section === 'head' && data.column.index >= 1) {
                            data.cell.styles.cellWidth = colWidth;
                            data.cell.styles.textColor = [255, 255, 255];
                            data.cell.styles.fontSize = 7;
                        }
                        if (data.section === 'body' && data.column.index >= 1) {
                            data.cell.styles.cellWidth = colWidth;
                        }
                    },
                    didDrawCell: (data) => {
                        if (data.section === 'body' && data.column.index >= 1) {
                            const cell = data.cell;
                            const raw = cell.raw as any;
                            if (raw && raw._status) {
                                const boxSize = 3;
                                const cx = cell.x + (cell.width / 2) - (boxSize / 2);
                                const cy = cell.y + (cell.height / 2) - (boxSize / 2);

                                doc.setDrawColor(100, 100, 100);

                                if (raw._status === 'COMPLETED') {
                                    doc.setFillColor(0, 128, 0);
                                    doc.rect(cx, cy, boxSize, boxSize, 'FD');
                                    doc.setDrawColor(255, 255, 255);
                                    doc.lines([[1, 1], [-0.5, 1]], cx + 0.5, cy + 1, [0.4, 0.4]);
                                } else if (raw._status === 'INCOMPLETE') {
                                    doc.setFillColor(255, 165, 0);
                                    doc.rect(cx, cy, boxSize, boxSize, 'FD');
                                } else {
                                    doc.setFillColor(255, 255, 255);
                                    doc.rect(cx, cy, boxSize, boxSize, 'S');
                                    doc.setDrawColor(0, 0, 0);
                                    doc.setLineWidth(0.3);
                                    doc.line(cx + 0.5, cy + 1.5, cx + 1.2, cy + 2.2);
                                    doc.line(cx + 1.2, cy + 2.2, cx + 2.5, cy + 0.5);
                                }
                            }
                        }
                    },
                    willDrawCell: (data) => {
                        if (data.section === 'body' && data.column.index >= 1) {
                            const raw = data.cell.raw as any;
                            if (raw && raw._status) {
                                data.cell.text = [];
                            }
                        }
                    }
                });

                yPos = (doc as any).lastAutoTable.finalY + 10;
            }

            // Extra spacing between structures
            yPos += 5;
        }
    }

    if (config?.returnBlob) {
        return doc.output('blob');
    }
    return doc;
};
