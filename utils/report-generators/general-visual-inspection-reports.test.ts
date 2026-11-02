import { describe, it, expect } from "vitest";
import {
    generateROVRGVIReport,
    buildROVRGVIRows,
    extractHardSoftGrowth as extractROVHardSoftGrowth,
    formatCoverage as formatROVCoverage
} from "./rov-rgvi-report";
import {
    generateDivingGVINSReport,
    buildDivingGVINSRows,
    extractHardSoftGrowth as extractDivingHardSoftGrowth,
    formatCoverage as formatDivingCoverage
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

        it("builds 2 rows per record with separate Hard and Soft Growth columns and Finding on second row", () => {
            const rows = buildROVRGVIRows(record, 0);
            expect(rows).toHaveLength(2);

            const [row1, row2] = rows;

            // Row 1: No. (rowSpan: 2) | Component QID | Elevation (m) | Dive No. | Tape No. | CP (mV) | Component Condition | Coating Condition | Hard Growth (%) | Soft Growth (%)
            expect(row1).toHaveLength(10);
            expect(row1[0]).toMatchObject({ content: "1", rowSpan: 2 });
            expect(row1[1]).toBe("VDM N3-N11");
            expect(row1[2]).toBe("0");
            expect(row1[3]).toBe("R001");
            expect(row1[4]).toBe("2026-01/PLAT-C/V001R");
            expect(row1[5]).toBe("-950 mV");
            expect(row1[6]).toBe("Good");
            expect(row1[7]).toBe("Intact");
            expect(row1[8]).toBe("10%");
            expect(row1[9]).toBe("20%");

            // Row 2: Finding label in second column, merged observations across 3rd through 10th column (colSpan: 8)
            expect(row2).toHaveLength(2);
            expect(row2[0]).toMatchObject({ content: "Finding" });
            expect(row2[1]).toMatchObject({ colSpan: 8 });

            // Ensure marine growth and conditions are NOT in the Finding text
            const findingText = row2[1].content;
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

        it("builds 2 rows per record for Diving with separate Hard and Soft Growth columns and Finding on second row", () => {
            const rows = buildDivingGVINSRows(divingRecord, 0);
            expect(rows).toHaveLength(2);

            const [row1, row2] = rows;

            // Row 1: No. (rowSpan: 2) | Component QID | Elevation (m) | Dive No. | Component Condition | Coating Condition | Hard Growth (%) | Soft Growth (%)
            expect(row1).toHaveLength(8);
            expect(row1[0]).toMatchObject({ content: "1", rowSpan: 2 });
            expect(row1[1]).toBe("LEG A1-EL-15");
            expect(row1[2]).toBe("-15");
            expect(row1[3]).toBe("D003");
            expect(row1[4]).toBe("Minor pitting");
            expect(row1[5]).toBe("Fair");
            expect(row1[6]).toBe("15%");
            expect(row1[7]).toBe("40%");

            // Row 2: Finding label in second column, merged observations across remaining columns (colSpan: 6)
            expect(row2).toHaveLength(2);
            expect(row2[0]).toMatchObject({ content: "Finding" });
            expect(row2[1]).toMatchObject({ colSpan: 6 });

            // Ensure marine growth and conditions are NOT in Finding text
            const findingText = row2[1].content;
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
    });
});
