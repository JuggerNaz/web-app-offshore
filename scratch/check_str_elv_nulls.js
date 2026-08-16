const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envConfig = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    envConfig[match[1]] = value;
  }
});

const url = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const key = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function inspectElevations() {
  console.log("=== Inspecting str_elv table ===");
  const { data, error } = await supabase
    .from('str_elv')
    .select('*');

  if (error) {
    console.error("Error fetching str_elv:", error);
    return;
  }

  console.log(`Total rows in str_elv: ${data.length}`);
  const nullOrient = data.filter(r => r.orient === null || r.orient === undefined || r.orient === "");
  console.log(`Rows with null/empty orient: ${nullOrient.length}`);
  console.log("Null orient rows sample:", nullOrient.slice(0, 10));

  const allOrients = new Set(data.map(r => r.orient));
  console.log("Distinct orient values:", Array.from(allOrients));
}

inspectElevations();
