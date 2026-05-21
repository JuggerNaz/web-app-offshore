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
  console.log('Fetching all columns for insp_rov_jobs...');
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'insp_rov_jobs' });
  
  if (error) {
    console.error('RPC failed:', error);
    // Try to get them via a dummy query
    const { data: dummy, error: dummyErr } = await supabase.from('insp_rov_jobs').select('*').limit(1);
    if (dummyErr) {
        console.error('Query failed:', dummyErr);
    } else {
        console.log('Columns from dummy query:', dummy.length > 0 ? Object.keys(dummy[0]) : 'Table empty, try select * with limit 0');
        const { data: empty, error: emptyErr } = await supabase.from('insp_rov_jobs').select('*').limit(0);
        // Supabase select * limit 0 doesn't return headers usually in the data object if it's empty, 
        // but maybe we can check the response.
    }
  } else {
    console.log('Columns:', data);
  }
}

verify();
