const fs = require('fs');
const path = require('path');

async function check() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envText = fs.readFileSync(envPath, 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim();

    console.log('Supabase URL:', url);

    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
    };

    // Try calling exec_sql
    const body = {
        sql_query: "SELECT id, email FROM auth.users LIMIT 5;"
    };

    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const result = await res.json();
    console.log('Result from exec_sql:', JSON.stringify(result, null, 2));
}

check().catch(console.error);
