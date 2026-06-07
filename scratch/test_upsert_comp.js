// Test script to check how structure_components upsert works
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/m);
const keyMatch = envContent.match(/^\s*NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/m);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== Testing structure_components upsert ===");
  
  // Try to query one component
  const { data: comp, error: getErr } = await supabase
    .from('structure_components')
    .select('id, comp_id, q_id, structure_id, code')
    .limit(1)
    .maybeSingle();

  if (getErr) {
    console.error("Error fetching component:", getErr);
    return;
  }

  if (!comp) {
    console.log("No components found in table to test upsert.");
    return;
  }

  console.log("Found sample component:", comp);

  // Try to upsert the same component to see if onConflict works on 'comp_id'
  console.log("Trying upsert with onConflict: 'comp_id'...");
  const testComp = {
    ...comp,
    is_deleted: false
  };
  delete testComp.id; // remove serial PK to force conflict on comp_id

  const { data: upsertData, error: upsertErr } = await supabase
    .from('structure_components')
    .upsert(testComp, { onConflict: 'comp_id' })
    .select();

  if (upsertErr) {
    console.error("Upsert failed on 'comp_id':", upsertErr);
    
    // Let's try upserting with 'q_id'
    console.log("Trying upsert with onConflict: 'q_id'...");
    const { data: upsertDataQ, error: upsertErrQ } = await supabase
      .from('structure_components')
      .upsert(testComp, { onConflict: 'q_id' })
      .select();
      
    if (upsertErrQ) {
      console.error("Upsert failed on 'q_id':", upsertErrQ);
    } else {
      console.log("Upsert succeeded on 'q_id'!", upsertDataQ);
    }
  } else {
    console.log("Upsert succeeded on 'comp_id'!", upsertData);
  }
}

main().catch(console.error);
