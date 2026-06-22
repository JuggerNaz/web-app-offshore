const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("Checking sow items for component IDs...");
  const compIds = [3036, 1397, 2918, 1213, 2916];
  const { data: sowItems, error } = await supabase
    .from("u_sow_items")
    .select("sow_id, component_id, component_qid, status, report_number, inspection_code, u_sow:sow_id(jobpack_id, structure_id)")
    .in("component_id", compIds);
  
  if (error) console.error(error);
  console.log("SOW Items:");
  console.log(JSON.stringify(sowItems, null, 2));
}

run().catch(console.error);
