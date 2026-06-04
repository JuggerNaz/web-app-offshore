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
    console.log("=== Querying Dive Jobs in Postgres ===");
    const { data: diveJobs, error: err1 } = await supabase
      .from('insp_dive_jobs')
      .select('dive_job_id, dive_no, structure_id, jobpack_id, sow_report_no');
    
    if (err1) throw err1;
    console.log(`Found ${diveJobs.length} dive jobs:`);
    console.log(diveJobs.map(j => ({ id: j.dive_job_id, no: j.dive_no, str: j.structure_id, jp: j.jobpack_id, sow: j.sow_report_no })));

    console.log("\n=== Querying CPCLB Records in Postgres ===");
    const { data: cpclbRecs, error: err2 } = await supabase
      .from('insp_records')
      .select('insp_id, dive_job_id, structure_id, component_id, jobpack_id, inspection_type_code, inspection_data')
      .eq('inspection_type_code', 'CPCLB');
    
    if (err2) throw err2;
    console.log(`Found ${cpclbRecs.length} CPCLB records:`);
    console.log(cpclbRecs.map(r => ({
      insp_id: r.insp_id,
      dive_job_id: r.dive_job_id,
      structure_id: r.structure_id,
      component_id: r.component_id,
      jobpack_id: r.jobpack_id,
      type_code: r.inspection_type_code,
      data_dive_no: r.inspection_data?.DIVE_NO || r.inspection_data?.dive_no
    })));

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
