const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testMismatched() {
  const jobPackId = "UIMC2026/NQ/Plat01";
  const structureId = "PLAT-C";
  const sowReportNo = "2026-REPORT-01";
  const mvtCol = "rov_job_id";

  const parsedJobpackId = parseInt(jobPackId || "0");
  const parsedStructureId = Number(structureId);

  console.log(`Parsed Jobpack ID: ${parsedJobpackId}`);
  console.log(`Parsed Structure ID: ${parsedStructureId}`);

  console.log('Testing inspsQuery query...');
  let inspsQuery = supabase
    .from("insp_records")
    .select(
      `
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
        `,
      { count: "exact" }
    )
    .eq("jobpack_id", parsedJobpackId)
    .not(mvtCol, "is", null)
    .order("inspection_date", { ascending: false })
    .order("inspection_time", { ascending: false })
    .range(0, 24);

  if (structureId && !isNaN(parsedStructureId)) {
    inspsQuery = inspsQuery.eq("structure_id", parsedStructureId);
  }
  if (sowReportNo) {
    inspsQuery = inspsQuery.or(`sow_report_no.eq."${sowReportNo}",sow_report_no.is.null`);
  }

  const { data, error } = await inspsQuery;
  console.log('inspsQuery result:', error ? 'ERROR: ' + JSON.stringify(error) : 'SUCCESS: ' + data.length + ' rows');
}

testMismatched();
