const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { count, error } = await supabase.from("insp_anomalies").select("*", { count: "exact", head: true });
  console.log("Total anomalies in PostgreSQL:", count, error);

  // Let's get distinct priorities from Postgres anomalies
  const { data: distPrio } = await supabase.from("insp_anomalies").select("priority");
  const priorities = Array.from(new Set((distPrio || []).map(x => x.priority)));
  console.log("Distinct priorities in DB:", priorities);

  // Search u_lib_list for anything related to priority
  const { data: libs } = await supabase
    .from("u_lib_list")
    .select("lib_id, lib_code, lib_desc, lib_com")
    .or("lib_id.ilike.%class%,lib_id.ilike.%prio%,lib_id.ilike.%anom%,lib_desc.ilike.%priority%,lib_desc.ilike.%class%")
    .limit(100);
  
  console.log("Library items related to priority/class:", libs.slice(0, 20));
}

check();
