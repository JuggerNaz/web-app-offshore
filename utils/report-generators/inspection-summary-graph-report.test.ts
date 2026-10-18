import { describe, it, expect, vi } from "vitest";
import { generateInspectionSummaryGraphReport } from "./inspection-summary-graph-report";

describe("generateInspectionSummaryGraphReport", () => {
    const sampleSummaryData = {
        sow: {
            total: 200,
            completed: 200,
            incomplete: 0,
            pending: 0,
            completionPct: 100,
        },
        records: {
            total: 200,
            completed: 200,
            incomplete: 0,
            anomaly: 15,
            finding: 10,
            rovCount: 200,
            diveCount: 0,
            inspTypeBreakdown: {
                RGVI: { name: "General Visual Inspection (GVI)", count: 180, rov: 180, dive: 0, anomaly: 5, finding: 3 },
                RSCOR: { name: "Scour Inspection", count: 8, rov: 8, dive: 0, anomaly: 2, finding: 1 },
                RSZCI: { name: "Splash Zone Inspection", count: 8, rov: 8, dive: 0, anomaly: 1, finding: 1 },
                RDEP: { name: "Water Depth Measurement", count: 4, rov: 4, dive: 0, anomaly: 0, finding: 0 },
            }
        },
        sow_summary: [
            { inspectionName: "General Visual Inspection (GVI)", totalQid: 180, completedQid: 180, incompleteQid: 0, completionPct: "100%" },
            { inspectionName: "Scour Inspection", totalQid: 8, completedQid: 8, incompleteQid: 0, completionPct: "100%" },
            { inspectionName: "Splash Zone Inspection", totalQid: 8, completedQid: 8, incompleteQid: 0, completionPct: "100%" },
            { inspectionName: "Water Depth Measurement", totalQid: 4, completedQid: 4, incompleteQid: 0, completionPct: "100%" },
        ],
        anomalies: {
            total: 15,
            byPriority: {
                "Priority 1": 0,
                "Priority 2": 8,
                "Priority 3": 0,
                "Observation": 7,
            },
            rectified: 2,
            byDefectType: {
                AW: 5,
                CP: 0,
                DB: 7,
                LI: 0,
                PD: 0,
                SC: 0,
                VS: 3,
            }
        },
        mgi: {
            total: 189,
            totalHardReadings: 189,
            totalSoftReadings: 189,
            hardBands: {
                "0-20%": 13,
                "20-40%": 0,
                "40-60%": 1,
                "60-80%": 1,
                "80-100%": 174,
            },
            softBands: {
                "0-20%": 13,
                "20-40%": 0,
                "40-60%": 1,
                "60-80%": 1,
                "80-100%": 174,
            },
            thickness: {
                hasData: true,
                min: 12,
                avg: 34,
                max: 56,
                hardAvg: 30,
                softAvg: 38,
            }
        },
        anodeGvi: {
            total: 49,
            anodeTypeStr: "TYPE A",
            depletionBuckets: {
                "0-25%": 0,
                "26-50%": 28,
                "50-75%": 15,
                "76-100%": 6,
            }
        },
        scour: {
            total: 8,
            registeredFaces: 4,
            facesSurveyed: 4,
            pilesSurveyed: 4,
            exposedCount: 0,
            scourFindingsCount: 4,
            maxDepthMm: 300,
        },
        cp: {
            totalCount: 54,
            primaryRov: 29,
            primaryDive: 0,
            maxVal: -853,
            minVal: -1005,
        },
        fmd: {
            total: 14,
            conditions: {
                dry: 14,
                flooded: 0,
                grouted: 0,
                inconclusive: 0,
            }
        }
    };

    const sampleHeader = {
        platformName: "BETTY | BEP-A",
        fieldName: "BETTY FIELD",
        waterDepth: 73,
        sowReportNo: "AM26-016-01",
    };

    const sampleCompany = {
        company_name: "Technical Services Department",
        department_name: "Inspection Services",
    };

    it("generates a valid Blob in landscape mode with returnBlob=true", async () => {
        const result = await generateInspectionSummaryGraphReport(
            sampleSummaryData,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, sowReportNo: "AM26-016-01" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("supports printer-friendly mode without error", async () => {
        const result = await generateInspectionSummaryGraphReport(
            sampleSummaryData,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, printFriendly: true, sowReportNo: "AM26-016-01" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("handles zero/empty dataset gracefully without throwing", async () => {
        const emptyData = {
            sow: { total: 0, completed: 0, incomplete: 0, pending: 0, completionPct: 0 },
            records: { total: 0, completed: 0, incomplete: 0, anomaly: 0, finding: 0 },
            sow_summary: [],
            anomalies: { total: 0, byPriority: {}, byDefectType: {}, items: [] },
        };

        const result = await generateInspectionSummaryGraphReport(
            emptyData,
            { platformName: "EMPTY PLATFORM", sowReportNo: "TEST-EMPTY" },
            sampleCompany,
            { returnBlob: true, sowReportNo: "TEST-EMPTY" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(500);
    });

    it("includes signatures and custom watermark configuration cleanly", async () => {
        const result = await generateInspectionSummaryGraphReport(
            sampleSummaryData,
            sampleHeader,
            sampleCompany,
            {
                returnBlob: true,
                showSignatures: true,
                showPageNumbers: true,
                watermark: { enabled: true, text: "CONFIDENTIAL", transparency: 0.15 },
                preparedBy: { name: "Inspection Lead", date: "2026-10-14" },
                reviewedBy: { name: "Senior QA Engineer", date: "2026-10-14" },
                approvedBy: { name: "Technical Director", date: "2026-10-14" },
                sowReportNo: "AM26-016-01"
            }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });
});
