import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { loadLogoWithTransparency, drawLogo, applyWatermarkAndSignaturesGlobal , formatPdfDate } from "./shared-logo";

interface CompanySettings {
    company_name?: string;
    department_name?: string;
    logo_url?: string;
}

interface ReportConfig {
    reportNoPrefix?: string;
    printFriendly?: boolean;
    preparedBy?: { name: string; date: string };
    reviewedBy?: { name: string; date: string };
    approvedBy?: { name: string; date: string };
    returnBlob?: boolean;
    showPageNumbers?: boolean;
    showSignatures?: boolean;
}

/**
 * Returns customized column definitions and subheaders for blank inspection reports.
 */
function getTemplateTableSpec(templateId: string): {
    orientation: "portrait" | "landscape";
    head: any[];
    columnStyles?: Record<number, any>;
    sampleRowCount?: number;
} {
    const isLandscape = [
        "diving-acfmc-report",
        "diving-plco-report",
        "diving-anmain-report"
    ].includes(templateId);

    // Default Portrait 2-level or 1-level headers
    switch (templateId) {
        case "diving-szone-report":
        case "szci-report":
            return {
                orientation: "portrait",
                sampleRowCount: 12,
                head: [
                    [
                        { content: "Item No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                        { content: "QID", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                        { content: "CP Reading\n(-mV)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                        { content: "Wall Thickness (mm) (o'clock)", colSpan: 4, styles: { halign: "center", valign: "middle" } },
                        { content: "Nominal\nThk (mm)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                        { content: "Dive / ROV No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                        { content: "Findings / Remarks", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    ],
                    [
                        { content: "3", styles: { halign: "center" } },
                        { content: "6", styles: { halign: "center" } },
                        { content: "9", styles: { halign: "center" } },
                        { content: "12", styles: { halign: "center" } },
                    ]
                ],
                columnStyles: {
                    0: { cellWidth: 14, halign: "center" },
                    1: { cellWidth: 26 },
                    2: { cellWidth: 20, halign: "center" },
                    3: { cellWidth: 14, halign: "center" },
                    4: { cellWidth: 14, halign: "center" },
                    5: { cellWidth: 14, halign: "center" },
                    6: { cellWidth: 14, halign: "center" },
                    7: { cellWidth: 18, halign: "center" },
                    8: { cellWidth: 20, halign: "center" },
                    9: { cellWidth: "auto" },
                }
            };

        case "rov-cp-report":
        case "diving-cpclb-report":
            return {
                orientation: "portrait",
                sampleRowCount: 14,
                head: [
                    [
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Component QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "Primary CP (-mV)", styles: { halign: "center", valign: "middle" } },
                        { content: "Add. CP (-mV)", styles: { halign: "center", valign: "middle" } },
                        { content: "Dive / Tape No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Anom Ref / Findings", styles: { halign: "center", valign: "middle" } },
                    ]
                ],
                columnStyles: {
                    0: { cellWidth: 16, halign: "center" },
                    1: { cellWidth: 32 },
                    2: { cellWidth: 22, halign: "center" },
                    3: { cellWidth: 24, halign: "center" },
                    4: { cellWidth: 24, halign: "center" },
                    5: { cellWidth: 24, halign: "center" },
                    6: { cellWidth: "auto" },
                }
            };

        case "utwt-report":
        case "diving-utwtk-report":
        case "diving-utclb-report":
            return {
                orientation: "portrait",
                sampleRowCount: 12,
                head: [
                    [
                        { content: "Item No.", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                        { content: "QID / Location", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                        { content: "UT Readings (mm)", colSpan: 4, styles: { halign: "center", valign: "middle" } },
                        { content: "Nominal (mm)", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                        { content: "Findings / Remarks", rowSpan: 2, styles: { halign: "center", valign: "middle" } },
                    ],
                    [
                        { content: "3 o'clock", styles: { halign: "center" } },
                        { content: "6 o'clock", styles: { halign: "center" } },
                        { content: "9 o'clock", styles: { halign: "center" } },
                        { content: "12 o'clock", styles: { halign: "center" } },
                    ]
                ],
                columnStyles: {
                    0: { cellWidth: 14, halign: "center" },
                    1: { cellWidth: 28 },
                    2: { cellWidth: 20, halign: "center" },
                    3: { cellWidth: 18, halign: "center" },
                    4: { cellWidth: 18, halign: "center" },
                    5: { cellWidth: 18, halign: "center" },
                    6: { cellWidth: 18, halign: "center" },
                    7: { cellWidth: 20, halign: "center" },
                    8: { cellWidth: "auto" },
                }
            };

        case "rov-anode-report":
        case "rov-anode-rsani-report":
        case "diving-anode-report":
            return {
                orientation: "portrait",
                sampleRowCount: 12,
                head: [
                    [
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Anode QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "CP (-mV)", styles: { halign: "center", valign: "middle" } },
                        { content: "Depletion %", styles: { halign: "center", valign: "middle" } },
                        { content: "Dimensions (L x W x H)", styles: { halign: "center", valign: "middle" } },
                        { content: "Condition & Findings", styles: { halign: "center", valign: "middle" } },
                    ]
                ],
                columnStyles: {
                    0: { cellWidth: 16, halign: "center" },
                    1: { cellWidth: 28 },
                    2: { cellWidth: 22, halign: "center" },
                    3: { cellWidth: 22, halign: "center" },
                    4: { cellWidth: 22, halign: "center" },
                    5: { cellWidth: 32, halign: "center" },
                    6: { cellWidth: "auto" },
                }
            };

        case "diving-acfmc-report":
            return {
                orientation: "landscape",
                sampleRowCount: 10,
                head: [
                    [
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Member / Weld QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "Direction of Travel", styles: { halign: "center", valign: "middle" } },
                        { content: "Clock Pos.", styles: { halign: "center", valign: "middle" } },
                        { content: "Probe No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Crack Length (mm)", styles: { halign: "center", valign: "middle" } },
                        { content: "Crack Depth (mm)", styles: { halign: "center", valign: "middle" } },
                        { content: "Dive / File No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Findings & Remarks", styles: { halign: "center", valign: "middle" } },
                    ]
                ],
                columnStyles: {
                    0: { cellWidth: 16, halign: "center" },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 22, halign: "center" },
                    3: { cellWidth: 28, halign: "center" },
                    4: { cellWidth: 20, halign: "center" },
                    5: { cellWidth: 22, halign: "center" },
                    6: { cellWidth: 24, halign: "center" },
                    7: { cellWidth: 24, halign: "center" },
                    8: { cellWidth: 24, halign: "center" },
                    9: { cellWidth: "auto" },
                }
            };

        case "diving-plco-report":
            return {
                orientation: "landscape",
                sampleRowCount: 10,
                head: [
                    [
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Component QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "Surface Condition", styles: { halign: "center", valign: "middle" } },
                        { content: "CP Reading (-mV)", styles: { halign: "center", valign: "middle" } },
                        { content: "Damage Length (mm)", styles: { halign: "center", valign: "middle" } },
                        { content: "Damage Width (mm)", styles: { halign: "center", valign: "middle" } },
                        { content: "Assessment", styles: { halign: "center", valign: "middle" } },
                        { content: "Findings & Anomaly Ref", styles: { halign: "center", valign: "middle" } },
                    ]
                ],
                columnStyles: {
                    0: { cellWidth: 16, halign: "center" },
                    1: { cellWidth: 35 },
                    2: { cellWidth: 22, halign: "center" },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 24, halign: "center" },
                    5: { cellWidth: 25, halign: "center" },
                    6: { cellWidth: 25, halign: "center" },
                    7: { cellWidth: 28 },
                    8: { cellWidth: "auto" },
                }
            };

        case "diving-anmain-report":
            return {
                orientation: "landscape",
                sampleRowCount: 10,
                head: [
                    [
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Anode QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "Dive No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Anode Type", styles: { halign: "center", valign: "middle" } },
                        { content: "Installed Date", styles: { halign: "center", valign: "middle" } },
                        { content: "Action (Replaced / Installed)", styles: { halign: "center", valign: "middle" } },
                        { content: "Position", styles: { halign: "center", valign: "middle" } },
                        { content: "Est. Life (Yrs)", styles: { halign: "center", valign: "middle" } },
                        { content: "Findings & Remarks", styles: { halign: "center", valign: "middle" } },
                    ]
                ],
                columnStyles: {
                    0: { cellWidth: 14, halign: "center" },
                    1: { cellWidth: 30 },
                    2: { cellWidth: 20, halign: "center" },
                    3: { cellWidth: 20, halign: "center" },
                    4: { cellWidth: 24, halign: "center" },
                    5: { cellWidth: 24, halign: "center" },
                    6: { cellWidth: 32, halign: "center" },
                    7: { cellWidth: 22, halign: "center" },
                    8: { cellWidth: 20, halign: "center" },
                    9: { cellWidth: "auto" },
                }
            };

        case "diving-item-report":
        case "diving-plic-report":
        case "PL_IC":
            return {
                orientation: "portrait",
                sampleRowCount: 12,
                head: [
                    [
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "Dive No.", styles: { halign: "center", valign: "middle" } },
                        { content: "CP (-mV)", styles: { halign: "center", valign: "middle" } },
                        { content: "Type of Item", styles: { halign: "center", valign: "middle" } },
                        { content: "Description", styles: { halign: "center", valign: "middle" } },
                        { content: "Findings", styles: { halign: "center", valign: "middle" } },
                    ]
                ],
                columnStyles: {
                    0: { cellWidth: 14, halign: "center" },
                    1: { cellWidth: 24 },
                    2: { cellWidth: 20, halign: "center" },
                    3: { cellWidth: 20, halign: "center" },
                    4: { cellWidth: 22, halign: "center" },
                    5: { cellWidth: 26 },
                    6: { cellWidth: 34 },
                    7: { cellWidth: "auto" },
                }
            };

        // Standard Default Inspection Table layout
        default:
            return {
                orientation: isLandscape ? "landscape" : "portrait",
                sampleRowCount: 14,
                head: [
                    [
                        { content: "Item No.", styles: { halign: "center", valign: "middle" } },
                        { content: "Component QID", styles: { halign: "center", valign: "middle" } },
                        { content: "Elevation (m)", styles: { halign: "center", valign: "middle" } },
                        { content: "CP Reading (-mV)", styles: { halign: "center", valign: "middle" } },
                        { content: "Condition / Observation", styles: { halign: "center", valign: "middle" } },
                        { content: "Dive / ROV Job", styles: { halign: "center", valign: "middle" } },
                        { content: "Findings / Anomaly Remarks", styles: { halign: "center", valign: "middle" } },
                    ]
                ],
                columnStyles: {
                    0: { cellWidth: 16, halign: "center" },
                    1: { cellWidth: 32 },
                    2: { cellWidth: 22, halign: "center" },
                    3: { cellWidth: 24, halign: "center" },
                    4: { cellWidth: 35 },
                    5: { cellWidth: 22, halign: "center" },
                    6: { cellWidth: "auto" },
                }
            };
    }
}

