
import jsPDF from "jspdf";
import "jspdf-autotable";

export interface AdvancedReportConfig {
    reportNoPrefix: string;
    reportYear: string;
    preparedBy: { name: string; date: string };
    reviewedBy: { name: string; date: string };
    approvedBy: { name: string; date: string };
    watermark: { enabled: boolean; text: string; transparency: number };
    showContractorLogo: boolean;
    showPageNumbers: boolean;
}

export const generateAdvancedStructureReport = async (
    structure: any,
    config: AdvancedReportConfig,
    companySettings?: any
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Helper for adding footer
    const addFooter = (pageNum: number, totalPages: number) => {
        // Signatures
        const sigY = pageHeight - 35;
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);

        // Draw Signature Box
        doc.setDrawColor(200, 200, 200);
        doc.line(10, sigY, pageWidth - 10, sigY);

        const colWidth = (pageWidth - 20) / 3;

        // Prepared By
        if (config.preparedBy.name) {
            doc.text("Prepared By:", 10, sigY + 5);
            doc.setFont("helvetica", "bold");
            doc.text(config.preparedBy.name, 10, sigY + 10);
            doc.setFont("helvetica", "normal");
            doc.text(config.preparedBy.date, 10, sigY + 15);
        }

        // Reviewed By
        if (config.reviewedBy.name) {
            doc.text("Reviewed By:", 10 + colWidth, sigY + 5);
            doc.setFont("helvetica", "bold");
            doc.text(config.reviewedBy.name, 10 + colWidth, sigY + 10);
            doc.setFont("helvetica", "normal");
            doc.text(config.reviewedBy.date, 10 + colWidth, sigY + 15);
        }

        // Approved By
        if (config.approvedBy.name) {
            doc.text("Approved By:", 10 + colWidth * 2, sigY + 5);
            doc.setFont("helvetica", "bold");
            doc.text(config.approvedBy.name, 10 + colWidth * 2, sigY + 10);
            doc.setFont("helvetica", "normal");
            doc.text(config.approvedBy.date, 10 + colWidth * 2, sigY + 15);
        }

        // Page Number
        if (config.showPageNumbers) {
            doc.setFontSize(8);
            doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: "right" });
        }

        // Report Number
        const reportNo = `${config.reportNoPrefix}-${config.reportYear}-${structure.id}`;
        doc.text(reportNo, 10, pageHeight - 10);
    };

    // Helper for Watermark
    const addWatermark = () => {
        if (!config.watermark.enabled) return;

        doc.saveGraphicsState();
        doc.setGState(new (doc as any).GState({ opacity: config.watermark.transparency }));
        doc.setTextColor(200, 200, 200);
        doc.setFontSize(60);
        doc.text(config.watermark.text, pageWidth / 2, pageHeight / 2, {
            align: "center",
            angle: 45
        });
        doc.restoreGraphicsState();
    };

    // --- Page 1 Content ---
    addWatermark();

    // Header (Simplified for demo)
    doc.setFillColor(26, 54, 93);
    doc.rect(0, 0, pageWidth, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(companySettings?.company_name || "NasQuest Resources", 10, 10);

    doc.setFontSize(12);
    doc.text("STRUCTURE SUMMARY REPORT", 10, 20);

    // Body
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Structure: ${structure.str_name}`, 10, 40);
    doc.text(`Type: ${structure.str_type}`, 10, 50);

    // Mock Body Content
    (doc as any).autoTable({
        startY: 60,
        head: [['Property', 'Value']],
        body: [
            ['Field', structure.field_name || 'N/A'],
            ['Install Date', structure.inst_date || 'N/A'],
            ['Water Depth', structure.depth || 'N/A'],
            ['Manned', structure.manned || 'N/A'],
        ],
    });

    addFooter(1, 1);

    doc.save(`${config.reportNoPrefix}_${structure.str_name}.pdf`);
};

export const generateAdvancedComponentReport = async (
    structure: any,
    component: any,
    config: AdvancedReportConfig,
    companySettings?: any
) => {
    // Similar implementation for component
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ... Copy header/watermark/footer logic ...

    doc.text(`Component Report: ${component.name}`, 10, 50);

    doc.save(`Component_${component.name}.pdf`);
}
