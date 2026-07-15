require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Searching platform table for 'PLAT-C'...");
  const { data: platforms, error } = await supabase
    .from('platform')
    .select('*')
    .ilike('title', '%PLAT-C%');

  if (error) {
    console.error(error);
  } else {
    console.log("Platforms found:", JSON.stringify(platforms, null, 2));
  }
}

run();
