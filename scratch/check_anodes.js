// Scratch script to check anode-related library items
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
    .ilike('lib_desc', '%anode%');

  if (error) {
    console.error('Error fetching anode library items:', error);
    return;
  }

  console.log('Anode-related library items in DB:');
  console.log(JSON.stringify(data, null, 2));

  // Let's also query all items to see if there are type codes
  const { data: dataAll, error: errorAll } = await supabase
    .from('u_lib_list')
    .select('lib_id, lib_code, lib_desc');

  if (errorAll) {
    console.error('Error fetching all library items:', errorAll);
    return;
  }

  const matched = dataAll?.filter(x => 
    x.lib_desc.toLowerCase().includes('type') || 
    x.lib_desc.toLowerCase().includes('bar') ||
    x.lib_code.toLowerCase().includes('anode') ||
    x.lib_code.toLowerCase().includes('and')
  );

  console.log('\nOther potential matched library items:');
  console.log(JSON.stringify(matched, null, 2));
}

run();
