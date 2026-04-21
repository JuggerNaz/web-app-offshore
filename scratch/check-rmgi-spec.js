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

async function checkRMGISpec() {
  const { data, error } = await supabase
    .from('inspection_type')
    .select('*')
    .eq('code', 'RMGI');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Found ${data.length} RMGI specs.`);
  data.forEach((d, i) => {
    console.log(`Spec ${i} (ID: ${d.id}):`);
    console.log(JSON.stringify(d.fields, null, 2));
  });
}

checkRMGISpec();
