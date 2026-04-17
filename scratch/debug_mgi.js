const fs = require('fs');

// Read env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) {
        env[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testFetch() {
    // 1. Find RMGI type ID
    const { data: typeData } = await supabase
        .from('inspection_type')
        .select('id, code, name')
        .eq('code', 'RMGI')
        .maybeSingle();

    console.log("RMGI Type:", typeData);

    // 2. Fetch some insp_records for testing
    let { data: records, error } = await supabase
        .from('insp_records')
        .select('insp_id, structure_id, component_id, jobpack_id, sow_report_no, inspection_type_id, inspection_type_code, inspection_data, inspection_dat, inspection_type:inspection_type_id!left(id, code, name)')
        .limit(20);

    if (error) {
        console.error("Fetch Error:", error.message);
        return;
    }
    console.log("Fetched records count:", records.length);
    
    // Look for potential RMGI records
    const rmgiId = typeData?.id;
    const mgiRecords = records.filter(r => {
        const recordData = r.inspection_data || r.inspection_dat;
        const isRMGI = 
            r.inspection_type_id === rmgiId ||
            String(r.inspection_type?.code || r.inspection_type_code || '').toUpperCase() === 'RMGI' ||
            String(r.inspection_type?.name || '').toLowerCase().includes('marine growth') ||
            (recordData && (recordData.mgi_hard_thickness_at_12 !== undefined || recordData._mgi_profile_id !== undefined));
            
        return isRMGI;
    });

    console.log("MGI Records found:", mgiRecords.length);
    if (mgiRecords.length > 0) {
        console.log("Sample MGI record:", JSON.stringify(mgiRecords[0], null, 2));
    } else {
        // Output all inspection_type_codes found
        console.log("Types found in db:", new Set(records.map(r => r.inspection_type_code || r.inspection_type?.code)));
    }
}

testFetch();
