const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Resolving parameters...');

  // 1. Search jobpack
  const { data: jps } = await supabase
    .from('jobpack')
    .select('id, name')
    .ilike('name', '%UIMC10/ROV/SK0/PLAT1%');
  console.log('Jobpacks matching UIMC10/ROV/SK0/PLAT1:', jps);

  // 2. Search platform
  const { data: platforms } = await supabase
    .from('platform')
    .select('plat_id, title')
    .ilike('title', '%BOP-A%');
  console.log('Platforms matching BOP-A:', platforms);

  // 3. Search pipeline
  const { data: pipelines } = await supabase
    .from('u_pipeline')
    .select('pipe_id, title')
    .ilike('title', '%BOP-A%');
  console.log('Pipelines matching BOP-A:', pipelines);
}

run();
