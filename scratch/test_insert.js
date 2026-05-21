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

async function verify() {
  console.log('Testing insert into insp_rov_jobs with all fields...');
  
  const payload = {
    deployment_no: 'TEST-001',
    rov_type: 'Observation Class',
    rov_operator: 'TEST',
    rov_supervisor: 'TEST',
    deployment_date: '2026-05-05',
    start_time: '12:00',
    status: 'IN_PROGRESS'
  };

  const { data, error } = await supabase.from('insp_rov_jobs').insert(payload).select();
  
  if (error) {
    console.error('Insert failed:', error);
  } else {
    console.log('Insert succeeded:', data);
    // Cleanup
    await supabase.from('insp_rov_jobs').delete().eq('deployment_no', 'TEST-001');
  }
}

verify();
