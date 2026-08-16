async function testApiResponse() {
    const url = "http://localhost:3000/api/reports/pipeline-defect-summary?jobpack_id=591&structure_id=2&sow_report_no=P%2F2026";
    console.log("Fetching API URL:", url);
    const res = await fetch(url);
    if (!res.ok) {
        console.error("API error:", res.status, res.statusText);
        return;
    }
    const json = await res.json();
    console.log("JSON response keys:", Object.keys(json));
    console.log("data count:", json.data?.length);
    console.log("all_inspection_records count:", json.all_inspection_records?.length);

    if (json.data && json.data.length > 0) {
        const item = json.data[0];
        console.log("Sample anomaly item keys:", Object.keys(item));
        console.log("Sample anomaly item:", {
            id: item.id,
            anomaly_id: item.anomaly_id,
            insp_id: item.insp_id,
            display_ref_no: item.display_ref_no,
            fp_kp: item.fp_kp,
            easting: item.easting,
            northing: item.northing,
            inspection_data: item.inspection_data
        });
    }

    if (json.all_inspection_records && json.all_inspection_records.length > 0) {
        console.log("\nSample insp_record items:");
        for (const r of json.all_inspection_records) {
            console.log(`  insp_id: ${r.insp_id}, fp_kp: ${r.fp_kp}, event_name: ${r.inspection_data?.event_name}, pos: ${r.inspection_data?.event_position}, E: ${r.inspection_data?.easting}, N: ${r.inspection_data?.northing}`);
        }
    }
}

testApiResponse().catch(console.error);
