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
  console.log('Checking insp_rov_jobs table...');
  const { data: rowData, error: rowErr } = await supabase
    .from('insp_rov_jobs')
    .select('*')
    .limit(1);
    
  if (rowErr) {
    console.error('Error reading insp_rov_jobs:', rowErr);
  } else {
    console.log('Columns in insp_rov_jobs:', rowData.length > 0 ? Object.keys(rowData[0]) : 'Table is empty');
    if (rowData.length > 0) {
        console.log('Sample data:', rowData[0]);
    } else {
        // If empty, try to get column names via another way if possible, 
        // but usually we can just try an insert and see the error.
        console.log('Table is empty, cannot infer columns from data.');
    }
  }
}

verify();
