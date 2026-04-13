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
        const { count: mastCount } = await supabase.from('u_lib_mast').select('*', { count: 'exact', head: true }).eq('lib_code', 'MEMB_MAT');
        const { count: listCount } = await supabase.from('u_lib_list').select('*', { count: 'exact', head: true }).eq('lib_code', 'MEMB_MAT');
        console.log(`MAST count: ${mastCount}`);
        console.log(`LIST count: ${listCount}`);
        
        if (listCount > 0) {
            const { data: listData } = await supabase.from('u_lib_list').select('lib_id, lib_desc').eq('lib_code', 'MEMB_MAT');
            console.log('LIST data:', JSON.stringify(listData, null, 2));
        }
    }
    check();
} catch (e) { console.error(e); }
