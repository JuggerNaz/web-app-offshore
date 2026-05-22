require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const sql = process.argv[2] || 'SELECT NOW() as now;';
  console.log('Running SQL:', sql);
  const { data, error } = await supabase.rpc('query_sql', { sql });
  if (error) {
    console.error('Error executing query:', error);
  } else {
    console.log('Result:', JSON.stringify(data, null, 2));
  }
}

run();
