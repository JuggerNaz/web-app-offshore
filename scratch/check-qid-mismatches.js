const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // Get SOW ID
  const { data: sowRec } = await supabase
    .from("u_sow")
    .select("id")
    .eq("jobpack_id", 610)
    .eq("structure_id", 1061)
    .maybeSingle();

  if (!sowRec) {
    console.log("No SOW record found");
    return;
  }

  // Fetch SOW items
  const { data: sowItems } = await supabase
    .from("u_sow_items")
    .select("component_qid, component_id")
    .eq("sow_id", sowRec.id);

  // Fetch all structure components
  const { data: comps } = await supabase
    .from("structure_components")
    .select("id, q_id")
    .eq("structure_id", 1061);

  const compMap = {};
  comps.forEach(c => {
    compMap[c.id] = c.q_id;
  });

  console.log("Mismatches between SOW Item component_qid and structure_component q_id:");
  sowItems.forEach(item => {
    const dbQid = compMap[item.component_id];
    if (dbQid && item.component_qid !== dbQid) {
      console.log(`Component ID ${item.component_id}: SOW QID='${item.component_qid}' vs DB QID='${dbQid}'`);
    }
  });
}

run().catch(console.error);
