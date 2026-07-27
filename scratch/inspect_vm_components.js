const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("Fetching VM components on Structure 211...");

  const { data, error } = await supabase
    .from("structure_components")
    .select("id, q_id, code, comp_id, metadata, id_no")
    .eq("structure_id", 211)
    .eq("q_id", "VEM N100-N178");

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Fetched ${data.length} VM components for VEM N100-N178.`);
  console.log("Details:");
  console.log(JSON.stringify(data, null, 2));
}

run();
