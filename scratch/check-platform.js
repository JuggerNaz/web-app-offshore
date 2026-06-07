require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('platform').select('*').limit(1);
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Row keys:', Object.keys(data[0] || {}));
  }
}

check();
