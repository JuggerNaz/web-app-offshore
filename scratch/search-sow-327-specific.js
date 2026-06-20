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
    .select("component_qid, component_type, status")
    .eq("sow_id", 327);
  
  const hmItems = items?.filter(i => i.component_type === "HM" || i.component_qid?.includes("HOM"));
  console.log("Total HM items in SOW 327:", hmItems?.length);
  hmItems.forEach(i => {
    console.log(`QID: '${i.component_qid}' | type: '${i.component_type}' | status: '${i.status}'`);
  });
}

run().catch(console.error);
