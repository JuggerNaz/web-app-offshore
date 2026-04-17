const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function findPlatform() {
    const { data: platforms } = await supabase.from('platform').select('id, str_name');
    console.log("Platforms:", platforms);

    const { data: records } = await supabase
        .from('insp_records')
        .select(`
            insp_id, structure_id, inspection_type_code, sow_report_no
        `)
        .eq('jobpack_id', 591)
        .eq('inspection_type_code', 'RMGI')
        .limit(10);
    console.log("RMGI Records for JobPack 591:", records);
}

findPlatform();
