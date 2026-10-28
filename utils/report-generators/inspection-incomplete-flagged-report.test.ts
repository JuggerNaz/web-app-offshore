import { describe, it, expect } from "vitest";
import { 
    generateInspectionIncompleteFlaggedReport, 
    isStatusIncomplete, 
    getIncompleteReasonOrComments,
    categorizeIncompleteReason,
    getRecordInspectionMode 
} from "./inspection-incomplete-flagged-report";

describe("Inspection Incomplete Flagged Report Generator", () => {
    describe("isStatusIncomplete helper", () => {
        it("returns true for records with status 'INCOMPLETE'", () => {
            expect(isStatusIncomplete({ status: "INCOMPLETE" })).toBe(true);
            expect(isStatusIncomplete({ status: "incomplete" })).toBe(true);
            expect(isStatusIncomplete({ inspection_data: { status: "INCOMPLETE" } })).toBe(true);
        });

        it("returns true for records with is_incomplete flag", () => {
            expect(isStatusIncomplete({ is_incomplete: true })).toBe(true);
            expect(isStatusIncomplete({ incomplete: true })).toBe(true);
            expect(isStatusIncomplete({ inspection_data: { is_incomplete: true } })).toBe(true);
        });

        it("returns true for records with incomplete_reason", () => {
            expect(isStatusIncomplete({ incomplete_reason: "Member fully buried" })).toBe(true);
            expect(isStatusIncomplete({ inspection_data: { incomplete_reason: "Access obstructed" } })).toBe(true);
        });

        it("returns false for completed records without incomplete flag", () => {
            expect(isStatusIncomplete({ status: "COMPLETED" })).toBe(false);
            expect(isStatusIncomplete({ status: "APPROVED" })).toBe(false);
            expect(isStatusIncomplete({ status: "CLOSED" })).toBe(false);
            expect(isStatusIncomplete(null)).toBe(false);
        });
    });

    describe("categorizeIncompleteReason helper", () => {
        it("categorizes seabed burial properly", () => {
            const res = categorizeIncompleteReason("Unable to inspect due to member being fully buried");
            expect(res.category).toBe("Seabed Burial / Fully Buried");
        });

        it("categorizes access and obstruction properly", () => {
            const res = categorizeIncompleteReason("Access obstructed by subsea debris");
            expect(res.category).toBe("Access & Physical Obstruction");
        });

        it("categorizes marine growth properly", () => {
            const res = categorizeIncompleteReason("Obscured by heavy marine growth");
            expect(res.category).toBe("Heavy Marine Growth / Fouling");
        });

        it("categorizes poor visibility properly", () => {
            const res = categorizeIncompleteReason("Turbid water and zero visibility");
            expect(res.category).toBe("Poor Subsea Visibility / Turbidity");
        });

        it("categorizes adverse weather / current properly", () => {
            const res = categorizeIncompleteReason("Excessive current and rough sea state");
            expect(res.category).toBe("High Current & Adverse Weather");
        });
    });

    describe("getRecordInspectionMode helper", () => {
        it("detects ROV and Diving modes accurately", () => {
            expect(getRecordInspectionMode({ inspection_type_code: "RCOND" })).toBe("ROV");
            expect(getRecordInspectionMode({ inspection_type_code: "RGVI" })).toBe("ROV");
            expect(getRecordInspectionMode({ inspection_type_code: "DCOND" })).toBe("DIVING");
            expect(getRecordInspectionMode({ inspection_type_code: "DGVI" })).toBe("DIVING");
        });
    });

    describe("getIncompleteReasonOrComments helper", () => {
        it("returns ONLY the incomplete reason when substantive inspection findings exist", () => {
            const record = {
                status: "INCOMPLETE",
                findings: "CP reading -950mV, cathodic protection adequate, weld seam 100% intact",
                incomplete_reason: "Member fully buried in seabed"
            };
            const result = getIncompleteReasonOrComments(record);
            expect(result).toBe("Member fully buried in seabed");
            expect(result).not.toContain("CP reading");
            expect(result).not.toContain("weld seam");
        });

        it("extracts incomplete finding from explicit prefix in description", () => {
            const record = {
                status: "INCOMPLETE",
                description: "INCOMPLETE: Access obstructed by subsea pipeline frame",
            };
            const result = getIncompleteReasonOrComments(record);
            expect(result).toBe("Access obstructed by subsea pipeline frame");
        });

        it("extracts from inspection_data.incomplete_findings directly", () => {
            const record = {
                status: "INCOMPLETE",
                inspection_data: {
                    incomplete_findings: "Turbid water and zero visibility below -30m"
                }
            };
            const result = getIncompleteReasonOrComments(record);
            expect(result).toBe("Turbid water and zero visibility below -30m");
        });

        it("falls back to standard message without outputting substantive inspection details if no incomplete reason is given", () => {
            const record = {
                status: "INCOMPLETE",
                findings: "Anode 40% consumed, weld free of visible cracks",
            };
            const result = getIncompleteReasonOrComments(record);
            expect(result).toBe("Incomplete — Task could not be fully executed");
            expect(result).not.toContain("Anode 40%");
        });
    });

    describe("generateInspectionIncompleteFlaggedReport PDF generation", () => {
        const headerData = {
            platformName: "BODP-A",
            vessel: "MEO RESOLUTION",
            jobpackName: "UIMC2026/SKA/PLAT01",
            sowReportNo: "AM26-016-02",
        };

        const companySettings = {
            company_name: "Subsea Worldwide Solutions",
            department_name: "Technical Services Department",
        };

        const mockIncompleteRecords = Array.from({ length: 15 }, (_, i) => ({
            insp_id: 100 + i,
            inspection_type_code: "RCOND",
            inspection_type: { code: "RCOND", name: "Conductor Inspection (ROV)" },
            structure_components: { q_id: `CGF00${i + 1}-70M` },
            elevation: "-70",
            inspection_date: "2026-08-30",
            status: "INCOMPLETE",
            incomplete_reason: i < 12 
                ? "Unable to inspect due to member being fully buried" 
                : (i < 14 ? "Access blocked by debris" : "Obscured by heavy marine growth"),
            description: "Unable to inspect due to member being fully buried"
        }));

        it("successfully generates PDF blob with executive summary charts and detailed tables", async () => {
            const blob = await generateInspectionIncompleteFlaggedReport(
                mockIncompleteRecords,
                { ...headerData, allRecords: [...mockIncompleteRecords, { status: "COMPLETED" }, { status: "COMPLETED" }] },
                companySettings,
                { returnBlob: true, showSignatures: true }
            );

            expect(blob).toBeTruthy();
            expect(blob instanceof Blob).toBe(true);
            expect((blob as Blob).size).toBeGreaterThan(1000);
        });

        it("supports printFriendly mode cleanly", async () => {
            const blob = await generateInspectionIncompleteFlaggedReport(
                mockIncompleteRecords,
                headerData,
                companySettings,
                { returnBlob: true, printFriendly: true }
            );

            expect(blob).toBeTruthy();
            expect(blob instanceof Blob).toBe(true);
            expect((blob as Blob).size).toBeGreaterThan(1000);
        });

        it("supports blank report mode cleanly", async () => {
            const blob = await generateInspectionIncompleteFlaggedReport(
                [],
                headerData,
                companySettings,
                { returnBlob: true, isBlankReport: true }
            );

            expect(blob).toBeTruthy();
            expect(blob instanceof Blob).toBe(true);
            expect((blob as Blob).size).toBeGreaterThan(500);
        });

        it("handles multiple and miscellaneous reasons consolidating other categories cleanly", async () => {
            const recordsWithManyReasons = [
                ...Array.from({ length: 120 }, (_, i) => ({
                    insp_id: 1 + i,
                    inspection_type_code: "RCOND",
                    status: "INCOMPLETE",
                    incomplete_reason: "Member fully buried in seabed",
                })),
                ...Array.from({ length: 21 }, (_, i) => ({
                    insp_id: 200 + i,
                    inspection_type_code: "RCOND",
                    status: "INCOMPLETE",
                    incomplete_reason: "Access obstructed by frame",
                })),
                ...Array.from({ length: 5 }, (_, i) => ({
                    insp_id: 300 + i,
                    inspection_type_code: "RCOND",
                    status: "INCOMPLETE",
                    incomplete_reason: "Custom unusual constraint A",
                })),
                ...Array.from({ length: 4 }, (_, i) => ({
                    insp_id: 400 + i,
                    inspection_type_code: "RCOND",
                    status: "INCOMPLETE",
                    incomplete_reason: "Custom unusual constraint B",
                })),
            ];

            const blob = await generateInspectionIncompleteFlaggedReport(
                recordsWithManyReasons,
                headerData,
                companySettings,
                { returnBlob: true }
            );

            expect(blob).toBeTruthy();
            expect(blob instanceof Blob).toBe(true);
            expect((blob as Blob).size).toBeGreaterThan(1000);
        });

        it("correctly integrates Inspection Module summaryData (SOW scope 1082, 932 completed, 150 incomplete & 1205 records)", async () => {
            const mockSummaryData = {
                sow: {
                    total: 1082,
                    completed: 932,
                    incomplete: 150,
                    pending: 0,
                    completionPct: 86.1,
                    completedPct: 86.1,
                    incompletePct: 13.9,
                    pendingPct: 0
                },
                records: {
                    total: 1205,
                    completed: 1055,
                    incomplete: 150,
                    completionPct: 87.6,
                    incompletePct: 12.4,
                    anomaly: 1,
                    finding: 0
                }
            };

            const blob = await generateInspectionIncompleteFlaggedReport(
                mockIncompleteRecords,
                { ...headerData, summaryData: mockSummaryData },
                companySettings,
                { returnBlob: true, summaryData: mockSummaryData }
            );

            expect(blob).toBeTruthy();
            expect(blob instanceof Blob).toBe(true);
            expect((blob as Blob).size).toBeGreaterThan(1000);
        });

        it("returns null when no incomplete records exist and not blank report", async () => {
            const completedRecords = [{ status: "COMPLETED", description: "All clear" }];
            const result = await generateInspectionIncompleteFlaggedReport(
                completedRecords,
                headerData,
                companySettings,
                { returnBlob: true }
            );

            expect(result).toBeNull();
        });
    });
});
