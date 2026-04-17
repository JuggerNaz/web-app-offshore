const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkId73() {
    const { data: rec } = await supabase
        .from('insp_records')
        .select('*')
        .eq('insp_id', 73)
        .single();
    
    console.log("Record 73 columns:", Object.keys(rec || {}));
    console.log("Elevation value:", rec?.elevation);
}

checkId73();
