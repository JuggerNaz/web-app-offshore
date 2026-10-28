import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import { generateROVRSCORReport } from "./rov-rscor-report";

describe("generateROVRSCORReport", () => {
    const sampleHeader = {
        platformName: "BODP-A",
        vessel: "MEO RESOLUTION",
        jobpackName: "UIMC2026/SKA/PLAT01",
        sowReportNo: "AM26-016-02",
    };

    const sampleCompany = {
        company_name: "Subsea Worldwide Solutions",
        department_name: "Technical Services Department",
    };

    const sampleRecords = [
        {
            structure_components: { q_id: "HOM N454-N455" },
            inspection_data: {
                scour_location: "Leg : A3",
                scour_depth: "0",
                Burial_percent: "100",
                Exposed_pile: "No",
            },
            description: "No significant findings",
        },
        {
            structure_components: { q_id: "PILE LEG A3" },
            inspection_data: {
                scour_location: "Leg : A3",
                scour_depth: "0",
                Burial_percent: null,
                Exposed_pile: "No",
            },
            description: "No exposed pile observed",
        },
        {
            // Case: Burial_percent is 100%, but scour_depth is missing / empty
            // Expected: Scour Depth should be "0 mm" instead of "—"
            structure_components: { q_id: "HOM N453-N454" },
            inspection_data: {
                scour_location: "Leg : A3",
                scour_depth: "",
                Burial_percent: "100",
                Exposed_pile: "No",
            },
            description: "No significant findings",
        },
        {
            // Case: Burial_percent is 75%, scour_depth is undefined
            // Expected: Scour Depth should be "0 mm"
            structure_components: { q_id: "HOM N453-N454" },
            inspection_data: {
                scour_location: "At Midpoint",
                Burial_percent: 75,
                Exposed_pile: "No",
            },
            description: "No significant findings",
        },
        {
            // Case: Burial is missing, scour_depth is missing
            // Expected: Scour Depth should be "—"
            structure_components: { q_id: "PILE LEG A4" },
            inspection_data: {
                scour_location: "Leg : A4",
                scour_depth: null,
                Burial_percent: null,
                Exposed_pile: "No",
            },
            description: "From Face A3-A4",
        },
        {
            // Case: Scour depth is 150 mm, burial is missing
            // Expected: Scour Depth should be "150 mm"
            structure_components: { q_id: "HOM N455-N456" },
            inspection_data: {
                scour_location: "Leg : A4",
                scour_depth: "150",
                Burial_percent: null,
                Exposed_pile: "No",
            },
            description: "Scour observed",
        }
    ];

    it("displays '0 mm' for Scour Depth when Burial % is greater than 0 and scour_depth is empty", async () => {
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
            const result = await generateROVRSCORReport(
                sampleRecords,
                sampleHeader,
                sampleCompany,
                { returnBlob: true, showSignatures: true, sowReportNo: "AM26-016-02" }
            );

            expect(result).toBeInstanceOf(Blob);
            expect((result as Blob).size).toBeGreaterThan(1000);

            // Headers
            expect(recordedTexts).toContain("Scour Depth");
            expect(recordedTexts).toContain("Burial %");
            expect(recordedTexts).toContain("Exposed Pile");

            // Verify "0 mm" is rendered for records where burial > 0
            expect(recordedTexts).toContain("0 mm");
            expect(recordedTexts).toContain("100%");
            expect(recordedTexts).toContain("75%");

            // Verify "150 mm" is rendered for the record with explicit scour depth
            expect(recordedTexts).toContain("150 mm");

            // Verify components
            expect(recordedTexts).toContain("HOM N454-N455");
            expect(recordedTexts).toContain("HOM N453-N454");
            expect(recordedTexts).toContain("PILE LEG A3");
        } finally {
            const idx = (jsPDF.API as any).events.indexOf(initHook);
            if (idx !== -1) {
                (jsPDF.API as any).events.splice(idx, 1);
            }
        }
    });

    it("handles empty / blank records gracefully", async () => {
        const result = await generateROVRSCORReport(
            [],
            sampleHeader,
            sampleCompany,
            { returnBlob: true, isBlankReport: true, sowReportNo: "AM26-016-02" }
        );

        expect(result).toBeInstanceOf(Blob);
        expect((result as Blob).size).toBeGreaterThan(500);
    });
});
