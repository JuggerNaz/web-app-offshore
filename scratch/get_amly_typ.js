const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data } = await supabase
    .from("u_lib_list")
    .select("*")
    .eq("lib_code", "AMLY_TYP");

  console.log("AMLY_TYP items:", data);
}

check();
