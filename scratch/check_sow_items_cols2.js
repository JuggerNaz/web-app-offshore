const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // Check columns of u_sow_items by getting one row with all columns
  const { data, error } = await supabase
    .from("u_sow_items")
    .select("*")
    .eq("sow_id", 311)
    .limit(1);

  if (error) {
    console.error("Error:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log("u_sow_items columns:", Object.keys(data[0]));
    console.log("\nSample row:", JSON.stringify(data[0], null, 2));
  }
}

run().catch(console.error);
