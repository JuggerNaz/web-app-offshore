import { describe, it, expect } from "vitest";
import {
    generateROVRGVIReport,
    buildROVRGVIRows,
    extractHardSoftGrowth as extractROVHardSoftGrowth,
    formatCoverage as formatROVCoverage,
    formatCondition as formatROVCondition,
    extractComponentCondition as extractROVCompCondition,
    extractCoatingCondition as extractROVCoatCondition,
} from "./rov-rgvi-report";
import {
    generateDivingGVINSReport,
    buildDivingGVINSRows,
    extractHardSoftGrowth as extractDivingHardSoftGrowth,
    formatCoverage as formatDivingCoverage,
    formatCondition as formatDivingCondition,
    extractComponentCondition as extractDivingCompCondition,
    extractCoatingCondition as extractDivingCoatCondition,
} from "./diving-gvins-report";

describe("General Visual Inspection Report Templates (ROV & Diving)", () => {
    const headerData = {
        platformName: "PLAT-C",
        jobpackName: "UIMC2026/NQ/Plat01",
        sowReportNo: "2026-01A",
        vessel: "mov2, mov",
        contractorLogoUrl: "",
    };

    const companySettings = {
        company_name: "Petronas Carigali Sdn Bhd (SKA)",
        department_name: "Technical Services Department",
    };

    describe("Hard and Soft Growth Extraction", () => {
        it("extracts hard and soft growth percentages properly", () => {
            expect(extractROVHardSoftGrowth({})).toEqual({ hard: "—", soft: "—" });
            expect(extractROVHardSoftGrowth({ marine_growth_hard: "15%", marine_growth_soft: "35%" }))
                .toEqual({ hard: "15%", soft: "35%" });
            expect(extractROVHardSoftGrowth({ marine_growth_hard: 20, marine_growth_soft: 0 }))
                .toEqual({ hard: "20%", soft: "0%" });
            expect(extractROVHardSoftGrowth({ marine_growth: "Hard: 10%, Soft: 45%" }))
                .toEqual({ hard: "10%", soft: "45%" });
        });
    });

    describe("Condition Formatting & Fallback", () => {
        it("returns 'N/A' when condition is null, undefined, empty, whitespace, '-', or 'None'", () => {
            expect(formatROVCondition(null)).toBe("N/A");
            expect(formatROVCondition(undefined)).toBe("N/A");
            expect(formatROVCondition("")).toBe("N/A");
            expect(formatROVCondition("   ")).toBe("N/A");
            expect(formatROVCondition("-")).toBe("N/A");
            expect(formatROVCondition("--")).toBe("N/A");
            expect(formatROVCondition("None")).toBe("N/A");
            expect(formatROVCondition("null")).toBe("N/A");
            expect(formatROVCondition("N/A")).toBe("N/A");
            expect(formatROVCondition("Good")).toBe("Good");
            expect(formatROVCondition("Intact")).toBe("Intact");

            expect(formatDivingCondition("")).toBe("N/A");
            expect(formatDivingCondition("  ")).toBe("N/A");
            expect(formatDivingCondition(null)).toBe("N/A");
            expect(formatDivingCondition("Damaged")).toBe("Damaged");
        });
    });

    describe("ROV General Visual Inspection (RGVI)", () => {
        const record = {
            id: 1,
            elevation: "0",
            structure_components: { q_id: "VDM N3-N11" },
            inspection_data: {
                elevation: "0",
                dive_no: "R001",
                tape_no: "2026-01/PLAT-C/V001R",
                cp_rdg: "-950",
                component_condition: "Good",
                coating_condition: "Intact",
                marine_growth_hard: "10%",
                marine_growth_soft: "20%",
                debris: "Metallic clamp",
                description: "Debris is in contact",
            },
            insp_rov_jobs: { job_no: "R001" },
            has_anomaly: false,
        };

        it("builds 2 rows per record with merged QID across two rows and Finding data on second row", () => {
            const rows = buildROVRGVIRows(record, 0);
            expect(rows).toHaveLength(2);

            const [row1, row2] = rows;

            // Row 1: No. (rowSpan: 2) | Component QID (rowSpan: 2) | Elevation (m) | Dive No. | Tape No. | CP (mV) | Component Condition | Coating Condition | Hard Growth (%) | Soft Growth (%)
            expect(row1).toHaveLength(10);
            expect(row1[0]).toMatchObject({ content: "1", rowSpan: 2, styles: { halign: "center", valign: "top" } });
            expect(row1[1]).toMatchObject({ content: "VDM N3-N11", rowSpan: 2, styles: { halign: "left", valign: "top" } });
            expect(row1[2]).toBe("0");
            expect(row1[3]).toBe("R001");
            expect(row1[4]).toBe("2026-01/PLAT-C/V001R");
            expect(row1[5]).toBe("-950 mV");
            expect(row1[6]).toBe("Good");
            expect(row1[7]).toBe("Intact");
            expect(row1[8]).toBe("10%");
            expect(row1[9]).toBe("20%");

            // Row 2: Finding data merged across remaining columns (colSpan: 8) with "Finding: " prefix
            expect(row2).toHaveLength(1);
            expect(row2[0]).toMatchObject({ colSpan: 8 });

            // Ensure finding text begins with "Finding: " and excludes marine growth and conditions
            const findingText = row2[0].content;
            expect(findingText).toMatch(/^Finding:\s+/);
            expect(findingText).toContain("Debris is in contact");
            expect(findingText).toContain("Debris: Metallic clamp");
            expect(findingText).not.toContain("Component Condition:");
            expect(findingText).not.toContain("Coating Condition:");
            expect(findingText).not.toContain("Marine Growth:");
        });

        it("generates a valid portrait PDF Blob for ROV RGVI", async () => {
            const blob = await generateROVRGVIReport([record], headerData, companySettings, {
                returnBlob: true,
                reportNoPrefix: "2026-01A",
            });

            expect(blob).toBeTruthy();
            expect(blob).toBeInstanceOf(Blob);
            expect((blob as Blob).size).toBeGreaterThan(1000);
        });

        it("handles long tape numbers (e.g., AM26-016-02/BODP-A/V010R) cleanly in ROV RGVI", async () => {
            const longTapeRecord = {
                ...record,
                inspection_data: {
                    ...record.inspection_data,
                    tape_no: "AM26-016-02/BODP-A/V010R",
                },
            };
            const rows = buildROVRGVIRows(longTapeRecord, 0);
            expect(rows[0][4]).toBe("AM26-016-02/BODP-A/V010R");

            const blob = await generateROVRGVIReport([longTapeRecord], headerData, companySettings, {
                returnBlob: true,
                reportNoPrefix: "AM26-016-02",
            });
            expect(blob).toBeTruthy();
            expect(blob).toBeInstanceOf(Blob);
        });

        it("displays 'N/A' when Component Condition or Coating Condition are empty strings in ROV RGVI", () => {
            const emptyCondRecord = {
                ...record,
                inspection_data: {
                    ...record.inspection_data,
                    component_condition: "",
                    coating_condition: "   ",
                    cp_rdg: "",
                },
            };
            const rows = buildROVRGVIRows(emptyCondRecord, 0);
            expect(rows[0][5]).toBe("—"); // CP stays "—"
            expect(rows[0][6]).toBe("N/A"); // Component Condition is "N/A"
            expect(rows[0][7]).toBe("N/A"); // Coating Condition is "N/A"
        });
    });

    describe("Diving General Visual Inspection (GVINS)", () => {
        const divingRecord = {
            id: 2,
            elevation: "-15",
            structure_components: { q_id: "LEG A1-EL-15" },
            inspection_data: {
                elevation: "-15",
                component_condition: "Minor pitting",
                coating_condition: "Fair",
                marine_growth: "Hard: 15%, Soft: 40%",
            },
            description: "Visual inspection completed. Minor surface pitting noted on east face.",
            insp_dive_jobs: { job_no: "D003" },
            has_anomaly: false,
        };

        it("builds 2 rows per record for Diving with merged QID across two rows and Finding data on second row", () => {
            const rows = buildDivingGVINSRows(divingRecord, 0);
            expect(rows).toHaveLength(2);

            const [row1, row2] = rows;

            // Row 1: No. (rowSpan: 2) | Component QID (rowSpan: 2) | Elevation (m) | Dive No. | Component Condition | Coating Condition | Hard Growth (%) | Soft Growth (%)
            expect(row1).toHaveLength(8);
            expect(row1[0]).toMatchObject({ content: "1", rowSpan: 2, styles: { halign: "center", valign: "top" } });
            expect(row1[1]).toMatchObject({ content: "LEG A1-EL-15", rowSpan: 2, styles: { halign: "left", valign: "top" } });
            expect(row1[2]).toBe("-15");
            expect(row1[3]).toBe("D003");
            expect(row1[4]).toBe("Minor pitting");
            expect(row1[5]).toBe("Fair");
            expect(row1[6]).toBe("15%");
            expect(row1[7]).toBe("40%");

            // Row 2: Finding data merged across remaining columns (colSpan: 6) with "Finding: " prefix
            expect(row2).toHaveLength(1);
            expect(row2[0]).toMatchObject({ colSpan: 6 });

            // Ensure finding text begins with "Finding: " and excludes marine growth and conditions
            const findingText = row2[0].content;
            expect(findingText).toMatch(/^Finding:\s+/);
            expect(findingText).toContain("Minor surface pitting noted on east face");
            expect(findingText).not.toContain("Component Condition:");
            expect(findingText).not.toContain("Coating Condition:");
            expect(findingText).not.toContain("Marine Growth:");
        });

        it("generates a valid portrait PDF Blob for Diving GVINS", async () => {
            const blob = await generateDivingGVINSReport([divingRecord], headerData, companySettings, {
                returnBlob: true,
                reportNoPrefix: "2026-01A",
            });

            expect(blob).toBeTruthy();
            expect(blob).toBeInstanceOf(Blob);
            expect((blob as Blob).size).toBeGreaterThan(1000);
        });

        it("displays 'N/A' when Component Condition or Coating Condition are empty strings in Diving GVINS", () => {
            const emptyCondRecord = {
                ...divingRecord,
                inspection_data: {
                    ...divingRecord.inspection_data,
                    component_condition: "",
                    coating_condition: "   ",
                },
            };
            const rows = buildDivingGVINSRows(emptyCondRecord, 0);
            expect(rows[0][4]).toBe("N/A"); // Component Condition is "N/A"
            expect(rows[0][5]).toBe("N/A"); // Coating Condition is "N/A"
        });
    });

    describe("Attachment Sketch Reports (ROV Caisson & Conductor)", () => {
        it("generates Caisson and Conductor sketch reports with appended conditions and marine growth in findings", async () => {
            const { generateROVCasnSketchReport } = await import("./rov-rcasn-sketch-report");
            const { generateROVCondSketchReport } = await import("./rov-rcond-sketch-report");

            const caissonRecord = {
                id: 10,
                elevation: "-12",
                inspection_type_code: "RCASN",
                structure_components: { id: 10, q_id: "CS-01", code: "CS", name: "Caisson 1" },
                inspection_data: {
                    elevation: "-12",
                    dive_no: "R005",
                    cp_rdg: "-980",
                    component_condition: "Good",
                    coating_condition: "Intact",
                    marine_growth_hard: "15%",
                    marine_growth_soft: "35%",
                    description: "Inspected member surface",
                },
                insp_rov_jobs: { job_no: "R005" },
                has_anomaly: false,
            };

            const condRecord = {
                id: 20,
                elevation: "-12",
                inspection_type_code: "RCOND",
                structure_components: { id: 20, q_id: "CD-01", code: "CD", name: "Conductor 1" },
                inspection_data: {
                    elevation: "-12",
                    dive_no: "R005",
                    cp_rdg: "-980",
                    component_condition: "Good",
                    coating_condition: "Intact",
                    marine_growth_hard: "15%",
                    marine_growth_soft: "35%",
                    description: "Inspected member surface",
                },
                insp_rov_jobs: { job_no: "R005" },
                has_anomaly: false,
            };

            const caissonBlob = await generateROVCasnSketchReport([caissonRecord], headerData, companySettings, {
                returnBlob: true,
                reportNoPrefix: "2026-01A",
            });
            expect(caissonBlob).toBeTruthy();
            expect(caissonBlob).toBeInstanceOf(Blob);

            const condBlob = await generateROVCondSketchReport([condRecord], headerData, companySettings, {
                returnBlob: true,
                reportNoPrefix: "2026-01A",
            });
            expect(condBlob).toBeTruthy();
            expect(condBlob).toBeInstanceOf(Blob);
        });
    });
});
