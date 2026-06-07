const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  const { data: platforms } = await supabase.from('platform').select('plat_id, title');
  const { data: pipelines } = await supabase.from('u_pipeline').select('pipe_id, title');
  const { data: rovJobs } = await supabase.from('insp_rov_jobs').select('rov_job_id, deployment_no, structure_id');
  const { data: diveJobs } = await supabase.from('insp_dive_jobs').select('dive_job_id, dive_no, structure_id');

  console.log("Migrated Platforms:", platforms);
  console.log("Migrated Pipelines:", pipelines);
  console.log("ROV Jobs:", rovJobs);
  console.log("Diving Jobs:", diveJobs);
}

main();
