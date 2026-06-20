const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const { data: recs } = await supabase
    .from("insp_records")
    .select("component_id, jobpack_id, structure_id, status, sow_report_no")
    .in("component_id", [1397, 2918, 3036]);
  
  console.log("Records for components 1397, 2918, 3036:", recs);
}

run().catch(console.error);
