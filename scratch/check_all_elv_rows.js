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

async function inspectAllElevations() {
  const { data, error } = await supabase.from('str_elv').select('*');
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  const nullOrient = data.filter(r => !r.orient);
  const mismatchAbove = data.filter(r => r.orient === 'ABOVE' && Number(r.elv) < 0);
  const mismatchBelow = data.filter(r => r.orient === 'BELOW' && Number(r.elv) > 0);

  console.log(`Total rows: ${data.length}`);
  console.log(`Null orientation rows: ${nullOrient.length}`);
  console.log(`Mismatched ABOVE (orient=ABOVE, elv<0): ${mismatchAbove.length}`);
  console.log(`Mismatched BELOW (orient=BELOW, elv>0): ${mismatchBelow.length}`);

  if (mismatchAbove.length > 0) {
    console.log("Mismatch ABOVE samples:", mismatchAbove);
  }
  if (mismatchBelow.length > 0) {
    console.log("Mismatch BELOW samples:", mismatchBelow);
  }
}

inspectAllElevations();
