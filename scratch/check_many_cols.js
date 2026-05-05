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
  const columns = ['rov_type', 'auto_capture_data', 'auto_grab_video', 'rov_data_config_id', 'video_grab_config_id'];
  console.log('Checking columns:', columns);
  
  for (const col of columns) {
    const { error } = await supabase.from('insp_rov_jobs').select(col).limit(0);
    if (error) {
      console.log(`Column ${col} does NOT exist.`);
    } else {
      console.log(`Column ${col} EXISTS.`);
    }
  }
}

verify();
