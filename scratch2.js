const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const url = urlMatch ? urlMatch[1].trim() : null;
const key = keyMatch ? keyMatch[1].trim() : null;

fetch(`${url}/rest/v1/u_pipeline?limit=1`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}).then(res => res.json()).then(data => {
  if (data && data.length > 0) {
    console.log("u_pipeline columns:", Object.keys(data[0]));
  } else {
    console.log("u_pipeline is empty or error:", data);
  }
});

fetch(`${url}/rest/v1/structure_components?limit=1`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}).then(res => res.json()).then(data => {
  if (data && data.length > 0) {
    console.log("structure_components columns:", Object.keys(data[0]));
  } else {
    console.log("structure_components is empty or error:", data);
  }
});
