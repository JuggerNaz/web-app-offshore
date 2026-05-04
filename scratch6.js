const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const url = urlMatch ? urlMatch[1].trim() : null;
const key = keyMatch ? keyMatch[1].trim() : null;

async function checkInspData() {
  const res = await fetch(`${url}/rest/v1/insp_records?select=inspection_data&limit=50`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await res.json();
  const keys = new Set();
  data.forEach(d => {
    if (d.inspection_data) {
      Object.keys(d.inspection_data).forEach(k => keys.add(k));
    }
  });
  console.log("Common inspection_data keys:", Array.from(keys));
}

checkInspData();
