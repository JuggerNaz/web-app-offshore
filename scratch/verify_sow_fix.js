const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // Simulate the FIXED API query
  const resolvedSowId = 311;

  const { data: itemsData, error: err } = await supabase
    .from("u_sow_items")
    .select(`
      status, 
      component_id, 
      component_qid,
      component_type, 
      report_number
    `)
    .eq("sow_id", resolvedSowId);

  if (err) {
    console.error("STILL ERROR:", err);
    return;
  }

  console.log(`SUCCESS! Fetched ${itemsData?.length || 0} SOW items`);
  const completed = (itemsData || []).filter(i => i.status === "completed").length;
  const incomplete = (itemsData || []).filter(i => i.status === "incomplete").length;
  const pending = (itemsData || []).filter(i => i.status === "pending").length;
  const total = (itemsData || []).length;
  
  console.log(`Status: completed=${completed}, incomplete=${incomplete}, pending=${pending}`);
  const completionPct = total > 0 ? Math.round(((completed + incomplete) / total) * 100) : 0;
  console.log(`Total: ${total}, Completion: ${completionPct}%`);
  console.log("\nThis should now show in the Inspection Summary panel!");
}

run().catch(console.error);
