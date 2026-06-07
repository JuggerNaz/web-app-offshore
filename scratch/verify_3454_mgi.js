const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  try {
    // 1. Fetch jobpack for INSPNO 00000003454
    const { data: jp, error: jpErr } = await supabase
      .from('jobpack')
      .select('id, name, mgi_profile_id, metadata')
      .eq('metadata->>oracleInspNo', '00000003454')
      .maybeSingle();

    if (jpErr) {
      console.error("Error fetching jobpack:", jpErr);
      return;
    }

    if (!jp) {
      console.log("Jobpack for INSPNO 00000003454 not found!");
      return;
    }

    console.log(`Jobpack: ID = ${jp.id}, Name = ${jp.name}, mgi_profile_id = ${jp.mgi_profile_id}`);

    // 2. Fetch the linked MGI profile
    if (jp.mgi_profile_id) {
      const { data: prof, error: profErr } = await supabase
        .from('mgi_profiles')
        .select('*')
        .eq('id', jp.mgi_profile_id)
        .single();
      
      if (profErr) {
        console.error("Error fetching profile:", profErr);
      } else {
        console.log("\nLinked MGI Profile:");
        console.log(JSON.stringify(prof, null, 2));
      }
    }

    // 3. Fetch MGI inspection records (both RMGI and MGROW) for this jobpack
    const { data: records, error: recErr } = await supabase
      .from('insp_records')
      .select('insp_id, inspection_type_code, inspection_data')
      .eq('jobpack_id', jp.id)
      .or('inspection_type_code.eq.RMGI,inspection_type_code.eq.MGROW');

    if (recErr) {
      console.error("Error fetching MGI records:", recErr);
    } else {
      console.log(`\nFound ${records.length} MGI records for Jobpack ${jp.id}:`);
      records.forEach(r => {
        console.log(`  Record #${r.insp_id} [Type: ${r.inspection_type_code}]:`);
        console.log(`    _mgi_profile_id: ${r.inspection_data?._mgi_profile_id}`);
      });
    }

  } catch (err) {
    console.error(err);
  }
}

main();
