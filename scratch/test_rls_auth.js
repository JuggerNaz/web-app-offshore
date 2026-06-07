require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const email = `test_rls_${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  console.log('Signing up a test user:', email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error('Sign up failed:', signUpError);
    return;
  }

  const session = signUpData.session;
  console.log('Successfully signed up! Session user ID:', signUpData.user?.id);

  console.log('\n--- Querying str_elv table under authenticated session ---');
  const { data: elvData, error: elvError } = await supabase
    .from('str_elv')
    .select('*')
    .eq('plat_id', 1061);
  
  if (elvError) {
    console.error('str_elv Error under AUTHENTICATED:', elvError);
  } else {
    console.log('str_elv Success under AUTHENTICATED, rows found:', elvData.length);
  }

  console.log('\n--- Querying comment table under authenticated session ---');
  const { data: commentData, error: commentError } = await supabase
    .from('comment')
    .select('*')
    .eq('structure_id', 1061)
    .eq('structure_type', 'platform');
  
  if (commentError) {
    console.error('comment Error under AUTHENTICATED:', commentError);
  } else {
    console.log('comment Success under AUTHENTICATED, rows found:', commentData.length);
  }

  // Cleanup/delete user if needed (though it's fine to leave it in dev db)
}

test().catch(console.error);
