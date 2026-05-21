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
  console.log('Fetching all column names for insp_rov_jobs...');
  const { data, error } = await supabase.from('insp_rov_jobs').select('*').limit(0);
  if (error) {
    console.error('Error:', error);
  } else {
    // This doesn't give column names if table is empty.
    // Try to get via postgrest explanation or something? No.
    // Let's try to query information_schema if possible? Usually blocked.
    console.log('Columns fetched via select *:', Object.keys(data[0] || {}));
  }
}

verify();
