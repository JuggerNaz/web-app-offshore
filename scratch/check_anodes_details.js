require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: comps } = await supabase
    .from('structure_components')
    .select('id, structure_id, q_id, code, is_deleted, metadata')
    .in('q_id', ['BAN004', 'BAN007']);

  const { data: records } = await supabase
    .from('insp_records')
    .select('insp_id, component_id, inspection_type_code, status, cr_date, inspection_date, inspection_time')
    .in('component_id', comps.map(c => c.id));

  const { data: sowItems } = await supabase
    .from('u_sow_items')
    .select('id, component_id, component_qid, inspection_code, status, report_number')
    .in('component_id', comps.map(c => c.id));

  fs.writeFileSync('scratch/anodes_details_output.json', JSON.stringify({ comps, records, sowItems }, null, 2));
  console.log('Saved to scratch/anodes_details_output.json');
}

run().catch(console.error);
