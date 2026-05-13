const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
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

async function checkSowItems() {
  const { data, error } = await supabase
    .from('u_sow_items')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching from u_sow_items:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in u_sow_items:', Object.keys(data[0]));
    console.log('Sample row:', JSON.stringify(data[0], null, 2));
  } else {
    console.log('No data found in u_sow_items');
  }
}

checkSowItems();
