const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log("Checking columns for insp_dive_movements...");
  const { data, error } = await supabase.from('insp_dive_movements').select('*').limit(1);
  if (error) {
    console.error("Error fetching from insp_dive_movements:", error);
  } else {
    console.log("insp_dive_movements columns:", Object.keys(data[0] || {}));
    console.log("insp_dive_movements sample row:", data[0]);
  }

  console.log("\nChecking columns for insp_rov_movements...");
  const { data: data2, error: error2 } = await supabase.from('insp_rov_movements').select('*').limit(1);
  if (error2) {
    console.error("Error fetching from insp_rov_movements:", error2);
  } else {
    console.log("insp_rov_movements columns:", Object.keys(data2[0] || {}));
    console.log("insp_rov_movements sample row:", data2[0]);
  }
}

checkColumns();
