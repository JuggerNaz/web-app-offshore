import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;
    const [key, ...value] = trimmed.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function syncSpecs() {
  const jsonPath = path.resolve(process.cwd(), 'utils/types/inspection-types.json');
  const rawJson = fs.readFileSync(jsonPath, 'utf8');
  const { inspectionTypes } = JSON.parse(rawJson);

  console.log(`🚀 Starting sync of ${inspectionTypes.length} inspection types...`);

  for (const type of inspectionTypes) {
    const { code, name, methods, fields, component_overrides } = type;
    
    // Prepare metadata
    const metadata = {
      methods: methods || [],
      rov: methods?.includes('ROV') ? 1 : 0,
      diving: methods?.includes('DIVING') ? 1 : 0,
      sync_date: new Date().toISOString()
    };

    // Prepare properties
    const default_properties = {
      fields: fields || [],
      component_overrides: component_overrides || []
    };

    console.log(`  - Checking ${code}: ${name}...`);

    // Check if exists
    const { data: existing, error: fetchError } = await supabase
      .from('inspection_type')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (fetchError) {
      console.error(`  ❌ Error fetching ${code}:`, fetchError.message);
      continue;
    }

    const payload = {
      code,
      name,
      default_properties,
      metadata,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      console.log(`    Updating existing record (ID: ${existing.id})...`);
      const { error: updateError } = await supabase
        .from('inspection_type')
        .update(payload)
        .eq('id', existing.id);
      
      if (updateError) console.error(`    ❌ Update failed:`, updateError.message);
      else console.log(`    ✅ Updated successfully.`);
    } else {
      console.log(`    Inserting new record...`);
      const { error: insertError } = await supabase
        .from('inspection_type')
        .insert(payload);
      
      if (insertError) console.error(`    ❌ Insert failed:`, insertError.message);
      else console.log(`    ✅ Inserted successfully.`);
    }
  }

  // --- CLEANUP PHASE ---
  console.log('\n🧹 Starting cleanup of orphaned records...');
  const currentCodes = inspectionTypes.map(t => t.code);
  
  // Fetch all codes from DB
  const { data: dbRecords, error: dbError } = await supabase
    .from('inspection_type')
    .select('code');

  if (dbError) {
    console.error('  ❌ Failed to fetch database records for cleanup:', dbError.message);
  } else {
    const orphanedCodes = dbRecords
      .map(r => r.code)
      .filter(code => !currentCodes.includes(code));

    if (orphanedCodes.length > 0) {
      console.log(`  Found ${orphanedCodes.length} orphaned records: ${orphanedCodes.join(', ')}`);
      const { error: deleteError } = await supabase
        .from('inspection_type')
        .delete()
        .in('code', orphanedCodes);
      
      if (deleteError) console.error('  ❌ Cleanup failed:', deleteError.message);
      else console.log('  ✅ Cleanup successful. Orphaned records removed.');
    } else {
      console.log('  No orphaned records found.');
    }
  }

  console.log('\n🎉 Sync completed!');
}

syncSpecs().catch(err => {
  console.error('💥 Sync failed:', err);
  process.exit(1);
});
