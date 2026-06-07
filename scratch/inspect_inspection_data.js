const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  try {
    // 1. Get Jobpack
    const { data: jobpacks, error: jpErr } = await supabase
      .from('jobpack')
      .select('id, name')
      .ilike('name', '%UIMC10/ROV/SKO/PLAT1%');
    
    console.log('--- Jobpacks ---');
    console.log(jobpacks, jpErr);

    if (!jobpacks || jobpacks.length === 0) return;
    const jobpackId = jobpacks[0].id;

    // 2. Get Structure
    const { data: structures, error: strErr } = await supabase
      .from('platform')
      .select('plat_id, title')
      .ilike('title', '%BOP-A%');
    
    console.log('--- Structures ---');
    console.log(structures, strErr);
    if (!structures || structures.length === 0) return;
    const structureId = structures[0].plat_id;

    // 3. Get ROV Jobs
    const { data: rovJobs, error: rovErr } = await supabase
      .from('insp_rov_jobs')
      .select('rov_job_id, deployment_no, structure_id, jobpack_id, sow_report_no')
      .eq('jobpack_id', jobpackId);
    
    console.log('--- ROV Jobs ---');
    console.log(rovJobs, rovErr);

    // 4. Get Dive Jobs
    const { data: diveJobs, error: diveErr } = await supabase
      .from('insp_dive_jobs')
      .select('dive_job_id, dive_no, structure_id, jobpack_id, sow_report_no')
      .eq('jobpack_id', jobpackId);
    
    console.log('--- Dive Jobs ---');
    console.log(diveJobs, diveErr);

    // 5. Sample Inspection Records
    const { data: records, error: recErr } = await supabase
      .from('insp_records')
      .select('insp_id, jobpack_id, structure_id, sow_report_no, rov_job_id, dive_job_id, component_id')
      .eq('jobpack_id', jobpackId)
      .limit(10);
    
    console.log('--- Sample Inspection Records ---');
    console.log(records, recErr);

    // Count records with rov_job_id or dive_job_id
    const { data: allRecords } = await supabase
      .from('insp_records')
      .select('rov_job_id, dive_job_id')
      .eq('jobpack_id', jobpackId);
    
    console.log('--- Record Count Summary ---');
    if (allRecords) {
      const hasRovJob = allRecords.filter(r => r.rov_job_id).length;
      const hasDiveJob = allRecords.filter(r => r.dive_job_id).length;
      console.log(`Total records: ${allRecords.length}`);
      console.log(`Has rov_job_id: ${hasRovJob}`);
      console.log(`Has dive_job_id: ${hasDiveJob}`);
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

inspect();
