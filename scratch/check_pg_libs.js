const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function run() {
  let supabaseUrl = "";
  let supabaseKey = "";

  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const urlMatch = envContent.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/m);
      const keyMatch = envContent.match(/^\s*NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/m);
      if (urlMatch) supabaseUrl = urlMatch[1].trim();
      if (keyMatch) supabaseKey = keyMatch[1].trim();
    }
  } catch (e) {
    console.error("Error reading .env.local:", e);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Connected to Supabase Client...");

  const { data: codes, error: err1 } = await supabase
    .from('u_lib_list')
    .select('lib_id, lib_desc, lib_code')
    .eq('lib_code', 'AMLY_COD');
  
  if (err1) {
    console.error("Error fetching AMLY_COD:", err1.message);
  } else {
    console.log(`\n--- AMLY_COD in Postgres (${codes ? codes.length : 0} items) ---`);
    if (codes) {
      codes.forEach(c => console.log(`- ${c.lib_id}: ${c.lib_desc}`));
    }
  }

  const { data: findings, error: err2 } = await supabase
    .from('u_lib_list')
    .select('lib_id, lib_desc, lib_code')
    .eq('lib_code', 'AMLY_FND')
    .in('lib_id', ['VSMEMB', 'NONE']);
  
  if (err2) {
    console.error("Error fetching AMLY_FND:", err2.message);
  } else {
    console.log(`\n--- AMLY_FND (sample) in Postgres (${findings ? findings.length : 0} items) ---`);
    if (findings) {
      findings.forEach(f => console.log(`- ${f.lib_id}: ${f.lib_desc}`));
    }
  }
}

run();
