const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("Checking structure_components for structure 255...");
  const { data: comps } = await supabase
    .from("structure_components")
    .select("id, q_id")
    .eq("structure_id", 255)
    .ilike("q_id", "%HOM%");
  
  console.log("HM components for structure 255:", comps);
}

run().catch(console.error);
