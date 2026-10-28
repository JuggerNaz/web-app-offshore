import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { generateROVSZCIReport } from "./rov-szci-report";

describe("generateROVSZCIReport", () => {
    const sampleHeader = {
        platformName: "BODP-A",
        vessel: "MEO RESOLUTION",
        jobpackName: "UIMC2026/SKA/PLAT01",
        sowReportNo: "AM26-016-02",
    };

    const sampleCompany = {
        company_name: "Subsea Worldwide Solutions",
        department_name: "Technical Services Department",
    };

    const sampleRecords = [
        {
            elevation: "+2.5",
            structure_components: { q_id: "VDM N1-N121" },
            inspection_data: {
                cp_rdg: "-950",
                ut_12_o_clock: "24.8",
                ut_3_o_clock: "25.1",
                ut_6_o_clock: "24.9",
                ut_9_o_clock: "25.0",
                marine_growth_hard: "15%",
                marine_growth_soft: "30%",
                component_condition: "Good",
                coating_condition: "Good",
            },
            has_anomaly: false,
            insp_rov_jobs: { job_no: "JR01" },
            description: "No significant corrosion",
        },
        {
            elevation: "+0.5",
            structure_components: { q_id: "VDM N1-N122" },
            inspection_data: {
                cp_rdg: "-980",
                ut_12: "23.5",
                ut_3: "23.9",
                ut_6: "24.0",
                ut_9: "23.8",
                // Test numeric inputs without %
                marine_growth_hard: 25,
                marine_growth_soft: 45,
                component_condition: "Fair",
                coating_condition: "Damaged",
            },
            has_anomaly: true,
            insp_rov_jobs: { job_no: "JR01" },
            description: "Coating breakdown near splash level",
        },
        {
            elevation: "-1.5",
            structure_components: { q_id: "VDM N1-N123" },
            inspection_data: {
                cp_rdg: "-1010",
                // Test composite marine_growth string
                marine_growth: "Hard: 10%, Soft: 50%",
                component_condition: "Good",
                coating_condition: "Good",
            },
            has_anomaly: false,
            insp_rov_jobs: { job_no: "JR02" },
            description: "Inspected thoroughly",
        }
    ];

    it("generates a valid PDF with Elevation and Marine Growth Hard/Soft percentage columns", async () => {
        const recordedTexts: string[] = [];
        const initHook = [
            "initialized",
            function (this: any) {
                const origText = this.text;
                this.text = function (...args: any[]) {
                    if (Array.isArray(args[0])) {
                        recordedTexts.push(...args[0].map(String));
                    } else {
                        recordedTexts.push(String(args[0]));
                    }
                    return origText.apply(this, args);
                };
            }
        ];
        (jsPDF.API as any).events.push(initHook);

        try {
            const result = await generateROVSZCIReport(
                sampleRecords,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, showSignatures: true, sowReportNo: "AM26-016-02" }
            );

            expect(result).toBeInstanceOf(Blob);
            expect((result as Blob).size).toBeGreaterThan(1000);

            // Verify Headers (single or wrapped lines)
            expect(recordedTexts.some(t => t.includes("Elevation"))).toBe(true);
            expect(recordedTexts.some(t => t.includes("Marine Growth"))).toBe(true);
            expect(recordedTexts).toContain("Hard");
            expect(recordedTexts).toContain("Soft");
            expect(recordedTexts.some(t => t.includes("Wall Thickness"))).toBe(true);
            expect(recordedTexts.some(t => t.includes("12"))).toBe(true);
            expect(recordedTexts.some(t => t.includes("o'clock"))).toBe(true);

            // Verify Elevation values
            expect(recordedTexts).toContain("+2.5");
            expect(recordedTexts).toContain("+0.5");
            expect(recordedTexts).toContain("-1.5");

            // Verify Marine Growth Percentage values
            expect(recordedTexts).toContain("15%");
            expect(recordedTexts).toContain("30%");
            expect(recordedTexts).toContain("25%");
            expect(recordedTexts).toContain("45%");
            expect(recordedTexts).toContain("10%");
            expect(recordedTexts).toContain("50%");

            // Verify Components and readings
            expect(recordedTexts).toContain("VDM N1-N121");
            expect(recordedTexts).toContain("VDM N1-N122");
            expect(recordedTexts).toContain("VDM N1-N123");
            expect(recordedTexts).toContain("24.8");
            expect(recordedTexts).toContain("25.1");
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("handles empty / blank records gracefully without crashing", async () => {
        const result = await generateROVSZCIReport(
            [],
            sampleHeader,
            sampleCompany,
            { returnBlob: true, isBlankReport: true, sowReportNo: "AM26-016-02" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(500);
    });
});
