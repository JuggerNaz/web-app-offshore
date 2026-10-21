import { describe, it, expect, vi, beforeEach } from "vitest";
import { jsPDF } from "jspdf";
import { generateDefectCriteriaReport } from "./defect-criteria-report";

describe("generateDefectCriteriaReport", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn(async (url: string) => {
            const urlStr = String(url);
            if (urlStr.includes("/api/defect-criteria/procedures")) {
                return {
                    ok: true,
                    json: async () => [
                        {
                            id: "proc-1",
                            procedureNumber: "DC-001",
                            procedureName: "PTS-2023",
                            version: "1",
                            status: "active",
                            effectiveDate: "2026-01-01T00:00:00Z"
                        }
                    ]
                };
            }
            if (urlStr.includes("/api/defect-criteria/library/priorities")) {
                return {
                    ok: true,
                    json: async () => [
                        { lib_id: "P1", lib_desc: "Priority 1" },
                        { lib_id: "P2", lib_desc: "Priority 2" }
                    ]
                };
            }
            if (urlStr.includes("/api/defect-criteria/library/codes")) {
                return {
                    ok: true,
                    json: async () => [
                        { lib_id: "AW", lib_desc: "ANODE WASTAGE (AW)" }
                    ]
                };
            }
            if (urlStr.includes("/api/defect-criteria/library/structure-groups")) {
                return {
                    ok: true,
                    json: async () => [
                        { lib_id: "SG1", lib_desc: "All Structure Groups" }
                    ]
                };
            }
            if (urlStr.includes("/api/defect-criteria/library/types")) {
                return {
                    ok: true,
                    json: async () => [
                        { lib_id: "T1", lib_desc: "Anode Net Wastage" }
                    ]
                };
            }
            if (urlStr.includes("/api/library/combo/ANMLYCLR")) {
                return {
                    ok: true,
                    json: async () => ({
                        data: [
                            { code_1: "P1", code_2: "255,0,0", lib_delete: null }
                        ]
                    })
                };
            }
            if (urlStr.includes("/api/defect-criteria/rules")) {
                return {
                    ok: true,
                    json: async () => [
                        {
                            id: "rule-1",
                            procedureId: "proc-1",
                            order: 1,
                            structureGroup: "All Structure Groups",
                            defectCodeId: "AW",
                            defectTypeId: "T1",
                            thresholdOperator: ">",
                            thresholdValue: "75%",
                            priorityId: "P1",
                            alertMessage: "High anode depletion detected"
                        }
                    ]
                };
            }
            if (urlStr.includes("/api/mgi-profiles")) {
                return {
                    ok: true,
                    json: async () => []
                };
            }
            return { ok: false, json: async () => ({}) };
        }));
    });

    it("renders the table without the 'Order' column", async () => {
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
            const result = await generateDefectCriteriaReport(
                {
                    company_name: "Petronas Carigali Sdn Bhd (SKA)",
                    department_name: "Technical Services Department"
                },
                {
                    sowReportNo: "AM26-016-02",
                    procedureId: "proc-1",
                    returnBlob: true
                }
            );

            expect(result).toBeInstanceOf(Blob);

            // Check that "Order" is NOT rendered in table headers
            expect(recordedTexts).not.toContain("Order");
            expect(recordedTexts).not.toContain("Orde");

            // Other column headers must be present
            expect(recordedTexts).toContain("Structure Group");
            expect(recordedTexts).toContain("Defect Type");
            expect(recordedTexts).toContain("Condition");
            expect(recordedTexts).toContain("Priority");
            expect(recordedTexts).toContain("Alert Message");

            // Rule data
            expect(recordedTexts).toContain("All Structure Groups");
            expect(recordedTexts).toContain("Anode Net Wastage");
            expect(recordedTexts).toContain("> 75%");

            // MGI Section must be printed
            expect(recordedTexts).toContain("Marine Growth Inspection (MGI)");
            expect(recordedTexts).toContain("Max Allowable Thickness");
            expect(recordedTexts).toContain("Segment");
            expect(recordedTexts).toContain("From Elevation / Reference Level");
            expect(recordedTexts).toContain("Application Rule");
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("renders MGI profile details when profiles are fetched from system settings or jobpack", async () => {
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

        // Mock with active 2026 profile
        vi.stubGlobal("fetch", vi.fn(async (url: string) => {
            const urlStr = String(url);
            if (urlStr.includes("/api/mgi-profiles")) {
                return {
                    ok: true,
                    json: async () => ({
                        data: [
                            {
                                id: 25,
                                name: "2026 profile",
                                description: "Field campaign limits",
                                is_active: true,
                                is_archived: false,
                                thresholds: [
                                    { max_thickness: 80, from_elevation: "MSL" },
                                    { max_thickness: 80, from_elevation: "1/3 WD" },
                                    { max_thickness: 25, from_elevation: "Mudline" }
                                ]
                            }
                        ]
                    })
                };
            }
            if (urlStr.includes("/api/defect-criteria/procedures")) {
                return {
                    ok: true,
                    json: async () => [
                        {
                            id: "proc-1",
                            procedureNumber: "DC-001",
                            procedureName: "PTS-2023",
                            version: "1",
                            status: "active",
                            effectiveDate: "2026-01-01T00:00:00Z"
                        }
                    ]
                };
            }
            if (urlStr.includes("/api/defect-criteria/library/priorities")) {
                return { ok: true, json: async () => [{ lib_id: "P1", lib_desc: "Priority 1" }] };
            }
            if (urlStr.includes("/api/defect-criteria/library/codes")) {
                return { ok: true, json: async () => [{ lib_id: "AW", lib_desc: "ANODE WASTAGE (AW)" }] };
            }
            if (urlStr.includes("/api/defect-criteria/library/structure-groups")) {
                return { ok: true, json: async () => [{ lib_id: "SG1", lib_desc: "All Structure Groups" }] };
            }
            if (urlStr.includes("/api/defect-criteria/library/types")) {
                return { ok: true, json: async () => [{ lib_id: "T1", lib_desc: "Anode Net Wastage" }] };
            }
            if (urlStr.includes("/api/defect-criteria/rules")) {
                return {
                    ok: true,
                    json: async () => [
                        {
                            id: "rule-1",
                            procedureId: "proc-1",
                            structureGroup: "All Structure Groups",
                            defectCodeId: "AW",
                            defectTypeId: "T1",
                            priorityId: "P1",
                            thresholdOperator: ">",
                            thresholdValue: "75%",
                            alertMessage: "High depletion"
                        }
                    ]
                };
            }
            return { ok: false, json: async () => ({}) };
        }));

        try {
            const result = await generateDefectCriteriaReport(
                { company_name: "Petronas Carigali Sdn Bhd (SKA)" },
                { sowReportNo: "AM26-016-02", procedureId: "proc-1", returnBlob: true }
            );

            expect(result).toBeInstanceOf(Blob);

            // MGI Profile title and metadata
            expect(recordedTexts).toContain("Marine Growth Inspection (MGI)");
            expect(recordedTexts).toContain("Profile: 2026 profile");
            expect(recordedTexts).toContain("Description: Field campaign limits");

            // Thresholds values in table
            expect(recordedTexts).toContain("MSL (0.00m)");
            expect(recordedTexts).toContain("1/3 WD (Water Depth)");
            expect(recordedTexts).toContain("Mudline (Seabed Level)");
            expect(recordedTexts).toContain("80 mm");
            expect(recordedTexts).toContain("25 mm");
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });
});
