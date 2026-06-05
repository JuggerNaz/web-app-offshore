import { describe, it, expect, vi, beforeAll } from "vitest";
import { generateDefectSummaryReport } from "@/utils/report-generators/defect-summary-report";
import { generateROVAnodeReport } from "@/utils/report-generators/rov-anode-report";

// Mock global window and Image if needed (jsdom does it partially, but let's mock fetch)
describe("Report Wizard Generation Tests", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";
    
    // Mock fetch for company settings, contractor logo, etc.
    global.fetch = vi.fn().mockImplementation((url) => {
      console.log("[Test Fetch Mock] URL:", url);
      if (url.includes("/api/company-settings")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              company_name: "Test Company Name",
              department_name: "Test Department",
              logo_url: "https://via.placeholder.com/150.png"
            }
          })
        });
      }
      if (url.includes("/api/reports/defect-summary")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              {
                anomaly_id: 1,
                priority: "critical",
                display_ref_no: "ANOM-001",
                description: "Test Anomaly Description",
                status: "Open",
                is_rectified: false,
                tape_no: "T-01",
                video_ref: 120,
                defect_type: "Corrosion",
                category: "Structural",
                observations: "Heavy corrosion detected"
              }
            ],
            priority_colors: {
              critical: "192,0,0"
            }
          })
        });
      }
      if (url.includes("/api/library/CONTR_NAM")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              {
                lib_id: "contr-1",
                lib_desc: "Mock Contractor",
                logo_url: "https://via.placeholder.com/100.png"
              }
            ]
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      });
    });
  });

  it("should generate Defect Summary Report successfully", async () => {
    console.log("Starting Defect Summary Report test...");
    const jobPack = {
      id: 595,
      name: "UIMC/2026/PLAT1",
      metadata: {
        contrac: "contr-1"
      }
    };
    const structure = {
      id: 243,
      str_name: "PLAT-B",
      field_name: "Test Field"
    };
    const companySettings = {
      company_name: "Test Company",
      department_name: "Test Dept",
      logo_url: "https://via.placeholder.com/150.png"
    };
    const config = {
      printFriendly: false,
      showContractorLogo: true,
      returnBlob: true,
      isFindingsReport: false,
      reportNoPrefix: "RPT"
    };

    const result = await generateDefectSummaryReport(
      jobPack,
      structure,
      "TEST-RPT-001",
      companySettings,
      config as any
    );

    console.log("Defect Summary Report generation completed!");
    expect(result).toBeInstanceOf(Blob);
  }, 15000);

  it("should generate ROV Anode Report successfully", async () => {
    console.log("Starting ROV Anode Report test...");
    const records = [
      {
        elevation: "-10",
        cr_date: "2026-06-01",
        has_anomaly: false,
        inspection_data: {
          anode_depletion_percent: 25,
          cp_reading_mv: -1050,
          cp_readings: [
            { location: "Top Stub", reading: -1060 },
            { location: "Bottom Stub", reading: -1040 }
          ],
          anode_type: "Al-Zn-In"
        },
        structure_components: {
          q_id: "AN-1",
          code: "AN"
        },
        description: "Anode CVI completed."
      }
    ];

    const headerData = {
      jobpackName: "UIMC/2026/PLAT1",
      sowReportNo: "TEST-RPT-001",
      platformName: "PLAT-B",
      contractorLogoUrl: "https://via.placeholder.com/100.png"
    };

    const companySettings = {
      company_name: "Test Company",
      department_name: "Test Dept",
      logo_url: "https://via.placeholder.com/150.png"
    };

    const config = {
      printFriendly: false,
      returnBlob: true,
      showPageNumbers: true,
      showSignatures: true
    };

    const result = await generateROVAnodeReport(
      records,
      headerData,
      companySettings,
      config as any
    );

    console.log("ROV Anode Report generation completed!");
    expect(result).toBeInstanceOf(Blob);
  }, 15000);
});
