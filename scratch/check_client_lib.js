require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Fetching distinct lib_code values from u_lib_list...");
  const { data: codes, error: codesErr } = await supabase
    .from('u_lib_list')
    .select('lib_code')
    .order('lib_code');
  
  if (codesErr) {
    console.error(codesErr);
    return;
  }
  
  const uniqueCodes = [...new Set(codes.map(c => c.lib_code))];
  console.log("Distinct lib_codes:", uniqueCodes.join(", "));

  console.log("\nFetching items with logo_url or related to client...");
  const { data: logoItems, error: logoErr } = await supabase
    .from('u_lib_list')
    .select('*')
    .not('logo_url', 'is', null);

  if (logoErr) {
    console.error(logoErr);
  } else {
    console.log("Items with logo_url:", logoItems.length);
    logoItems.forEach(item => {
      console.log(`- [${item.lib_code}] ID: ${item.lib_id} | DESC: ${item.lib_desc} | LOGO: ${item.logo_url}`);
    });
  }

  // Check if there is a 'CLNT_NAM' or similar code in u_lib_list
  const { data: clientItems, error: clientErr } = await supabase
    .from('u_lib_list')
    .select('*')
    .ilike('lib_code', '%clnt%');
  
  if (clientErr) {
    console.error(clientErr);
  } else {
    console.log("\nItems matching 'clnt':", clientItems.length);
    clientItems.forEach(item => {
      console.log(`- [${item.lib_code}] ID: ${item.lib_id} | DESC: ${item.lib_desc}`);
    });
  }

  // Check if there are any other codes starting with C
  const { data: cItems, error: cErr } = await supabase
    .from('u_lib_list')
    .select('*')
    .ilike('lib_code', 'C%');
  
  if (cErr) {
    console.error(cErr);
  } else {
    const cCodes = [...new Set(cItems.map(c => c.lib_code))];
    console.log("\nDistinct lib_codes starting with C:", cCodes.join(", "));
  }
}

run();
