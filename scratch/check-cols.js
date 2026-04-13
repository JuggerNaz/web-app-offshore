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

async function check() {
  const { data, error } = await supabase.from('insp_dive_jobs').select('*').limit(1);
  if (error) console.error(error);
  else console.log('Data:', data);
  
  // List columns via RPC if possible or just guess
  const { data: cols } = await supabase.rpc('get_columns', { table_name: 'insp_dive_jobs' });
  console.log('Columns:', cols);
}
check();
