const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8').split('\n');
dotenv.forEach(line => {
    const parts = line.split('=');
    const k = parts[0];
    const v = parts.slice(1).join('=');
    if (k && v) process.env[k.trim()] = v.trim().replace(/['"]/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function main() {
    const { data } = await supabase.from('structure_components').select('*').limit(1);
    console.log('COMPONENTS:', data[0]);
}
main();
