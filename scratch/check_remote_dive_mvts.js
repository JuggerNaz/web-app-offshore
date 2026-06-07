const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(envText.split('\n').filter(l => l && !l.startsWith('#')).map(l => {
  const i = l.indexOf('=');
  return [l.slice(0, i).trim(), l.slice(i+1).trim().replace(/['"]/g, '')];
}));
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  try {
    console.log("Fetching a record from insp_dive_movements...");
    const { data: diveData, error: diveError } = await supabase.from('insp_dive_movements').select('*').limit(1);
    if (diveError) {
      console.error("insp_dive_movements error:", diveError);
    } else {
      console.log("insp_dive_movements record keys:", Object.keys(diveData[0] || {}));
      console.log("Sample record:", diveData[0]);
    }

    console.log("Fetching a record from insp_rov_movements...");
    const { data: rovData, error: rovError } = await supabase.from('insp_rov_movements').select('*').limit(1);
    if (rovError) {
      console.error("insp_rov_movements error:", rovError);
    } else {
      console.log("insp_rov_movements record keys:", Object.keys(rovData[0] || {}));
      console.log("Sample record:", rovData[0]);
    }
  } catch (e) {
    console.error(e);
  }
}

run();
