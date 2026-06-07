const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testApi() {
  const { data, error } = await supabase.from('mgi_profiles').select('*');
  console.log("All profiles in public.mgi_profiles:");
  if (error) {
    console.error(error);
  } else {
    data.forEach(p => {
      console.log(`ID: ${p.id}, Name: ${p.name}, thresholds type: ${typeof p.thresholds}, is_active: ${p.is_active}`);
      console.log("Thresholds:", p.thresholds);
    });
  }
}
testApi();
