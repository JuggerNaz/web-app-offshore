import { describe, it, expect } from "vitest";
import { 
    generateROVSelectedNodeReport, 
    formatCoverage, 
    buildROVSelectedNodeRow 
} from "./rov-selected-node-report";

describe("Selected Node Inspection Report Template", () => {
    const headerData = {
        platformName: "WPA",
        jobpackName: "JP-2026-ROV",
        sowReportNo: "SOW-ROV-001",
        vessel: "SAPURA-1",
        contractorLogoUrl: "",
    };

    const companySettings = {
        company_name: "Petrofac Offshore",
        department_name: "Subsea Operations",
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

    it("builds row with separate Hard Growth and Soft Growth columns", () => {
        const record = {
            elevation: "-25.0",
            structure_components: { q_id: "NODE-A1-2" },
            inspection_data: {
                elevation: "-25.0",
                marine_growth_hard: "30%",
                marine_growth_soft: "45%",
                cp_rdg: "-980",
                component_condition: "Good",
                coating_condition: "Intact",
                findings: "No significant defects noted",
            },
            insp_rov_jobs: { job_no: "ROV-DIVE-04" },
            has_anomaly: false,
        };

        const row = buildROVSelectedNodeRow(record, 0);

        // Columns: No., QID, Elevation, Dive No., CP, Hard Growth, Soft Growth, Component Condition, Coating Condition, Findings
        expect(row).toHaveLength(10);
        expect(row[0]).toBe("1");
        expect(row[1]).toBe("NODE-A1-2");
        expect(row[2]).toBe("-25.0 m");
        expect(row[3]).toBe("ROV-DIVE-04");
        expect(row[4]).toBe("-980 mV");
        expect(row[5]).toBe("30%");
        expect(row[6]).toBe("45%");
        expect(row[7]).toBe("Good");
        expect(row[8]).toBe("Intact");
        expect(row[9]).toBe("No significant defects noted");
    });

    it("extracts hard and soft growth from combined marine_growth string if individual fields are not present", () => {
        const record = {
            elevation: "-18.5",
            structure_components: { q_id: "NODE-B3-1" },
            inspection_data: {
                marine_growth: "Hard: 10%, Soft: 40%",
                component_condition: "Corroded",
                coating_condition: "Damaged",
            },
        };

        const row = buildROVSelectedNodeRow(record, 1);
        expect(row[5]).toBe("10%");
        expect(row[6]).toBe("40%");
    });

    it("generates a PDF blob in landscape mode without throwing", async () => {
        const records = [
            {
                elevation: "-15.0",
                structure_components: { q_id: "NODE-N1" },
                inspection_data: {
                    marine_growth_hard: "20%",
                    marine_growth_soft: "50%",
                    cp_rdg: -960,
                    component_condition: "Satisfactory",
                    coating_condition: "Fair",
                },
            }
        ];

        const blob = await generateROVSelectedNodeReport(records, headerData, companySettings, {
            returnBlob: true,
            printFriendly: false,
        });

        expect(blob).toBeTruthy();
        expect(blob).toBeInstanceOf(Blob);
    });
});

