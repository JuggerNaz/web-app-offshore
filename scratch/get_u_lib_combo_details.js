const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: combos, error } = await supabase
    .from("u_lib_combo")
    .select("*")
    .limit(20);

  console.log("u_lib_combo sample rows:", combos, "error:", error);

  // Let's check distinct combo_code values in u_lib_combo
  const { data: distComboCodes } = await supabase
    .from("u_lib_combo")
    .select("combo_code");
  
  const codes = Array.from(new Set((distComboCodes || []).map(x => x.combo_code)));
  console.log("Distinct combo codes:", codes);
}

check();
