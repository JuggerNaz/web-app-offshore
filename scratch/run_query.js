require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  // Find jobpack
  const { data: jps, error: jpErr } = await supabase
    .from('jobpack')
    .select('id, name, metadata');
  if (jpErr) {
    console.error('JP error:', jpErr);
    return;
  }
  console.log('--- Jobpacks ---');
  jps.forEach(jp => {
    console.log(`ID: ${jp.id}, Name: ${jp.name}, metadata:`, jp.metadata);
  });

  const targetJp = jps.find(jp => jp.name.includes('UIMC10/ROV/SKO/PLAT1') || jp.metadata?.oracleInspNo === '00000001504');
  if (!targetJp) {
    console.log('UIMC10/ROV/SKO/PLAT1 not found in Postgres jobpack table.');
    return;
  }
  console.log('Found Target Jobpack ID:', targetJp.id);

  // Find SOW records for this jobpack
  const { data: sows, error: sowErr } = await supabase
    .from('u_sow')
    .select('*')
    .eq('jobpack_id', targetJp.id);
  
  console.log('--- SOWs for target jobpack ---');
  console.log(JSON.stringify(sows, null, 2));

  // Find job records in insp_rov_jobs
  const { data: rovJobs, error: rjErr } = await supabase
    .from('insp_rov_jobs')
    .select('rov_job_id, deployment_no, sow_report_no')
    .eq('jobpack_id', targetJp.id);
  console.log('--- ROV Jobs ---');
  console.log(rovJobs);
}

run();
