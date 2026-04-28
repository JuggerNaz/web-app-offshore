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

async function checkJobpackLink() {
  const { data: recs } = await supabase.from('insp_records').select('jobpack_id').not('jobpack_id', 'is', null).limit(5);
  console.log('insp_records jobpack_id samples:', recs);

  const ids = recs.map(r => r.jobpack_id);

  const { data: jp } = await supabase.from('jobpack').select('id, name').in('id', ids);
  console.log('jobpack matches:', jp);

  const { data: tjp } = await supabase.from('u_taskstr').select('task_id, name').in('task_id', ids);
  console.log('u_taskstr matches:', tjp);

  // Check u_sow
  const { data: sowRecs } = await supabase.from('u_sow').select('jobpack_id').not('jobpack_id', 'is', null).limit(5);
  console.log('u_sow jobpack_id samples:', sowRecs);
  
  const sowIds = sowRecs.map(r => r.jobpack_id);
  const { data: sowjp } = await supabase.from('jobpack').select('id, name').in('id', sowIds);
  console.log('u_sow matching jobpack table:', sowjp);

  const { data: sowtjp } = await supabase.from('u_taskstr').select('task_id, name').in('task_id', sowIds);
  console.log('u_sow matching u_taskstr table:', sowtjp);
}

checkJobpackLink();
