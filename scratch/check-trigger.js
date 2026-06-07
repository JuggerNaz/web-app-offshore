require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.rpc('query_sql', { sql: `
    SELECT pg_get_functiondef(oid) 
    FROM pg_proc 
    WHERE proname = 'deleted_record_insert';
  ` });
  
  if (error) {
    console.error('Error fetching function:', error);
  } else {
    console.log(data);
  }
}

check();
