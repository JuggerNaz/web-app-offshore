import { describe, it, expect, vi, beforeAll } from "vitest";
import { generatePipelineDefectSummaryReport } from "@/utils/report-generators/defect-summary-pipeline-report";

const sampleJobPack = {
    id: 101,
    name: "JP-2024-PL-01",
    metadata: { vessel: "SK Offshore Express", contrac: 1 }
};

const sampleStructure = {
    id: 5001,
    str_id: 5001,
    title: "12-Inch Gas Export Pipeline (PL-101)",
    code: "PL-101",
    str_type: "PIPELINE",
    pfield: "BARRACUDA"
};

const sampleAnomalies = [
    {
        id: 1,
        insp_id: 1,
        display_ref_no: "AN-PL-001",
        anomaly_code: "AN-01",
        priority: "Priority 1",
        easting: "123456.78",
        northing: "9876543.21",
        fp_kp: "0.150",
        category: "Span",
        has_anomaly: true,
        inspection_data: {
            eventName: "Free Span 01",
            eventType: "Span",
            eventPosition: "Top",
            kp_end: "0.220",
            easting_end: "123480.50",
            northing_end: "9876560.10",
            cp_reading: "-965",
            finding: "Free span height 0.8m over rocky seabed."
        },
        rectified: false
    },
    {
        id: 2,
        insp_id: 2,
        display_ref_no: "AN-RS-002",
        anomaly_code: "AC-02",
        priority: "Priority 2",
        is_riser_anomaly: true,
        elevation: "-15.5",
        easting: "123410.00",
        northing: "9876500.00",
        category: "Coating Defect",
        has_anomaly: true,
        inspection_data: {
            eventName: "Riser 01 Coating Breakdown",
            eventType: "Coating",
            eventPosition: "Joint 3",
            finding: "Localized coating disbondment near flange connector."
        },
        rectified: true,
        rectified_by: "Diving Team Alpha",
        rectified_remarks: "Re-wrapped with marine tape."
    }
];

const companySettings = {
    company_name: "NASQUEST RESOURCES SDN BHD",
    department_name: "SUBSEA & ASSET INTEGRITY DIVISION"
};

const baseConfig = {
    reportNoPrefix: "DSR-PL",
    returnBlob: true,
    printFriendly: false,
    watermark: { enabled: true, text: "TEST DRAFT", transparency: 0.15 },
    showSignatures: true,
    preparedBy: { name: "Lead Engineer", date: "2026-08-12" },
    reviewedBy: { name: "QA/QC Manager", date: "2026-08-12" },
    approvedBy: { name: "Client Representative", date: "2026-08-12" }
};

describe("Pipeline Defect Summary Report Generator", () => {
    beforeAll(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";

        // Mock the pipeline report data endpoint so the generator's fetch path succeeds in jsdom
        global.fetch = vi.fn().mockImplementation((url) => {
            if (String(url).includes("/api/reports/pipeline-defect-summary")) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        success: true,
                        data: sampleAnomalies,
                        all_inspection_records: sampleAnomalies,
                        priority_colors: {
                            "Priority 1": "192,0,0",
                            "Priority 2": "237,125,49"
                        },
                        pipeline_info: {
                            title: sampleStructure.title,
                            code: sampleStructure.code
                        }
                    })
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data: [] })
            });
        });
    });

    it("should generate a standard report PDF blob from anomaly records", async () => {
        const blob = await generatePipelineDefectSummaryReport(
            sampleJobPack,
            sampleStructure,
            "SOW-2024-001",
            companySettings,
            baseConfig as any,
            sampleAnomalies
        );

        expect(blob).toBeInstanceOf(Blob);
        expect((blob as Blob).size).toBeGreaterThan(0);
    }, 15000);

    it("should call the pipeline report data endpoint during generation", async () => {
        await generatePipelineDefectSummaryReport(
            sampleJobPack,
            sampleStructure,
            "SOW-2024-001",
            companySettings,
            baseConfig as any,
            sampleAnomalies
        );

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/reports/pipeline-defect-summary")
        );
    }, 15000);

    it("should generate a blank report PDF blob when no records are provided", async () => {
        const blob = await generatePipelineDefectSummaryReport(
            sampleJobPack,
            sampleStructure,
            "SOW-2024-001",
            companySettings,
            { ...baseConfig, isBlankReport: true } as any,
            []
        );

        expect(blob).toBeInstanceOf(Blob);
        expect((blob as Blob).size).toBeGreaterThan(0);
    }, 15000);
});
