const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { count, error } = await supabase
    .from('insp_records')
    .select('*', { count: 'exact', head: true })
    .eq('structure_id', 260);
  console.log('Total inspection records for structure=260:', count);
  if (error) console.error(error);

  const { data: samples } = await supabase
    .from('insp_records')
    .select('insp_id, jobpack_id, structure_id, sow_report_no, rov_job_id, dive_job_id')
    .eq('structure_id', 260)
    .limit(5);
  console.log('Sample inspection records for structure=260:', samples);
}

run();
