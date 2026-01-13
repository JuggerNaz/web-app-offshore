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
        const { data: listData } = await supabase.from('u_lib_list').select('*').limit(1);
        if (listData && listData.length > 0) {
            console.log("List Columns:", Object.keys(listData[0]));
        } else {
            console.log("List table empty");
        }
    }
    check();
} catch (e) { console.error(e); }
