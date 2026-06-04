const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  console.log("Querying jobpack with mgi_profile_id...");
  const start = Date.now();
  const { data, error } = await supabase
    .from('jobpack')
    .select('id, name, metadata, mgi_profile_id')
    .order('created_at', { ascending: false });

  console.log("Time taken:", Date.now() - start, "ms");
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Jobpack data count:", data.length);
    console.log("Sample:", data.slice(0, 3));
  }
}
main();
