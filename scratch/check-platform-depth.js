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
  // Find a platform that actually has a depth value set
  console.log('=== PLATFORMS WITH DEPTH SET ===');
  const { data } = await supabase
    .from('platform')
    .select('plat_id, title, depth, pfield, inst_date')
    .not('depth', 'is', null)
    .limit(5);

  if (data && data.length > 0) {
    data.forEach(p => console.log(`  id=${p.plat_id}, title=${p.title}, depth=${p.depth}m, field=${p.pfield}`));
  } else {
    console.log('  No platforms with depth set yet (all null)');
  }

  // Check what columns structure table actually has
  console.log('\n=== STRUCTURE TABLE COLUMNS ===');
  const { data: str } = await supabase
    .from('structure')
    .select('*')
    .limit(1);
  if (str && str.length > 0) {
    console.log('Columns:', Object.keys(str[0]).join(', '));
  }
}

verify();
