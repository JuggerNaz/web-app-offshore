const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  try {
    const { data: records, error } = await supabase
      .from('insp_records')
      .select('insp_id, rov_job_id, inspection_type_code, inspection_data')
      .not('rov_job_id', 'is', null)
      .limit(5);

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    console.log(`Fetched ${records.length} migrated ROV records:`);
    records.forEach(r => {
      console.log(`\nRecord #${r.insp_id} [Type: ${r.inspection_type_code}]:`);
      console.log(JSON.stringify(r.inspection_data, null, 2));
    });
  } catch (err) {
    console.error(err);
  }
}

main();
