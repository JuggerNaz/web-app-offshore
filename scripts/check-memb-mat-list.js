const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve('.env.local');
    const env = fs.readFileSync(envPath, 'utf8');
    const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
    const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
    const supabase = createClient(url, key);

    async function check() {
        const { data, error } = await supabase.from('u_lib_list').select('*').eq('lib_code', 'MEMB_MAT');
        console.log(JSON.stringify(data, null, 2));
    }
    check();
} catch (e) { console.error(e); }
