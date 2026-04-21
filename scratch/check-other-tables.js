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

async function checkOtherTablesSchema() {
  console.log('=== U_SOW_ITEMS TABLE ===');
  const { data: sowItems, error: err1 } = await supabase.from('u_sow_items').select('*').limit(1);
  if (sowItems && sowItems.length > 0) {
    console.log('Columns:', Object.keys(sowItems[0]).sort().join(', '));
  } else if (err1) {
    console.log('Error:', err1.message);
  }

  console.log('\n=== U_SOW TABLE ===');
  const { data: sow, error: err2 } = await supabase.from('u_sow').select('*').limit(1);
  if (sow && sow.length > 0) {
    console.log('Columns:', Object.keys(sow[0]).sort().join(', '));
  } else if (err2) {
    console.log('Error:', err2.message);
  }
}

checkOtherTablesSchema();
