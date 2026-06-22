const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const { data: items } = await supabase
    .from("u_sow_items")
    .select("component_qid, component_type")
    .eq("sow_id", 327);
  
  console.log("Total items for SOW 327:", items?.length);
  const hmItems = items?.filter(i => i.component_type === "HM" || i.component_qid?.includes("HOM"));
  console.log("HM items for SOW 327:", hmItems);
}

run().catch(console.error);
