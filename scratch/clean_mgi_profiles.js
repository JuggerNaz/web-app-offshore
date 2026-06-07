const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log("Deleting profiles from public.mgi_profiles...");
  const { data, error } = await supabase.from('mgi_profiles').delete().neq('id', 0);
  if (error) {
    console.error("Delete error:", error);
  } else {
    console.log("Profiles deleted successfully!");
  }
}

main();
