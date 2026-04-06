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
        const { data, error } = await supabase.from('structure_components').select('code, compcode, q_id, id_no').limit(5);
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Sample Components:', JSON.stringify(data, null, 2));
        }
    }
    check();
} catch (e) { console.error(e); }
