const { jsPDF } = require('jspdf');

try {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageCount = doc.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const sigW = contentWidth / 3;
    const sigY = pageHeight - 38;

    console.log("PDF Specs:", { pageCount, pageWidth, pageHeight, sigY });
    
    console.log("Checking GState existence...");
    const GStateClass = doc.constructor.GState || jsPDF.GState || doc.GState;
    console.log("GStateClass:", typeof GStateClass);
    
    if (GStateClass) {
        const state = new GStateClass({ opacity: 0.15 });
        console.log("GState instantiation: Success!");
    } else {
        console.log("GState class not found anywhere");
    }
} catch (e) {
    console.error("Test error:", e);
}
