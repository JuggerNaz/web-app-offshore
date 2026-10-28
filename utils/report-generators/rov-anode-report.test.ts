import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { generateROVAnodeReport } from "./rov-anode-report";

describe("generateROVAnodeReport", () => {
    const sampleHeader = {
        platformName: "PLAT-C",
        vessel: "mov2, mov",
        jobpackName: "UIMC2026/NQ/Plat01",
        sowReportNo: "2026-01A",
    };

    const sampleCompany = {
        company_name: "Petronas Carigali Sdn Bhd (SKA)",
        department_name: "Technical Services Department",
    };

    const sampleRecords = [
        {
            elevation: "-9",
            structure_components: { q_id: "BAN004" },
            inspection_data: {
                depletion_percent: "25%",
                cp_rdg: "-400",
                anode_type: "TYPE A",
                marine_growth_hard: "15%",
                marine_growth_soft: "35%",
            },
            has_anomaly: true,
            insp_rov_jobs: { job_no: "R001" },
            description: "test3 anomaly found",
        },
        {
            elevation: "-20",
            structure_components: { q_id: "BAN007" },
            inspection_data: {
                depletion_percent: "25-50%",
                cp_rdg: "-850 mV",
                anode_type: "TYPE B",
                // Test numeric inputs without %
                marine_growth_hard: 20,
                marine_growth_soft: 40,
            },
            has_anomaly: false,
            insp_rov_jobs: { job_no: "R001" },
            description: "tested",
        },
        {
            elevation: "-35",
            structure_components: { q_id: "BAN012" },
            inspection_data: {
                depletion_percent: "10%",
                cp_rdg: "-920",
                anode_type: "TYPE C",
                // Test composite marine_growth string
                marine_growth: "Hard: 10%, Soft: 25%",
            },
            has_anomaly: false,
            insp_rov_jobs: { job_no: "R002" },
            description: "clean anode",
        },
        {
            elevation: "-50",
            structure_components: { q_id: "BAN020" },
            inspection_data: {
                depletion_percent: "5%",
                cp_rdg: "-1000",
                anode_type: "TYPE A",
                // Empty marine growth
            },
            has_anomaly: false,
            insp_rov_jobs: { job_no: "R002" },
            description: "no marine growth recorded",
        }
    ];

    it("generates a valid PDF Blob with Marine Growth Hard and Soft columns", async () => {
        const recordedTexts: string[] = [];
        const initHook = [
            "initialized",
            function (this: any) {
                const origText = this.text;
                this.text = function (...args: any[]) {
                    recordedTexts.push(String(args[0]));
                    return origText.apply(this, args);
                };
            }
        ];
        (jsPDF.API as any).events.push(initHook);

        try {
            const result = await generateROVAnodeReport(
                sampleRecords,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, showSignatures: true, sowReportNo: "2026-01A" }
            );

            expect(result).toBeInstanceOf(Blob);
            expect((result as Blob).size).toBeGreaterThan(1000);

            // Verify Headers
            expect(recordedTexts).toContain("Marine Growth (%)");
            expect(recordedTexts).toContain("Hard");
            expect(recordedTexts).toContain("Soft");

            // Verify Percentage Values
            expect(recordedTexts).toContain("15%");
            expect(recordedTexts).toContain("35%");
            expect(recordedTexts).toContain("20%");
            expect(recordedTexts).toContain("40%");
            expect(recordedTexts).toContain("10%");
            expect(recordedTexts).toContain("25%");

            // Verify Standard Anode Columns
            expect(recordedTexts).toContain("BAN004");
            expect(recordedTexts).toContain("BAN007");
            expect(recordedTexts).toContain("BAN012");
            expect(recordedTexts).toContain("BAN020");
            expect(recordedTexts).toContain("-400 mV");
            expect(recordedTexts).toContain("-850 mV");
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("handles empty / blank records gracefully", async () => {
        const result = await generateROVAnodeReport(
            [],
            sampleHeader,
            sampleCompany,
            { returnBlob: true, isBlankReport: true, sowReportNo: "2026-01A" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(500);
    });
});
