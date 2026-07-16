const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase
    .from("u_lib_combo")
    .select("*")
    .eq("lib_code", "ANMLYCLR");

  console.log("ANMLYCLR combo items:", data, "error:", error);
}

check();
