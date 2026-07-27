const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking migration_mappings table...");
  const { data, error } = await supabase
    .from('migration_mappings')
    .select('*');

  if (error) {
    console.error("Error reading mappings:", error.message);
  } else {
    console.log("SUCCESS! Mappings found in database:", data ? data.length : 0, "rows.");
    if (data && data.length > 0) {
      console.log("Row Keys:", data.map(r => r.key));
      console.log("Sample Mappings Keys:", Object.keys(data[0].mappings || {}));
    }
  }
}

check();
