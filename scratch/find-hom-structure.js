const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const { data: comps } = await supabase
    .from("structure_components")
    .select("id, q_id, structure_id")
    .ilike("q_id", "%HOM%N2110%");
  
  console.log("Comps containing HOM N2110:", comps);

  if (comps && comps.length > 0) {
    const structId = comps[0].structure_id;
    const { data: struct } = await supabase
      .from("structure")
      .select("id, name, code")
      .eq("id", structId)
      .maybeSingle();
    console.log("Structure details:", struct);

    // Also get all SOW records for this structure
    const { data: sows } = await supabase
      .from("u_sow")
      .select("id, jobpack_id, structure_id")
      .eq("structure_id", structId);
    console.log("SOWs for this structure:", sows);
  }
}

run().catch(console.error);
