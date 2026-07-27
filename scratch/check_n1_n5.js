require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: comps, error } = await supabase
    .from('structure_components')
    .select('id, q_id, code, metadata')
    .eq('structure_id', 204)
    .or('q_id.ilike.%4a%,q_id.ilike.%4b%');
    
  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(JSON.stringify(comps, null, 2));
}

run();
