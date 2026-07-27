const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: user, error: userError } = await supabase.auth.signInWithPassword({
    email: 'admin@offshore.com', // Let's check typical seeded user emails or see if there is any active session we can grab.
    password: 'password123'
  });
  console.log('User Error:', userError);
  console.log('Session user:', user?.user?.email);
}
run();
