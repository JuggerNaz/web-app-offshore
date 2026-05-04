const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
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

async function checkContext() {
  const { data: jobpacks } = await supabase.from('jobpacks').select('jobpack_id, jobpack_no').eq('jobpack_no', 'UIMC2026/NQ/Plat01');
  console.log('Jobpacks:', jobpacks);

  const { data: platforms } = await supabase.from('platform').select('plat_id, title').eq('title', 'PLAT-C');
  console.log('Platforms:', platforms);
  
  if (platforms && platforms.length > 0) {
     const { data: structures } = await supabase.from('structure').select('str_id, plat_id').eq('plat_id', platforms[0].plat_id);
     console.log('Structures for PLAT-C:', structures);
  }
}

checkContext();
