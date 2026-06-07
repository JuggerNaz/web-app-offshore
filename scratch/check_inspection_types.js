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
  
  const { data, error } = await supabase
    .from("inspection_type")
    .select("id, code, name, metadata");
    
  if (error) {
    console.error("Error:", error);
  } else {
    console.log(`Total inspection types: ${data.length}`);
    console.log("Inspection types details:");
    console.log(JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
