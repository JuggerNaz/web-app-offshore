const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  console.log("Checking library values for anomalies...");

  // Let's get list items where lib_id or lib_desc relates to anomaly / priority / class
  const { data: listItems, error: listErr } = await supabase
    .from("u_lib_list")
    .select("*")
    .ilike("lib_id", "%anom%")
    .limit(100);

  console.log("Lib list like 'anom':", listItems);

  const { data: listItems2 } = await supabase
    .from("u_lib_list")
    .select("*")
    .ilike("lib_id", "%class%")
    .limit(100);
  console.log("Lib list like 'class':", listItems2);

  const { data: listItems3 } = await supabase
    .from("u_lib_list")
    .select("*")
    .ilike("lib_id", "%prio%")
    .limit(100);
  console.log("Lib list like 'prio':", listItems3);

  // Let's look at existing anomalies priorities
  const { data: anomalies, error: anomErr } = await supabase
    .from("insp_anomalies")
    .select("priority, status")
    .limit(50);
  console.log("Anomalies priority values in DB:", anomalies);
}

check();
