const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // Find all SOW IDs for structure 255
  const { data: Sows } = await supabase
    .from("u_sow")
    .select("id, jobpack_id")
    .eq("structure_id", 255);
  
  const sowIds = Sows.map(s => s.id);
  console.log("SOW IDs for structure 255:", Sows);

  // Query SOW items matching those SOW IDs and containing HOM
  const { data: items } = await supabase
    .from("u_sow_items")
    .select("sow_id, component_qid, component_type, status")
    .in("sow_id", sowIds)
    .ilike("component_qid", "%HOM%");

  console.log("HM SOW items for structure 255:", items);
}

run().catch(console.error);
