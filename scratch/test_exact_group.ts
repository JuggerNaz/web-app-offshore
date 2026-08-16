import { generatePipelineDefectSummaryReport } from "../utils/report-generators/defect-summary-pipeline-report";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function testPdfOutput() {
    console.log("=== Testing generatePipelineDefectSummaryReport PDF Output ===");
    const blob: any = await generatePipelineDefectSummaryReport(
        { id: 591, name: "UIMC2026/NQ/Plat01" },
        { id: 2, title: "Test Empty Platform" },
        "P/2026",
        { company_name: "NASQUEST RESOURCES SDN BHD" },
        { returnBlob: true, sowReportNo: "P/2026", jobPackId: 591, structureId: 2 }
    );
    console.log("Generated Blob Size:", blob?.size);
}

testPdfOutput().catch(console.error);
