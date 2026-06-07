const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // SOW 311, jobpack 610, structure 1061
  const sowId = 311;

  // 1. Full status breakdown of all items
  const { data: items, error } = await supabase
    .from("u_sow_items")
    .select("id, sow_id, status, report_number, inspection_code, component_id")
    .eq("sow_id", sowId);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total SOW items for SOW ${sowId}: ${items.length}`);

  // Status breakdown
  const statusMap = {};
  items.forEach(i => {
    statusMap[i.status || "(null)"] = (statusMap[i.status || "(null)"] || 0) + 1;
  });
  console.log("\nStatus distribution:", statusMap);

  // Report number breakdown
  const reportMap = {};
  items.forEach(i => {
    reportMap[i.report_number || "(null)"] = (reportMap[i.report_number || "(null)"] || 0) + 1;
  });
  console.log("\nReport number distribution:", reportMap);

  // 2. How many records match these SOW items (by component_id + inspection_type_code)?
  const { data: records, count } = await supabase
    .from("insp_records")
    .select("insp_id, component_id, inspection_type_code, status, sow_report_no", { count: "exact" })
    .eq("structure_id", 1061)
    .eq("jobpack_id", 610);

  console.log(`\nTotal insp_records for structure=1061, jobpack=610: ${count}`);
  
  // Check how many records have COMPLETED status
  const completedRecs = records.filter(r => r.status === "COMPLETED").length;
  const incompleteRecs = records.filter(r => r.status === "INCOMPLETE").length;
  console.log(`Records: COMPLETED=${completedRecs}, INCOMPLETE=${incompleteRecs}`);

  // 3. Match records to SOW items
  let matchedItems = 0;
  let unmatchedItems = 0;
  const unmatchedSample = [];

  for (const item of items) {
    const hasMatch = records.some(r => 
      r.component_id === item.component_id && 
      r.inspection_type_code === item.inspection_code
    );
    if (hasMatch) {
      matchedItems++;
    } else {
      unmatchedItems++;
      if (unmatchedSample.length < 5) {
        unmatchedSample.push({ 
          id: item.id, 
          component_id: item.component_id, 
          code: item.inspection_code,
          status: item.status,
          report: item.report_number 
        });
      }
    }
  }

  console.log(`\nSOW items with matching records: ${matchedItems}`);
  console.log(`SOW items WITHOUT matching records: ${unmatchedItems}`);
  if (unmatchedSample.length > 0) {
    console.log("Sample unmatched items:", JSON.stringify(unmatchedSample, null, 2));
  }

  // 4. Check what the API would see
  // Simulate the API query path
  const { data: sowRec } = await supabase
    .from("u_sow")
    .select("id, jobpack_id, structure_id")
    .eq("jobpack_id", 610)
    .eq("structure_id", 1061)
    .maybeSingle();
  
  console.log(`\nAPI resolution: SOW lookup for jp=610, str=1061:`, sowRec);

  // 5. Now let's check what the InspectionSummaryPanel receives
  // It uses sowId, structureId, jobpackId - let's see what gets passed
  console.log("\n--- Simulating API call ---");
  console.log(`sowId would be: ${sowRec?.id || 'null'}`);
  
  // Check the items query that API uses
  const { data: apiItems, error: apiErr } = await supabase
    .from("u_sow_items")
    .select(`
      status, 
      component_id, 
      component_type, 
      report_number
    `)
    .eq("sow_id", Number(sowRec?.id || sowId));
  
  if (apiErr) {
    console.error("API items error:", apiErr);
  } else {
    console.log(`API would see ${apiItems?.length || 0} SOW items`);
    const apiCompleted = (apiItems || []).filter(i => i.status === "completed").length;
    const apiIncomplete = (apiItems || []).filter(i => i.status === "incomplete").length;
    const apiPending = (apiItems || []).filter(i => i.status === "pending").length;
    console.log(`API stats: completed=${apiCompleted}, incomplete=${apiIncomplete}, pending=${apiPending}`);
  }
}

run().catch(console.error);
