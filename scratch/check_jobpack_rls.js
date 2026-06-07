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

async function checkRLS() {
  console.log("Checking if RLS is enabled for jobpack table...");
  const { data, error } = await supabase.rpc('check_rls_enabled', { table_name_input: 'jobpack' });
  
  if (error) {
    console.log("RPC check_rls_enabled failed:", error);
    // Let's try to query pg_tables or pg_class using a custom RPC if we have one
    // Or we can check if there are other check scripts.
  } else {
    console.log("jobpack RLS Enabled:", data);
  }
}

checkRLS();
