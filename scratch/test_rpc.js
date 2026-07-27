const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key exists:', !!supabaseKey);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data, error } = await supabase.rpc('get_all_users');
    if (error) {
      console.error('RPC Error:', error);
    } else {
      console.log('RPC Success. Users count:', data?.length);
      console.log('Users:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Thrown error:', err);
  }
}

main();
