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
  try {
    const { data: recs, error } = await supabase
      .from('insp_records')
      .select('insp_id, dive_job_id, structure_id, component_id, jobpack_id, inspection_type_code, inspection_data')
      .eq('inspection_type_code', 'CPCLB')
      .limit(3);
    
    if (error) throw error;
    
    console.log("=== CPCLB Inspection Data Payload Samples ===");
    for (const r of recs) {
      console.log(`\nRecord insp_id: ${r.insp_id}`);
      console.log(`dive_job_id: ${r.dive_job_id}`);
      console.log(`structure_id: ${r.structure_id}`);
      console.log(`component_id: ${r.component_id}`);
      console.log(`jobpack_id: ${r.jobpack_id}`);
      console.log("inspection_data:", JSON.stringify(r.inspection_data, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
