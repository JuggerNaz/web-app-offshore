import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import {
    generateMainCoverPage,
    generateTOCPages,
    generateSectionDividerPage,
    generateEndOfReportCoverPage,
    applyTOCLinksToPdf,
    TOCSectionItem
} from "../utils/report-generators/final-datasheet-report";
import { generateDefectCriteriaReport } from "../utils/report-generators/defect-criteria-report";
import { generateInspectionSummaryGraphReport } from "../utils/report-generators/inspection-summary-graph-report";
import { generateROVCPReport } from "../utils/report-generators/rov-cp-report";
import { generateROVRGVIReport } from "../utils/report-generators/rov-rgvi-report";
import { generateROVRSCORSurveyReport } from "../utils/report-generators/rov-rscor-survey-report";
import { generateROVFMDReport } from "../utils/report-generators/rov-fmd-report";

async function main() {
    console.log("Starting Final Datasheet PDF compilation...");

    const coverOptions = {
        structureName: "BODP-A",
        fieldName: "BOKOR FIELD",
        jobPackName: "UIMC2026/SKA/PLAT01",
        sowReportNo: "AM26-016-01",
        contractorName: "NasQuest Resources Sdn Bhd",
        companyName: "NasQuest Resources Sdn Bhd",
        vessel: "MEO RESOLUTION",
        inspectionDateRange: "24 Aug 2026 – 31 Aug 2026",
        inspectionModes: "ROV & Diving Consolidated",
        dateStr: "2026-10-22",
        preparedBy: { name: "Inspection Lead", date: "2026-10-22" },
        reviewedBy: { name: "Senior QA Engineer", date: "2026-10-22" },
        approvedBy: { name: "Technical Director", date: "2026-10-22" },
    };

    const companySettings = {
        company_name: "NasQuest Resources Sdn Bhd",
        department_name: "Subsea Inspection & Asset Integrity",
    };

    // Install mock fetch for local Node CLI script environment to supply Defect Criteria data
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: any, init?: any) => {
        const urlStr = String(input);
        if (urlStr.includes('/api/defect-criteria/procedures')) {
            return {
                ok: true,
                json: async () => [
                    {
                        id: "1",
                        procedureNumber: "DC-001",
                        procedureName: "PTS-2023",
                        version: "1",
                        status: "active",
                        effectiveDate: "2026-01-25T00:00:00Z"
                    }
                ]
            };
        }
        if (urlStr.includes('/api/defect-criteria/library/priorities')) {
            return {
                ok: true,
                json: async () => [
                    { lib_id: "P1", lib_desc: "PRIORITY 1" },
                    { lib_id: "P2", lib_desc: "PRIORITY 2" },
                    { lib_id: "P3", lib_desc: "PRIORITY 3" },
                    { lib_id: "OBS", lib_desc: "OBSERVATION" }
                ]
            };
        }
        if (urlStr.includes('/api/defect-criteria/library/codes')) {
            return {
                ok: true,
                json: async () => [
                    { lib_id: "AW", lib_desc: "ANODE WASTAGE (AW)" },
                    { lib_id: "CP", lib_desc: "CATHODIC POTENTIAL (CP)" },
                    { lib_id: "DB", lib_desc: "DEBRIS (DB)" },
                    { lib_id: "LI", lib_desc: "LACK OF INTEGRITY (LI)" },
                    { lib_id: "SC", lib_desc: "SCOUR (SC)" }
                ]
            };
        }
        if (urlStr.includes('/api/defect-criteria/library/structure-groups')) {
            return {
                ok: true,
                json: async () => [
                    { lib_id: "SG1", lib_desc: "All Structure Groups" },
                    { lib_id: "SG2", lib_desc: "Primary, Conductor, Pile" },
                    { lib_id: "SG3", lib_desc: "Primary, Pile, Conductor" },
                    { lib_id: "SG4", lib_desc: "Secondary, Anode, Boat Landing, Clamps, Guides" },
                    { lib_id: "SG5", lib_desc: "Anode, Boat Landing, Clamps, Guides, Secondary" },
                    { lib_id: "SG6", lib_desc: "Secondary, Anode, Clamps, Guides, Boat Landing" },
                    { lib_id: "SG7", lib_desc: "Primary" },
                    { lib_id: "SG8", lib_desc: "Secondary" }
                ]
            };
        }
        if (urlStr.includes('/api/defect-criteria/library/types')) {
            return {
                ok: true,
                json: async () => [
                    { lib_id: "ANNW", lib_desc: "Anode Not Working" },
                    { lib_id: "CPOP", lib_desc: "Cathodic Potential Over Protected" },
                    { lib_id: "CPUP", lib_desc: "Cathodic Potential Unprotected" },
                    { lib_id: "DBMIC", lib_desc: "Debris Metallic In Contact" },
                    { lib_id: "DBNMIC", lib_desc: "Debris Non Metallic In Contact" },
                    { lib_id: "LIMEMFLO", lib_desc: "Lack Of Integrity - Member Flooded" },
                    { lib_id: "SCLIM", lib_desc: "Scour Depth Limit" }
                ]
            };
        }
        if (urlStr.includes('/api/library/combo/ANMLYCLR')) {
            return {
                ok: true,
                json: async () => ({
                    data: [
                        { code_1: "P1", code_2: "255,0,0", lib_delete: null },
                        { code_1: "P2", code_2: "255,200,0", lib_delete: null },
                        { code_1: "P3", code_2: "0,200,0", lib_delete: null },
                        { code_1: "OBS", code_2: "255,165,0", lib_delete: null }
                    ]
                })
            };
        }
        if (urlStr.includes('/api/defect-criteria/rules')) {
            return {
                ok: true,
                json: async () => [
                    {
                        id: 1,
                        procedureId: "1",
                        structureGroup: "All Structure Groups",
                        defectCodeId: "AW",
                        defectTypeId: "ANNW",
                        thresholdOperator: ">",
                        thresholdValue: 75,
                        priorityId: "P2",
                        alertMessage: "Anode not working"
                    },
                    {
                        id: 2,
                        procedureId: "1",
                        structureGroup: "Primary, Conductor, Pile",
                        defectCodeId: "CP",
                        defectTypeId: "CPOP",
                        thresholdOperator: "<",
                        thresholdValue: -1150,
                        priorityId: "P1",
                        alertMessage: "CP unprotected"
                    },
                    {
                        id: 3,
                        procedureId: "1",
                        structureGroup: "Primary, Pile, Conductor",
                        defectCodeId: "CP",
                        defectTypeId: "CPOP",
                        thresholdOperator: ">",
                        thresholdValue: -650,
                        priorityId: "P1",
                        alertMessage: "CP over protected"
                    },
                    {
                        id: 4,
                        procedureId: "1",
                        structureGroup: "Primary, Pile, Conductor",
                        defectCodeId: "CP",
                        defectTypeId: "CPUP",
                        thresholdOperator: ">",
                        thresholdValue: -799,
                        priorityId: "P2",
                        alertMessage: "CP over protected"
                    },
                    {
                        id: 5,
                        procedureId: "1",
                        structureGroup: "Secondary, Anode, Boat Landing, Clamps, Guides",
                        defectCodeId: "CP",
                        defectTypeId: "CPUP",
                        thresholdOperator: ">",
                        thresholdValue: -649,
                        priorityId: "P2",
                        alertMessage: "CP over protected"
                    },
                    {
                        id: 6,
                        procedureId: "1",
                        structureGroup: "Anode, Boat Landing, Clamps, Guides, Secondary",
                        defectCodeId: "CP",
                        defectTypeId: "CPUP",
                        thresholdOperator: "<",
                        thresholdValue: -1150,
                        priorityId: "P2",
                        alertMessage: "Cp unprotected"
                    },
                    {
                        id: 7,
                        procedureId: "1",
                        structureGroup: "Secondary, Anode, Clamps, Guides, Boat Landing",
                        defectCodeId: "CP",
                        defectTypeId: "CPOP",
                        thresholdOperator: ">",
                        thresholdValue: -799,
                        priorityId: "P3",
                        alertMessage: "CP over protected"
                    },
                    {
                        id: 8,
                        procedureId: "1",
                        structureGroup: "All Structure Groups",
                        defectCodeId: "DB",
                        defectTypeId: "DBMIC",
                        thresholdOperator: "==",
                        thresholdText: "Debris Metallic",
                        priorityId: "P1",
                        alertMessage: "Metallic Item in contact"
                    },
                    {
                        id: 9,
                        procedureId: "1",
                        structureGroup: "All Structure Groups",
                        defectCodeId: "DB",
                        defectTypeId: "DBNMIC",
                        thresholdOperator: "==",
                        thresholdText: "Debris Non Metallic",
                        priorityId: "OBS",
                        alertMessage: "Debries observation"
                    },
                    {
                        id: 10,
                        procedureId: "1",
                        structureGroup: "All Structure Groups",
                        defectCodeId: "DB",
                        defectTypeId: "DBMIC",
                        thresholdOperator: "==",
                        thresholdText: "Debris Metallic",
                        priorityId: "OBS",
                        alertMessage: "Debris Observation"
                    },
                    {
                        id: 11,
                        procedureId: "1",
                        structureGroup: "Primary",
                        defectCodeId: "LI",
                        defectTypeId: "LIMEMFLO",
                        thresholdOperator: "==",
                        thresholdText: "Flooded",
                        priorityId: "P1",
                        alertMessage: "Flooded Member"
                    },
                    {
                        id: 12,
                        procedureId: "1",
                        structureGroup: "Secondary",
                        defectCodeId: "LI",
                        defectTypeId: "LIMEMFLO",
                        thresholdOperator: "==",
                        thresholdText: "Flooded",
                        priorityId: "P2",
                        alertMessage: "Flooded Member"
                    },
                    {
                        id: 13,
                        procedureId: "1",
                        structureGroup: "All Structure Groups",
                        defectCodeId: "SC",
                        defectTypeId: "SCLIM",
                        thresholdOperator: ">",
                        thresholdValue: 900,
                        priorityId: "P1",
                        alertMessage: "Scour depth exceeded"
                    }
                ]
            };
        }
        if (urlStr.includes('/api/mgi-profiles')) {
            return {
                ok: true,
                json: async () => ({
                    data: [
                        {
                            id: 1,
                            name: "2026 Field Profile",
                            description: "Field campaign limits",
                            is_active: true,
                            thresholds: [
                                { from_elevation: "MSL", max_thickness: 80 },
                                { from_elevation: "1/3 WD", max_thickness: 80 },
                                { from_elevation: "Mudline", max_thickness: 25 }
                            ]
                        }
                    ]
                })
            };
        }
        if (typeof originalFetch === 'function') {
            try {
                return await originalFetch(input, init);
            } catch (_) {}
        }
        return { ok: false, json: async () => ({}) };
    }) as any;

    // 1. Generate Sub-Reports
    console.log("Generating Section 1: Structure Details sub-reports...");
    const defectCriteriaBlob = await generateDefectCriteriaReport(
        companySettings,
        {
            returnBlob: true,
            sowReportNo: "AM26-016-01",
            jobPack: { name: "UIMC2026/SKA/PLAT01" }
        } as any
    );

    const inspectionSummaryGraphBlob = await generateInspectionSummaryGraphReport(
        {
            summary: {
                scopeType: "ROV",
                overallStatus: "Normal",
                anomalies: { total: 4, open: 4, p1: 1, p2: 1, p3: 2, obs: 0 },
                tasks: { total: 1082, completed: 932, incomplete: 150 },
                mgi: { total: 14, hardBands: { "<50mm": 6, "50-100mm": 5, ">100mm": 3 } },
                cp: { total: 84, normal: 80, low: 4, minReading: -890, maxReading: -1050 },
                scour: {
                    facesSurveyed: 4,
                    registeredFaces: 4,
                    pilesSurveyed: 8,
                    exposedPiles: 0,
                    maxDepthMm: 300,
                    minDepthMm: 100,
                    maxAllowableMm: 800,
                    qidReadings: [
                        { qid: "QID-B1", location: "Leg B1", depthMm: 300 },
                        { qid: "QID-A1", location: "Leg A1", depthMm: 200 },
                        { qid: "QID-B2", location: "Leg B2", depthMm: 100 }
                    ]
                }
            }
        },
        { platformName: "BODP-A", fieldName: "BOKOR FIELD", sowReportNo: "AM26-016-01", jobpackName: "UIMC2026/SKA/PLAT01" },
        companySettings,
        { returnBlob: true, sowReportNo: "AM26-016-01" }
    );

    console.log("Generating Section 2: General Visual Inspection sub-report...");
    const rgviRecords = [
        {
            id: "1",
            component_code: "LEG-A1",
            elevation: -15.5,
            dive_no: "D01",
            tape_no: "T01",
            finding_text: "General visual inspection carried out from EL -10.0m to EL -20.0m. Minor soft marine growth observed, no structural deformation.",
            marine_growth: "Soft 25mm (30% coverage)",
            component_condition: "Good",
            coating_condition: "Intact",
            debris: "None",
            date: "2026-10-18"
        },
        {
            id: "2",
            component_code: "LEG-B1",
            elevation: -25.0,
            dive_no: "D02",
            tape_no: "T02",
            finding_text: "Inspection of lower leg member. Hard barnacle growth up to 40mm thickness. Cathodic potential measured at -980mV.",
            marine_growth: "Hard 40mm (60% coverage)",
            component_condition: "Good",
            coating_condition: "Fair",
            debris: "None",
            date: "2026-10-19"
        }
    ];

    const rgviBlob = await generateROVRGVIReport(
        rgviRecords,
        { platformName: "BODP-A", field: "BOKOR", jobpackName: "UIMC2026/SKA/PLAT01", sowReportNo: "AM26-016-01" },
        companySettings,
        { returnBlob: true, sowReportNo: "AM26-016-01" }
    );

    console.log("Generating Section 3: Cathodic Protection Survey sub-report...");
    const cpRecords = [
        {
            id: "101",
            component_code: "ANODE-A1-01",
            elevation: -12.0,
            dive_no: "D01",
            tape_no: "T01",
            cp_reading_mv: -985,
            cp: -985,
            finding_text: "Anode active and healthy. Good electrical continuity with adjacent structure.",
            date: "2026-10-18"
        },
        {
            id: "102",
            component_code: "NODE-A1-EL20",
            elevation: -20.0,
            dive_no: "D01",
            tape_no: "T01",
            cp_reading_mv: -960,
            cp: -960,
            finding_text: "Structural node reading within safe Petronas limits (-800mV to -1050mV).",
            date: "2026-10-18"
        },
        {
            id: "103",
            component_code: "LEG-B2-EL35",
            elevation: -35.0,
            dive_no: "D02",
            tape_no: "T02",
            cp_reading_mv: -945,
            cp: -945,
            finding_text: "Cathodic protection potential verified normal.",
            date: "2026-10-19"
        }
    ];

    const cpBlob = await generateROVCPReport(
        cpRecords,
        { platformName: "BODP-A", field: "BOKOR", jobpackName: "UIMC2026/SKA/PLAT01", sowReportNo: "AM26-016-01" },
        companySettings,
        { returnBlob: true, sowReportNo: "AM26-016-01" }
    );

    console.log("Generating Section 4: Base Level Survey sub-report...");
    const scourRecords = [
        {
            id: "201",
            component_code: "LEG-A1-MUD",
            elevation: -72.0,
            dive_no: "D03",
            tape_no: "T04",
            depth: 0.20,
            depth_mm: 200,
            finding_text: "Scour depression around leg base measured at 200mm depth. Well below 800mm limit.",
            date: "2026-10-20"
        },
        {
            id: "202",
            component_code: "LEG-B1-MUD",
            elevation: -72.2,
            dive_no: "D03",
            tape_no: "T04",
            depth: 0.30,
            depth_mm: 300,
            finding_text: "Local seabed scour depression 300mm. No exposed pile threads or structural undermine.",
            date: "2026-10-20"
        }
    ];

    const scourBlob = await generateROVRSCORSurveyReport(
        scourRecords,
        { platformName: "BODP-A", field: "BOKOR", jobpackName: "UIMC2026/SKA/PLAT01", sowReportNo: "AM26-016-01" },
        companySettings,
        { returnBlob: true, sowReportNo: "AM26-016-01" }
    );

    console.log("Generating Section 5: Flooded Member Detection sub-report...");
    const fmdRecords = [
        {
            id: "301",
            component_code: "MBR-A1-B1-01",
            elevation: -45.0,
            dive_no: "D04",
            tape_no: "T05",
            finding_text: "Horizontal bracing member tested dry. Sound propagation confirms no water ingress.",
            fmd_status: "DRY",
            date: "2026-10-21"
        },
        {
            id: "302",
            component_code: "MBR-A2-B2-02",
            elevation: -55.0,
            dive_no: "D04",
            tape_no: "T05",
            finding_text: "Diagonal bracing member tested dry. Ultrasonic signal clear.",
            fmd_status: "DRY",
            date: "2026-10-21"
        }
    ];

    const fmdBlob = await generateROVFMDReport(
        fmdRecords,
        { platformName: "BODP-A", field: "BOKOR", jobpackName: "UIMC2026/SKA/PLAT01", sowReportNo: "AM26-016-01" },
        companySettings,
        { returnBlob: true, sowReportNo: "AM26-016-01" }
    );

    // 2. Load sub-report documents into PDFDocument to inspect page counts
    const toPdfDoc = async (b: any) => PDFDocument.load(await (b as Blob).arrayBuffer());

    const docDefect = await toPdfDoc(defectCriteriaBlob);
    const docGraph = await toPdfDoc(inspectionSummaryGraphBlob);
    const docRgvi = await toPdfDoc(rgviBlob);
    const docCp = await toPdfDoc(cpBlob);
    const docScour = await toPdfDoc(scourBlob);
    const docFmd = await toPdfDoc(fmdBlob);

    // Section Definitions
    const sectionsRaw = [
        {
            id: 1,
            name: "Structure Details",
            reports: [
                { id: "defect-criteria-report", name: "Defect Criteria Report", mode: "General", doc: docDefect, pageCount: docDefect.getPageCount() },
            ]
        },
        {
            id: 2,
            name: "Inspection Summary",
            reports: [
                { id: "inspection-summary-graph", name: "Inspection Summary by Graph", mode: "General", doc: docGraph, pageCount: docGraph.getPageCount() },
            ]
        },
        {
            id: 3,
            name: "General Visual Inspection",
            reports: [
                { id: "rov-rgvi-report", name: "General Visual Inspection Report (ROV)", mode: "ROV", doc: docRgvi, pageCount: docRgvi.getPageCount() },
            ]
        },
        {
            id: 4,
            name: "Cathodic Protection Potential Survey",
            reports: [
                { id: "rov-cp-report", name: "CP Survey Report (ROV)", mode: "ROV", doc: docCp, pageCount: docCp.getPageCount() },
            ]
        },
        {
            id: 5,
            name: "Base Level Survey",
            reports: [
                { id: "rov-rscor-survey-report", name: "Scour Survey Report (ROV)", mode: "ROV", doc: docScour, pageCount: docScour.getPageCount() },
            ]
        },
        {
            id: 6,
            name: "Flooded Member Detection Survey",
            reports: [
                { id: "rov-fmd-report", name: "FMD Survey Report (ROV)", mode: "ROV", doc: docFmd, pageCount: docFmd.getPageCount() },
            ]
        }
    ];

    // 3. Compute Page Numbers
    // Page 1: Main Cover
    // Page 2: Table of Contents (TOC)
    const tocPagesCount = 1;
    let runningPageNum = 1 + tocPagesCount + 1; // Starts at Page 3

    const sectionsWithPages: TOCSectionItem[] = [];
    const sectionDividers: PDFDocument[] = [];

    for (const sec of sectionsRaw) {
        const secStartPage = runningPageNum;
        runningPageNum += 1; // Section divider page

        const divBlob = await generateSectionDividerPage(sec.name, coverOptions);
        const divDoc = await PDFDocument.load(await divBlob.arrayBuffer());
        sectionDividers.push(divDoc);

        const repItems = sec.reports.map(r => {
            const rStartPage = runningPageNum;
            runningPageNum += r.pageCount;
            return {
                id: r.id,
                name: r.name,
                mode: r.mode,
                pageNum: rStartPage,
                pageCount: r.pageCount
            };
        });

        sectionsWithPages.push({
            id: sec.id,
            name: sec.name,
            pageNum: secStartPage,
            templates: repItems
        });
    }

    // Account for End of Report Cover Page (1 page at the end of the dossier)
    const endOfReportPageNum = runningPageNum;
    runningPageNum += 1;

    const totalDocumentPages = runningPageNum - 1;
    console.log(`Document Layout computed: ${sectionsWithPages.length} Sections + End Cover, Total Pages: ${totalDocumentPages}`);

    // 4. Generate Main Cover & TOC Pages
    console.log("Generating Main Cover Page...");
    const mainCoverBlob = await generateMainCoverPage(coverOptions);
    const mainCoverDoc = await PDFDocument.load(await mainCoverBlob.arrayBuffer());

    console.log("Generating Table of Contents Page with link bounding boxes...");
    const { blobs: tocBlobs, linkTargets } = await generateTOCPages(
        sectionsWithPages,
        totalDocumentPages,
        coverOptions
    );

    // 5. Merge into Final Master PDF
    console.log("Assembling Final Datasheet PDF package...");
    const mergedPdf = await PDFDocument.create();

    // 5A. Add Cover Page
    const [copiedCover] = await mergedPdf.copyPages(mainCoverDoc, [0]);
    mergedPdf.addPage(copiedCover);

    // 5B. Add TOC Pages
    const addedTocPages: any[] = [];
    for (const tBlob of tocBlobs) {
        const tDoc = await PDFDocument.load(await tBlob.arrayBuffer());
        const [copiedToc] = await mergedPdf.copyPages(tDoc, [0]);
        mergedPdf.addPage(copiedToc);
        addedTocPages.push(copiedToc);
    }

    // 5C. Add Section Dividers and Sub-Reports
    for (let i = 0; i < sectionsRaw.length; i++) {
        const sec = sectionsRaw[i];
        const divDoc = sectionDividers[i];

        // Divider
        const [copiedDiv] = await mergedPdf.copyPages(divDoc, [0]);
        mergedPdf.addPage(copiedDiv);

        // Reports
        for (const rep of sec.reports) {
            const pages = await mergedPdf.copyPages(rep.doc, rep.doc.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
        }
    }

    // 5D. Add End of Report Cover Page
    console.log("Generating End of Report Cover Page...");
    const endCoverBlob = await generateEndOfReportCoverPage(coverOptions);
    const endCoverDoc = await PDFDocument.load(await endCoverBlob.arrayBuffer());
    const [copiedEndCover] = await mergedPdf.copyPages(endCoverDoc, [0]);
    mergedPdf.addPage(copiedEndCover);

    // 6. Attach Clickable PDF Link Annotations to TOC Page(s)
    console.log(`Attaching ${linkTargets.length} clickable navigation link annotations to TOC page...`);
    applyTOCLinksToPdf(mergedPdf, addedTocPages, linkTargets);

    // 7. Global Page Numbering
    console.log("Applying continuous global page numbering...");
    const totalPages = mergedPdf.getPageCount();
    const font = await mergedPdf.embedFont(StandardFonts.Helvetica);

    for (let idx = 0; idx < totalPages; idx++) {
        const p = mergedPdf.getPage(idx);
        const { width } = p.getSize();
        const pageStr = `Page ${idx + 1} of ${totalPages}`;
        const fontSize = 7.5;
        const textWidth = font.widthOfTextAtSize(pageStr, fontSize);
        const textColor = rgb(0.45, 0.52, 0.62);

        p.drawText(pageStr, {
            x: width - 40 - textWidth,
            y: 17,
            size: fontSize,
            font,
            color: textColor,
        });
    }

    // 8. Save output
    const finalPdfBytes = await mergedPdf.save();

    const publicPath = path.join(process.cwd(), "public", "Final_Inspection_Datasheet.pdf");
    fs.writeFileSync(publicPath, finalPdfBytes);
    console.log(`Saved public PDF to: ${publicPath}`);

    const artifactPath = "C:/Users/nq352/.gemini/antigravity-ide/brain/21cba234-1dbb-4df4-8f24-25392a01b934/Final_Inspection_Datasheet.pdf";
    try {
        fs.writeFileSync(artifactPath, finalPdfBytes);
        console.log(`Saved artifact PDF to: ${artifactPath}`);
    } catch (_) {}

    console.log(`SUCCESS! Final Datasheet PDF successfully compiled: ${totalPages} pages, ${finalPdfBytes.length} bytes.`);
}

main().catch(err => {
    console.error("Error generating final datasheet dossier:", err);
    process.exit(1);
});
