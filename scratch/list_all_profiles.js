const fs = require('fs');
const path = require('path');

async function run() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envText = fs.readFileSync(envPath, 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim();

    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`
    };

    const res = await fetch(`${url}/rest/v1/profiles`, { headers });
    const profiles = await res.json();
    console.log('--- ALL PROFILES ---');
    console.log(JSON.stringify(profiles, null, 2));
}

run().catch(console.error);
