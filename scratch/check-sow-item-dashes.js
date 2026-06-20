const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("Searching u_sow_items for en-dashes...");
  const { data: sowItems, error: err1 } = await supabase
    .from("u_sow_items")
    .select("id, component_qid, sow_id")
    .like("component_qid", "%–%");
  
  if (err1) console.error(err1);
  console.log("Found in SOW items:", sowItems?.length, "rows:", sowItems);

  console.log("Searching structure_components for en-dashes...");
  const { data: comps, error: err2 } = await supabase
    .from("structure_components")
    .select("id, q_id, structure_id")
    .like("q_id", "%–%");
  
  if (err2) console.error(err2);
  console.log("Found in DB components:", comps?.length, "rows:", comps);
}

run().catch(console.error);
