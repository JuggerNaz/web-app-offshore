const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// Simulate what the /api/inspection-summary API does
async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // Simulate the API request params as the panel would send them
  // From the panel: sowId={sowId || null}, structureId="1061", jobpackId="610", sowReportNo="14061"
  const sowId = null;  // likely null from URL
  const structureId = "1061";
  const jobpackId = "610";
  const sowReportNo = "14061";

  console.log("=== Simulating API call ===");
  console.log(`Params: sowId=${sowId}, structureId=${structureId}, jobpackId=${jobpackId}, sowReportNo=${sowReportNo}`);

  // Step 1: Parse IDs (same as API)
  const sowIdParsed = sowId ? sowId.split('-')[0] : null;
  const structureIdParsed = structureId ? structureId.split('-')[0] : null;
  const jobpackIdParsed = jobpackId ? jobpackId.split('-')[0] : null;

  let resolvedSowId = sowIdParsed;
  const jpNum = parseInt(String(jobpackIdParsed));
  const strNum = parseInt(String(structureIdParsed));

  console.log(`Parsed: sowIdParsed=${sowIdParsed}, jpNum=${jpNum}, strNum=${strNum}`);

  // Step 2: Resolve SOW ID
  if (!resolvedSowId && !isNaN(jpNum) && !isNaN(strNum)) {
    console.log("Resolving SOW ID via jobpack_id + structure_id...");
    const { data: sowRec, error } = await supabase
      .from("u_sow")
      .select("id")
      .eq("jobpack_id", jpNum)
      .eq("structure_id", strNum)
      .limit(1)
      .maybeSingle();
    
    if (error) console.error("SOW resolve error:", error);
    if (sowRec) {
      resolvedSowId = String(sowRec.id);
      console.log(`Resolved SOW ID to ${resolvedSowId}`);
    } else {
      console.log("NO SOW found for this jobpack+structure combo!");
    }
  }

  // Step 3: Fetch SOW items
  if (resolvedSowId) {
    const { data: itemsData, error: err } = await supabase
      .from("u_sow_items")
      .select(`
        status, 
        component_id, 
        component_type, 
        report_number, 
        structure_components:component_id(
            id, q_id, code, metadata
        )
      `)
      .eq("sow_id", Number(resolvedSowId));
    
    if (err) {
      console.error("SOW Items fetch error:", err);
    } else {
      console.log(`\nFetched ${itemsData?.length || 0} SOW items`);
      const completed = (itemsData || []).filter(i => i.status === "completed").length;
      const incomplete = (itemsData || []).filter(i => i.status === "incomplete").length;
      const pending = (itemsData || []).filter(i => i.status === "pending").length;
      
      console.log(`Status: completed=${completed}, incomplete=${incomplete}, pending=${pending}`);
      const total = (itemsData || []).length;
      const completionPct = total > 0 ? Math.round(((completed + incomplete) / total) * 100) : 0;
      console.log(`Completion: ${completionPct}%`);
    }
  } else {
    console.log("\n*** resolvedSowId is null! SOW items will show 0 ***");
  }

  // Now also check what sowId the panel would have
  // Let's see if the sow URL param is set in the workspace
  console.log("\n=== Checking SOW lookup ===");
  const { data: allSows } = await supabase
    .from("u_sow")
    .select("id, jobpack_id, structure_id, report_number")
    .eq("structure_id", 1061);
  
  console.log("All SOWs for structure 1061:", JSON.stringify(allSows, null, 2));
}

run().catch(console.error);
