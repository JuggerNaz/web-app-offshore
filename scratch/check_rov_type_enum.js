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

async function verify() {
  console.log('Checking rov_type column type...');
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'insp_rov_jobs' });
  // Since RPC might fail, let's try to query information_schema directly if we can,
  // or just try to insert a weird value and see the error.
  
  const { error: err } = await supabase.from('insp_rov_jobs').insert({ rov_type: 'INVALID_TYPE' }).select();
  if (err) {
    console.log('Error inserting invalid type:', err.message);
  }
}

verify();
