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

async function checkRecentRecords() {
  console.log('=== CHECKING RECENT RECORDS FOR ELEVATION ===');
  const { data, error } = await supabase
    .from('insp_records')
    .select('insp_id, elevation, inspection_data, inspection_type_code')
    .order('cr_date', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  data.forEach(r => {
    console.log(`Record ID: ${r.insp_id} | Type: ${r.inspection_type_code} | Elevation: ${r.elevation}`);
    console.log(`   Inspection Data:`, JSON.stringify(r.inspection_data));
  });
}

checkRecentRecords();
