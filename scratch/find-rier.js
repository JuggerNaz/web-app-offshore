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

async function findRier() {
  const { data, error } = await supabase
    .from('insp_records')
    .select('insp_id, description, inspection_data, jobpack_id, structure_id, sow_report_no')
    .or('description.ilike.%Rier%,inspection_data->>findings.ilike.%Rier%,inspection_data->>remarks.ilike.%Rier%');

  if (error) {
    console.error('Error searching:', error);
    return;
  }

  console.log('Search results:', JSON.stringify(data, null, 2));
}

findRier();
