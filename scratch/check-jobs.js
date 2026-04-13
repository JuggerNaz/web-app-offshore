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

async function checkJobs() {
  const tables = ['insp_dive_jobs', 'insp_rov_jobs', 'u_dive_jobs', 'u_rov_jobs'];
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`Table ${table} count:`, error ? `Error: ${error.message}` : count);
    if (!error && count > 0) {
        const { data } = await supabase.from(table).select('*').limit(1);
        console.log(`Columns in ${table}:`, Object.keys(data[0]));
    }
  }
}

checkJobs();
