const { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFString, StandardFonts, rgb } = require('pdf-lib');
const { jsPDF } = require('jspdf');
const fs = require('fs');

async function testTOCGeneration() {
  const mergedPdf = await PDFDocument.create();
  const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

  // 1. Cover Page
  const coverDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = coverDoc.internal.pageSize.getWidth();
  const ph = coverDoc.internal.pageSize.getHeight();

  coverDoc.setFillColor(15, 23, 42); // slate-900
  coverDoc.rect(0, 0, pw, ph, 'F');

  // Decorative border
  coverDoc.setDrawColor(37, 99, 235);
  coverDoc.setLineWidth(1.5);
  coverDoc.rect(12, 12, pw - 24, ph - 24);

  coverDoc.setDrawColor(203, 213, 225);
  coverDoc.setLineWidth(0.3);
  coverDoc.rect(15, 15, pw - 30, ph - 30);

  // Document Title
  coverDoc.setTextColor(255, 255, 255);
  coverDoc.setFontSize(26);
  coverDoc.setFont('helvetica', 'bold');
  coverDoc.text('FINAL INSPECTION DATASHEET', pw / 2, 85, { align: 'center' });

  coverDoc.setFontSize(12);
  coverDoc.setFont('helvetica', 'normal');
  coverDoc.setTextColor(148, 163, 184);
  coverDoc.text('Comprehensive Inspection & Verification Dossier', pw / 2, 95, { align: 'center' });

  // Structure / Project Metadata Card
  coverDoc.setFillColor(30, 41, 59);
  coverDoc.roundedRect(25, 120, pw - 50, 75, 2, 2, 'F');
  coverDoc.setDrawColor(51, 65, 85);
  coverDoc.roundedRect(25, 120, pw - 50, 75, 2, 2, 'S');

  const metaRows = [
    { label: 'PLATFORM / STRUCTURE:', val: 'BODP-A' },
    { label: 'FIELD NAME:', val: 'BOKOR FIELD' },
    { label: 'JOBPACK:', val: 'UIMC2026/SKA/PLAT01' },
    { label: 'SOW REPORT NO:', val: 'AM26-016-01' },
    { label: 'INSPECTION MODE:', val: 'ROV & DIVING CONSOLIDATED' },
    { label: 'CONTRACTOR:', val: 'NasQuest Resources Sdn Bhd' },
  ];

  metaRows.forEach((m, idx) => {
    const my = 132 + (idx * 10);
    coverDoc.setFontSize(8.5);
    coverDoc.setFont('helvetica', 'bold');
    coverDoc.setTextColor(148, 163, 184);
    coverDoc.text(m.label, 32, my);

    coverDoc.setFontSize(9);
    coverDoc.setFont('helvetica', 'bold');
    coverDoc.setTextColor(255, 255, 255);
    coverDoc.text(m.val, 85, my);
  });

  const coverBytes = coverDoc.output('arraybuffer');
  const donorCover = await PDFDocument.load(coverBytes);
  const [coverPage] = await mergedPdf.copyPages(donorCover, [0]);
  mergedPdf.addPage(coverPage);

  // Sample sections and reports
  const sectionsData = [
    {
      title: 'SECTION 1: STRUCTURE DETAILS',
      templates: [
        { name: '1.1 Structure Summary Report', mode: 'General', pageCount: 2 },
        { name: '1.2 Defect Criteria Report', mode: 'General', pageCount: 1 },
        { name: '1.3 Inspection Summary by Graph', mode: 'General', pageCount: 2 },
      ]
    },
    {
      title: 'SECTION 2: GENERAL VISUAL INSPECTION',
      templates: [
        { name: '2.1 General Visual Inspection Report (ROV)', mode: 'ROV', pageCount: 3 },
      ]
    },
    {
      title: 'SECTION 3: CATHODIC PROTECTION SURVEY',
      templates: [
        { name: '3.1 CP Survey Report (ROV)', mode: 'ROV', pageCount: 2 },
      ]
    },
    {
      title: 'SECTION 4: BASE LEVEL SURVEY',
      templates: [
        { name: '4.1 Scour Survey Report (ROV)', mode: 'ROV', pageCount: 2 },
        { name: '4.2 Water Depth Measurement Survey Report (ROV)', mode: 'ROV', pageCount: 1 },
      ]
    }
  ];

  // Calculate page numbers
  // Page 1: Cover
  // Page 2: TOC
  let currentPage = 3;
  const tocEntries = [];

  sectionsData.forEach((sec) => {
    const secEntry = {
      isSection: true,
      title: sec.title,
      pageNum: currentPage,
      items: []
    };
    currentPage += 1; // Section divider cover page

    sec.templates.forEach((t) => {
      secEntry.items.push({
        isSection: false,
        title: t.name,
        mode: t.mode,
        pageNum: currentPage,
        pageCount: t.pageCount
      });
      currentPage += t.pageCount;
    });

    tocEntries.push(secEntry);
  });

  const totalPages = currentPage - 1;

  // 2. Build TOC Page with jsPDF
  const tocDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header
  tocDoc.setFillColor(248, 250, 252);
  tocDoc.rect(0, 0, pw, 35, 'F');
  tocDoc.setDrawColor(226, 232, 240);
  tocDoc.line(0, 35, pw, 35);

  tocDoc.setFontSize(16);
  tocDoc.setFont('helvetica', 'bold');
  tocDoc.setTextColor(15, 23, 42);
  tocDoc.text('TABLE OF CONTENTS', 15, 18);

  tocDoc.setFontSize(9);
  tocDoc.setFont('helvetica', 'normal');
  tocDoc.setTextColor(100, 116, 139);
  tocDoc.text('Final Inspection Datasheet • Index & Page Navigation', 15, 26);

  tocDoc.setFontSize(8.5);
  tocDoc.setFont('helvetica', 'bold');
  tocDoc.setTextColor(37, 99, 235);
  tocDoc.text(`Total Pages: ${totalPages}`, pw - 15, 26, { align: 'right' });

  // Column header bar
  tocDoc.setFillColor(15, 23, 42);
  tocDoc.rect(15, 40, pw - 30, 7, 'F');
  tocDoc.setFontSize(7.5);
  tocDoc.setFont('helvetica', 'bold');
  tocDoc.setTextColor(255, 255, 255);
  tocDoc.text('SECTION / REPORT TEMPLATE', 20, 44.8);
  tocDoc.text('MODE', pw - 48, 44.8);
  tocDoc.text('PAGE NO.', pw - 20, 44.8, { align: 'right' });

  // Rows and clickable rect locations (in mm)
  const linkTargets = [];
  let rowY = 52;

  tocEntries.forEach((sec) => {
    // Section Header row
    tocDoc.setFillColor(241, 245, 249);
    tocDoc.roundedRect(15, rowY - 4.5, pw - 30, 6.5, 1, 1, 'F');
    tocDoc.setDrawColor(203, 213, 225);
    tocDoc.setLineWidth(0.1);
    tocDoc.roundedRect(15, rowY - 4.5, pw - 30, 6.5, 1, 1, 'S');

    tocDoc.setFontSize(8.5);
    tocDoc.setFont('helvetica', 'bold');
    tocDoc.setTextColor(15, 23, 42);
    tocDoc.text(sec.title, 19, rowY);

    tocDoc.setFontSize(8.5);
    tocDoc.setFont('helvetica', 'bold');
    tocDoc.setTextColor(37, 99, 235);
    tocDoc.text(`Page ${sec.pageNum}`, pw - 20, rowY, { align: 'right' });

    linkTargets.push({
      pageNum: sec.pageNum,
      rect: { x: 15, y: rowY - 4.5, w: pw - 30, h: 6.5 }
    });

    rowY += 8.5;

    // Sub-items
    sec.items.forEach((item) => {
      tocDoc.setFontSize(8);
      tocDoc.setFont('helvetica', 'normal');
      tocDoc.setTextColor(51, 65, 85);
      tocDoc.text(item.title, 24, rowY);

      // Mode badge
      const modeColor = item.mode === 'ROV' ? [217, 119, 6] : item.mode === 'Diving' ? [79, 70, 229] : [100, 116, 139];
      tocDoc.setFontSize(6.8);
      tocDoc.setFont('helvetica', 'bold');
      tocDoc.setTextColor(...modeColor);
      tocDoc.text(`[${item.mode}]`, pw - 48, rowY);

      // Dot leader line
      const titleW = tocDoc.getTextWidth(item.title);
      const dotStartX = 26 + titleW;
      const dotEndX = pw - 52;
      if (dotEndX > dotStartX) {
        tocDoc.setFontSize(7);
        tocDoc.setFont('helvetica', 'normal');
        tocDoc.setTextColor(203, 213, 225);
        let dots = '';
        while (tocDoc.getTextWidth(dots + ' .') < (dotEndX - dotStartX)) {
          dots += ' .';
        }
        tocDoc.text(dots, dotStartX, rowY);
      }

      // Page number
      tocDoc.setFontSize(8);
      tocDoc.setFont('helvetica', 'bold');
      tocDoc.setTextColor(15, 23, 42);
      tocDoc.text(`Page ${item.pageNum}`, pw - 20, rowY, { align: 'right' });

      linkTargets.push({
        pageNum: item.pageNum,
        rect: { x: 15, y: rowY - 4, w: pw - 30, h: 6 }
      });

      rowY += 6.5;
    });

    rowY += 3;
  });

  // Footer tip
  tocDoc.setFontSize(7.5);
  tocDoc.setFont('helvetica', 'italic');
  tocDoc.setTextColor(100, 116, 139);
  tocDoc.text('Click any section or report entry above to navigate directly to its page in the document.', 15, ph - 15);

  const tocBytes = tocDoc.output('arraybuffer');
  const donorTOC = await PDFDocument.load(tocBytes);
  const [tocPage] = await mergedPdf.copyPages(donorTOC, [0]);
  mergedPdf.addPage(tocPage);

  // 3. Add section divider and report pages
  for (const sec of sectionsData) {
    // Section divider
    const sDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    sDoc.setFillColor(248, 250, 252);
    sDoc.rect(0, 0, pw, ph, 'F');
    sDoc.setDrawColor(37, 99, 235);
    sDoc.setLineWidth(2);
    sDoc.rect(20, 20, pw - 40, ph - 40);

    sDoc.setFontSize(22);
    sDoc.setFont('helvetica', 'bold');
    sDoc.setTextColor(15, 23, 42);
    sDoc.text(sec.title, 105, 140, { align: 'center' });
    const sBytes = sDoc.output('arraybuffer');
    const donorS = await PDFDocument.load(sBytes);
    const [sPage] = await mergedPdf.copyPages(donorS, [0]);
    mergedPdf.addPage(sPage);

    // Reports
    for (const t of sec.templates) {
      for (let p = 0; p < t.pageCount; p++) {
        const rDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        rDoc.setFontSize(16);
        rDoc.setFont('helvetica', 'bold');
        rDoc.setTextColor(15, 23, 42);
        rDoc.text(`${t.name}`, 105, 50, { align: 'center' });
        rDoc.setFontSize(10);
        rDoc.setFont('helvetica', 'normal');
        rDoc.setTextColor(100, 116, 139);
        rDoc.text(`Section Content - Page ${p + 1} of ${t.pageCount}`, 105, 60, { align: 'center' });
        const rBytes = rDoc.output('arraybuffer');
        const donorR = await PDFDocument.load(rBytes);
        const [rPage] = await mergedPdf.copyPages(donorR, [0]);
        mergedPdf.addPage(rPage);
      }
    }
  }

  // 4. Attach clickable link annotations on TOC Page (index 1)
  const context = mergedPdf.context;
  const linkRefs = [];

  for (const lt of linkTargets) {
    const targetPageIndex = lt.pageNum - 1;
    if (targetPageIndex < mergedPdf.getPageCount()) {
      const targetPage = mergedPdf.getPage(targetPageIndex);

      // Convert mm to PDF points (origin at bottom-left)
      const x1 = lt.rect.x * 2.83465;
      const x2 = (lt.rect.x + lt.rect.w) * 2.83465;
      const y1 = (297 - (lt.rect.y + lt.rect.h)) * 2.83465;
      const y2 = (297 - lt.rect.y) * 2.83465;

      const linkAnnot = context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [x1, y1, x2, y2],
        Border: [0, 0, 0],
        Dest: [targetPage.ref, 'Fit'],
      });
      const linkRef = context.register(linkAnnot);
      linkRefs.push(linkRef);
    }
  }

  const annots = tocPage.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (annots) {
    linkRefs.forEach(r => annots.push(r));
  } else {
    tocPage.node.set(PDFName.of('Annots'), context.obj(linkRefs));
  }

  // 5. Global continuous page numbers
  const total = mergedPdf.getPageCount();
  for (let idx = 0; idx < total; idx++) {
    const p = mergedPdf.getPage(idx);
    const { width } = p.getSize();
    const str = `Page ${idx + 1} of ${total}`;
    const w = font.widthOfTextAtSize(str, 8);
    p.drawText(str, {
      x: width - 15 * 2.83465 - w,
      y: 8 * 2.83465,
      size: 8,
      font,
      color: rgb(0.3, 0.4, 0.5),
    });
  }

  const finalPdfBytes = await mergedPdf.save();
  fs.writeFileSync('public/Final_Inspection_Datasheet_Sample.pdf', finalPdfBytes);
  console.log('SUCCESS! Generated Final Datasheet sample PDF: public/Final_Inspection_Datasheet_Sample.pdf');
  console.log('Total pages:', total, 'Size:', finalPdfBytes.length);
}

testTOCGeneration();
