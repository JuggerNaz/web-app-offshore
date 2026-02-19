
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Type Interfaces
interface JobPackData {
    name: string;
    description?: string;
    status: string;
    metadata: {
        istart?: string;
        iend?: string;
        contract_ref?: string;
        client_rep?: string;
        contrac?: string;
        vessel?: string;
        vessel_history?: { name: string; date: string }[];
    };
}

interface SOWData {
    items: any[];
    report_numbers: any[];
}

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
    printFriendly?: boolean;
}

// Helpers
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
                resolve(canvas.toDataURL("image/png"));
            } else {
                reject(new Error("Canvas context is null"));
            }
        };
        img.onerror = (err) => reject(err);
    });
};

const fetchInspectionTypes = async (): Promise<any[]> => {
    try {
        const res = await fetch(`/api/inspection-type?pageSize=1000`);
        const json = await res.json();
        return json.data || [];
    } catch (e) {
        return [];
    }
};

const drawPieChart = (doc: jsPDF, centerX: number, centerY: number, radius: number, data: { value: number; color: [number, number, number] }[]) => {
    let currentAngle = 0;
    const total = data.reduce((acc, d) => acc + d.value, 0);

    data.forEach(slice => {
        const sliceAngle = (slice.value / total) * 2 * Math.PI;

        doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);

        const steps = Math.max(10, Math.floor(sliceAngle * 20));
        if (slice.value === total && total > 0) {
            doc.circle(centerX, centerY, radius, 'F');
        } else if (slice.value > 0) {
            const path: any[] = [];
            path.push({ op: "m", c: [centerX, centerY] });

            for (let i = 0; i <= steps; i++) {
                const angle = currentAngle + (sliceAngle * i / steps);
                const px = centerX + radius * Math.cos(angle);
                const py = centerY + radius * Math.sin(angle);
                path.push({ op: "l", c: [px, py] });
            }

            path.push({ op: "l", c: [centerX, centerY] });
            path.push({ op: "f" });

            // @ts-ignore
            doc.path(path);
        }

        currentAngle += sliceAngle;
    });
};

