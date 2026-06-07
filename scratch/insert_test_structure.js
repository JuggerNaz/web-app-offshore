const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envText = fs.readFileSync(envPath, 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim();

    const supabase = createClient(url, key);

    console.log('Inserting structure 255 into local database...');
    const { data, error } = await supabase
        .from('structure')
        .upsert({
            str_id: 255,
            str_type: 'PLATFORM'
        })
        .select();

    if (error) {
        console.error('Error inserting structure:', error.message);
    } else {
        console.log('Successfully inserted structure:', data);
    }
}

main().catch(console.error);
