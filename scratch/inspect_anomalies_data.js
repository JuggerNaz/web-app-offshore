const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  try {
    const { data: records, error } = await supabase
      .from('insp_records')
      .select('insp_id, inspection_data, inspection_type_code, has_anomaly')
      .eq('has_anomaly', true)
      .limit(10);

    if (error) {
      console.error(error);
      return;
    }

    console.log("Found", records.length, "anomaly records.");
    records.forEach((r, idx) => {
      console.log(`\nAnomaly Record ${idx + 1} (Type: ${r.inspection_type_code}, ID: ${r.insp_id}):`);
      Object.keys(r.inspection_data || {}).forEach(k => {
        const val = r.inspection_data[k];
        if (typeof val === 'string' && val.length > 0) {
            console.log(` - ${k}: ${val}`);
        }
      });
    });
  } catch (err) {
    console.error(err);
  }
}

main();
