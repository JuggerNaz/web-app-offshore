const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  // Let's get total count of u_sow_items
  const { count, error } = await supabase
    .from("u_sow_items")
    .select("*", { count: "exact", head: true });
  console.log("Total u_sow_items count:", count, "error:", error);

  // Let's get one row to inspect columns
  const { data: oneRow } = await supabase
    .from("u_sow_items")
    .select("*")
    .limit(1);
  console.log("One row of u_sow_items:", oneRow);
}

run().catch(console.error);
