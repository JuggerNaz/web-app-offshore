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

async function main() {
  console.log('=== Migrated Anomalies ===');
  const { data, error } = await supabase
    .from('insp_anomalies')
    .select('anomaly_id, anomaly_ref_no, defect_type_code, priority_code, defect_category_code, defect_description, severity');
  
  if (error) {
    console.error('Error fetching anomalies:', error.message);
  } else {
    console.log(`Found ${data.length} anomalies:`);
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
