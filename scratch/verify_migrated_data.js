const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  if (!fs.existsSync(envPath)) {
    console.error(".env.local not found");
    return;
  }
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  
  if (!urlMatch || !keyMatch) {
    console.error("Could not parse Supabase URL/Key from .env.local");
    return;
  }
  
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());
  console.log("Connected to Supabase!");
  
  // 1. Verify GVINS
  console.log("\n=================== MIGRATED GVINS RECORDS ===================");
  const { data: gvins, error: gvErr } = await supabase
    .from("insp_records")
    .select("insp_id, inspection_type_code, inspection_data, description")
    .eq("inspection_type_code", "GVINS")
    .limit(3);
    
  if (gvErr) console.error("Error fetching GVINS:", gvErr);
  else console.log(JSON.stringify(gvins, null, 2));

  // 2. Verify RISER
  console.log("\n=================== MIGRATED RISER RECORDS ===================");
  const { data: risers, error: risErr } = await supabase
    .from("insp_records")
    .select("insp_id, inspection_type_code, inspection_data, description")
    .eq("inspection_type_code", "RISER")
    .limit(3);
    
  if (risErr) console.error("Error fetching RISER:", risErr);
  else console.log(JSON.stringify(risers, null, 2));
}

run().catch(console.error);
