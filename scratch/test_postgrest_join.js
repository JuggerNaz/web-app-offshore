const fs = require('fs');
const path = require('path');

async function testJoin() {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envText = fs.readFileSync(envPath, 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim();

    console.log('Testing PostgREST Join Query...');
    console.log('Supabase URL:', url);

    // Using anon key
    const headers = {
        'apikey': key,
        'Authorization': `Bearer ${key}`
    };

    // Query 1: user:profiles(*)
    try {
        console.log('\n--- 1. Testing user:profiles(*) join ---');
        const res = await fetch(`${url}/rest/v1/company_memberships?select=id,user_id,company_id,role,is_active,created_at,updated_at,user:profiles(*)&limit=1`, { headers });
        const json = await res.json();
        console.log('Status:', res.status);
        console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.error('Error on query 1:', e);
    }

    // Query 2: user:profiles!user_id(*)
    try {
        console.log('\n--- 2. Testing user:profiles!user_id(*) join ---');
        const res = await fetch(`${url}/rest/v1/company_memberships?select=id,user_id,company_id,role,is_active,created_at,updated_at,user:profiles!user_id(*)&limit=1`, { headers });
        const json = await res.json();
        console.log('Status:', res.status);
        console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.error('Error on query 2:', e);
    }

    // Query 3: profiles(*)
    try {
        console.log('\n--- 3. Testing profiles(*) join ---');
        const res = await fetch(`${url}/rest/v1/company_memberships?select=id,user_id,company_id,role,is_active,created_at,updated_at,profiles(*)&limit=1`, { headers });
        const json = await res.json();
        console.log('Status:', res.status);
        console.log('Response:', JSON.stringify(json, null, 2));
    } catch (e) {
        console.error('Error on query 3:', e);
    }
}

testJoin().catch(console.error);
