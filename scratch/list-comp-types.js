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

async function listTypes() {
  const { data, error } = await supabase
    .from('structure_components')
    .select('component_type, code')
    .limit(1000);

  if (error) {
    console.error(error);
    return;
  }

  const unique = {};
  data.forEach(c => {
    const key = `${c.component_type} (${c.code})`;
    unique[key] = (unique[key] || 0) + 1;
  });

  console.log(unique);
}

listTypes();
