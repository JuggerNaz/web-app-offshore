const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase
    .from("insp_anomalies")
    .select("priority_code");

  const codes = Array.from(new Set((data || []).map(x => x.priority_code)));
  console.log("Distinct priority_code in Postgres:", codes, "error:", error);
}

check();
