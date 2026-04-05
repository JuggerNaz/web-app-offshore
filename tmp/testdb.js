const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
  const i = l.indexOf('=');
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/['"]/g, '')];
}));
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('insp_rov_jobs').select('*').limit(1);
  if (error) {
    console.error("DB Error:", error);
  } else {
    console.log("Columns:", Object.keys(data[0] || {}));
  }
}
test();
