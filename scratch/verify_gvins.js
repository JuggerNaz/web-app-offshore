const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  
  if (!urlMatch || !keyMatch) {
    console.error("Could not parse key");
    return;
  }
  const url = urlMatch[1].trim();
  const key = keyMatch[1].trim();
  
  const supabase = createClient(url, key);
  
  const { data: gvins, error } = await supabase
    .from("insp_records")
    .select("insp_id, inspection_data")
    .eq("inspection_type_code", "GVINS")
    .limit(2);
    
  if (error) console.error(error);
  else console.log(JSON.stringify(gvins, null, 2));
}
run();
