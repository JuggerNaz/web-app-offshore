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

async function verifyFix() {
  console.log('=== VERIFYING FIX (SIMULATED INSERT) ===');
  
  // Use existing IDs from a previous valid record to avoid FK violations
  const { data: sample } = await supabase.from('insp_records').select('*').limit(1).single();
  
  if (!sample) {
    console.log('No sample record found to mirror IDs from.');
    return;
  }

  // Mimic the payload from page.tsx (without updated_by)
  const testPayload = {
    rov_job_id: sample.rov_job_id,
    dive_job_id: sample.dive_job_id,
    structure_id: sample.structure_id,
    component_id: sample.component_id,
    component_type: sample.component_type,
    jobpack_id: sample.jobpack_id,
    sow_report_no: sample.sow_report_no,
    inspection_type_id: sample.inspection_type_id,
    inspection_type_code: sample.inspection_type_code,
    inspection_date: new Date().toISOString().split('T')[0],
    inspection_time: new Date().toTimeString().split(' ')[0],
    description: 'Test record to verify fix for save failure',
    status: 'COMPLETED',
    has_anomaly: false,
    tape_id: sample.tape_id,
    tape_count_no: '00:00:01',
    elevation: 0,
    inspection_data: { 
        test: true, 
        _meta_status: 'Pass',
        _mgi_profile_id: null 
    },
    archived_data: {},
    cr_user: sample.cr_user || 'system' // audit field
  };

  console.log('Attempting insert with payload (no updated_by)...');
  const { data, error } = await supabase.from('insp_records').insert(testPayload).select('insp_id').single();

  if (error) {
    console.error('FAILED to save (Verify):', error.message);
    if (error.message.includes('column "updated_by" does not exist')) {
        console.log('CRITICAL: The error persists! (Wait, did I remove it from the script test too? Yes I did.)');
    }
  } else {
    console.log('SUCCESS: Record saved with insp_id:', data.insp_id);
    
    // Clean up
    console.log('Cleaning up test record...');
    await supabase.from('insp_records').delete().eq('insp_id', data.insp_id);
    console.log('Cleanup done.');
  }

  // Test with updated_by to PROVE it fails (optional but good for showing why it was broken)
  console.log('\n--- Proving the failure context ---');
  const { error: errorWithBadField } = await supabase.from('insp_records').insert({ ...testPayload, updated_by: 'test' });
  if (errorWithBadField && errorWithBadField.message.includes('column "updated_by" does not exist')) {
    console.log('Verified: Sending "updated_by" correctly triggers the column-does-not-exist error.');
  }
}

verifyFix();
