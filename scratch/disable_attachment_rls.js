const fs = require('fs');
const path = require('path');

async function main() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envText = fs.readFileSync(envPath, 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim();

    console.log('Connecting to Supabase at:', url);

    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
    };

    const sql = `
        ALTER TABLE public.attachment DISABLE ROW LEVEL SECURITY;
        GRANT ALL ON public.attachment TO anon, authenticated;
    `;

    const body = {
        sql: sql
    };

    console.log('Executing SQL via RPC to disable RLS on attachment table...');
    const res = await fetch(`${url}/rest/v1/rpc/query_sql`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const result = await res.json();
    console.log('Result from disabling RLS on attachment:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
