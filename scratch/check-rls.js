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

async function checkRLS() {
  try {
    console.log("Checking if we can select jobpack as anon...");
    const { data: anonData, error: anonError } = await supabase
      .from("jobpack")
      .select("id")
      .limit(1);
    
    console.log("Anon select:", { dataCount: anonData?.length, error: anonError });
    
  } catch (err) {
    console.error("Error:", err);
  }
}

checkRLS();
