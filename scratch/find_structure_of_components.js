require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const qids = ["BAN135", "BAN067", "HOM N481-N482", "VEM N289-N482"];
  
  const { data, error } = await supabase
    .from('structure_components')
    .select('id, q_id, structure_id, company_id')
    .in('q_id', qids);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Component structure mappings:", JSON.stringify(data, null, 2));
}

run();
