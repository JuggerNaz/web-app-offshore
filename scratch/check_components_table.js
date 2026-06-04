// Inspect database for components or related tables
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log("=== Inspecting Components Table ===");

  // Let's try querying "component" or "components"
  const tables = ['components', 'component', 'structure_component', 'u_component', 'u_structure_component'];
  
  for (const table of tables) {
    console.log(`Checking table: ${table}...`);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`  x Table ${table} failed: ${error.message}`);
    } else {
      console.log(`  ✓ Table ${table} exists! Sample row:`, data);
      if (data && data.length > 0) {
        console.log(`  Fields:`, Object.keys(data[0]));
      }
    }
  }
}

main().catch(console.error);
