const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkData() {
    // 1. Get JobPack
    const { data: jp } = await supabase.from('jobpack').select('id, name').ilike('name', '%UIMC2026/NQ/Plat01%').maybeSingle();
    console.log("JobPack:", jp);
    
    if (!jp) return;

    // 2. Get Structure
    const { data: str } = await supabase.from('platform').select('id, str_name').ilike('str_name', '%PLAT-C%').maybeSingle();
    console.log("Structure:", str);

    if (!str) return;

    // 3. Get RMGI records
    const { data: records, error } = await supabase
        .from('insp_records')
        .select(`
            *,
            inspection_type:inspection_type_id(code, name),
            structure_components:component_id(q_id, code)
        `)
        .eq('jobpack_id', jp.id)
        .eq('structure_id', str.id)
        .eq('inspection_type_code', 'RMGI');

    if (error) {
        console.error("Error fetching records:", error);
    } else {
        console.log(`Found ${records.length} RMGI records.`);
        if (records.length > 0) {
            records.forEach(r => {
                console.log(`Record ID: ${r.insp_id}, Component: ${r.structure_components?.q_id}, SOW: ${r.sow_report_no}, Depth: ${r.elevation}`);
                console.log("Data:", r.inspection_data);
            });
        }
    }
}

checkData();
