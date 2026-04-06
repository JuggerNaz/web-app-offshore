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
        const { data, error } = await supabase.from('structure_components').select('inspno').limit(10);
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('InspNo samples:', data.map(d => d.inspno));
        }
    }
    check();
} catch (e) { console.error(e); }
