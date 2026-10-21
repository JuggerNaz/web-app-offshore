import { describe, it, expect, vi } from "vitest";
import { jsPDF } from "jspdf";
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

    it("renders with defect criteria limits, both CP counts, descending defect ranking, and completion/incomplete card (Pic 1-5)", async () => {
        const enrichedData = {
            ...sampleSummaryData,
            sow: {
                total: 934,
                completed: 837,
                incomplete: 97,
                pending: 0,
                completionPct: 90,
                completedPct: 90,
                incompletePct: 10,
            },
            defectCriteria: {
                scour: { maxAllowableMm: 900, operator: ">" },
                cp: { minAllowableMv: -1150, maxAllowableMv: -800, nominalMaxMv: -800, criticalMaxMv: -650 },
            },
            scour: {
                total: 8,
                registeredFaces: 4,
                facesSurveyed: 4,
                pilesSurveyed: 8,
                exposedCount: 0,
                scourFindingsCount: 4,
                maxDepthMm: 300,
                minDepthMm: 100,
                maxDepthLocation: "Leg : B1",
                maxAllowableMm: 900,
            },
            cp: {
                primaryCount: 120,
                additionalCount: 53,
                totalCount: 173,
                maxVal: -854,
                minVal: -1030,
                minAllowableMv: -1150,
                maxAllowableMv: -800,
                nominalMaxMv: -800,
                criticalMaxMv: -650,
            },
            anomalies: {
                total: 71,
                byPriority: { "Priority 1": 10, "Priority 2": 25, "Priority 3": 15, Observation: 21 },
                byDefectType: {
                    DB: 29,
                    AW: 26,
                    VS: 16,
                    CP: 0,
                    LI: 0,
                    PD: 0,
                    SC: 0,
                }
            },
            anodeGvi: {
                total: 239,
                anodeTypeStr: "TYPE A, TYPE B, TYPE F",
                depletionBuckets: {
                    "0-25%": 19,
                    "26-50%": 107,
                    "50-75%": 80,
                    "76-100%": 26,
                }
            }
        };

        const result = await generateInspectionSummaryGraphReport(
            enrichedData,
            sampleHeader,
            sampleCompany,
            { returnBlob: true, sowReportNo: "AM26-016-01" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(1000);
    });

    it("renders distinct value labels for both hard and soft bars in the MGI section", async () => {
        const recordedTexts: string[] = [];
        const initHook = [
            "initialized",
            function (this: any) {
                const origText = this.text;
                this.text = function (...tArgs: any[]) {
                    recordedTexts.push(String(tArgs[0]));
                    return origText.apply(this, tArgs);
                };
            }
        ];
        (jsPDF.API as any).events.push(initHook);

        const mgiDistinctData = {
            ...sampleSummaryData,
            mgi: {
                total: 1004,
                totalHardReadings: 1004,
                totalSoftReadings: 1004,
                hardBands: {
                    "0-20%": 42,
                    "20-40%": 16,
                    "40-60%": 2,
                    "60-80%": 1,
                    "80-100%": 943,
                },
                softBands: {
                    "0-20%": 35,
                    "20-40%": 12,
                    "40-60%": 5,
                    "60-80%": 3,
                    "80-100%": 912,
                },
            }
        };

        try {
            const result = await generateInspectionSummaryGraphReport(
                mgiDistinctData,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, sowReportNo: "AM26-016-01" }
            );

            expect(result).toBeInstanceOf(Blob);

            // Verify that both hard and soft values were rendered
            expect(recordedTexts).toContain("42");   // Hard 0-20%
            expect(recordedTexts).toContain("35");   // Soft 0-20%
            expect(recordedTexts).toContain("16");   // Hard 20-40%
            expect(recordedTexts).toContain("12");   // Soft 20-40%
            expect(recordedTexts).toContain("2");    // Hard 40-60%
            expect(recordedTexts).toContain("5");    // Soft 40-60%
            expect(recordedTexts).toContain("1");    // Hard 60-80%
            expect(recordedTexts).toContain("3");    // Soft 60-80%
            expect(recordedTexts).toContain("943");  // Hard 80-100%
            expect(recordedTexts).toContain("912");  // Soft 80-100%
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("auto-resizes block heights dynamically based on whether footer / signatures are printed", async () => {
        const recordedRects: Array<{ x: number; y: number; w: number; h: number }> = [];
        const initHook = [
            "initialized",
            function (this: any) {
                const origRect = this.rect;
                this.rect = function (...rArgs: any[]) {
                    recordedRects.push({
                        x: Math.round(Number(rArgs[0]) * 10) / 10,
                        y: Math.round(Number(rArgs[1]) * 10) / 10,
                        w: Math.round(Number(rArgs[2]) * 10) / 10,
                        h: Math.round(Number(rArgs[3]) * 10) / 10,
                    });
                    return origRect.apply(this, rArgs);
                };
            }
        ];
        (jsPDF.API as any).events.push(initHook);

        try {
            // Case 1: 4-Block Single Page (User's Exact Scenario) With Signatures Printed
            // The 4 blocks must expand to fill the void down close to the footer signatures (leaving 3.5mm gap)
            const singlePage4BlockData = {
                ...sampleSummaryData,
                fmd: { total: 0 },
                mgi: { ...sampleSummaryData.mgi, thickness: { hasData: false } }, // Exactly 4 blocks: MGI, Anode, Scour, CP
            };

            recordedRects.length = 0;
            await generateInspectionSummaryGraphReport(
                singlePage4BlockData,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, showSignatures: true, sowReportNo: "AM26-016-01" }
            );

            // Find block frames with width around 67mm (4-column grid on 277mm content width)
            const blockFramesWithSigs = recordedRects.filter(r => r.w === 67 && r.h > 20);
            expect(blockFramesWithSigs.length).toBeGreaterThan(0);
            // With signatures, dynamic block height should expand from old 32.5mm graphH to ~53mm (blockH ~58mm)
            const sigGraphH = blockFramesWithSigs[0].h;
            expect(sigGraphH).toBeGreaterThan(48); // Was previously 32.5mm (from 37.5mm block)
            expect(sigGraphH).toBeLessThanOrEqual(58);

            // Case 2: 4-Block Single Page Without Signatures (showSignatures: false)
            // Footer/signatures not printed, so blocks expand further to fill the remaining empty space down to page footer
            recordedRects.length = 0;
            await generateInspectionSummaryGraphReport(
                singlePage4BlockData,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, showSignatures: false, sowReportNo: "AM26-016-01" }
            );

            const blockFramesNoSigs = recordedRects.filter(r => r.w === 67 && r.h > 20);
            expect(blockFramesNoSigs.length).toBeGreaterThan(0);
            const noSigGraphH = blockFramesNoSigs[0].h;
            // Without signatures, block expands even further into empty page space up to MAX_BLOCK_H (72mm - 5mm header = 67mm)
            expect(noSigGraphH).toBeGreaterThan(sigGraphH);
            expect(noSigGraphH).toBeCloseTo(67, 1);

            // Case 3: Multi-Row Dataset (Page 1 has row 0, Page 2 has row 1 with signatures)
            recordedRects.length = 0;
            await generateInspectionSummaryGraphReport(
                sampleSummaryData,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, showSignatures: true, sowReportNo: "AM26-016-01" }
            );
            const multiRowFrames = recordedRects.filter(r => r.w === 67 && r.h > 20);
            expect(multiRowFrames.length).toBeGreaterThan(0);
            expect(multiRowFrames[0].h).toBeGreaterThan(48);
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("renders MGI Effective Thickness vs Elevation line graph with dark red allowable line and dotted multi-QID readings", async () => {
        const recordedDrawColors: string[] = [];
        const recordedDashPatterns: any[] = [];
        const recordedTexts: string[] = [];

        const initHook = [
            "initialized",
            function (this: any) {
                const origSetDrawColor = this.setDrawColor;
                this.setDrawColor = function (...args: any[]) {
                    recordedDrawColors.push(args.slice(0, 3).map(Number).join(","));
                    return origSetDrawColor.apply(this, args);
                };
                const origSetLineDashPattern = this.setLineDashPattern;
                this.setLineDashPattern = function (...args: any[]) {
                    recordedDashPatterns.push(args[0]);
                    return origSetLineDashPattern.apply(this, args);
                };
                const origText = this.text;
                this.text = function (...args: any[]) {
                    recordedTexts.push(String(args[0]));
                    return origText.apply(this, args);
                };
            }
        ];
        (jsPDF.API as any).events.push(initHook);

        const mgiProfileData = {
            ...sampleSummaryData,
            mgi: {
                ...sampleSummaryData.mgi,
                profileName: "Shell Offshore Zone 1 MGI Profile",
                waterDepth: 73,
                profilePoints: [
                    { elevation: 0, maxThickness: 127, label: "MSL" },
                    { elevation: -18.25, maxThickness: 100, label: "1/4 WD" },
                    { elevation: -36.5, maxThickness: 75, label: "1/2 WD" },
                    { elevation: -73, maxThickness: 25, label: "Mudline" },
                ],
                byQid: {
                    "LEG A1": [
                        { elevation: 0, effectiveThickness: 65, limit: 127, isAnomaly: false },
                        { elevation: -18, effectiveThickness: 50, limit: 100, isAnomaly: false },
                        { elevation: -36, effectiveThickness: 35, limit: 75, isAnomaly: false },
                        { elevation: -73, effectiveThickness: 15, limit: 25, isAnomaly: false },
                    ],
                    "LEG B2": [
                        { elevation: 0, effectiveThickness: 80, limit: 127, isAnomaly: false },
                        { elevation: -20, effectiveThickness: 60, limit: 100, isAnomaly: false },
                        { elevation: -40, effectiveThickness: 45, limit: 75, isAnomaly: false },
                        { elevation: -73, effectiveThickness: 20, limit: 25, isAnomaly: false },
                    ]
                },
                hasProfileGraphData: true
            }
        };

        try {
            const result = await generateInspectionSummaryGraphReport(
                mgiProfileData,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, sowReportNo: "AM26-016-01" }
            );

            expect(result).toBeInstanceOf(Blob);

            // Verify Dark Red Allowable line color: 185,28,28
            expect(recordedDrawColors).toContain("185,28,28");

            // Verify Dotted line pattern used for QID readings: [1, 1]
            const hasDottedPattern = recordedDashPatterns.some(
                pat => Array.isArray(pat) && pat.length === 2 && Number(pat[0]) === 1 && Number(pat[1]) === 1
            );
            expect(hasDottedPattern).toBe(true);

            // Verify Multi-QID colors used (Teal: 13,148,136 and Blue: 37,99,235)
            expect(recordedDrawColors).toContain("13,148,136");
            expect(recordedDrawColors).toContain("37,99,235");

            // Verify Legend and Axis labels
            expect(recordedTexts).toContain("Max Allow");
            expect(recordedTexts).toContain("LEG A1");
            expect(recordedTexts).toContain("LEG B2");
            expect(recordedTexts).toContain("Thk(mm)");
            expect(recordedTexts).toContain("Elev(m)");
            expect(recordedTexts).toContain("Profile: Shell Offshore Zone 1 MGI Profile");
            expect(recordedTexts.some(t => t.includes("CRITERIA MET"))).toBe(true);
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("plots Thickness on Y-axis and Elevation on X-axis with both ROV and Diving QIDs", async () => {
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

        const testData = {
            ...sampleSummaryData,
            mgi: {
                ...sampleSummaryData.mgi,
                profileName: "Standard MGI Profile",
                waterDepth: 60,
                profilePoints: [
                    { elevation: 0, maxThickness: 127, label: "MSL" },
                    { elevation: -30, maxThickness: 75, label: "1/2 WD" },
                    { elevation: -60, maxThickness: 25, label: "Mudline" },
                ],
                byQid: {
                    "ROV-MEMBER-1": [
                        { elevation: 0, effectiveThickness: 85, limit: 127, mode: "ROV", isAnomaly: false },
                        { elevation: -30, effectiveThickness: 60, limit: 75, mode: "ROV", isAnomaly: false },
                    ],
                    "DIVE-MEMBER-2": [
                        { elevation: -15, effectiveThickness: 70, limit: 100, mode: "Diving", isAnomaly: false },
                        { elevation: -45, effectiveThickness: 40, limit: 50, mode: "Diving", isAnomaly: false },
                    ]
                },
                hasProfileGraphData: true
            }
        };

        try {
            await generateInspectionSummaryGraphReport(
                testData,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, sowReportNo: "AM26-016-01" }
            );

            expect(recordedTexts).toContain("Thk(mm)");
            expect(recordedTexts).toContain("Elev(m)");
            expect(recordedTexts).toContain("ROV-MEM..");
            expect(recordedTexts).toContain("DIVE-ME..");
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("does NOT render MGI THICKNESS PROFILE chart if no MGI inspection data was carried out", async () => {
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

        const testDataWithoutMgi = {
            ...sampleSummaryData,
            mgi: {
                total: 0,
                totalHardReadings: 0,
                totalSoftReadings: 0,
                profileName: "2026 profile",
                waterDepth: 51,
                profilePoints: [
                    { elevation: 0, maxThickness: 127, label: "MSL" },
                    { elevation: -17, maxThickness: 100, label: "1/4 WD" },
                    { elevation: -34, maxThickness: 75, label: "1/2 WD" },
                    { elevation: -51, maxThickness: 25, label: "Mudline" },
                ],
                byQid: {},
                hasProfileGraphData: false
            }
        };

        try {
            await generateInspectionSummaryGraphReport(
                testDataWithoutMgi,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, sowReportNo: "AM26-016-02" }
            );

            expect(recordedTexts).not.toContain("MGI THICKNESS PROFILE");
            expect(recordedTexts).not.toContain("LEG A1");
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("satisfies user instructions: Scour footer safety-only, CP header boxes & footer without logged text, and full task coverage tally", async () => {
        const recordedTexts: string[] = [];
        const initHook = [
            "addPage",
            function (this: any) {
                const originalText = this.text;
                this.text = function (text: any, ...args: any[]) {
                    if (typeof text === "string") {
                        recordedTexts.push(text);
                    } else if (Array.isArray(text)) {
                        recordedTexts.push(...text);
                    }
                    return originalText.apply(this, [text, ...args]);
                };
            }
        ];
        (jsPDF.API as any).events.push(initHook);

        const comprehensiveData = {
            ...sampleSummaryData,
            sow_summary: [
                { inspectionName: "General Visual Inspection", totalQid: 941, completedQid: 806, incompleteQid: 135, completionPct: "86%" },
                { inspectionName: "Conductor Inspection", totalQid: 93, completedQid: 78, incompleteQid: 15, completionPct: "84%" },
                { inspectionName: "Splash Zone Inspection", totalQid: 20, completedQid: 20, incompleteQid: 0, completionPct: "100%" },
                { inspectionName: "Scour Inspection", totalQid: 16, completedQid: 16, incompleteQid: 0, completionPct: "100%" },
                { inspectionName: "Water Depth Inspection", totalQid: 8, completedQid: 8, incompleteQid: 0, completionPct: "100%" },
                { inspectionName: "Caisson Inspection", totalQid: 4, completedQid: 4, incompleteQid: 0, completionPct: "100%" },
            ],
            scour: {
                total: 8,
                registeredFaces: 4,
                facesSurveyed: 4,
                pilesSurveyed: 8,
                exposedCount: 0,
                scourFindingsCount: 4,
                maxDepthMm: 300,
                minDepthMm: 100,
                maxDepthLocation: "Leg : B1",
                maxAllowableMm: 900,
            },
            cp: {
                primaryCount: 89,
                additionalCount: 82,
                totalCount: 171,
                maxVal: -854,
                minVal: -1030,
                minAllowableMv: -1150,
                maxAllowableMv: -800,
                nominalMaxMv: -800,
                criticalMaxMv: -650,
            },
        };

        try {
            await generateInspectionSummaryGraphReport(
                comprehensiveData,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, sowReportNo: "AM26-016-02" }
            );

            // 1. Scour Survey block: Footer has Safety details only
            expect(recordedTexts).toContain("Safety: Normal (<900mm)");
            expect(recordedTexts.some(t => t.includes("Findings on 4 piles"))).toBe(false);

            // 2. CP block: Header boxes (Total Readings, Min CP, Max CP) and footer without "Readings Logged"
            expect(recordedTexts).toContain("Total Readings");
            expect(recordedTexts).toContain("89 Pri, 82 Addl");
            expect(recordedTexts).toContain("Min CP");
            expect(recordedTexts).toContain("-1030 mV");
            expect(recordedTexts).toContain("Max CP");
            expect(recordedTexts).toContain("-854 mV");
            expect(recordedTexts).toContain("CRITERIA MET: Safe protection [-1150 to -800 mV]");
            expect(recordedTexts.some(t => t.includes("Readings Logged"))).toBe(false);

            // 3. Task coverage: All 6 tasks are displayed including Caisson Inspection
            expect(recordedTexts).toContain("General Visual Inspection");
            expect(recordedTexts).toContain("Conductor Inspection");
            expect(recordedTexts).toContain("Splash Zone Inspection");
            expect(recordedTexts).toContain("Scour Inspection");
            expect(recordedTexts).toContain("Water Depth Inspection");
            expect(recordedTexts).toContain("Caisson Inspection");

            // Counts tally: 941 + 93 + 20 + 16 + 8 + 4 = 1082; completed = 806 + 78 + 20 + 16 + 8 + 4 = 932; incomplete = 150
            expect(recordedTexts).toContain("Tasks: 86% Done (932/1082)");
            expect(recordedTexts.some(t => t.includes("932 Completed (86%)  •  150 Incomplete (14%)  •  1082 Total Tasks"))).toBe(true);
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("displays Jobpack Name in the top header banner and auto-resizes single mode ROV coverage", async () => {
        const recordedTexts: string[] = [];
        const recordedRects: Array<{ x: number; y: number; w: number; h: number }> = [];

        const initHook = [
            "addPage",
            function (this: any) {
                const originalText = this.text;
                this.text = function (text: any, ...args: any[]) {
                    if (typeof text === "string") recordedTexts.push(text);
                    else if (Array.isArray(text)) recordedTexts.push(...text);
                    return originalText.apply(this, [text, ...args]);
                };
                const originalRect = this.rect;
                this.rect = function (x: any, y: any, w: any, h: any, ...args: any[]) {
                    recordedRects.push({ x: Number(x), y: Number(y), w: Number(w), h: Number(h) });
                    return originalRect.apply(this, [x, y, w, h, ...args]);
                };
            }
        ];
        (jsPDF.API as any).events.push(initHook);

        try {
            const rovOnlySummary = {
                ...sampleSummaryData,
                jobpackName: "UIMC2026/SKA/PLAT01",
                sow_summary: [
                    { inspectionName: "General Visual Inspection", taskType: "ROV", totalQid: 941, completedQid: 806, incompleteQid: 135, completionPct: "86%" },
                    { inspectionName: "Conductor Inspection", taskType: "ROV", totalQid: 93, completedQid: 78, incompleteQid: 15, completionPct: "84%" },
                    { inspectionName: "Splash Zone Inspection", taskType: "ROV", totalQid: 20, completedQid: 20, incompleteQid: 0, completionPct: "100%" },
                    { inspectionName: "Scour Inspection", taskType: "ROV", totalQid: 16, completedQid: 16, incompleteQid: 0, completionPct: "100%" },
                    { inspectionName: "Water Depth Inspection", taskType: "ROV", totalQid: 8, completedQid: 8, incompleteQid: 0, completionPct: "100%" },
                    { inspectionName: "Caisson Inspection", taskType: "ROV", totalQid: 4, completedQid: 4, incompleteQid: 0, completionPct: "100%" },
                ]
            };

            await generateInspectionSummaryGraphReport(
                rovOnlySummary,
                {
                    platformName: "BODP-A",
                    fieldName: "BOKOR.",
                    sowReportNo: "AM26-016-02",
                    jobpackName: "UIMC2026/SKA/PLAT01"
                },
                { company_name: "PETRONAS CARIGALI" },
                { returnBlob: true, sowReportNo: "AM26-016-02" }
            );

            // Jobpack Name must be rendered in header banner instead of '--'
            expect(recordedTexts.some(t => t.includes("UIMC2026/SKA/PLAT01"))).toBe(true);
            expect(recordedTexts).toContain("Jobpack Name: ");

            // ROV block is rendered
            expect(recordedTexts).toContain("ROV INSPECTION TASK COVERAGE");

            // Diving was NOT done: Diving task block must NOT be shown!
            expect(recordedTexts.some(t => t.includes("DIVING TASK COVERAGE") || t.includes("DIVING INSPECTION TASK COVERAGE"))).toBe(false);

            // Single mode block width: Left block is 150mm, Right anomaly block is 123mm
            const has150w = recordedRects.some(r => Math.abs(r.w - 150) < 0.5);
            const has123w = recordedRects.some(r => Math.abs(r.w - 123) < 0.5);
            expect(has150w).toBe(true);
            expect(has123w).toBe(true);
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("separates ROV and Diving task coverage when both modes are done and auto-resizes columns to 95mm and 75mm", async () => {
        const recordedTexts: string[] = [];
        const recordedRects: Array<{ x: number; y: number; w: number; h: number }> = [];

        const initHook = [
            "addPage",
            function (this: any) {
                const originalText = this.text;
                this.text = function (text: any, ...args: any[]) {
                    if (typeof text === "string") recordedTexts.push(text);
                    else if (Array.isArray(text)) recordedTexts.push(...text);
                    return originalText.apply(this, [text, ...args]);
                };
                const originalRect = this.rect;
                this.rect = function (x: any, y: any, w: any, h: any, ...args: any[]) {
                    recordedRects.push({ x: Number(x), y: Number(y), w: Number(w), h: Number(h) });
                    return originalRect.apply(this, [x, y, w, h, ...args]);
                };
            }
        ];
        (jsPDF.API as any).events.push(initHook);

        try {
            const dualModeSummary = {
                ...sampleSummaryData,
                jobpackName: "DUAL-MODE-JP-2026",
                sow_summary: [
                    // ROV tasks
                    { inspectionName: "General Visual Inspection (ROV)", taskType: "ROV", totalQid: 500, completedQid: 400, incompleteQid: 100, completionPct: "80%" },
                    { inspectionName: "Scour Survey (ROV)", taskType: "ROV", totalQid: 20, completedQid: 20, incompleteQid: 0, completionPct: "100%" },
                    // Diving tasks
                    { inspectionName: "Splash Zone Inspection (Diving)", taskType: "Diving", totalQid: 50, completedQid: 45, incompleteQid: 5, completionPct: "90%" },
                    { inspectionName: "Close Visual Inspection (Diving)", taskType: "Diving", totalQid: 30, completedQid: 30, incompleteQid: 0, completionPct: "100%" },
                ]
            };

            await generateInspectionSummaryGraphReport(
                dualModeSummary,
                {
                    platformName: "BODP-B",
                    fieldName: "BOKOR.",
                    sowReportNo: "DUAL-001",
                    jobpackName: "DUAL-MODE-JP-2026"
                },
                { company_name: "PETRONAS CARIGALI" },
                { returnBlob: true, sowReportNo: "DUAL-001" }
            );

            // Both ROV and Diving blocks are rendered separately
            expect(recordedTexts).toContain("ROV TASK COVERAGE");
            expect(recordedTexts).toContain("DIVING TASK COVERAGE");

            // Separate completion and incomplete status:
            // ROV: 420 completed, 100 incomplete, total 520 -> 420/520 = 81%
            // Diving: 75 completed, 5 incomplete, total 80 -> 75/80 = 94%
            expect(recordedTexts.some(t => t.includes("420 Comp (81%) • 100 Inc (19%)"))).toBe(true);
            expect(recordedTexts.some(t => t.includes("75 Comp (94%) • 5 Inc (6%)"))).toBe(true);

            // Row blocks auto-resize: ROV block width = 97mm, Diving block width = 97mm, Anomaly block width = 75mm
            const has97w = recordedRects.some(r => Math.abs(r.w - 97) < 0.5);
            const has75w = recordedRects.some(r => Math.abs(r.w - 75) < 0.5);
            expect(has97w).toBe(true);
            expect(has75w).toBe(true);

            // Header banner shows jobpack name
            expect(recordedTexts.some(t => t.includes("DUAL-MODE-JP-2026"))).toBe(true);
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("renders only Diving task coverage when only Diving mode is carried out and hides ROV", async () => {
        const recordedTexts: string[] = [];

        const initHook = [
            "addPage",
            function (this: any) {
                const originalText = this.text;
                this.text = function (text: any, ...args: any[]) {
                    if (typeof text === "string") recordedTexts.push(text);
                    else if (Array.isArray(text)) recordedTexts.push(...text);
                    return originalText.apply(this, [text, ...args]);
                };
            }
        ];
        (jsPDF.API as any).events.push(initHook);

        try {
            const diveOnlySummary = {
                ...sampleSummaryData,
                jobpackName: "DIVE-ONLY-JP",
                sow_summary: [
                    { inspectionName: "Splash Zone Inspection", taskType: "Diving", totalQid: 20, completedQid: 20, incompleteQid: 0, completionPct: "100%" },
                    { inspectionName: "Close Visual Inspection", taskType: "Diving", totalQid: 10, completedQid: 8, incompleteQid: 2, completionPct: "80%" },
                ]
            };

            await generateInspectionSummaryGraphReport(
                diveOnlySummary,
                {
                    platformName: "BODP-C",
                    fieldName: "BOKOR.",
                    sowReportNo: "DIVE-002",
                    jobpackName: "DIVE-ONLY-JP"
                },
                { company_name: "PETRONAS CARIGALI" },
                { returnBlob: true, sowReportNo: "DIVE-002" }
            );

            // Only Diving block is rendered
            expect(recordedTexts).toContain("DIVING INSPECTION TASK COVERAGE");

            // ROV was NOT done: ROV block must NOT be rendered
            expect(recordedTexts.some(t => t.includes("ROV TASK COVERAGE") || t.includes("ROV INSPECTION TASK COVERAGE"))).toBe(false);

            // Diving tasks are rendered
            expect(recordedTexts).toContain("Splash Zone Inspection");
            expect(recordedTexts).toContain("Close Visual Inspection");
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });
});


