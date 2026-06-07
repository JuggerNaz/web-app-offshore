require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: comps, error } = await supabase
    .from('structure_components')
    .select('id, q_id, code, is_deleted, metadata')
    .in('q_id', ['BAN004', 'BAN007']);
  
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('=== structure_components info ===');
  comps.forEach(c => {
    console.log(`ID: ${c.id}, QID: ${c.q_id}, Code: ${c.code}, is_deleted: ${c.is_deleted}, metadata.del: ${c.metadata?.del}`);
  });
}

run();
