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
  console.log('Checking columns of insp_rov_jobs via RPC...');
  // Many Supabase setups have a get_columns or similar, but let's try a direct query if possible
  // or just try to insert a dummy record and see the error details.
  
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'insp_rov_jobs' });
  if (error) {
    console.log('RPC failed, trying query...');
    const { data: cols, error: colErr } = await supabase.from('insp_rov_jobs').select('*').limit(0);
    if (colErr) {
        console.error('Query failed:', colErr);
    } else {
        console.log('Success (empty result), columns are probably okay if query worked.');
    }
  } else {
    console.log('Columns:', data);
  }
}

verify();
