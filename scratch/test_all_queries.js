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

async function testAll() {
  // Let's find some deployments to test with
  const jobPackId = "1"; // let's check
  const structureId = "1";
  const inspMethod = "ROV"; // from screenshot
  
  console.log('Fetching active ROV jobs...');
  const { data: rovJobs, error: rovErr } = await supabase
    .from('insp_rov_jobs')
    .select('*')
    .limit(5);

  if (rovErr) {
    console.error('ROV Jobs Error:', rovErr);
    return;
  }
  
  if (!rovJobs || rovJobs.length === 0) {
    console.log('No ROV jobs found');
    return;
  }

  const activeDep = rovJobs[0];
  const depId = activeDep.rov_job_id;
  console.log('Using active ROV job:', activeDep.rov_job_no, 'ID:', depId);

  const mvtTable = 'insp_rov_movements';
  const mvtCol = 'rov_job_id';

  console.log('Testing movements query...');
  const { data: movs, error: movsErr } = await supabase
    .from(mvtTable)
    .select("*")
    .eq(mvtCol, depId)
    .order("movement_time", { ascending: true });
  console.log('Movements query result:', movsErr ? 'ERROR: ' + movsErr.message : 'SUCCESS: ' + movs.length + ' rows');

  console.log('Testing tapes query...');
  const { data: tapes, error: tapesErr } = await supabase
    .from("insp_video_tapes")
    .select("*")
    .eq(mvtCol, depId)
    .order("tape_id", { ascending: false });
  console.log('Tapes query result:', tapesErr ? 'ERROR: ' + tapesErr.message : 'SUCCESS: ' + tapes.length + ' rows');

  console.log('Testing overallLatestTape query...');
  const { data: overallLatestTape, error: overallErr } = await supabase
    .from("insp_video_tapes")
    .select("tape_no, chapter_no")
    .order("tape_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log('overallLatestTape query result:', overallErr ? 'ERROR: ' + overallErr.message : 'SUCCESS: ' + JSON.stringify(overallLatestTape));

  if (overallLatestTape) {
    console.log('Testing latestTapeForNo query...');
    const { data: latestTapeForNo, error: latestErr } = await supabase
      .from("insp_video_tapes")
      .select("chapter_no")
      .eq("tape_no", overallLatestTape.tape_no)
      .order("chapter_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log('latestTapeForNo query result:', latestErr ? 'ERROR: ' + latestErr.message : 'SUCCESS: ' + JSON.stringify(latestTapeForNo));
  }

  console.log('Testing inspsQuery query...');
  const { data: insps, error: inspsErr } = await supabase
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
    .eq("jobpack_id", 1) // Using 1 for test
    .not(mvtCol, "is", null)
    .order("inspection_date", { ascending: false })
    .order("inspection_time", { ascending: false })
    .range(0, 24);
  console.log('inspsQuery result:', inspsErr ? 'ERROR: ' + inspsErr.message : 'SUCCESS: ' + insps.length + ' rows');
}

testAll();
