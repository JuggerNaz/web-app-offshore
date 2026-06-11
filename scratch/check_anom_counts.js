const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Let's query insp_anomalies to see column definitions or linked records
  const { data: anomalies, error: anomError } = await supabase
    .from("insp_anomalies")
    .select("*, insp_records(*)")
    .limit(10);

  if (anomError) {
    console.error("Error querying insp_anomalies:", anomError);
    return;
  }

  console.log("Anomalies sample count:", anomalies?.length);
  if (anomalies && anomalies.length > 0) {
    console.log("Anomaly columns:", Object.keys(anomalies[0]));
    console.log("Sample anomaly:", JSON.stringify(anomalies[0], null, 2));
  }
}

run();
