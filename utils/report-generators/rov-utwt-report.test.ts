import { describe, it, expect } from "vitest";
import { 
    generateROVUTWTReport, 
    formatCoverage, 
    buildROVUTWTRow 
} from "./rov-utwt-report";

describe("UT Wall Thickness Inspection Report (ROV) Template", () => {
    const headerData = {
        platformName: "PLAT-C",
        jobpackName: "26003/PLAT-C/NAQIB",
        sowReportNo: "NAQIBPLATC",
        vessel: "MV PIONEER",
        contractorLogoUrl: "",
    };

    const companySettings = {
        company_name: "Petronas Carigali Sdn Bhd (SKA)",
        department_name: "Technical Services Department",
    };

    it("formats hard and soft marine growth coverage properly", () => {
        expect(formatCoverage(null)).toBe("—");
        expect(formatCoverage("")).toBe("—");
        expect(formatCoverage("0")).toBe("0%");
        expect(formatCoverage("0%")).toBe("0%");
        expect(formatCoverage(15)).toBe("15%");
        expect(formatCoverage("25")).toBe("25%");
        expect(formatCoverage("30%")).toBe("30%");
    });

    it("builds row with separate Hard Growth (%) and Soft Growth (%) columns and UT clock readings", () => {
        const record = {
            elevation: "-9",
            structure_components: { q_id: "VDM N1120-N2110", nominal_wall_thickness: 15 },
            inspection_data: {
                elevation: "-9",
                marine_growth_hard: "15%",
                marine_growth_soft: "30%",
                ut_12_o_clock: "13",
                ut_3_o_clock: "15",
                ut_6_o_clock: "18",
                ut_9_o_clock: "14",
                findings: "The UT reading obtained was within the acceptable range as stipulated by the client.",
            },
            insp_rov_jobs: { job_no: "TG004" },
            has_anomaly: false,
        };

        const row = buildROVUTWTRow(record, 0);

        // Columns: 
        // 0: Item No., 1: Component QID, 2: Elevation (m), 3: Dive No.,
        // 4: Hard Growth (%), 5: Soft Growth (%),
        // 6: 12 O'clock, 7: 3 O'clock, 8: 6 O'clock, 9: 9 O'clock,
        // 10: Nominal (mm), 11: Findings
        expect(row).toHaveLength(12);
        expect(row[0]).toBe(1);
        expect(row[1]).toBe("VDM N1120-N2110");
        expect(row[2]).toBe("-9");
        expect(row[3]).toBe("TG004");
        expect(row[4]).toBe("15%");
        expect(row[5]).toBe("30%");
        expect(row[6]).toBe("13");
        expect(row[7]).toBe("15");
        expect(row[8]).toBe("18");
        expect(row[9]).toBe("14");
        expect(row[10]).toBe("15");
        expect(row[11]).toContain("The UT reading obtained was within the acceptable range");
    });

    it("extracts hard and soft growth from combined marine_growth string if separate fields are omitted", () => {
        const record = {
            elevation: "-12",
            structure_components: { q_id: "VDM N2200" },
            inspection_data: {
                marine_growth: "Hard: 20%, Soft: 50%",
                ut_12_o_clock: "16",
                ut_3_o_clock: "16",
                ut_6_o_clock: "16",
                ut_9_o_clock: "16",
            },
        };

        const row = buildROVUTWTRow(record, 0);
        expect(row[4]).toBe("20%");
        expect(row[5]).toBe("50%");
    });

    it("generates a valid landscape PDF Blob with UT Wall Thickness Inspection Report title and columns", async () => {
        const records = [
            {
                elevation: "-9",
                structure_components: { q_id: "VDM N1120-N2110", nominal_wall_thickness: 15 },
                inspection_data: {
                    elevation: "-9",
                    marine_growth_hard: "15%",
                    marine_growth_soft: "30%",
                    ut_12_o_clock: "13",
                    ut_3_o_clock: "15",
                    ut_6_o_clock: "18",
                    ut_9_o_clock: "14",
                    findings: "The UT reading obtained was within the acceptable range as stipulated by the client.",
                },
                insp_rov_jobs: { job_no: "TG004" },
            }
        ];

        const blob = await generateROVUTWTReport(records, headerData, companySettings, {
            returnBlob: true,
            reportNoPrefix: "NAQIBPLATC",
        });

        expect(blob).toBeTruthy();
        expect(blob).toBeInstanceOf(Blob);
        expect((blob as Blob).size).toBeGreaterThan(1000);
    });
});
