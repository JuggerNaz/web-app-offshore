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

async function checkTypes() {
  const { data, error } = await supabase
    .rpc('get_column_types', { table_name: 'u_sow_items' });

  if (error) {
    // If RPC doesn't exist, try a generic query to see types in the error or something
    console.log("RPC failed, trying raw query on information_schema");
    const { data: info, error: infoErr } = await supabase
      .from('u_sow_items')
      .select('created_by, updated_by')
      .limit(1);
    
    if (infoErr) console.error(infoErr);
    else console.log("Sample info:", info);
  } else {
    console.log(data);
  }
}

checkTypes();
