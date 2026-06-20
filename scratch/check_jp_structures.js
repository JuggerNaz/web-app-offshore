const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const { data: jp } = await supabase.from("jobpack").select("*").eq("id", 610).single();
  console.log("Jobpack structures:", jp.metadata.structures);

  const { data: sow, error: sowErr } = await supabase
    .from("u_sow")
    .select("*, u_sow_items(*)")
    .eq("jobpack_id", 610);
  
  if (sowErr) {
    console.error("SOW Error:", sowErr);
  } else {
    console.log("Sows count:", sow?.length);
    if (sow?.length > 0) {
      console.log("Sow structures IDs in Sows:", sow.map(s => s.structure_id));
      console.log("Sow items sample:", sow[0].u_sow_items?.slice(0, 5));
    }
  }
}

run();
