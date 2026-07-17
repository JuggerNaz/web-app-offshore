require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const qids = ["CGF010-42M", "CGF004-12M", "CON011", "WN N99", "WN N238", "HDM N178-N185"];
  
  const { data, error } = await supabase
    .from('structure_components')
    .select('id, q_id, code, metadata')
    .eq('structure_id', 211)
    .in('q_id', qids);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Component Details:");
  console.log(JSON.stringify(data, null, 2));
}

run();
