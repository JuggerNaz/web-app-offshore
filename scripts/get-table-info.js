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
        const { data: cols, error: colError } = await supabase.from('information_schema.columns')
            .select('column_name, is_nullable, column_default, data_type')
            .eq('table_name', 'structure_components');
        
        if (colError) {
            console.error('Error fetching columns:', colError);
        } else {
            console.log('Columns:', JSON.stringify(cols, null, 2));
        }
    }
    check();
} catch (e) { console.error(e); }