/**
 * Generates a 1-page blank inspection report with fields, section boxes, and empty table grid.
 */
export const generateBlankInspectionReport = async (
    templateId: string,
    templateTitle: string,
    companySettings: CompanySettings,
    config: ReportConfig
): Promise<Blob | void> => {
    try {
        const headerData = {
            jobpackName: ". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .",
            sowReportNo: config.reportNoPrefix || "____________________",
            platformName: ". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .",
            contractorLogoUrl: "",
            vessel: ". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . ."
        };

        const generatorConfig = {
            ...config,
            returnBlob: true,
            printFriendly: config.printFriendly ?? true
        };

        // Create 12 empty/blank rows so table fields and layout are printed fully
        const blankRecords: any[] = Array.from({ length: 12 }, (_, i) => ({
            id: i + 1,
            elevation: 0,
            inspection_data: {
                cp_rdg: "",
                cp: "",
                ut_3_o_clock: "",
                ut_6_o_clock: "",
                ut_9_o_clock: "",
                ut_12_o_clock: "",
                nominal_thickness: "",
                ut_unit: "mm"
            },
            structure_components: {
                q_id: "",
                code: ""
            },
            component: {
                q_id: ""
            },
            description: "",
            insp_dive_jobs: {
                dive_no: ""
            },
            insp_rov_jobs: {
                job_no: ""
            }
        }));

        // Dynamic delegate to actual generator module
        switch (templateId) {
            case "diving-szone-report": {
                const { generateDivingSZONEReport } = await import("./diving-szone-report");
                return await generateDivingSZONEReport(blankRecords, headerData, companySettings, generatorConfig as any, null);
            }
            case "szci-report": {
                const { generateROVSZCIReport } = await import("./rov-szci-report");
                return await generateROVSZCIReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "utwt-report": {
                const { generateROVUTWTReport } = await import("./rov-utwt-report");
                return await generateROVUTWTReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-utwtk-report": {
                const { generateDivingUTWTKReport } = await import("./diving-utwtk-report");
                return await generateDivingUTWTKReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-cp-report": {
                const { generateROVCPReport } = await import("./rov-cp-report");
                return await generateROVCPReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-cpclb-report": {
                const { generateDivingCPCLBReport } = await import("./diving-cpclb-report");
                return await generateDivingCPCLBReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-anode-report": {
                const { generateROVAnodeReport } = await import("./rov-anode-report");
                return await generateROVAnodeReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-anode-rsani-report": {
                const { generateROVAnodeRSANIReport } = await import("./rov-anode-rsani-report");
                return await generateROVAnodeRSANIReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-anode-report": {
                const { generateDivingAnodeReport } = await import("./diving-anode-report");
                return await generateDivingAnodeReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-acfmc-report": {
                const { generateDivingACFMCReport } = await import("./diving-acfmc-report");
                return await generateDivingACFMCReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-plco-report": {
                const { generateDivingPLCOReport } = await import("./diving-plco-report");
                return await generateDivingPLCOReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-anmain-report": {
                const { generateDivingANMAINReport } = await import("./diving-anmain-report");
                return await generateDivingANMAINReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-gvins-report": {
                const { generateDivingGVINSReport } = await import("./diving-gvins-report");
                return await generateDivingGVINSReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-bsins-report": {
                const { generateDivingBSINSReport } = await import("./diving-bsins-report");
                return await generateDivingBSINSReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-cvins-report": {
                const { generateDivingCVINSReport } = await import("./diving-cvins-report");
                return await generateDivingCVINSReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-clean-report": {
                const { generateDivingCLEANReport } = await import("./diving-clean-report");
                return await generateDivingCLEANReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-mpins-report": {
                const { generateDivingMPINSReport } = await import("./diving-mpins-report");
                return await generateDivingMPINSReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rgvi-report": {
                const { generateROVRGVIReport } = await import("./rov-rgvi-report");
                return await generateROVRGVIReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rcond-report": {
                const { generateROVCondReport } = await import("./rov-rcond-report");
                return await generateROVCondReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rcasn-report": {
                const { generateROVCasnReport } = await import("./rov-rcasn-report");
                return await generateROVCasnReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-selected-node-report": {
                const { generateROVSelectedNodeReport } = await import("./rov-selected-node-report");
                return await generateROVSelectedNodeReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "defect-anomaly-report":
            case "findings-report": {
                const { generateDefectAnomalyReport } = await import("./defect-anomaly-report");
                const isFindingsReport = templateId === "findings-report";
                return await generateDefectAnomalyReport(
                    { name: ". . . . . . . . . . . . . . . . . . . ." },
                    { str_name: ". . . . . . . . . . . . . . . . . . . ." },
                    generatorConfig.reportNoPrefix || "____________________",
                    companySettings as any,
                    { ...generatorConfig, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport } as any
                );
            }
            case "defect-summary":
            case "findings-summary": {
                const { generateDefectSummaryReport } = await import("./defect-summary-report");
                const isFindingsReport = templateId === "findings-summary";
                return await generateDefectSummaryReport(
                    { name: ". . . . . . . . . . . . . . . . . . . ." },
                    { str_name: ". . . . . . . . . . . . . . . . . . . ." },
                    generatorConfig.reportNoPrefix || "____________________",
                    companySettings as any,
                    { ...generatorConfig, prefix: isFindingsReport ? "F-" : "A-", isFindingsReport } as any
                );
            }
            case "diver-log-report": {
                const { generateDiverLogReport } = await import("./diver-log-report");
                return await generateDiverLogReport(
                    { name: ". . . . . . . . . . . . . . . . . . . ." },
                    { str_name: ". . . . . . . . . . . . . . . . . . . ." },
                    generatorConfig.reportNoPrefix || "____________________",
                    companySettings as any,
                    generatorConfig as any
                );
            }
            case "video-log-report": {
                const { generateVideoLogReport } = await import("./video-log-report");
                return await generateVideoLogReport(
                    { name: ". . . . . . . . . . . . . . . . . . . ." },
                    { str_name: ". . . . . . . . . . . . . . . . . . . ." },
                    generatorConfig.reportNoPrefix || "____________________",
                    companySettings as any,
                    generatorConfig as any
                );
            }
            case "rov-ricmi-report": {
                const { generateROVRICMIReport } = await import("./rov-ricmi-report");
                return await generateROVRICMIReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rwdi-report": {
                const { generateROVRWDIReport } = await import("./rov-rwdi-report");
                return await generateROVRWDIReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "fmd-report": {
                const { generateROVFMDReport } = await import("./rov-fmd-report");
                return await generateROVFMDReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-fmd-report": {
                const { generateDivingFMDReport } = await import("./diving-fmd-report");
                return await generateDivingFMDReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-measu-report": {
                const { generateDivingMEASUReport } = await import("./diving-measu-report");
                return await generateDivingMEASUReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "mgi-report": {
                const { generateROVMGIGraphReport } = await import("./rov-mgi-report");
                return await generateROVMGIGraphReport(blankRecords, null, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rmgi-report": {
                const { generateROVRMGIReport } = await import("./rov-rmgi-report");
                return await generateROVRMGIReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-mgi-report": {
                const { generateDivingMGIReport } = await import("./diving-mgi-report");
                return await generateDivingMGIReport(blankRecords, null, headerData, companySettings, generatorConfig as any);
            }
            case "diving-rrisi-report":
            case "drrisi-report":
            case "diving-jtisi-report":
            case "diving-itisi-report": {
                const { generateDivingRRISIReport } = await import("./diving-rrisi-report");
                let reportType: 'R' | 'J' | 'I' = 'R';
                if (templateId === "diving-jtisi-report") reportType = 'J';
                if (templateId === "diving-itisi-report") reportType = 'I';
                return await generateDivingRRISIReport(blankRecords, headerData, companySettings, { ...generatorConfig, reportType } as any);
            }
            case "diving-rrisi-detail-report":
            case "drrisi-detail-report":
            case "diving-jtisi-detail-report":
            case "diving-itisi-detail-report": {
                const { generateDivingRRISIDetailReport } = await import("./diving-rrisi-detail-report");
                let reportType: 'R' | 'J' | 'I' = 'R';
                if (templateId === "diving-jtisi-detail-report") reportType = 'J';
                if (templateId === "diving-itisi-detail-report") reportType = 'I';
                return await generateDivingRRISIDetailReport(blankRecords, headerData, companySettings, { ...generatorConfig, reportType } as any);
            }
            case "rrisi-report":
            case "rov-jtisi-report":
            case "rov-itisi-report": {
                const { generateROVRRISIReport } = await import("./rov-rrisi-report");
                let reportType: 'R' | 'J' | 'I' = 'R';
                if (templateId === "rov-jtisi-report") reportType = 'J';
                if (templateId === "rov-itisi-report") reportType = 'I';
                return await generateROVRRISIReport(blankRecords, headerData, companySettings, { ...generatorConfig, reportType } as any);
            }
            case "rrisi-detail-report": {
                const { generateROVRRISIDetailReport } = await import("./rov-rrisi-detail-report");
                return await generateROVRRISIDetailReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-jtisi-detail-report": {
                const { generateROVRRISIJTubeDetailReport } = await import("./rov-jtisi-detail-report");
                return await generateROVRRISIJTubeDetailReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-itisi-detail-report": {
                const { generateROVRRISIITubeDetailReport } = await import("./rov-itisi-detail-report");
                return await generateROVRRISIITubeDetailReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-scour-report": {
                const { generateROVRSCORReport } = await import("./rov-rscor-report");
                return await generateROVRSCORReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rcasn-sketch-report": {
                const { generateROVCasnSketchReport } = await import("./rov-rcasn-sketch-report");
                return await generateROVCasnSketchReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rcond-sketch-report": {
                const { generateROVCondSketchReport } = await import("./rov-rcond-sketch-report");
                return await generateROVCondSketchReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-bl-report": {
                const { generateROVBoatlandingReport } = await import("./rov-boatlanding-report");
                return await generateROVBoatlandingReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rg-report": {
                const { generateROVRiserGuardReport } = await import("./rov-riser-guard-report");
                return await generateROVRiserGuardReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-sg-report": {
                const { generateROVCaissonGuardReport } = await import("./rov-caisson-guard-report");
                return await generateROVCaissonGuardReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-cu-report": {
                const { generateROVConductorGuardReport } = await import("./rov-conductor-guard-report");
                return await generateROVConductorGuardReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-photo-report": {
                const { generateROVPhotographyReport } = await import("./rov-photography-report");
                return await generateROVPhotographyReport([], headerData, companySettings, generatorConfig as any);
            }
            case "rov-photo-log-report": {
                const { generateROVPhotographyLogReport } = await import("./rov-photography-log-report");
                return await generateROVPhotographyLogReport([], headerData, companySettings, generatorConfig as any);
            }
            case "rov-rseab-detail-report": {
                const { generateROVRSEABDetailReport } = await import("./rov-rseab-detail-report");
                return await generateROVRSEABDetailReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rseab-gas-detail-report": {
                const { generateROVRSEABGasDetailReport } = await import("./rov-rseab-gas-detail-report");
                return await generateROVRSEABGasDetailReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-rseab-crater-detail-report": {
                const { generateROVRSEABCraterDetailReport } = await import("./rov-rseab-crater-detail-report");
                return await generateROVRSEABCraterDetailReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-dcasn-report":
            case "diving-dcasn-uw-report":
            case "diving-dcasn-ts-report": {
                const { generateDivingDCASNReport } = await import("./diving-dcasn-report");
                return await generateDivingDCASNReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "diving-dcond-report":
            case "diving-dcond-uw-report":
            case "diving-dcond-ts-report": {
                const { generateDivingDCONDReport } = await import("./diving-dcond-report");
                return await generateDivingDCONDReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "inspection-report": {
                const { generateInspectionReport } = await import("./inspection-report");
                return await generateInspectionReport(0, companySettings, generatorConfig as any);
            }
            case "diving-utclb-report": {
                const { generateDivingUTWTKReport } = await import("./diving-utwtk-report");
                return await generateDivingUTWTKReport(blankRecords, headerData, companySettings, generatorConfig as any);
            }
            case "rov-seabed-report":
            case "seabed-survey-debris":
            case "seabed-survey-gas":
            case "seabed-survey-crater": {
                const { generateSeabedSurveyReport } = await import("./seabed-survey-report");
                const filterMap: Record<string, string> = {
                    "rov-seabed-report": "",
                    "seabed-survey-debris": "Debris",
                    "seabed-survey-gas": "Gas Seepage",
                    "seabed-survey-crater": "Crater"
                };
                return await generateSeabedSurveyReport(
                    { name: ". . . . . . . . . . . . . . . . . . . ." },
                    { str_name: ". . . . . . . . . . . . . . . . . . . ." },
                    generatorConfig.reportNoPrefix || "____________________",
                    companySettings as any,
                    generatorConfig as any,
                    filterMap[templateId] || ""
                );
            }
            default: {
                // Fall back to original custom grid renderer if template generator not listed
                return await generateCustomFallbackBlank(templateId, templateTitle, companySettings, config, headerData);
            }
        }
    } catch (error) {
        console.error("Error generating blank inspection report:", error);
        throw error;
    }
};

async function generateCustomFallbackBlank(
    templateId: string,
    templateTitle: string,
    companySettings: CompanySettings,
    config: ReportConfig,
    headerData: any
): Promise<Blob | void> {
    const spec = getTemplateTableSpec(templateId);
    const doc = new jsPDF({ orientation: spec.orientation, unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;

    const colors = {
        navy: [31, 55, 93] as [number, number, number],
        lightGray: [248, 250, 252] as [number, number, number],
        border: [203, 213, 225] as [number, number, number],
        text: [30, 41, 59] as [number, number, number],
    };

    const HEADER_H = 24;

    let companyLogo: any = null;
    if (companySettings.logo_url) {
        try { companyLogo = await loadLogoWithTransparency(companySettings.logo_url); } catch (_) { }
    }

    const isPF = config.printFriendly;
    if (isPF) {
        doc.setDrawColor(...colors.navy); doc.setLineWidth(0.5);
        doc.rect(margin, margin, contentWidth, HEADER_H, "S");
        doc.setTextColor(...colors.navy);
    } else {
        doc.setFillColor(...colors.navy);
        doc.rect(margin, margin, contentWidth, HEADER_H, "F");
        doc.setTextColor(255);
    }

    if (companyLogo) drawLogo(doc, companyLogo, 18, 18, pageWidth - margin - 22, margin + 3, "right", "center");

    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(companySettings.company_name || "NasQuest Resources Sdn Bhd", margin + contentWidth / 2, margin + 6, { align: "center" });
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(companySettings.department_name || "Technical Inspection Division", margin + contentWidth / 2, margin + 10, { align: "center" });
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(`${templateTitle}`, margin + contentWidth / 2, margin + 17, { align: "center" });
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.text(`Report No: ${config?.reportNoPrefix || "____________________"}`, margin + contentWidth / 2, margin + 22, { align: "center" });

    const ROW_H = 7;
    const startY = margin + HEADER_H + 4;
    const half = contentWidth / 2;

    const drawBox = (label: string, value: string, x: number, w: number, ty: number) => {
        doc.setDrawColor(...colors.border); doc.setLineWidth(0.1);
        if (!isPF) { doc.setFillColor(...colors.lightGray); doc.rect(x, ty, w, ROW_H, "F"); }
        doc.rect(x, ty, w, ROW_H, "S");
        doc.setTextColor(...colors.text);
        doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
        doc.text(label, x + 2, ty + 4.8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(140, 140, 140);
        doc.text(value, x + 36, ty + 4.8);
    };

    drawBox("Structure:", headerData.platformName, margin, half, startY);
    drawBox("Vessel:", headerData.vessel, margin + half, half, startY);
    drawBox("Job Pack:", headerData.jobpackName, margin, half, startY + ROW_H);
    drawBox("Insp. Date Range:", ". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .", margin + half, half, startY + ROW_H);

    const tableStartY = startY + ROW_H * 2 + 5;

    const colCount = (spec.head[spec.head.length - 1] as any[]).reduce((acc: number, c: any) => acc + (c.colSpan || 1), 0);
    const blankRows: string[][] = Array.from({ length: spec.sampleRowCount || 12 }, (_, i) => {
        const row = Array(colCount).fill("");
        row[0] = String(i + 1);
        return row;
    });

    autoTable(doc, {
        startY: tableStartY,
        margin: { left: margin, right: margin, top: margin + HEADER_H + 10, bottom: 25 },
        head: spec.head,
        body: blankRows,
        theme: "grid",
        headStyles: {
            fillColor: isPF ? [255, 255, 255] : colors.navy,
            textColor: isPF ? colors.navy : [255, 255, 255],
            lineColor: isPF ? colors.navy : colors.border,
            lineWidth: 0.3,
            fontSize: 7.5,
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
        },
        styles: {
            fontSize: 7,
            cellPadding: 3.5,
            textColor: colors.text,
            lineColor: isPF ? colors.navy : colors.border,
            lineWidth: 0.3,
            minCellHeight: 9,
        },
        columnStyles: spec.columnStyles || {},
    });

    applyWatermarkAndSignaturesGlobal(doc, config as any);

    if (config.returnBlob) {
        return doc.output("blob");
    } else {
        doc.save(`${templateTitle.replace(/[^a-z0-9]/gi, '_')}_BLANK.pdf`);
    }
}