export const generateWorkScopeIncompleteReport = async (
    jobPack: JobPackData,
    structure: any,
    sowData: SOWData,
    companySettings?: any,
    config?: ReportConfig
) => {
    // A4 Portrait
    const doc = new jsPDF({ orientation: "portrait" });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    // --- Colors ---
    const headerBlue: [number, number, number] = [26, 54, 93];
    const completedColor: [number, number, number] = [229, 231, 235]; // Light Grey (Background for complete)
    const incompleteColor: [number, number, number] = [220, 38, 38]; // Red

    const isPrintFriendly = config?.printFriendly === true;

    // --- 1. Draw Header ---
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
                doc.addImage(logoData, 'PNG', pageWidth - 24, 5, 16, 16);
            } catch (error) { }
        }

        // Company
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
        doc.text("WORK SCOPE INCOMPLETE STATUS", 10, 20);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`Platform: ${structure.str_name || (structure.id === 'all' ? 'ALL STRUCTURES' : 'N/A')}`, 10, 24);

        // Report No
        if (config?.reportNoPrefix) {
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255, isPrintFriendly ? 0 : 255);
            doc.text(`${config.reportNoPrefix}-${config.reportYear}`, pageWidth - 16, 26, { align: "center" });
        }

        // Page No
        if (config?.showPageNumbers) {
            doc.setTextColor(100, 100, 100);
            doc.text(`Page ${pageNo}`, pageWidth - 20, pageHeight - 10, { align: "right" });
        }
    };

    await drawHeader(1);
    let yPos = 35;

    // --- 2. Calculate Statistics ---

    const inspectionTypes = await fetchInspectionTypes();
    const typeMap: Record<string, string> = {};
    const typeNameMap: Record<string, string> = {};
    inspectionTypes.forEach(t => { typeMap[t.id] = t.code; typeNameMap[t.code] = t.name; });

    // Group items by Structure
    const groupedByStructure: Record<string, any[]> = {};
    let globalStats: Record<string, { total: number, incomplete: number }> = {};
    let grandTotal = 0;
    let grandIncomplete = 0;

    sowData.items.forEach(item => {
        // Determine Structure Key
        let sTitle = (item as any).structure_title;
        if (!sTitle) {
            sTitle = structure.str_name || "Structure";
        }
        if (structure.id !== 'all') {
            // Keep existing behavior if single structure selected
        }

        if (!groupedByStructure[sTitle]) groupedByStructure[sTitle] = [];
        groupedByStructure[sTitle].push(item);

        // Global Stats Calc
        let code = item.inspection_type_code;
        if (!code && (item as any).inspection_type_id) {
            code = typeMap[(item as any).inspection_type_id];
        }
        if (!code) code = "Unknown";

        if (!globalStats[code]) globalStats[code] = { total: 0, incomplete: 0 };
        globalStats[code].total++;
        grandTotal++;

        const status = (item.status || "").toUpperCase();
        // If NOT completed, it's incomplete
        if (!['COMPLETED', 'CLOSED', 'APPROVED', 'DONE'].includes(status)) {
            globalStats[code].incomplete++;
            grandIncomplete++;
        }
    });

    // --- 3. Draw Chart Section (Overall Incomplete) ---

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`Overall Incomplete Status`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    const chartRadius = 35;
    const chartX = pageWidth / 2;
    const chartY = yPos + chartRadius;

    const completed = grandTotal - grandIncomplete;
    // Pie: Red slice = Incomplete, Grey slice = Completed
    const chartData = [
        { value: grandIncomplete, color: incompleteColor },
        { value: completed, color: completedColor }
    ];

    if (grandTotal > 0) {
        drawPieChart(doc, chartX, chartY, chartRadius, chartData);
    } else {
        doc.text("No Items Found", chartX, chartY, { align: 'center' });
    }

    // Legend / Percentage Center
    const percentage = grandTotal > 0 ? Math.round((grandIncomplete / grandTotal) * 100) : 0;
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${percentage}%`, chartX, chartY + 2, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Incomplete", chartX, chartY + 8, { align: 'center' });

    yPos = chartY + chartRadius + 20;

    // --- 4. Detailed Breakdown Loop ---

    const structKeys = Object.keys(groupedByStructure).sort();

    for (const sKey of structKeys) {
        const structureItems = groupedByStructure[sKey];

        // Page Break Check
        if (yPos > pageHeight - 60) {
            doc.addPage();
            await drawHeader(doc.getNumberOfPages());
            yPos = 35;
        }

        // Draw Section Header if Multi-Structure
        if (structure.id === 'all') {
            if (isPrintFriendly) {
                doc.setFillColor(240, 240, 240);
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.rect(14, yPos, pageWidth - 28, 8, "FD");
                doc.setTextColor(0, 0, 0);
            } else {
                doc.setFillColor(30, 41, 59); // Dark Slate Blue
                doc.rect(14, yPos, pageWidth - 28, 8, "F");
                doc.setTextColor(255, 255, 255);
            }
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`STRUCTURE: ${sKey.toUpperCase()}`, 16, yPos + 5.5);
            yPos += 14;
        } else {
            if (structKeys.length === 1 && structKeys.indexOf(sKey) === 0) {
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text("Incomplete Breakdown by Inspection Type", 14, yPos);
                yPos += 10;
            }
        }

        // --- Group by Report Number (New Logic) ---
        const groupedByReport: Record<string, any[]> = {};
        structureItems.forEach(item => {
            const rpt = item.report_number || "Pending Assignment";
            if (!groupedByReport[rpt]) groupedByReport[rpt] = [];
            groupedByReport[rpt].push(item);
        });

        const reportKeys = Object.keys(groupedByReport).sort();

        for (const rptKey of reportKeys) {
            const items = groupedByReport[rptKey];

            // Compute Stats for this Report Group
            const groupStats: Record<string, { total: number, incomplete: number }> = {};
            items.forEach(item => {
                let code = item.inspection_type_code;
                if (!code && (item as any).inspection_type_id) {
                    code = typeMap[(item as any).inspection_type_id];
                }
                if (!code) code = "Unknown";

                if (!groupStats[code]) groupStats[code] = { total: 0, incomplete: 0 };
                groupStats[code].total++;

                const status = (item.status || "").toUpperCase();
                if (!['COMPLETED', 'CLOSED', 'APPROVED', 'DONE'].includes(status)) {
                    groupStats[code].incomplete++;
                }
            });

            // Check space
            if (yPos > pageHeight - 50) {
                doc.addPage();
                await drawHeader(doc.getNumberOfPages());
                yPos = 35;
            }

            // Draw Report Sub-Header
            const reportDisplay = rptKey === "Pending Assignment" ? "Items Pending Assignment" : `Report Ref: ${rptKey}`;

            doc.setFillColor(240, 240, 240); // Light Grey
            doc.rect(14, yPos, pageWidth - 28, 7, "F");
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(reportDisplay, 16, yPos + 5);
            yPos += 12;

            // Draw Table
            const statKeys = Object.keys(groupStats).sort();

            // Table Header
            const col1 = 14;
            const col2 = 60; // Bar
            const col3 = pageWidth - 40; // Value

            if (isPrintFriendly) {
                doc.setFillColor(240, 240, 240);
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.rect(col1 - 4, yPos - 5, pageWidth - 20, 8, "FD");
                doc.setTextColor(0, 0, 0);
            } else {
                doc.setFillColor(...headerBlue);
                doc.rect(col1 - 4, yPos - 5, pageWidth - 20, 8, "F");
                doc.setTextColor(255, 255, 255);
            }
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("Inspection Type", col1, yPos);
            doc.text("Incomplete Level", col2, yPos);
            doc.text("Status", col3, yPos);
            yPos += 10;

            for (let index = 0; index < statKeys.length; index++) {
                const code = statKeys[index];
                const s = groupStats[code];
                const pct = s.total > 0 ? (s.incomplete / s.total) : 0;
                const pctText = (pct * 100).toFixed(0) + "%";

                // Row Background
                if (index % 2 === 1) {
                    doc.setFillColor(245, 245, 245);
                    doc.rect(col1 - 4, yPos - 6, pageWidth - 20, 12, "F");
                }

                // 1. Label
                const name = typeNameMap[code] || code;
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.text(name, col1, yPos);

                doc.setFont("helvetica", "normal");
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 100);
                if (typeNameMap[code]) doc.text(code, col1, yPos + 3.5);

                // 2. Bar
                const barWidth = 80;
                const barHeight = 6;
                const barX = col2;
                const barY = yPos - 4;

                // Background (Grey)
                doc.setFillColor(230, 230, 230);
                doc.roundedRect(barX, barY, barWidth, barHeight, 1, 1, "F");

                // Fill (Red / Incomplete)
                if (pct > 0) {
                    doc.setFillColor(...incompleteColor);
                    doc.roundedRect(barX, barY, barWidth * pct, barHeight, 1, 1, "F");
                }

                // 3. Value
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text(`${pctText} (${s.incomplete}/${s.total})`, col3, yPos);

                yPos += 12;

                if (yPos > pageHeight - 30) {
                    doc.addPage();
                    await drawHeader(doc.getNumberOfPages());
                    yPos = 35;
                }
            }
            yPos += 5; // Spacing after table
        }
        yPos += 5; // Spacing after structure block
    }

    if (config?.returnBlob) {
        return doc.output('blob');
    }
    return doc;
};
