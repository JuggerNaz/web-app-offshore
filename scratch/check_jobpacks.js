const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Searching jobpacks...');

  // Try different terms
  const terms = ['UIMC10', 'SK0', 'PLAT1', 'UIMC', 'SK0/PLAT1'];
  for (const term of terms) {
    const { data, error } = await supabase
      .from('jobpack')
      .select('id, name')
      .ilike('name', `%${term}%`);
    console.log(`Matching term '${term}':`, data);
  }
}

run();
