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

async function inspectSchema() {
  console.log('Inspecting insp_dive_jobs columns...');
  
  // We can use a trick to see columns by selecting one row and looking at keys
  const { data, error } = await supabase
    .from('insp_dive_jobs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching Row:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in insp_dive_jobs:', Object.keys(data[0]));
  } else {
    console.log('No data in insp_dive_jobs to check columns.');
  }

  console.log('\nInspecting insp_records columns...');
  const { data: recData } = await supabase.from('insp_records').select('*').limit(1);
  if (recData?.[0]) console.log('Columns in insp_records:', Object.keys(recData[0]));
}

inspectSchema();
