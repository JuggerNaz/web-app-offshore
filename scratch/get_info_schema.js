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
  console.log('Querying information_schema.columns for insp_rov_jobs...');
  const { data, error } = await supabase.from('information_schema.columns')
    .select('column_name')
    .eq('table_name', 'insp_rov_jobs');
  
  if (error) {
    console.error('Error querying information_schema:', error);
    // Information schema might be restricted.
  } else {
    console.log('Columns:', data.map(c => c.column_name));
  }
}

verify();
