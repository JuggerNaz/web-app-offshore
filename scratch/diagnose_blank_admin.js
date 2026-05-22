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
        'Authorization': `Bearer ${key}`
    };

    // 1. Fetch companies
    const companiesRes = await fetch(`${url}/rest/v1/companies`, { headers });
    const companies = await companiesRes.json();
    console.log('--- COMPANIES ---');
    console.log(JSON.stringify(companies, null, 2));

    // 2. Fetch profiles
    const profilesRes = await fetch(`${url}/rest/v1/profiles`, { headers });
    const profiles = await profilesRes.json();
    console.log('--- PROFILES ---');
    console.log(JSON.stringify(profiles, null, 2));

    // 3. Fetch company_memberships
    const membershipsRes = await fetch(`${url}/rest/v1/company_memberships`, { headers });
    const memberships = await membershipsRes.json();
    console.log('--- COMPANY MEMBERSHIPS ---');
    console.log(JSON.stringify(memberships, null, 2));
}

check().catch(console.error);
