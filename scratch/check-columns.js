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

async function checkPkey() {
  const { data, error } = await supabase
    .from('inspection_type')
    .select('*')
    .limit(1);

  if (data && data.length > 0) {
    console.log('Sample Row:', data[0]);
  } else {
    console.log('Table empty or no access');
  }
}

checkPkey();
