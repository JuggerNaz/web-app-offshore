const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  try {
    // 1. Check jobpacks with mgi_profile_id
    const { data: jobpacks, error: jpError } = await supabase
      .from('jobpack')
      .select('id, name, mgi_profile_id')
      .not('mgi_profile_id', 'is', null);

    if (jpError) {
      console.error("Error fetching jobpacks:", jpError);
    } else {
      console.log(`Found ${jobpacks.length} jobpacks linked to MGI profiles:`);
      jobpacks.forEach(jp => {
        console.log(`  JP ID: ${jp.id}, Name: ${jp.name}, Profile ID: ${jp.mgi_profile_id}`);
      });
    }

    // 2. Check insp_records of type RMGI or MGROW with _mgi_profile_id
    const { data: records, error: recError } = await supabase
      .from('insp_records')
      .select('insp_id, jobpack_id, inspection_type_code, inspection_data')
      .or('inspection_type_code.eq.RMGI,inspection_type_code.eq.MGROW')
      .limit(10);

    if (recError) {
      console.error("Error fetching MGI records:", recError);
    } else {
      console.log(`\nFound ${records.length} MGI records:`);
      records.forEach(r => {
        console.log(`  Record #${r.insp_id} [JP: ${r.jobpack_id}, Type: ${r.inspection_type_code}]:`);
        console.log(`    _mgi_profile_id: ${r.inspection_data?._mgi_profile_id}`);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

main();
