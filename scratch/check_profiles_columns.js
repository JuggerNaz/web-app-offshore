const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    // 1. Fetch any profile id
    const { data: profiles, error: fetchErr } = await supabase.from('profiles').select('id').limit(1);
    if (fetchErr) {
        console.error("Fetch profiles error:", fetchErr);
        return;
    }
    if (!profiles || profiles.length === 0) {
        console.log("No profiles in table.");
        return;
    }
    const targetId = profiles[0].id;
    console.log("Attempting to update profile ID:", targetId);

    // 2. Try updating device_restriction_type
    const { data: updateData, error: updateErr } = await supabase
        .from('profiles')
        .update({ device_restriction_type: 'enforced' })
        .eq('id', targetId)
        .select();

    if (updateErr) {
        console.error("Update error:", updateErr);
    } else {
        console.log("Update success! Returned data:", updateData);
        
        // Revert it back to none
        const { error: revertErr } = await supabase
            .from('profiles')
            .update({ device_restriction_type: 'none' })
            .eq('id', targetId);
        console.log("Revert error (if any):", revertErr);
    }
}
run();
