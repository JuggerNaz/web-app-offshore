
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

        // Draw Wedge using lines and curves not natively supported cleanly in all jsPDF versions without 'path' plugin,
        // but 'arc' or simple triangles work for approximation.
        // Actually, jsPDF has 'arc' method. But filling a wedge is tricky.
        // We will use the 'lines' method to draw the path: center -> outline point -> arc -> outline point -> center.
        // Approximate arc with small line segments for compatibility.

        const steps = Math.max(10, Math.floor(sliceAngle * 20)); // Steps per slice
        if (slice.value === total && total > 0) {
            doc.circle(centerX, centerY, radius, 'F');
        } else if (slice.value > 0) {
            const lines: any[] = [];
            // Start at center relative to current cursor (which we set to center)
            lines.push([0, 0]); // Move to center implied if we start there? No, lines are relative.

            // Start point on circumference
            // We need absolute path construction or carefully use lines.
            // Let's use `lines` with explicit path
            const startX = centerX;
            const startY = centerY;

            const path: any[] = [];
            path.push({ op: "m", c: [startX, startY] });

            // Calculate points
            for (let i = 0; i <= steps; i++) {
                const angle = currentAngle + (sliceAngle * i / steps);
                const px = centerX + radius * Math.cos(angle);
                const py = centerY + radius * Math.sin(angle);
                path.push({ op: "l", c: [px, py] });
            }

            path.push({ op: "l", c: [centerX, centerY] }); // Close back to center
            path.push({ op: "f" }); // Fill

            // Execute specialized drawing
            // @ts-ignore
            doc.path(path);
        }

        currentAngle += sliceAngle;
    });
};

