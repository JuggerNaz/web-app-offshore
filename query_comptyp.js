const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const key = env.split('\n').find(line => line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')).split('=')[1].trim();
const url = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co/rest/v1/components?select=code,name&order=code';
fetch(url, {
    headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
    }
})
    .then(r => r.json())
    .then(data => {
        const matches = data.filter(c => c.name.toLowerCase().includes('weld') || c.code.toLowerCase() === 'wn');
        matches.forEach(m => console.log(`${m.code}: ${m.name}`));
    })
    .catch(console.error);
