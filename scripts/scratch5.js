const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const url = urlMatch ? urlMatch[1].trim() : null;
const key = keyMatch ? keyMatch[1].trim() : null;

async function checkInspectionTypes() {
  const res = await fetch(`${url}/rest/v1/inspection_type?select=code,name,default_properties`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await res.json();
  console.log("Inspection Types and Properties:");
  data.forEach(t => {
    console.log(`- ${t.code} (${t.name}):`, JSON.stringify(t.default_properties, null, 2));
  });
}

checkInspectionTypes();
