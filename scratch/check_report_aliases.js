require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Fetching all report aliases...");
  const { data: aliases, error } = await supabase
    .from('report_aliases') // or check the table name
    .select('*');

  if (error) {
    console.log("Error fetching from report_aliases. Let's list tables containing 'alias'...");
    const { data: listData, error: listErr } = await supabase
      .from('u_lib_list') // check if there is an alias table in public schema
      .select('*')
      .limit(10);
    console.error(error);
  } else {
    console.log("Report Aliases:", JSON.stringify(aliases, null, 2));
  }

  // Let's search using the API endpoint directly to see what it returns
  try {
    const { data: tables } = await supabase.rpc('get_tables'); // if helper exists
  } catch(e) {}
}

run();
