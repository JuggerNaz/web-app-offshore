const { createClient } = require('@supabase/supabase-js');

// Get env from .env.local
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.rpc('get_schema_info');
  if (error) {
     // fallback: select * limit 1
     const res = await supabase.from('u_pipeline').select('*').limit(1);
     console.log("u_pipeline columns:", res.data ? Object.keys(res.data[0]) : res.error);
     
     const res2 = await supabase.from('structure').select('*').limit(1);
     console.log("structure columns:", res2.data ? Object.keys(res2.data[0]) : res2.error);
  }
}
main();
