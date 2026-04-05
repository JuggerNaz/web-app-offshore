const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '';
env.forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('u_sow_items').select('*').limit(1);
    console.log("Error:", error);
    if(data) console.log("u_sow_items Columns:", Object.keys(data[0] || {}));
}
check();
