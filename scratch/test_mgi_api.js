// Test the MGI profiles API endpoint and direct Supabase query
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log("=== Testing MGI Profiles ===\n");
  
  // Test 1: Direct Supabase query for mgi_profiles
  console.log("1. Direct Supabase query for mgi_profiles...");
  const { data: profiles, error: profErr } = await supabase
    .from('mgi_profiles')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (profErr) {
    console.error("   ERROR:", profErr.message);
  } else {
    console.log(`   Found ${profiles?.length || 0} profiles:`);
    profiles?.forEach(p => {
      console.log(`   - ID: ${p.id}, Name: "${p.name}", Active: ${p.is_active}, Thresholds: ${JSON.stringify(p.thresholds)}`);
    });
  }

  // Test 2: Direct Supabase query for jobpack
  console.log("\n2. Direct Supabase query for jobpack (limit 5)...");
  const { data: jobpacks, error: jpErr } = await supabase
    .from('jobpack')
    .select('id, name, mgi_profile_id')
    .order('created_at', { ascending: false })
    .limit(5);

  if (jpErr) {
    console.error("   ERROR:", jpErr.message);
  } else {
    console.log(`   Found ${jobpacks?.length || 0} jobpacks (showing first 5):`);
    jobpacks?.forEach(jp => {
      console.log(`   - ID: ${jp.id}, Name: "${jp.name}", MGI Profile: ${jp.mgi_profile_id || "none"}`);
    });
  }

  // Test 3: Check if is_archived column exists
  console.log("\n3. Checking mgi_profiles table columns...");
  const { data: rawProfiles, error: rawErr } = await supabase
    .from('mgi_profiles')
    .select('*')
    .limit(1);

  if (rawErr) {
    console.error("   ERROR:", rawErr.message);
    console.error("   Details:", rawErr);
  } else if (rawProfiles && rawProfiles.length > 0) {
    console.log("   Columns:", Object.keys(rawProfiles[0]).join(', '));
  } else {
    console.log("   No rows found (table may be empty or RLS blocks)");
  }
  
  // Test 4: Fetch via the API route
  console.log("\n4. Testing API route http://localhost:3000/api/mgi-profiles ...");
  try {
    const res = await fetch('http://localhost:3000/api/mgi-profiles');
    console.log("   Status:", res.status);
    const json = await res.json();
    console.log("   Response:", JSON.stringify(json, null, 2).substring(0, 500));
  } catch (err) {
    console.error("   ERROR:", err.message);
  }
}

main().catch(console.error);
