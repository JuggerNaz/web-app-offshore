async function inspectApiFull() {
    const url = "http://localhost:3000/api/reports/pipeline-defect-summary?jobpack_id=591&structure_id=2&sow_report_no=P%2F2026";
    const res = await fetch(url);
    const json = await res.json();

    console.log("=== json.data[0] ===");
    console.log(JSON.stringify(json.data?.[0], null, 2));

    console.log("=== json.all_inspection_records ===");
    console.log(JSON.stringify(json.all_inspection_records, null, 2));
}

inspectApiFull().catch(console.error);
