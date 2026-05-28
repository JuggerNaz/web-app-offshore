const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Check platforms matching D21JT-A
  const { data: platforms, error } = await supabase
    .from("platform")
    .select("*")
    .ilike("title", "%D21JT-A%");
  
  if (error) {
    console.log("Error:", error.message);
  } else {
    console.log("Postgres Platforms matching D21JT-A:", JSON.stringify(platforms, null, 2));
  }
  
  // Also check pipelines just in case
  const { data: pipelines } = await supabase
    .from("u_pipeline")
    .select("*")
    .ilike("title", "%D21JT-A%");
  if (pipelines && pipelines.length > 0) {
    console.log("Postgres Pipelines matching D21JT-A:", JSON.stringify(pipelines, null, 2));
  }
}

run();
