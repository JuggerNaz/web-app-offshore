require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const sql = `
    SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  `;
  const { data, error } = await supabase.rpc('query_sql', { sql });
  if (error) {
    console.error('Error running query:', error);
  } else {
    console.log('Tables:', data);
  }
}

run();
