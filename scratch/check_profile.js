const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val) env[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkProfile() {
    const { data: profile } = await supabase
        .from('mgi_profiles')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
    
    console.log("MGI Profile ID 1:");
    console.log(JSON.stringify(profile, null, 2));
}

checkProfile();