export const generateWorkScopeStatusReport = async (
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

    // --- Header Colors & Fonts ---
    const headerBlue: [number, number, number] = [26, 54, 93];
    const sectionBlue: [number, number, number] = [65, 105, 225];
    const borderGrey: [number, number, number] = [200, 200, 200];
    const completedColor: [number, number, number] = [34, 197, 94]; // Green
    const pendingColor: [number, number, number] = [229, 231, 235]; // Light Grey
    const partialColor: [number, number, number] = [234, 179, 8]; // Yellow?

    // --- 1. Draw Header (Reused) ---
    const drawHeader = async (pageNo: number) => {
        // Top Blue Bar
        doc.setFillColor(...headerBlue);
        doc.rect(0, 0, pageWidth, 28, "F");

        // Logo
        if (companySettings?.logo_url) {
            try {
                const logoData = await loadImage(companySettings.logo_url);
                doc.addImage(logoData, 'PNG', pageWidth - 24, 5, 16, 16);

                // Report Number under Logo
                if (config?.reportNoPrefix) {
                    doc.setFontSize(8);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(255, 255, 255);
                    doc.text(`${config.reportNoPrefix}-${config.reportYear}`, pageWidth - 16, 26, { align: "center" });
                }
            } catch (error) { }
        }

        // Company
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
        doc.text("WORK SCOPE STATUS SUMMARY", 10, 20);

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`Platform: ${structure.str_name || (structure.id === 'all' ? 'ALL STRUCTURES' : 'N/A')}`, 10, 24);

        // Page No
        if (config?.showPageNumbers) {
            doc.text(`Page ${pageNo}`, pageWidth - 20, pageHeight - 10, { align: "right" });
        }
    };

    await drawHeader(1);
    let yPos = 35;

    // --- 2. Calculate Statistics ---

    // Map ID -> Code
    const inspectionTypes = await fetchInspectionTypes();
    const typeMap: Record<string, string> = {};
    const typeNameMap: Record<string, string> = {};
    inspectionTypes.forEach(t => { typeMap[t.id] = t.code; typeNameMap[t.code] = t.name; });

    // Group items by Structure
    const groupedByStructure: Record<string, any[]> = {};
    let globalStats: Record<string, { total: number, completed: number }> = {};
    let grandTotal = 0;
    let grandCompleted = 0;

    sowData.items.forEach(item => {
        // Determine Structure Key
        let sTitle = (item as any).structure_title;
        if (!sTitle) {
            sTitle = structure.str_name || "Structure";
        }
        if (structure.id !== 'all') {
            // If specific structure selected, assume single structure logic 
            // though we can still use the title if available.
            // If we force "Single", the headers won't show.
            // Actually, grouping by title is fine. If structure.id is specific, items should belong to it.
        }

        if (!groupedByStructure[sTitle]) groupedByStructure[sTitle] = [];
        groupedByStructure[sTitle].push(item);

        // Global Stats Calc
        let code = item.inspection_type_code;
        if (!code && (item as any).inspection_type_id) {
            code = typeMap[(item as any).inspection_type_id];
        }
        if (!code) code = "Unknown";

        if (!globalStats[code]) globalStats[code] = { total: 0, completed: 0 };
        globalStats[code].total++;
        grandTotal++;

        const status = (item.status || "").toUpperCase();
        if (['COMPLETED', 'CLOSED', 'APPROVED', 'DONE'].includes(status)) {
            globalStats[code].completed++;
            grandCompleted++;
        }
    });

    // --- 3. Draw Chart Section (Overall) ---

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`Overall Completion Status`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    const chartRadius = 35;
    const chartX = pageWidth / 2;
    const chartY = yPos + chartRadius;

    const remaining = grandTotal - grandCompleted;
    const chartData = [
        { value: grandCompleted, color: completedColor },
        { value: remaining, color: pendingColor }
    ];

    if (grandTotal > 0) {
        drawPieChart(doc, chartX, chartY, chartRadius, chartData);
    } else {
        doc.text("No Items Found", chartX, chartY, { align: 'center' });
    }

    // Legend / Percentage Center
    const percentage = grandTotal > 0 ? Math.round((grandCompleted / grandTotal) * 100) : 0;
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(`${percentage}%`, chartX, chartY + 2, { align: 'center' }); // Centered in pie

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Completed", chartX, chartY + 8, { align: 'center' });

    yPos = chartY + chartRadius + 20;

    // --- 4. Detailed Breakdown Loop ---

    // Sort keys. If 'Single', it's just one loop.
    const structKeys = Object.keys(groupedByStructure).sort();

    for (const sKey of structKeys) {
        const structureItems = groupedByStructure[sKey];

        // Page Break Check (Structure Header needs space)
        if (yPos > pageHeight - 60) {
            doc.addPage();
            await drawHeader(doc.getNumberOfPages());
            yPos = 35;
        }

        // Draw Section Header if Multi-Structure
        if (structure.id === 'all') {
            doc.setFillColor(30, 41, 59); // Dark Slate Blue
            doc.rect(14, yPos, pageWidth - 28, 8, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`STRUCTURE: ${sKey.toUpperCase()}`, 16, yPos + 5.5);
            yPos += 14;
        } else {
            // Standard Header for single structure report - only if first key
            if (structKeys.length === 1 && structKeys.indexOf(sKey) === 0) {
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.setFont("helvetica", "bold");
                doc.text("Detailed Breakdown by Inspection Type", 14, yPos);
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
            const groupStats: Record<string, { total: number, completed: number }> = {};
            items.forEach(item => {
                let code = item.inspection_type_code;
                if (!code && (item as any).inspection_type_id) {
                    code = typeMap[(item as any).inspection_type_id];
                }
                if (!code) code = "Unknown";

                if (!groupStats[code]) groupStats[code] = { total: 0, completed: 0 };
                groupStats[code].total++;

                const status = (item.status || "").toUpperCase();
                if (['COMPLETED', 'CLOSED', 'APPROVED', 'DONE'].includes(status)) {
                    groupStats[code].completed++;
                }
            });

            // Check space for Report Header + Table Header + at least one row
            if (yPos > pageHeight - 50) {
                doc.addPage();
                await drawHeader(doc.getNumberOfPages());
                yPos = 35;
            }

            // Draw Report Sub-Header
            // Only show if we actually have a report num grouping or if specific requirement
            // User asked for "sub header for the report number"
            const reportDisplay = rptKey === "Pending Assignment" ? "Items Pending Assignment" : `Report Ref: ${rptKey}`;

            doc.setFillColor(240, 240, 240); // Light Grey
            doc.rect(14, yPos, pageWidth - 28, 7, "F");
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(reportDisplay, 16, yPos + 5);
            yPos += 12;

            // Draw Table for this Report Group
            const statKeys = Object.keys(groupStats).sort();

            // Table Header
            const col1 = 14;
            const col2 = 60; // Progress Bar
            const col3 = pageWidth - 40; // Value

            // Headers
            doc.setFillColor(...headerBlue);
            doc.rect(col1 - 4, yPos - 5, pageWidth - 20, 8, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("Inspection Type", col1, yPos);
            doc.text("Progress", col2, yPos);
            doc.text("Status", col3, yPos);
            yPos += 10;

            for (let index = 0; index < statKeys.length; index++) {
                const code = statKeys[index];
                const s = groupStats[code];
                const pct = s.total > 0 ? (s.completed / s.total) : 0;
                const pctText = (pct * 100).toFixed(0) + "%";

                // Row Background (Alternating)
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

                // Background
                doc.setFillColor(230, 230, 230);
                doc.roundedRect(barX, barY, barWidth, barHeight, 1, 1, "F");

                // Fill
                if (pct > 0) {
                    doc.setFillColor(...completedColor);
                    doc.roundedRect(barX, barY, barWidth * pct, barHeight, 1, 1, "F");
                }

                // 3. Value
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text(`${pctText} (${s.completed}/${s.total})`, col3, yPos);

                yPos += 12; // Row Height

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
