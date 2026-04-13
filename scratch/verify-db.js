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

async function verify() {
  console.log('Testing connection to:', envConfig.NEXT_PUBLIC_SUPABASE_URL);
  
  // Try fetching count of inspection_type
  const { count, error: countErr } = await supabase
    .from('inspection_type')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error('Error fetching count:', countErr);
  } else {
    console.log('Count of inspection_type:', count);
  }

  // List first 5 names
  const { data, error: dataErr } = await supabase
    .from('inspection_type')
    .select('code, name')
    .limit(5);

  if (dataErr) {
    console.error('Error fetching data:', dataErr);
  } else {
    console.log('Sample Data:', data);
  }
}

verify();
