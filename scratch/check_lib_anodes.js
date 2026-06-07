require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('u_lib_list')
    .select('lib_code');

  if (error) {
    console.error('Error fetching library items:', error);
    return;
  }

  const uniqueCodes = [...new Set(data.map(d => d.lib_code))].sort();
  console.log('All unique lib_code in u_lib_list:');
  console.log(JSON.stringify(uniqueCodes, null, 2));
}

run();
