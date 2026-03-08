const fs = require('fs');

async function check() {
    const envText = fs.readFileSync('.env.local', 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();

    const url = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co/rest/v1/inspection_type?select=id,code,default_properties,metadata';

    const res = await fetch(url, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    const data = await res.json();
    console.log(`Found ${data.length} total types`);
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
}

check();
