const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  // Let's see if there is any table named 'migration_mappings' or similar in Supabase
  // We can query the public schema tables list by inspecting public tables
  // Wait, let's just query a few likely tables:
  const tables = [
    'migration_config',
    'migration_mappings',
    'migration_mappings_v2',
    'migration_history',
    'migration_jobs'
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(5);
    if (!error) {
      console.log(`Table ${t} exists! Data:`, data);
    } else {
      console.log(`Table ${t} check error:`, error.message);
    }
  }
}

main();
