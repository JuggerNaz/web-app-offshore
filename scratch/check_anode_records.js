require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('insp_records')
    .select('insp_id, inspection_data, description')
    .in('insp_id', [141, 410, 262, 400, 449]);

  if (error) {
    console.error('Error fetching records:', error);
    return;
  }

  console.log('Anode records details:');
  console.log(JSON.stringify(data, null, 2));
}

run();
