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
        // Try to insert a dummy component to see the error message
        const { data, error } = await supabase.from('structure_components').insert({
            q_id: 'TEST_ID',
            code: 'HD',
            structure_id: 1, // Assume structure 1 exists or use a valid one
            comp_id: 0,
            metadata: {}
        }).select();
        
        if (error) {
            console.error('Insert Error Detail:', error);
        } else {
            console.log('Insert Succeeded:', data);
        }
    }
    check();
} catch (e) { console.error(e); }
