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
        console.log('Attempting minimal insert...');
        const { data, error } = await supabase.from('structure_components').insert({
            id_no: 'TEST_ID_NO',
            q_id: 'TEST_Q_ID',
            comp_id: 0,
            structure_id: 1, // Assume 1 is valid or try a safe value
            code: 'HD',
            metadata: { additionalInfo: {} }
        }).select();
        
        if (error) {
            console.error('Insert error code:', error.code);
            console.error('Insert error message:', error.message);
            console.error('Insert error hint:', error.hint);
        } else {
            console.log('Insert succeeded! ID:', data[0].id);
        }
    }
    check();
} catch (e) { console.error(e); }
