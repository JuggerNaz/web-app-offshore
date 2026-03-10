const fs = require('fs');

async function check() {
    const envText = fs.readFileSync('.env.local', 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();

    // First get one to update
    const getRes = await fetch('https://zpsmxtdqlpbdwfzctqzd.supabase.co/rest/v1/attachment?select=id&limit=1', {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const attachments = await getRes.json();
    if (attachments.length === 0) {
        console.log('No attachments found to test');
        return;
    }
    const id = attachments[0].id;
    console.log(`Testing PATCH on id: ${id}`);

    const patchRes = await fetch('https://zpsmxtdqlpbdwfzctqzd.supabase.co/rest/v1/attachment?id=eq.' + id, {
        method: 'PATCH',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            meta: { title: 'Test Title', description: 'Test Description' }
        })
    });

    const result = await patchRes.json();
    console.log('PATCH Result:', JSON.stringify(result, null, 2));
}

check();
