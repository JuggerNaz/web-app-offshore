require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  // Find components BAN004 and BAN007
  const { data: comps, error: compsErr } = await supabase
    .from('structure_components')
    .select('id, q_id, code, metadata')
    .in('q_id', ['BAN004', 'BAN007']);
  
  if (compsErr) {
    console.error('Error fetching comps:', compsErr);
    return;
  }
  console.log('=== Components ===');
  console.log(comps);

  const compIds = comps.map(c => c.id);

  // Query insp_records for these components
  const { data: records, error: recsErr } = await supabase
    .from('insp_records')
    .select(`
      insp_id,
      component_id,
      inspection_type_code,
      status,
      has_anomaly,
      cr_date,
      inspection_date,
      inspection_time
    `)
    .in('component_id', compIds);

  if (recsErr) {
    console.error('Error fetching records:', recsErr);
    return;
  }

  console.log('\n=== Inspection Records for BAN004 / BAN007 ===');
  records.forEach(r => {
    const qid = comps.find(c => c.id === r.component_id)?.q_id || r.component_id;
    console.log(`  Record ID: ${r.insp_id}, Component: ${qid}, Code: ${r.inspection_type_code}, Status: ${r.status}, Date: ${r.inspection_date || r.cr_date}`);
  });

  // Query u_sow_items for these components
  const { data: sowItems, error: sowErr } = await supabase
    .from('u_sow_items')
    .select('*')
    .in('component_id', compIds);

  if (sowErr) {
    console.error('Error fetching sow items:', sowErr);
    return;
  }

  console.log('\n=== u_sow_items for BAN004 / BAN007 ===');
  sowItems.forEach(item => {
    const qid = comps.find(c => c.id === item.component_id)?.q_id || item.component_id;
    console.log(`  SOW Item ID: ${item.id}, Component: ${qid}, Code: ${item.inspection_code}, Status: ${item.status}, Report: ${item.report_number}`);
  });
}

run().catch(console.error);
