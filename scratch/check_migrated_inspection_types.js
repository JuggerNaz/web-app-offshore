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
  console.log('Fetching all migrated inspection records for structure_id = 1061 and jobpack_id = 610...');
  
  const { data: records, error } = await supabase
    .from('insp_records')
    .select('inspection_type_code, status, has_anomaly')
    .eq('structure_id', 1061)
    .eq('jobpack_id', 610);
    
  if (error) {
    console.error('Error fetching records:', error.message);
    return;
  }
  
  console.log(`Total inspection records fetched: ${records.length}`);
  
  const counts = {};
  records.forEach(r => {
    const code = r.inspection_type_code || 'UNKNOWN';
    if (!counts[code]) {
      counts[code] = { total: 0, completed: 0, incomplete: 0, with_anomaly: 0 };
    }
    counts[code].total++;
    if (r.status === 'COMPLETED') counts[code].completed++;
    if (r.status === 'INCOMPLETE') counts[code].incomplete++;
    if (r.has_anomaly) counts[code].with_anomaly++;
  });
  
  console.log('\nBreakdown of inspection records by inspection type code:');
  console.table(counts);
}

main().catch(console.error);
