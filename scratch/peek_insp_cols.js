const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Check insp_records columns
  const { data, error } = await supabase.from("insp_records").select("*").limit(1);
  if (error) {
    console.log("Error:", error.message);
  } else if (data && data.length > 0) {
    console.log("insp_records columns:", Object.keys(data[0]).join(", "));
    console.log("Sample row:", JSON.stringify(data[0], null, 2));
  } else {
    console.log("No data found in insp_records. Trying insert with minimal fields...");
    const { data: testIns, error: testErr } = await supabase
      .from("insp_records")
      .insert({ structure_id: 255, inspection_type_id: 71, component_id: 1 })
      .select("*")
      .maybeSingle();
    
    if (testErr) {
      console.log("Insert error:", testErr.message);
    } else {
      console.log("Test insert succeeded! Columns:", Object.keys(testIns).join(", "));
    }
  }
}

run();
