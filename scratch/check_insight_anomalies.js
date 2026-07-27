const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  // Let's query u_lib_list for anomaly priorities and classes!
  const { data: listItems } = await supabase
    .from("u_lib_list")
    .select("lib_code, lib_desc, lib_com")
    .eq("lib_id", "ANOMALY_PRIORITY");

  console.log("Anomaly priority library items:", listItems);

  const { data: listItemsAll } = await supabase
    .from("u_lib_list")
    .select("lib_id, lib_code, lib_desc, lib_com")
    .ilike("lib_desc", "%priority%")
    .limit(20);
  console.log("Anomaly priority lib lists in DB:", listItemsAll);
}

check();
