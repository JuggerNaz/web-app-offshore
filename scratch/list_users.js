const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error(error);
  } else {
    console.log("Profiles list:");
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
