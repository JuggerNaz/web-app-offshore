const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Let's run a query to get column names of these tables using RPC or direct queries if allowed.
  // Wait, does Supabase have a way to check columns? We can try to select one row from each table and inspect keys.
  const tables = ['jobpack', 'structure', 'platform', 'u_pipeline'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error selecting from ${table}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`\nTable ${table} columns:`, Object.keys(data[0]));
      console.log(`Sample row from ${table}:`, data[0]);
    } else {
      console.log(`\nTable ${table} is empty or returned no rows.`);
    }
  }
}

run();
