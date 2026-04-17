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

async function checkDataTypes() {
  const { data, error } = await supabase.rpc('get_table_columns_and_types', { p_table_name: 'insp_records' });
  if (error) {
    console.log('Error calling RPC:', error.message);
    // Fallback: use information_schema if possible (might not be exposed)
    const { data: info, error: infoErr } = await supabase.from('insp_records').select('*').limit(1);
    if (info) {
        console.log('Sample data types (approx):');
        Object.keys(info[0]).forEach(k => {
            console.log(`${k}: ${typeof info[0][k]} (Value: ${info[0][k]})`);
        });
    }
  } else {
    console.log('Column Types:', data);
  }
}

checkDataTypes();
