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

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // If a custom RPC exists
  if (error) {
    // Fallback: Try common table names to see if they exist
    const tables = ['inspection_type', 'm_inspection_types', 'insp_types', 'structure', 'platform', 'u_sow'];
    for (const t of tables) {
        const { count, error: err } = await supabase.from(t).select('*', { count: 'exact', head: true });
        console.log(`Table ${t}: ${err ? 'Error (' + err.message + ')' : count + ' rows'}`);
    }
  } else {
    console.log('Tables:', data);
  }
}

listTables();
