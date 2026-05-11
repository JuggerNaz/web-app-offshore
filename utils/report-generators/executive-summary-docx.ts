import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, Footer, PageNumber } from "docx";
import { saveAs } from "file-saver";

interface Section {
    id: string;
    title: string;
    content: string;
}

interface ReportData {
    jobpackName: string;
    platformName: string;
    sowReportNo: string;
    sections: Section[];
    preparedBy?: { name: string; date: string };
}

export const generateExecutiveSummaryDocx = async (data: ReportData) => {
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
                                new TextRun({
                                    children: [PageNumber.CURRENT],
                                }),
                                new TextRun(" of "),
                                new TextRun({
                                    children: [PageNumber.TOTAL_PAGES],
                                }),
                            ],
                        }),
                    ],
                }),
            },
            children: [
                // Title
                new Paragraph({
                    text: "EXECUTIVE SUMMARY REPORT",
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    text: data.platformName,
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: `Job Pack: ${data.jobpackName}`, bold: true }),
                        new TextRun({ text: ` | SOW Report: ${data.sowReportNo}`, bold: true }),
                    ],
                    spacing: { after: 400 },
                }),

                // Table of Contents (Manual list for now)
                new Paragraph({ 
                    text: "TABLE OF CONTENTS", 
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 200 }
                }),
                ...data.sections.map((s, idx) => 
                    new Paragraph({
                        text: `${idx + 1}. ${s.title}`,
                        indent: { left: 720 },
                    })
                ),
                new Paragraph({ 
                    text: "", 
                    pageBreakBefore: true 
                }),

                // Sections
                ...data.sections.flatMap((s, idx) => [
                    new Paragraph({
                        text: `${idx + 1}. ${s.title.toUpperCase()}`,
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 400, after: 200 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: s.content || "No summary provided for this section.",
                                size: 24, // 12pt
                            }),
                        ],
                        alignment: AlignmentType.JUSTIFIED,
                    }),
                ]),
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Executive_Summary_${data.platformName}_${data.sowReportNo}.docx`);
};
