const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Use service role key to bypass RLS and query auth schema
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("Listing users from auth.users...");
  const { data, error } = await supabase.rpc('get_users'); // Let's check if there is an RPC, or direct select
  if (error) {
    console.log("RPC get_users failed, attempting direct query via sql or checking profiles...");
    const { data: users, error: selectError } = await supabase
      .from('profiles')
      .select('*');
    if (selectError) {
      console.error("Profiles select error:", selectError);
    } else {
      console.log("Profiles:", users);
    }
  } else {
    console.log("Users:", data);
  }
}
main();
