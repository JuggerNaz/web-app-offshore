const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Let's find any inspection records for jobpack 610, structure 1061
  const { data: records, error } = await supabase
    .from("insp_records")
    .select("*")
    .eq("jobpack_id", 610)
    .eq("structure_id", 1061);

  if (error) {
    console.error("Error fetching insp_records:", error);
    return;
  }

  console.log("Found insp_records count:", records?.length);
  if (records && records.length > 0) {
    console.log("Sample records:", records.slice(0, 3));
    console.log("Unique sow_report_no values in insp_records:", Array.from(new Set(records.map(r => r.sow_report_no))));
    console.log("Number of records with has_anomaly=true:", records.filter(r => r.has_anomaly).length);

    // Let's find anomalies linked to these records
    const recordIds = records.map(r => r.insp_id);
    const { data: anomalies, error: anomErr } = await supabase
      .from("insp_anomalies")
      .select("*")
      .in("inspection_id", recordIds);

    if (anomErr) {
      console.error("Error fetching anomalies:", anomErr);
    } else {
      console.log("Linked anomalies count:", anomalies?.length);
      if (anomalies?.length > 0) {
        console.log("Sample anomaly:", anomalies[0]);
      }
    }
  }
}

run();
