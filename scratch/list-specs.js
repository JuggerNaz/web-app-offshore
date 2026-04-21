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

async function listSpecs() {
  const { data, error } = await supabase
    .from('inspection_type')
    .select('id, code, name');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Inspection Types:');
  data.forEach(d => console.log(`ID: ${d.id} | Code: ${d.code} | Name: ${d.name}`));
}

listSpecs();
