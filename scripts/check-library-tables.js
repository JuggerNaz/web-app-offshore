const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve('.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('.env.local not found');
        process.exit(1);
    }
    const env = fs.readFileSync(envPath, 'utf8');

    const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

    if (!urlMatch || !keyMatch) {
        console.error('Could not parse Supabase URL/Key');
        process.exit(1);
    }

    const url = urlMatch[1].trim();
    const key = keyMatch[1].trim();

    const supabase = createClient(url, key);

    async function check() {
        console.log("--- MAST ---");
        const { data: mastData, error: mastError } = await supabase.from('u_lib_mast').select('*').limit(5);
        if (mastError) {
            console.error('Error fetching u_lib_mast:', mastError);
        } else {
            console.log(JSON.stringify(mastData, null, 2));
        }

        console.log("--- LIST ---");
        const { data: listData, error: listError } = await supabase.from('u_lib_list').select('*').limit(5);
        if (listError) {
            console.error('Error fetching u_lib_list:', listError);
        } else {
            console.log(JSON.stringify(listData, null, 2));
        }
    }

    check();

} catch (e) {
    console.error(e);
}
