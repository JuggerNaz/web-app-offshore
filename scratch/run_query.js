require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('insp_records')
    .select('insp_id, component_id, inspection_type_code, inspection_data')
    .eq('structure_id', 1061);
  if (error) {
    console.error('Error running query:', error);
  } else {
    console.log('Total insp_records returned:', data?.length);
    if (data && data.length > 0) {
      console.log('Sample record structure:', data[0]);
      console.log('Sample record inspection_data keys:', Object.keys(data[0].inspection_data || {}));
    }
  }
}

run();
