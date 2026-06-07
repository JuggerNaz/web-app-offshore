const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Check structure_components columns
  const { data, error } = await supabase.from("structure_components").select("*").limit(1);
  if (error) {
    console.log("Error:", error.message);
  } else if (data && data.length > 0) {
    console.log("structure_components columns:", Object.keys(data[0]).join(", "));
    console.log("Sample row:", JSON.stringify(data[0], null, 2));
  } else {
    console.log("No data found. Trying insert with minimal fields...");
    // Try a minimal insert to see the schema error
    const { data: testIns, error: testErr } = await supabase
      .from("structure_components")
      .insert({ comp_id: 99999, structure_id: 255, code: 'TEST' })
      .select("*")
      .maybeSingle();
    
    if (testErr) {
      console.log("Insert error:", testErr.message);
    } else {
      console.log("Test insert succeeded! Columns:", Object.keys(testIns).join(", "));
      // Delete the test row
      await supabase.from("structure_components").delete().eq("comp_id", 99999);
      console.log("Test row deleted.");
    }
  }
}

run();
