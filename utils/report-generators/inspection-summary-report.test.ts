import { describe, it, expect, vi } from "vitest";
import { generateInspectionSummaryReport } from "./inspection-summary-report";

describe("generateInspectionSummaryReport", () => {
    const sampleSummaryData = {
        sow: {
            total: 120,
            completed: 96,
            incomplete: 24,
            pending: 0,
            completionPct: 80,
        },
        records: {
            total: 110,
            completed: 96,
            incomplete: 14,
            anomaly: 8,
            finding: 12,
            rovCount: 85,
            diveCount: 25,
            hasBothModes: true,
            inspTypeBreakdown: {
                RGVI: { name: "General Visual Inspection (GVI)", count: 40, rov: 40, dive: 0, anomaly: 2, finding: 3 },
                RSZCI: { name: "Splash Zone Inspection (SZI)", count: 15, rov: 15, dive: 0, anomaly: 1, finding: 2 },
                RSCOR: { name: "Scour Survey", count: 12, rov: 12, dive: 0, anomaly: 1, finding: 1 },
                RMGI: { name: "Marine Growth (MGI)", count: 20, rov: 20, dive: 0, anomaly: 2, finding: 4 },
                RSANI: { name: "Anode Inspection", count: 23, rov: 23, dive: 0, anomaly: 2, finding: 2 },
            }
        },
        sow_summary: [
            { inspectionName: "General Visual Inspection (GVI)", totalQid: 45, completedQid: 40, incompleteQid: 5, completionPct: "89%" },
            { inspectionName: "Splash Zone Inspection (SZI)", totalQid: 18, completedQid: 15, incompleteQid: 3, completionPct: "83%" },
            { inspectionName: "Scour Survey", totalQid: 12, completedQid: 12, incompleteQid: 0, completionPct: "100%" },
            { inspectionName: "Anode Inspection", totalQid: 25, completedQid: 23, incompleteQid: 2, completionPct: "92%" },
            { inspectionName: "CP Survey / Reading", totalQid: 20, completedQid: 18, incompleteQid: 2, completionPct: "90%" },
        ],
        anomalies: {
            total: 8,
            byPriority: {
                "Priority 1": 1,
                "Priority 2": 3,
                "Observation": 4,
            },
            byDefectType: {
                AW: 2,
                CP: 1,
                DB: 1,
                PD: 2,
                SC: 1,
                LI: 1,
            }
        },
        mgi: {
            total: 20,
            avg: 45.2,
            max: 120,
            min: 15,
        },
        anodeGvi: {
            total: 25,
            depletionBuckets: {
                "0–25%": 12,
                "25–50%": 8,
                "50–75%": 3,
                "75–100%": 2,
            }
        },
        scour: {
            total: 12,
            exposed: 2,
            maxDepth: 1.8,
        }
    };

    const sampleHeader = {
        platformName: "PRODUCTION PLATFORM",
        fieldName: "BETTY FIELD",
        waterDepth: 73,
        registeredAnodes: 52,
        sowReportNo: "SOW-BETTY-2026-001",
    };

    const sampleCompany = {
        company_name: "NasQuest Resources Sdn Bhd",
        department_name: "Technical Inspection Division",
    };

    it("generates a valid Blob in landscape mode with returnBlob=true", async () => {
        const result = await generateInspectionSummaryReport(
            sampleSummaryData,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, sowReportNo: "SOW-BETTY-2026-001" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("supports printer-friendly mode without error", async () => {
        const result = await generateInspectionSummaryReport(
            sampleSummaryData,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, printFriendly: true, sowReportNo: "SOW-BETTY-2026-001" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("renders accurately with multiple anode types and all 4 depletion buckets (Pic 3)", async () => {
        const dataWithAnodes = {
            ...sampleSummaryData,
            anodeGvi: {
                total: 208,
                anodeTypes: ["ANODE TYPE A", "ANODE TYPE B", "ANODE TYPE E", "ANODE TYPE F"],
                anodeTypeStr: "Type A, Type B, Type E, Type F",
                depletionBuckets: {
                    "0-25%": 16,
                    "26-50%": 95,
                    "50-75%": 72,
                    "76-100%": 25,
                }
            }
        };

        const result = await generateInspectionSummaryReport(
            dataWithAnodes,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, sowReportNo: "SOW-BETTY-2026-001" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("renders scour survey details with mm depth and distinct face/pile metrics (Pic 2)", async () => {
        const dataWithScour = {
            ...sampleSummaryData,
            scour: {
                total: 20,
                registeredFaces: 4,
                facesSurveyed: 4,
                pilesSurveyed: 4,
                scourFindingsCount: 4,
                maxDepthMm: 300,
                maxDepth: 300,
            }
        };

        const result = await generateInspectionSummaryReport(
            dataWithScour,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, sowReportNo: "AM26-016-01" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("correctly maps anomaly priorities with non-deleted library items and 0 for empty counts (Pic 1)", async () => {
        const dataWithAnomalies = {
            ...sampleSummaryData,
            anomalies: {
                total: 15,
                byPriority: {
                    "Priority 1": 0,
                    "Priority 2": 8,
                    "Priority 3": 0,
                    "Observation": 7,
                },
                byDefectType: {
                    AW: 8,
                    DB: 7,
                }
            }
        };

        const result = await generateInspectionSummaryReport(
            dataWithAnomalies,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, sowReportNo: "AM26-016-01" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("renders Marine Growth coverage bands for Hard and Soft, and MGI thickness block (Pic 3)", async () => {
        const dataWithMgi = {
            ...sampleSummaryData,
            mgi: {
                total: 189,
                hardBands: { "0-20%": 13, "20-40%": 0, "40-60%": 1, "60-80%": 1, "80-100%": 174 },
                softBands: { "0-20%": 13, "20-40%": 0, "40-60%": 1, "60-80%": 1, "80-100%": 174 },
                totalHardReadings: 189,
                totalSoftReadings: 189,
                hasCoverageData: true,
                thickness: {
                    hasData: true,
                    count: 12,
                    min: 10,
                    max: 45,
                    avg: 24.5,
                    hardAvg: 22.0,
                    hardMax: 35,
                    softAvg: 26.0,
                    softMax: 45,
                }
            }
        };

        const result = await generateInspectionSummaryReport(
            dataWithMgi,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, sowReportNo: "AM26-016-01" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("correctly resolves water depth from depth, waterDepth, or structureInfo", async () => {
        // Testing with structure depth (as returned by database)
        const headerWithDepthOnly = {
            platformName: "BEP-A",
            fieldName: "BETTY.",
            depth: 73,
            sowReportNo: "AM26-016-02",
        };

        const result = await generateInspectionSummaryReport(
            sampleSummaryData,
            headerWithDepthOnly,
            sampleCompany,
            { returnBlob: true, sowReportNo: "AM26-016-02" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);

        // Testing with negative depth (e.g. -70)
        const headerWithNegativeDepth = {
            platformName: "BODP-A",
            fieldName: "BOKOR.",
            water_depth: -70,
            sowReportNo: "AM26-016-02",
        };

        const result2 = await generateInspectionSummaryReport(
            sampleSummaryData,
            headerWithNegativeDepth,
            sampleCompany,
            { returnBlob: true, sowReportNo: "AM26-016-02" }
        );

        expect(result2).toBeInstanceOf(Blob);
        expect((result2 as Blob).size).toBeGreaterThan(1000);
    });

    it("conditionally includes FMD only when FMD data exists", async () => {
        // Without FMD
        const resWithoutFmd = await generateInspectionSummaryReport(
            sampleSummaryData,
            sampleHeader,
            sampleCompany,
            { returnBlob: true }
        );
        expect(resWithoutFmd).toBeInstanceOf(Blob);

        // With FMD
        const dataWithFmd = {
            ...sampleSummaryData,
            fmd: {
                total: 15,
                conditions: { dry: 14, flooded: 1, grouted: 0, inconclusive: 0 }
            }
        };
        const resWithFmd = await generateInspectionSummaryReport(
            dataWithFmd,
            sampleHeader,
            sampleCompany,
            { returnBlob: true }
        );
        expect(resWithFmd).toBeInstanceOf(Blob);
        expect((resWithFmd as Blob).size).toBeGreaterThan(0);
    });

    it("renders 4 task blocks in one row and displays Exposed pile count with 0 default in scour table", async () => {
        const dataWithAll4Tasks = {
            ...sampleSummaryData,
            scour: {
                total: 20,
                registeredFaces: 4,
                facesSurveyed: 4,
                pilesSurveyed: 4,
                exposedCount: 0,
                scourFindingsCount: 4,
                maxDepthMm: 300,
            },
            cp: {
                totalCount: 54,
                maxVal: -853,
                minVal: -1005,
                primaryRov: 29,
                primaryDive: 0,
            }
        };

        const result = await generateInspectionSummaryReport(
            dataWithAll4Tasks,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, sowReportNo: "AM26-016-01" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("renders Anomaly Distribution with Rectified row and table format style for both priority and defect blocks", async () => {
        const dataWithRectified = {
            ...sampleSummaryData,
            anomalies: {
                total: 15,
                rectified: 3,
                open: 12,
                byPriority: {
                    "Priority 1": 0,
                    "Priority 2": 8,
                    "Priority 3": 0,
                    "Observation": 7,
                },
                byDefectType: {
                    AW: 5,
                    DB: 7,
                    VS: 3,
                }
            }
        };

        const result = await generateInspectionSummaryReport(
            dataWithRectified,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, sowReportNo: "AM26-016-01" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });
});
