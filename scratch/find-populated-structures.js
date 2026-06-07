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

async function findPopulated() {
  const { data, error } = await supabase
    .from("jobpack")
    .select("id, name, metadata");
  
  if (error) {
    console.error(error);
    return;
  }

  let countWithArray = 0;
  let sample = null;

  data.forEach(jp => {
    const structures = jp.metadata?.structures;
    if (Array.isArray(structures) && structures.length > 0) {
      countWithArray++;
      if (!sample) {
        sample = {
          id: jp.id,
          name: jp.name,
          structures: structures
        };
      }
    }
  });

  console.log(`Total jobpacks with populated structures array: ${countWithArray} out of ${data.length}`);
  if (sample) {
    console.log("Sample:", JSON.stringify(sample, null, 2));
  }
}

findPopulated();
