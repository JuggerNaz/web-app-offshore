const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkRLS() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'inspection_type' });
  if (error) {
    // get_policies might not exist, try common RPCs or just select from pg_policies if allowed (unlikely)
    console.log('Error checking policies (RPC might be missing):', error.message);
  } else {
    console.log('Policies for inspection_type:', data);
  }

  // Check if we can see any tables
  const { data: tables, error: tableErr } = await supabase.from('information_schema.tables').select('table_name').limit(1);
  if (tableErr) {
    console.log('Direct information_schema access denied (Typical for anon)');
  }

  // Just try to fetch ONE row with 'code' filter if the user mentioned one
  const { data: q, error: qErr } = await supabase.from('inspection_type').select('code').limit(1);
  console.log('Attempting fetch with select(code):', q, qErr);
}

checkRLS();
