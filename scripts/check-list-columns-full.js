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
        const { data } = await supabase.from('u_lib_list').select('*').limit(1);
        if (data && data.length > 0) {
            console.log('--- Columns in u_lib_list ---');
            Object.keys(data[0]).forEach(k => console.log(k));
        }
    }
    check();
} catch (e) { console.error(e); }
