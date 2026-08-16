import { generatePipelineDefectSummaryReport } from "../utils/report-generators/defect-summary-pipeline-report";
import fs from "fs";

async function debugPreviewBlob() {
    console.log("=== Debugging Report Wizard preview generation ===");

    const jobPack = { id: 591, name: "UIMC2026/NQ/Plat01" };
    const structure = { id: 2, title: "Test Empty Platform", code: "Plat01" };
    const sowReportNo = "P/2026";
    const companySettings = { company_name: "NASQUEST RESOURCES SDN BHD" };
    const config = { returnBlob: true, isBlankReport: false };

    try {
        const result: any = await generatePipelineDefectSummaryReport(
            jobPack,
            structure,
            sowReportNo,
            companySettings,
            config
        );

        console.log("Report generation result type:", result instanceof Blob ? `Blob (${result.size} bytes)` : typeof result);
    } catch (e) {
        console.error("Error generating report:", e);
    }
}

debugPreviewBlob().catch(console.error);
