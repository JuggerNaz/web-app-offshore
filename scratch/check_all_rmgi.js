const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkLatestRecords() {
    const { data: records } = await supabase
        .from('insp_records')
        .select('insp_id, inspection_data, cr_date, component_id, structure_components:component_id(q_id)')
        .eq('jobpack_id', 591)
        .eq('structure_id', 234)
        .eq('inspection_type_code', 'RMGI')
        .order('cr_date', { ascending: false });
    
    console.log("RMGI Records (Sorted by date):");
    records.forEach(r => {
        console.log(`ID: ${r.insp_id}, Date: ${r.cr_date}, Component: ${r.structure_components?.q_id}`);
        console.log("Data:", JSON.stringify(r.inspection_data, null, 2));
    });
}

checkLatestRecords();
