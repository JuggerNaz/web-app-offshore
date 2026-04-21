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
    let { data: records, error } = await supabase
        .from('insp_records')
        .select(`
            insp_id, jobpack_id, sow_report_no, inspection_type_code, inspection_type_id, inspection_type(id,code,name)
        `)
        .eq('inspection_type_code', 'RMGI')
        .limit(5);

    console.log("RMGI Records:", records);
}

testFetch();
