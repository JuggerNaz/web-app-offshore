const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Successfully connected to Supabase JS client.');

  // Let's query rov jobs
  const { data: rovJobs } = await supabase.from('insp_rov_jobs').select('*').limit(1);
  if (!rovJobs || rovJobs.length === 0) {
    console.log('No ROV jobs found');
    return;
  }

  const job = rovJobs[0];
  const depId = job.rov_job_id;
  console.log(`Testing with rov_job_id: ${depId}`);

  // Query 1: Movements
  let startTime = Date.now();
  const { data: movs, error: movsErr } = await supabase
    .from('insp_rov_movements')
    .select('*')
    .eq('rov_job_id', depId)
    .order('movement_time', { ascending: true });
  console.log(`Query 1 (Movements): ${movs?.length || 0} rows, took ${Date.now() - startTime}ms`);
  if (movsErr) console.error(movsErr);

  // Query 2: Tapes
  startTime = Date.now();
  const { data: tapes, error: tapesErr } = await supabase
    .from('insp_video_tapes')
    .select('*')
    .eq('rov_job_id', depId)
    .order('tape_id', { ascending: false });
  console.log(`Query 2 (Tapes): ${tapes?.length || 0} rows, took ${Date.now() - startTime}ms`);
  if (tapesErr) console.error(tapesErr);

  const tapeIds = tapes?.map(t => t.tape_id) || [];

  // Query 3: Video Logs
  if (tapeIds.length > 0) {
    startTime = Date.now();
    const { data: logs, error: logsErr } = await supabase
      .from('insp_video_logs')
      .select('*')
      .in('tape_id', tapeIds)
      .order('event_time', { ascending: false });
    console.log(`Query 3 (Logs): ${logs?.length || 0} rows, took ${Date.now() - startTime}ms`);
    if (logsErr) console.error(logsErr);
  } else {
    console.log('No tapes, skipping logs query.');
  }

  // Query 4: Attachment counts
  // Let's simulate fetching attachment count for some mock insp_ids
  const sampleInspIds = [1, 2, 3, 4, 5];
  startTime = Date.now();
  const { data: atts, error: attsErr } = await supabase
    .from('attachment')
    .select('source_id')
    .in('source_type', ['inspection', 'INSPECTION'])
    .in('source_id', sampleInspIds);
  console.log(`Query 4 (Attachments): ${atts?.length || 0} rows, took ${Date.now() - startTime}ms`);
  if (attsErr) console.error(attsErr);
}

run();
