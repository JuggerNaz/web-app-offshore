import { extractFieldValue } from "../utils/report-generators/defect-summary-pipeline-report";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function testAnom() {
    const url = "http://localhost:3000/api/reports/pipeline-defect-summary?jobpack_id=591&structure_id=2&sow_report_no=P%2F2026";
    const res = await fetch(url);
    const json = await res.json();

    const anom = json.data[0];
    console.log("=== API json.data[0] ===");
    console.log("easting:", anom.easting);
    console.log("northing:", anom.northing);
    console.log("kp:", anom.kp);
    console.log("fp_kp:", anom.fp_kp);
    console.log("easting_start:", anom.easting_start);
    console.log("northing_start:", anom.northing_start);
    console.log("kp_start:", anom.kp_start);
    console.log("inspection_data:", anom.inspection_data);

    const inspMap = new Map();
    for (const r of json.all_inspection_records || []) {
        inspMap.set(r.insp_id, r);
        inspMap.set(String(r.insp_id), r);
    }

    const inspRec = inspMap.get(anom.id) || inspMap.get(anom.insp_id);
    console.log("=== inspRec from all_inspection_records for 105453 ===");
    console.log("inspRec:", inspRec ? {
        insp_id: inspRec.insp_id,
        fp_kp: inspRec.fp_kp,
        easting: inspRec.inspection_data?.easting,
        northing: inspRec.inspection_data?.northing,
        kp: inspRec.inspection_data?.kp,
        event_position: inspRec.inspection_data?.event_position
    } : "NOT FOUND");
}

testAnom().catch(console.error);
