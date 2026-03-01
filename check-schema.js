const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length > 1) env[parts[0]] = parts.slice(1).join('=').trim();
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
    const { data, error } = await supabase.from('insp_video_logs').select('*').limit(1);
    console.log(error || data);
})();
