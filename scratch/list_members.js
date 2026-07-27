require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: members, error } = await supabase
    .from('company_memberships')
    .select('id, user_id, company_id, role, is_active');
  if (error) {
    console.error('Error fetching memberships:', error);
    return;
  }
  console.log('Memberships:', JSON.stringify(members, null, 2));
}

run();
