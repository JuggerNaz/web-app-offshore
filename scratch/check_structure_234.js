const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkStructure() {
    const { data: str } = await supabase
        .from('platform')
        .select('*')
        .eq('id', 234)
        .maybeSingle();
    
    console.log("Structure ID 234:");
    console.log(JSON.stringify(str, null, 2));
}

checkStructure();
