const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing .single() query with NaN...');
  try {
    const { data, error } = await supabase
      .from('jobpack')
      .select('name')
      .eq('id', NaN)
      .single();
    console.log('Single query completed:', data, error);
  } catch (err) {
    console.error('Single query threw an exception:', err);
  }
}

run();
