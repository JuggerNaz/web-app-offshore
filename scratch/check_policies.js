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
  console.log('Checking RLS policies for insp_rov_jobs...');
  const { data, error } = await supabase.rpc('get_policies', { table_name_input: 'insp_rov_jobs' });
  
  if (error) {
    console.error('Error fetching policies:', error);
    // Try to find any SQL file that defines policies
  } else {
    console.log('Policies:', data);
  }
}

verify();
