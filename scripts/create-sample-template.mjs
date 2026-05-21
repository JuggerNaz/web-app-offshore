import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, Footer, PageNumber } from "docx";
import fs from "fs";
import path from "path";

// This script generates a Sample DOCX with the tags used by our new generator.
// You can open this file in Word, change the layout, and re-save it.

const doc = new Document({
    sections: [{
        properties: {},
        footers: {
            default: new Footer({
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun("Page "),
                            new TextRun({ children: [PageNumber.CURRENT] }),
                            new TextRun(" of "),
                            new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                        ],
                    }),
                ],
            }),
        },
        children: [
            // Logo Placeholder (In a real template, you'd put a small image here with the tag)
            new Paragraph({
                text: "{%CLIENT_LOGO}",
                alignment: AlignmentType.RIGHT,
            }),

            // Title
            new Paragraph({
                text: "{{REPORT_TYPE}}",
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
                text: "{{PLATFORM_TITLE}}",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: "Report No: {{REPORT_NO}}", bold: true }),
                    new TextRun({ text: "  |  Date: {{DATE}}", bold: true }),
                ],
                spacing: { after: 400 },
            }),

            // Summary Sections Loop
            new Paragraph({ text: "1. EXECUTIVE SUMMARY", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({
                children: [
                    new TextRun({ text: "{{#SECTIONS}}", color: "FF0000" }),
                ],
            }),
            new Paragraph({
                text: "{{title}}",
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 200 },
            }),
            new Paragraph({
                text: "{{content}}",
                alignment: AlignmentType.JUSTIFIED,
            }),
            new Paragraph({
                children: [
                    new TextRun({ text: "{{/SECTIONS}}", color: "FF0000" }),
                ],
            }),

            // Anomaly Table
            new Paragraph({ text: "2. ANOMALY LIST", heading: HeadingLevel.HEADING_2, spacing: { before: 400 } }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ text: "Ref No", bold: true })] }),
                            new TableCell({ children: [new Paragraph({ text: "Description", bold: true })] }),
                            new TableCell({ children: [new Paragraph({ text: "Priority", bold: true })] }),
                            new TableCell({ children: [new Paragraph({ text: "Status", bold: true })] }),
                        ],
                    }),
                    // Table Loop
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph({ text: "{{#ANOMALIES}}{{ref}}" })] }),
                            new TableCell({ children: [new Paragraph({ text: "{{description}}" })] }),
                            new TableCell({ children: [new Paragraph({ text: "{{priority}}" })] }),
                            new TableCell({ children: [new Paragraph({ text: "{{status}}{{/ANOMALIES}}" })] }),
                        ],
                    }),
                ],
            }),

            new Paragraph({
                text: "End of Report",
                alignment: AlignmentType.CENTER,
                spacing: { before: 800 },
            }),
        ],
    }],
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("Sample_Executive_Summary_Template.docx", buffer);
    console.log("Sample template generated: Sample_Executive_Summary_Template.docx");
});
