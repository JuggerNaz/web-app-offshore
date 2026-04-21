const fs = require('fs');

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
    const { data: typeData } = await supabase
        .from('inspection_type')
        .select('id, code, name')
        .eq('code', 'RMGI')
        .maybeSingle();

    console.log("RMGI Type:", typeData);

    let { data: records, error } = await supabase
        .from('insp_records')
        .select(`
            *,
            inspection_type:inspection_type_id!left(id, code, name),
            structure_components:component_id!left(q_id, code)
        `)
        .limit(20);

    if (error) {
        console.error("Fetch Error:", error.message);
        return;
    }
    console.log("Fetched records count:", records.length);
    
    const rmgiId = typeData?.id || 79;
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
    }
}

testFetch();
