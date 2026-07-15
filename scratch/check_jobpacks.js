require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: jobpacks, error } = await supabase
    .from('jobpack')
    .select('*');

  if (error) {
    console.error(error);
    return;
  }

  console.log("Jobpack count:", jobpacks.length);
  jobpacks.forEach(jp => {
    console.log(`\nJobpack ID: ${jp.id} | Name: ${jp.name} | Status: ${jp.status}`);
    console.log("Metadata:", JSON.stringify(jp.metadata, null, 2));
  });
}

run();
