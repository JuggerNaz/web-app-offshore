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

async function main() {
  const { data, error } = await supabase
    .from("jobpack")
    .select("*")
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }

  console.log("Jobpack columns/data:");
  data.forEach((r, i) => {
    console.log(`\nJobpack [${i}] name: ${r.name}`);
    console.log("Metadata keys:", Object.keys(r.metadata || {}));
    console.log("Metadata sample:", JSON.stringify(r.metadata, null, 2));
  });
}

main();
