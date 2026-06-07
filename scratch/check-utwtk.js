const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkData() {
  const { data, error } = await supabase
    .from('insp_records')
    .select('inspection_data, inspection_type_code')
    .eq('inspection_type_code', 'UTWTK')
    .limit(2);
    
  if (error) console.error(error);
  console.log("UTWTK Data:", JSON.stringify(data, null, 2));
}

checkData();
