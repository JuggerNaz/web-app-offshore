// Scratch script to check Anode Depletion (ADA) library items
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('u_lib_list')
    .select('lib_id, lib_code, lib_desc')
    .ilike('lib_desc', '%0-25%');

  if (error) {
    console.error('Error fetching library items:', error);
    return;
  }

  console.log('Library items with 0-25%:');
  console.log(JSON.stringify(data, null, 2));

  // Let's search for depletion or percentage
  const { data: data2, error: error2 } = await supabase
    .from('u_lib_list')
    .select('lib_id, lib_code, lib_desc')
    .ilike('lib_desc', '%deplet%');

  console.log('\nLibrary items with deplet:');
  console.log(JSON.stringify(data2, null, 2));
}

run();
