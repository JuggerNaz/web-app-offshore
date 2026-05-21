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
  console.log('Checking if RLS is enabled for insp_rov_jobs...');
  const { data, error } = await supabase.rpc('check_rls_enabled', { table_name_input: 'insp_rov_jobs' });
  
  if (error) {
    console.log('RPC check_rls_enabled failed. Trying alternative...');
    // We can't really check RLS from anon client easily without an RPC.
    // But we can try to insert and see the error code.
    const { error: err } = await supabase.from('insp_rov_jobs').insert({ deployment_no: 'TEST-RLS', rov_serial_no: 'TEST', rov_operator: 'TEST', rov_supervisor: 'TEST', report_coordinator: 'TEST', structure_id: 1 }).select();
    if (err) {
      console.log('Insert error code:', err.code);
      console.log('Insert error message:', err.message);
    }
  } else {
    console.log('RLS Enabled:', data);
  }
}

verify();
