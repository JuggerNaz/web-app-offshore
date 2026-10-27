import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
import {
    generateMainCoverPage,
    generateTOCPages,
    generateSectionDividerPage,
    generateInspectionSummaryCoverPage,
    generateEndOfReportCoverPage,
    applyTOCLinksToPdf,
    TOCSectionItem
} from "./final-datasheet-report";

describe("final-datasheet-report", () => {
    it("generates a valid Main Cover Page Blob with metadata", async () => {
        const coverBlob = await generateMainCoverPage({
            structureName: "BODP-A",
            fieldName: "BOKOR",
            jobPackName: "UIMC2026/SKA/PLAT01",
            sowReportNo: "AM26-016-01",
            contractorName: "NasQuest Resources Sdn Bhd",
            inspectionModes: "ROV & Diving Inspection",
            dateStr: "2026-10-22"
        });

        expect(coverBlob).toBeInstanceOf(Blob);
        expect(coverBlob.size).toBeGreaterThan(1000);

        const arrayBuffer = await coverBlob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        expect(pdfDoc.getPageCount()).toBe(1);
    });

    it("generates TOC pages with accurate page numbers and interactive link targets", async () => {
        const sampleSections: TOCSectionItem[] = [
            {
                id: 1,
                name: "Structure Details",
                pageNum: 3,
                templates: [
                    { id: "structure-summary", name: "Structure Summary Report", mode: "General", pageNum: 4, pageCount: 2 },
                    { id: "defect-criteria-report", name: "Defect Criteria Report", mode: "General", pageNum: 6, pageCount: 1 },
                ]
            },
            {
                id: 2,
                name: "General Visual Inspection",
                pageNum: 7,
                templates: [
                    { id: "rov-rgvi-report", name: "General Visual Inspection Report (ROV)", mode: "ROV", pageNum: 8, pageCount: 3 },
                ]
            }
        ];

        const { blobs, linkTargets } = await generateTOCPages(sampleSections, 10, {
            structureName: "BODP-A",
            fieldName: "BOKOR",
            jobPackName: "UIMC2026/SKA/PLAT01"
        });

        expect(blobs.length).toBeGreaterThanOrEqual(1);
        expect(blobs[0]).toBeInstanceOf(Blob);

        // 2 sections + 3 templates = 5 link targets
        expect(linkTargets.length).toBe(5);

        // Verify page numbers in targets
        expect(linkTargets[0].pageNum).toBe(3); // Section 1 cover
        expect(linkTargets[1].pageNum).toBe(4); // Structure summary
        expect(linkTargets[2].pageNum).toBe(6); // Defect criteria
        expect(linkTargets[3].pageNum).toBe(7); // Section 2 cover
        expect(linkTargets[4].pageNum).toBe(8); // RGVI report

        // Verify bounding boxes
        linkTargets.forEach(lt => {
            expect(lt.rect.x).toBeGreaterThan(0);
            expect(lt.rect.w).toBeGreaterThan(50);
            expect(lt.rect.h).toBeGreaterThan(2);
        });
    });

    it("attaches clickable PDF Link Annotations to the TOC page in a merged document", async () => {
        const mergedPdf = await PDFDocument.create();

        // Add 10 dummy pages
        for (let i = 0; i < 10; i++) {
            mergedPdf.addPage([595, 842]);
        }

        const tocPage = mergedPdf.getPage(1); // Page 2 (0-indexed 1)

        const linkTargets = [
            { pageNum: 3, tocPageIndex: 0, rect: { x: 15, y: 50, w: 180, h: 7 } },
            { pageNum: 4, tocPageIndex: 0, rect: { x: 15, y: 60, w: 180, h: 6 } },
            { pageNum: 8, tocPageIndex: 0, rect: { x: 15, y: 70, w: 180, h: 6 } },
        ];

        applyTOCLinksToPdf(mergedPdf, [tocPage], linkTargets);

        // Verify annotations exist on tocPage
        const annots = tocPage.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
        expect(annots).toBeDefined();
        expect(annots?.size()).toBe(3);

        // Verify each annotation has /Subtype /Link and points to target page
        for (let i = 0; i < (annots?.size() || 0); i++) {
            const annot = annots!.lookup(i);
            const subtype = (annot as any).lookup(PDFName.of("Subtype")).encodedName;
            expect(subtype).toBe("/Link");

            const dest = (annot as any).lookup(PDFName.of("Dest"));
            expect(dest).toBeDefined();
        }

        const savedBytes = await mergedPdf.save();
        expect(savedBytes.length).toBeGreaterThan(500);
    });

    it("generates a valid Section Divider Page Blob", async () => {
        const dividerBlob = await generateSectionDividerPage("Cathodic Protection Potential Survey", {
            structureName: "BODP-A",
            jobPackName: "UIMC2026/SKA/PLAT01"
        });

        expect(dividerBlob).toBeInstanceOf(Blob);
        const arrayBuffer = await dividerBlob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        expect(pdfDoc.getPageCount()).toBe(1);
    });

    it("generates a dedicated, executive Cover Page for Inspection Summary", async () => {
        const coverBlob = await generateInspectionSummaryCoverPage({
            structureName: "BODP-A",
            fieldName: "BOKOR FIELD",
            jobPackName: "UIMC2026/SKA/PLAT01",
            sowReportNo: "AM26-016-01",
            contractorName: "NasQuest Resources Sdn Bhd",
            inspectionModes: "ROV & Diving Consolidated",
            dateStr: "2026-10-22",
            preparedBy: { name: "Inspection Lead", date: "2026-10-22" },
            reviewedBy: { name: "Senior QA Engineer", date: "2026-10-22" },
            approvedBy: { name: "Technical Director", date: "2026-10-22" },
        });

        expect(coverBlob).toBeInstanceOf(Blob);
        expect(coverBlob.size).toBeGreaterThan(1000);

        const arrayBuffer = await coverBlob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        expect(pdfDoc.getPageCount()).toBe(1);
    });

    it("generates a unified section cover page when generateSectionDividerPage is called for Inspection Summary", async () => {
        const dividerBlob = await generateSectionDividerPage("Inspection Summary", {
            structureName: "BODP-A",
            fieldName: "BOKOR FIELD",
            jobPackName: "UIMC2026/SKA/PLAT01"
        });

        expect(dividerBlob).toBeInstanceOf(Blob);
        const arrayBuffer = await dividerBlob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        expect(pdfDoc.getPageCount()).toBe(1);
    });

    it("generates an executive End of Report Cover Page with corporate styling", async () => {
        const endCoverBlob = await generateEndOfReportCoverPage({
            structureName: "BODP-A",
            fieldName: "BOKOR FIELD",
            jobPackName: "UIMC2026/SKA/PLAT01",
            sowReportNo: "AM26-016-01",
            contractorName: "NasQuest Resources Sdn Bhd",
            inspectionModes: "ROV & Diving Consolidated",
            dateStr: "2026-10-22"
        });

        expect(endCoverBlob).toBeInstanceOf(Blob);
        expect(endCoverBlob.size).toBeGreaterThan(1000);

        const arrayBuffer = await endCoverBlob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        expect(pdfDoc.getPageCount()).toBe(1);

        const page = pdfDoc.getPage(0);
        expect(page.getWidth()).toBeCloseTo(595.28, 0);
        expect(page.getHeight()).toBeCloseTo(841.89, 0);
    });
});
