const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
const url = urlMatch ? urlMatch[1].trim() : null;
const key = keyMatch ? keyMatch[1].trim() : null;

async function fetchColumns(table) {
  const res = await fetch(`${url}/rest/v1/${table}?limit=1`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await res.json();
  if (data && data.length > 0) {
    console.log(`${table} columns:`, Object.keys(data[0]));
    if (data[0].metadata) {
       console.log(`${table} metadata sample:`, Object.keys(data[0].metadata));
    }
    if (data[0].config) {
        console.log(`${table} config sample:`, Object.keys(data[0].config));
    }
    if (data[0].inspection_data) {
        console.log(`${table} inspection_data sample:`, Object.keys(data[0].inspection_data));
    }
  } else {
    console.log(`${table} is empty or error:`, data);
  }
}

async function main() {
  await fetchColumns('jobpack');
  await fetchColumns('u_sow');
  await fetchColumns('insp_records');
  await fetchColumns('insp_anomalies');
}

main();
