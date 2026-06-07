// Test querying all jobpacks without limit and measure the time taken
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log("=== Testing Jobpacks Query Speed ===");
  const start = Date.now();
  
  const { data, error, count } = await supabase
    .from('jobpack')
    .select('id, name, mgi_profile_id', { count: 'exact' });

  const duration = Date.now() - start;
  
  if (error) {
    console.error("Query failed:", error.message);
  } else {
    console.log(`Query succeeded in ${duration}ms.`);
    console.log(`Total jobpacks in DB: ${data.length} (exact count: ${count})`);
  }
}

main().catch(console.error);
