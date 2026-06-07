// List all codes and descriptions/names from the components table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log("=== Listing components table from DB ===");
  const { data, error } = await supabase
    .from('components')
    .select('code, name, descrip')
    .order('code');

  if (error) {
    console.error("Error fetching components:", error.message);
  } else {
    console.log(`Found ${data.length} components:`);
    data.forEach(c => {
      console.log(`  "${c.code}": "${c.name || c.descrip}" (descrip: "${c.descrip}")`);
    });
    
    // Print as a clean JSON mapping
    const mapping = {};
    data.forEach(c => {
      mapping[c.code.toUpperCase()] = c.name || c.descrip;
    });
    console.log("\nJSON Mapping:");
    console.log(JSON.stringify(mapping, null, 2));
  }
}

main().catch(console.error);
