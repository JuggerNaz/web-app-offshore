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

async function checkMetadata() {
  const { data, error } = await supabase
    .from("jobpack")
    .select("id, name, metadata")
    .limit(10);
  
  if (error) {
    console.error(error);
    return;
  }

  console.log("Analyzing metadata structures for first 10 jobpacks:");
  data.forEach(jp => {
    console.log(`\nJobpack ID: ${jp.id}, Name: ${jp.name}`);
    console.log("Metadata:", JSON.stringify(jp.metadata, null, 2));
    const structures = jp.metadata?.structures;
    if (structures) {
      console.log("Structures array type:", typeof structures, "isArray:", Array.isArray(structures));
      console.log("Structures:", structures);
    } else {
      console.log("No structures in metadata");
    }
  });
}

checkMetadata();
