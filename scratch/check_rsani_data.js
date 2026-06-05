require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: record, error } = await supabase
    .from("insp_records")
    .select("insp_id, inspection_data")
    .eq("insp_id", 89994)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Inspection Data for RSANI 89994:');
  console.log(JSON.stringify(record.inspection_data, null, 2));
}

run();
