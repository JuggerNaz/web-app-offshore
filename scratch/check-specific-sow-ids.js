const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

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

  // Fetch SOW items matching those patterns
  const { data: sowItems } = await supabase
    .from("u_sow_items")
    .select("id, component_qid, component_id, status")
    .eq("sow_id", sowRec.id)
    .or("component_qid.ilike.%N2110%,component_qid.ilike.%N2205%,component_qid.ilike.%N4140%");
  
  console.log("SOW Items matching specific numbers:");
  sowItems.forEach(item => {
    console.log(item);
  });
}

run().catch(console.error);
