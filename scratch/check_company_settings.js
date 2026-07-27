require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Fetching company settings...");
  const { data, error } = await supabase
    .from('company_settings')
    .select('*');

  if (error) {
    console.error(error);
  } else {
    console.log("Company Settings:", JSON.stringify(data, null, 2));
  }
}

run();
