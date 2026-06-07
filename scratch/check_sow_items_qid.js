require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: items, error } = await supabase
    .from('u_sow_items')
    .select('id, component_id, component_qid, component_type, inspection_code, status, report_number')
    .in('id', [40659, 25, 40664, 267]);
  
  if (error) {
    console.error(error);
    return;
  }
  console.log('=== raw u_sow_items ===');
  console.log(items);
}

run();
