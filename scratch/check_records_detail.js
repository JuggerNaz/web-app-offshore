require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: recs, error } = await supabase
    .from('insp_records')
    .select('insp_id, component_id, structure_id, inspection_type_code, sow_report_no, status')
    .in('insp_id', [43, 47, 48, 89994]);
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('=== Detailed Inspection Records ===');
  for (const r of recs) {
    const { data: comp } = await supabase
      .from('structure_components')
      .select('id, q_id, metadata')
      .eq('id', r.component_id)
      .single();
    console.log(`Record ID: ${r.insp_id}, Component ID in record: ${r.component_id} (QID: ${comp?.q_id}, f_node: ${comp?.metadata?.f_node}, s_node: ${comp?.metadata?.s_node}), Structure ID: ${r.structure_id}, Code: ${r.inspection_type_code}, Sow Report No: ${r.sow_report_no}, Status: ${r.status}`);
  }
}

run();
