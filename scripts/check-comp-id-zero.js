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
        const { data, count } = await supabase.from('structure_components').select('id', { count: 'exact', head: true }).eq('comp_id', 0);
        console.log(`Components with comp_id 0: ${count}`);
    }
    check();
} catch (e) { console.error(e); }
