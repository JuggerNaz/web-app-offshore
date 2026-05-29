const fs = require('fs');
const path = require('path');

async function run() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envText = fs.readFileSync(envPath, 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim();

    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
    };

    const sql = process.argv[2] || "SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename IN ('str_elv', 'comment');";
    console.log('Running SQL via exec_sql:', sql);

    const body = {
        sql_query: sql
    };

    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const result = await res.json();
    console.log('Result from exec_sql:', JSON.stringify(result, null, 2));
}

run().catch(console.error);
