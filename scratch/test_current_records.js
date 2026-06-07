require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: insps, error } = await supabase
    .from("insp_records")
    .select(`
        *,
        inspection_type:inspection_type_id!left(id, code, name),
        structure_components:component_id!left (
            id,
            q_id, 
            code,
            metadata
        ),
        insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
        insp_dive_jobs:dive_job_id!left(id:dive_job_id, job_no:dive_no, name:diver_name),
        insp_video_tapes:tape_id!left(tape_no),
        insp_anomalies(*)
    `)
    .eq("structure_id", 234)
    .order("inspection_date", { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Fetched ${insps.length} records.`);
  insps.slice(0, 10).forEach(r => {
    const typeCode = (r.inspection_type_code || r.inspection_type?.code || "").toUpperCase();
    const compCode = (r.structure_components?.code || r.component?.code || "").toUpperCase();
    console.log(`Insp ID: ${r.insp_id}, typeCode: "${typeCode}", compCode: "${compCode}", raw_components:`, r.structure_components);
  });
}

run();
