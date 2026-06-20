const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  try {
    const { data: records, error } = await supabase
      .from('insp_records')
      .select('*')
      .limit(100);

    if (error) {
      console.error(error);
      return;
    }

    console.log("Total records fetched:", records.length);
    if (records.length > 0) {
      console.log("Keys on first record:", Object.keys(records[0]));
      // Print some details of records with anomalies
      const withAnomalies = records.filter(r => r.has_anomaly || r.is_anomaly || r.inspection_data?.has_anomaly);
      console.log("Found records with has_anomaly/is_anomaly:", withAnomalies.length);
      if (withAnomalies.length > 0) {
        console.log("Example anomaly record:", JSON.stringify(withAnomalies[0], null, 2));
      } else {
        // Let's inspect some records
        console.log("No records with has_anomaly, printing first record:", JSON.stringify(records[0], null, 2));
      }
    }
  } catch (err) {
    console.error(err);
  }
}

main();
