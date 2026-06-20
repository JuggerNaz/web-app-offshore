const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  const envPath = path.resolve(".env.local");
  const env = fs.readFileSync(envPath, "utf8");
  const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

  console.log("Checking jobpacks...");
  const { data: jobpacks, error } = await supabase
    .from("u_jobpacks")
    .select("jobpack_id, jobpack_name, status, structure_id")
    .in("jobpack_id", [591, 600, 590]);
  
  if (error) {
    // try jobpacks instead of u_jobpacks
    const { data: jobpacks2, error: error2 } = await supabase
      .from("jobpacks")
      .select("id, name, status, structure_id")
      .in("id", [591, 600, 590]);
    console.log("jobpacks:", jobpacks2, error2);
  } else {
    console.log("u_jobpacks:", jobpacks);
  }
}

run().catch(console.error);
