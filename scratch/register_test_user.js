const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const email = 'test_user@example.com';
  const password = 'TestPassword123!';
  
  console.log("Signing up user:", email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (error) {
    console.error("Sign up error:", error.message);
  } else {
    console.log("Successfully registered test user!", data.user?.id);
  }
}

main();
