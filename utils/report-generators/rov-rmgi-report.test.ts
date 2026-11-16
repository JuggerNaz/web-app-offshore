import { describe, it, expect } from "vitest";
import { 
    generateROVRMGIReport, 
    extractROVRMGICoverage, 
    getROVRMGIClockReadings, 
    buildROVRMGIRow,
    sortROVRMGIRecords 
} from "./rov-rmgi-report";

describe("generateROVRMGIReport & MGI table data processing", () => {
    const headerData = {
        platformName: "BODP-A",
        jobpackName: "UIMC2026/SKA/MGI",
        sowReportNo: "SOW-2026-MGI-001",
        vessel: "SEAPRO-1",
        contractorLogoUrl: "",
    };

    const companySettings = {
        company_name: "Offshore Engineering Services",
        department_name: "Subsea Structural Integrity",
    };

    const sampleRecords = [
        {
            elevation: "-15.5",
            structure_components: { q_id: "LEG-A1" },
            inspection_data: {
                marine_growth_hard: "40%",
                marine_growth_soft: "60%",
                mgi_hard_thickness_at_12: "25",
                mgi_hard_thickness_at_3: "35",
                mgi_hard_thickness_at_6: "20",
                mgi_hard_thickness_at_9: "30",
                mgi_soft_thickness_at_12: "15",
                mgi_soft_thickness_at_3: "18",
                mgi_soft_thickness_at_6: "12",
                mgi_soft_thickness_at_9: "10",
                findings: "Marine growth barnacles observed evenly around tubular circumference",
            },
            insp_rov_jobs: { job_no: "ROV-01" },
            tape_no: "T-001",
            has_anomaly: false,
            status: "NORMAL"
        },
        {
            elevation: "-20.0",
            structure_components: { q_id: "BRACE-B2" },
            inspection_data: {
                marine_growth: "Hard: 80%, Soft: 20%",
                mgi_hard_thickness_at_12: 50,
                mgi_hard_thickness_at_3: 45,
                mgi_hard_thickness_at_6: 40,
                mgi_hard_thickness_at_9: 42,
                mgi_soft_thickness_at_12: 10,
                mgi_soft_thickness_at_3: 12,
                mgi_soft_thickness_at_6: 15,
                mgi_soft_thickness_at_9: 8,
            },
            insp_rov_jobs: { job_no: "ROV-01" },
            tape_no: "T-002",
            has_anomaly: true,
            status: "ANOMALY",
            defect_description: "Severe marine growth exceeding allowable limit with heavy hard fouling",
            anomaly_ref_no: "ANO-MGI-001"
        },
        {
            elevation: "-30.0",
            structure_components: { q_id: "LEG-A2" },
            inspection_data: {
                // Testing null/empty fields
                marine_growth_hard: null,
                marine_growth_soft: null,
            },
            insp_rov_jobs: { job_no: "ROV-02" },
            tape_no: "T-003",
            has_anomaly: false,
            status: "NORMAL",
            description: "No significant findings"
        }
    ];

    it("extracts hard and soft marine growth coverage percentages accurately", () => {
        // Direct properties
        const cov1 = extractROVRMGICoverage({ marine_growth_hard: "40%", marine_growth_soft: "60%" });
        expect(cov1.h).toBe("40%");
        expect(cov1.s).toBe("60%");

        // Numeric values
        const cov2 = extractROVRMGICoverage({ marine_growth_hard: 25, marine_growth_soft: 75 });
        expect(cov2.h).toBe("25%");
        expect(cov2.s).toBe("75%");

        // Parsed from composite string
        const cov3 = extractROVRMGICoverage({ marine_growth: "Hard: 80%, Soft: 20%" });
        expect(cov3.h).toBe("80%");
        expect(cov3.s).toBe("20%");

        // Empty/null fallback
        const cov4 = extractROVRMGICoverage({});
        expect(cov4.h).toBe("—");
        expect(cov4.s).toBe("—");
    });

    it("extracts 4-clock position thickness readings for hard and soft accurately", () => {
        const readings = getROVRMGIClockReadings({
            mgi_hard_thickness_at_12: "25",
            mgi_hard_thickness_at_3: "35",
            mgi_hard_thickness_at_6: "20",
            mgi_hard_thickness_at_9: "30",
            mgi_soft_thickness_at_12: "15",
            mgi_soft_thickness_at_3: "18",
            mgi_soft_thickness_at_6: "12",
            mgi_soft_thickness_at_9: "10",
        });

        expect(readings.hVals).toEqual([25, 35, 20, 30]);
        expect(readings.sVals).toEqual([15, 18, 12, 10]);
        expect(readings.maxHard).toBe(35);
        expect(readings.hDisplay).toEqual(["25", "35", "20", "30"]);
        expect(readings.sDisplay).toEqual(["15", "18", "12", "10"]);
    });

    it("builds 16-column table row with dedicated coverage & clock positions and stripped findings", () => {
        const row0 = buildROVRMGIRow(sampleRecords[0], 0);
        expect(row0.length).toBe(16);
        expect(row0[0]).toBe("1");              // No.
        expect(row0[1]).toBe("LEG-A1");         // QID
        expect(row0[2]).toBe("-15.5 m");        // Elevation
        expect(row0[3]).toBe("ROV-01");         // Dive No.
        expect(row0[4]).toBe("T-001");          // Tape No.
        expect(row0[5]).toBe("40%");            // Coverage HARD %
        expect(row0[6]).toBe("60%");            // Coverage SOFT %
        expect(row0[7]).toBe("25");             // 12H
        expect(row0[8]).toBe("35");             // 3H
        expect(row0[9]).toBe("20");             // 6H
        expect(row0[10]).toBe("30");            // 9H
        expect(row0[11]).toBe("15");            // 12S
        expect(row0[12]).toBe("18");            // 3S
        expect(row0[13]).toBe("12");            // 6S
        expect(row0[14]).toBe("10");            // 9S

        // Findings column: MUST NOT contain "Readings:" or "Marine Growth Coverage:"
        expect(row0[15]).not.toContain("Readings:");
        expect(row0[15]).not.toContain("Marine Growth Coverage:");
        expect(row0[15]).toContain("Marine growth barnacles observed evenly around tubular circumference");

        // Anomaly record
        const row1 = buildROVRMGIRow(sampleRecords[1], 1);
        expect(row1.length).toBe(16);
        expect(row1[5]).toBe("80%");            // Coverage HARD %
        expect(row1[6]).toBe("20%");            // Coverage SOFT %
        expect(row1[7]).toBe("50");             // 12H
        expect(row1[8]).toBe("45");             // 3H
        expect(row1[9]).toBe("40");             // 6H
        expect(row1[10]).toBe("42");            // 9H
        expect(row1[11]).toBe("10");            // 12S
        expect(row1[12]).toBe("12");            // 3S
        expect(row1[13]).toBe("15");            // 6S
        expect(row1[14]).toBe("8");             // 9S

        // Findings column for Anomaly
        expect(row1[15]).not.toContain("Readings:");
        expect(row1[15]).not.toContain("Marine Growth Coverage:");
        expect(row1[15]).toContain("Anomaly Description: Severe marine growth exceeding allowable limit with heavy hard fouling");
        expect(row1[15]).toContain("Please refer to Anomaly No.: ANO-MGI-001");
    });

    it("generates a landscape PDF blob successfully with records", async () => {
        const blob = await generateROVRMGIReport(
            sampleRecords,
            headerData,
            companySettings,
            { returnBlob: true, printFriendly: false }
        );

        expect(blob).toBeInstanceOf(Blob);
        expect((blob as Blob).size).toBeGreaterThan(1000);
    });

    it("handles printFriendly mode without errors", async () => {
        const blob = await generateROVRMGIReport(
            sampleRecords,
            headerData,
            companySettings,
            { returnBlob: true, printFriendly: true }
        );

        expect(blob).toBeInstanceOf(Blob);
        expect((blob as Blob).size).toBeGreaterThan(1000);
    });

    it("orders records by elevation from top to bottom (descending)", async () => {
        const unordered = [
            { elevation: "-25.0", structure_components: { q_id: "LEG-B" } },
            { elevation: "+2.5", structure_components: { q_id: "LEG-A" } },
            { elevation: "-50.0", structure_components: { q_id: "LEG-D" } },
            { elevation: "0.0", structure_components: { q_id: "LEG-C" } },
            { elevation: "-10.0", structure_components: { q_id: "LEG-E" } },
        ];

        const sorted = sortROVRMGIRecords(unordered);
        expect(sorted.map(r => r.elevation)).toEqual([
            "+2.5",
            "0.0",
            "-10.0",
            "-25.0",
            "-50.0"
        ]);

        const blob = await generateROVRMGIReport(
            unordered,
            headerData,
            companySettings,
            { returnBlob: true }
        );
        expect(blob).toBeInstanceOf(Blob);
    });

    it("handles empty records by returning null unless isBlankReport is true", async () => {
        const nullRes = await generateROVRMGIReport(
            [],
            headerData,
            companySettings,
            { returnBlob: true, isBlankReport: false }
        );
        expect(nullRes).toBeNull();

        const blankRes = await generateROVRMGIReport(
            [],
            headerData,
            companySettings,
            { returnBlob: true, isBlankReport: true }
        );
        expect(blankRes).toBeInstanceOf(Blob);
    });
});
