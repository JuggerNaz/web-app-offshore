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
  console.log('Checking if rov_type column exists...');
  const { data, error } = await supabase.from('insp_rov_jobs').select('rov_type').limit(0);
  
  if (error) {
    console.error('Column rov_type does not exist or error:', error);
  } else {
    console.log('Column rov_type exists.');
  }
}

verify();
