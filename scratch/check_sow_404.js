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
  const { data: sow } = await supabase.from('u_sow').select('*').eq('jobpack_id', 404).eq('structure_id', 258);
  console.log('u_sow records for JP 404, Str 258:', sow);
  console.log('report_numbers array:', sow?.[0]?.report_numbers);

  const { data: sowItems } = await supabase.from('u_sow_items').select('*').eq('sow_id', sow?.[0]?.id);
  console.log('u_sow_items sample:', sowItems?.slice(0, 3));

  const { data: movements } = await supabase.from('insp_dive_movements').select('*').in('dive_job_id', [2971, 2972, 2973]);
  console.log('insp_dive_movements count:', movements?.length);
  console.log('insp_dive_movements sample:', movements?.slice(0, 5));
}

run();
