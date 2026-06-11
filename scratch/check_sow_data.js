const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Let's find structure with name D21JT-A
  const { data: platforms } = await supabase.from("plat_structure").select("*").eq("title", "D21JT-A");
  console.log("Platforms:", platforms);

  // Let's find jobpack with name UIMC14/DIV/SKO/PLAT2
  const { data: jobpacks } = await supabase.from("jobpack").select("*").eq("name", "UIMC14/DIV/SKO/PLAT2");
  console.log("Jobpacks:", jobpacks);

  if (platforms?.length && jobpacks?.length) {
    const structId = platforms[0].plat_id;
    const jpId = jobpacks[0].id;

    // Fetch u_sow
    const { data: sow, error: sowErr } = await supabase
      .from("u_sow")
      .select("*, u_sow_items(*)")
      .eq("jobpack_id", jpId)
      .eq("structure_id", structId);

    if (sowErr) {
      console.error("SOW error:", sowErr);
    } else {
      console.log("SOW found:", sow?.length);
      if (sow?.length > 0) {
        console.log("SOW structure:", JSON.stringify(sow[0], null, 2));
      }
    }
  }
}

run();
