const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkSettings() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('company_settings').select('*').eq('id', 1).single();
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Settings Data:', JSON.stringify(data, null, 2));
        console.log('Provider Value:', `'${data.storage_provider}'`);
        console.log('Provider Length:', data.storage_provider?.length);
        if (data.storage_provider) {
            console.log('Provider Chars:', Array.from(data.storage_provider).map(c => c.charCodeAt(0)));
        }
    }
}

checkSettings();
