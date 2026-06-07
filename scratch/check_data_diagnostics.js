const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
  const i = l.indexOf('=');
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/['"]/g, '')];
}));
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log("--- Supabase Diagnostics ---");
  
  // 1. Check all job packs
  const { data: jobpacks, error: jpError } = await supabase.from('jobpack').select('id, name');
  if (jpError) {
    console.error("Error fetching jobpacks:", jpError);
    return;
  }
  console.log(`Total jobpacks in DB: ${jobpacks.length}`);
  console.log("Jobpacks list:", jobpacks.map(jp => `ID: ${jp.id}, Name: ${jp.name}`));

  // 2. Check insp_dive_jobs jobpack_ids
  const { data: diveJobs, error: djError } = await supabase.from('insp_dive_jobs').select('dive_job_id, jobpack_id');
  console.log(`Total insp_dive_jobs: ${diveJobs?.length ?? 0}`);
  const diveJpIds = new Set(diveJobs?.map(j => j.jobpack_id).filter(Boolean));
  console.log("Jobpack IDs in insp_dive_jobs:", Array.from(diveJpIds));

  // 3. Check insp_rov_jobs jobpack_ids
  const { data: rovJobs, error: rjError } = await supabase.from('insp_rov_jobs').select('rov_job_id, jobpack_id');
  console.log(`Total insp_rov_jobs: ${rovJobs?.length ?? 0}`);
  const rovJpIds = new Set(rovJobs?.map(j => j.jobpack_id).filter(Boolean));
  console.log("Jobpack IDs in insp_rov_jobs:", Array.from(rovJpIds));

  // 4. Check insp_records jobpack_ids
  const { data: records, error: recError } = await supabase.from('insp_records').select('insp_id, jobpack_id, structure_id');
  console.log(`Total insp_records: ${records?.length ?? 0}`);
  const recJpIds = new Set(records?.map(j => j.jobpack_id).filter(Boolean));
  console.log("Jobpack IDs in insp_records:", Array.from(recJpIds));

  // 5. Check jobpack 595 specifically
  const { data: j595records, error: j595Error } = await supabase.from('insp_records').select('insp_id, structure_id, sow_report_no').eq('jobpack_id', 595);
  console.log(`Total insp_records linked to jobpack 595: ${j595records?.length ?? 0}`);
  if (j595records && j595records.length > 0) {
    const structIds = new Set(j595records.map(r => r.structure_id));
    const sowReportNos = new Set(j595records.map(r => r.sow_report_no));
    console.log("Structures in jobpack 595 records:", Array.from(structIds));
    console.log("SOW reports in jobpack 595 records:", Array.from(sowReportNos));
  }
}

run();
