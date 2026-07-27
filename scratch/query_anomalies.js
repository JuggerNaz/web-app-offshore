const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  try {
    const { data: records, error } = await supabase
      .from('insp_records')
      .select('insp_id, has_anomaly, description, sow_report_no, jobpack_id, structure_id')
      .not('has_anomaly', 'is', null);

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    console.log(`Found ${records.length} records with non-null has_anomaly:`);
    records.slice(0, 50).forEach(r => {
      console.log(`ID: ${r.insp_id} | has_anomaly: ${r.has_anomaly} (type: ${typeof r.has_anomaly}) | jobpack: ${r.jobpack_id} | structure: ${r.structure_id} | SOW: ${r.sow_report_no} | Desc: ${r.description}`);
    });
  } catch (err) {
    console.error(err);
  }
}

main();
