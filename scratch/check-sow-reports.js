const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  const { data: sows } = await supabase
    .from("u_sow")
    .select("id, jobpack_id, structure_id, report_numbers")
    .eq("structure_id", 234);
  
  console.log("SOWs for structure 234:", JSON.stringify(sows, null, 2));
}

run().catch(console.error);
