import { describe, it, expect, vi, beforeEach } from "vitest";
import { jsPDF } from "jspdf";
import { generateDefectCriteriaReport, resolveRuleUnit, formatRuleCondition } from "./defect-criteria-report";

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

    it("renders engineering units for rules with threshold values and leaves text conditions without units", async () => {
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
                        { lib_id: "P2", lib_desc: "Priority 2" },
                        { lib_id: "OBS", lib_desc: "Observation" }
                    ]
                };
            }
            if (urlStr.includes("/api/defect-criteria/library/codes")) {
                return {
                    ok: true,
                    json: async () => [
                        { lib_id: "AW", lib_desc: "ANODE WASTAGE (AW)" },
                        { lib_id: "CP", lib_desc: "CATHODIC POTENTIAL (CP)" },
                        { lib_id: "SC", lib_desc: "SCOUR (SC)" },
                        { lib_id: "DB", lib_desc: "DEBRIS (DB)" },
                        { lib_id: "LI", lib_desc: "LACK OF INTEGRITY (LI)" }
                    ]
                };
            }
            if (urlStr.includes("/api/defect-criteria/library/structure-groups")) {
                return {
                    ok: true,
                    json: async () => [
                        { lib_id: "SG1", lib_desc: "All Structure Groups" },
                        { lib_id: "SG2", lib_desc: "Primary, Conductor, Pile" }
                    ]
                };
            }
            if (urlStr.includes("/api/defect-criteria/library/types")) {
                return {
                    ok: true,
                    json: async () => [
                        { lib_id: "AW_NW", lib_desc: "Anode Not Working" },
                        { lib_id: "CP_OP", lib_desc: "Cathodic Potential Over Protected" },
                        { lib_id: "CP_UP", lib_desc: "Cathodic Potential Unprotected" },
                        { lib_id: "SC_DEP", lib_desc: "Scour Depth Limit" },
                        { lib_id: "DB_MET", lib_desc: "Debris Metallic In Contact" },
                        { lib_id: "LI_FLD", lib_desc: "Lack Of Integrity - Member Flooded" }
                    ]
                };
            }
            if (urlStr.includes("/api/defect-criteria/rules")) {
                return {
                    ok: true,
                    json: async () => [
                        {
                            id: "rule-aw",
                            procedureId: "proc-1",
                            structureGroup: "All Structure Groups",
                            defectCodeId: "AW",
                            defectTypeId: "AW_NW",
                            thresholdOperator: ">",
                            thresholdValue: 75,
                            priorityId: "P2",
                            alertMessage: "Anode not working"
                        },
                        {
                            id: "rule-cp-1",
                            procedureId: "proc-1",
                            structureGroup: "Primary, Conductor, Pile",
                            defectCodeId: "CP",
                            defectTypeId: "CP_OP",
                            thresholdOperator: "<",
                            thresholdValue: -1150,
                            priorityId: "P1",
                            alertMessage: "CP unprotected"
                        },
                        {
                            id: "rule-cp-2",
                            procedureId: "proc-1",
                            structureGroup: "Primary, Conductor, Pile",
                            defectCodeId: "CP",
                            defectTypeId: "CP_OP",
                            thresholdOperator: ">",
                            thresholdValue: -650,
                            priorityId: "P1",
                            alertMessage: "CP over protected"
                        },
                        {
                            id: "rule-sc",
                            procedureId: "proc-1",
                            structureGroup: "All Structure Groups",
                            defectCodeId: "SC",
                            defectTypeId: "SC_DEP",
                            thresholdOperator: ">",
                            thresholdValue: 900,
                            priorityId: "P1",
                            alertMessage: "Scour depth exceeded"
                        },
                        {
                            id: "rule-db",
                            procedureId: "proc-1",
                            structureGroup: "All Structure Groups",
                            defectCodeId: "DB",
                            defectTypeId: "DB_MET",
                            thresholdOperator: "==",
                            thresholdText: "Debris Metallic",
                            priorityId: "P1",
                            alertMessage: "Metallic Item in contact"
                        },
                        {
                            id: "rule-li",
                            procedureId: "proc-1",
                            structureGroup: "All Structure Groups",
                            defectCodeId: "LI",
                            defectTypeId: "LI_FLD",
                            thresholdOperator: "==",
                            thresholdText: "Flooded",
                            priorityId: "P1",
                            alertMessage: "Flooded Member"
                        }
                    ]
                };
            }
            if (urlStr.includes("/api/mgi-profiles")) {
                return { ok: true, json: async () => [] };
            }
            return { ok: false, json: async () => ({}) };
        }));

        try {
            const result = await generateDefectCriteriaReport(
                { company_name: "Petronas Carigali Sdn Bhd (SKA)" },
                { sowReportNo: "AM26-016-02", procedureId: "proc-1", returnBlob: true }
            );

            expect(result).toBeInstanceOf(Blob);

            // Anode Wastage has '%' unit
            expect(recordedTexts).toContain("> 75%");

            // Cathodic Potential has 'mV' unit
            expect(recordedTexts).toContain("< -1150 mV");
            expect(recordedTexts).toContain("> -650 mV");

            // Scour has 'mm' unit
            expect(recordedTexts).toContain("> 900 mm");

            // Text conditions do NOT have numeric units appended
            expect(recordedTexts).toContain("== Debris Metallic");
            expect(recordedTexts).toContain("== Flooded");
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    describe("resolveRuleUnit and formatRuleCondition helpers", () => {
        it("resolves units based on defect code and explicit properties", () => {
            // AW -> %
            expect(resolveRuleUnit({ defectCodeId: "AW" }, "ANODE WASTAGE (AW)")).toBe("%");

            // CP -> mV
            expect(resolveRuleUnit({ defectCodeId: "CP" }, "CATHODIC POTENTIAL (CP)")).toBe("mV");

            // SC -> mm
            expect(resolveRuleUnit({ defectCodeId: "SC" }, "SCOUR (SC)")).toBe("mm");

            // MG -> mm
            expect(resolveRuleUnit({ defectCodeId: "MG" }, "MARINE GROWTH (MG)")).toBe("mm");

            // PS -> m
            expect(resolveRuleUnit({ defectCodeId: "PS" }, "PIPELINE SPANNING (PS)")).toBe("m");

            // IN -> deg
            expect(resolveRuleUnit({ defectCodeId: "IN" }, "INCLINOMETER")).toBe("deg");

            // Negative voltage heuristic for CP readings
            expect(resolveRuleUnit({ thresholdValue: -1050 })).toBe("mV");

            // Explicit unit property takes highest priority
            expect(resolveRuleUnit({ defectCodeId: "AW", unit: "custom-unit" })).toBe("custom-unit");
        });

        it("formats conditions properly with engineering units", () => {
            expect(formatRuleCondition({ thresholdOperator: ">", thresholdValue: 75, defectCodeId: "AW" }, "ANODE WASTAGE")).toBe("> 75%");
            expect(formatRuleCondition({ thresholdOperator: "<", thresholdValue: -1150, defectCodeId: "CP" }, "CATHODIC POTENTIAL")).toBe("< -1150 mV");
            expect(formatRuleCondition({ thresholdOperator: ">", thresholdValue: -650, defectCodeId: "CP" }, "CATHODIC POTENTIAL")).toBe("> -650 mV");
            expect(formatRuleCondition({ thresholdOperator: ">", thresholdValue: 900, defectCodeId: "SC" }, "SCOUR")).toBe("> 900 mm");

            // Text conditions remain text without units
            expect(formatRuleCondition({ thresholdOperator: "==", thresholdText: "Debris Metallic", defectCodeId: "DB" }, "DEBRIS")).toBe("== Debris Metallic");
            expect(formatRuleCondition({ thresholdOperator: "==", thresholdText: "Flooded", defectCodeId: "LI" }, "LACK OF INTEGRITY")).toBe("== Flooded");
            expect(formatRuleCondition({ thresholdOperator: "==", thresholdText: "Yes", defectCodeId: "SC" }, "SCOUR")).toBe("== Yes");

            // No duplicate unit if value already has unit
            expect(formatRuleCondition({ thresholdOperator: ">", thresholdValue: "75%", defectCodeId: "AW" }, "ANODE WASTAGE")).toBe("> 75%");
            expect(formatRuleCondition({ thresholdOperator: "<", thresholdValue: "-1150 mV", defectCodeId: "CP" }, "CATHODIC POTENTIAL")).toBe("< -1150 mV");
        });
    });
});
