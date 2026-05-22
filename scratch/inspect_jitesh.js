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

    // 1. Fetch profiles
    const profilesRes = await fetch(`${url}/rest/v1/profiles?email=eq.jitesh@nasquest.com`, { headers });
    const profiles = await profilesRes.json();
    console.log('--- PROFILES ---');
    console.log(JSON.stringify(profiles, null, 2));

    if (profiles.length > 0) {
        const userId = profiles[0].id;
        console.log('\nUser ID:', userId);

        // 2. Fetch memberships
        const membershipsRes = await fetch(`${url}/rest/v1/company_memberships?user_id=eq.${userId}`, { headers });
        const memberships = await membershipsRes.json();
        console.log('\n--- COMPANY MEMBERSHIPS ---');
        console.log(JSON.stringify(memberships, null, 2));

        // 3. Fetch user_roles
        const userRolesRes = await fetch(`${url}/rest/v1/user_roles?user_id=eq.${userId}`, { headers });
        const userRoles = await userRolesRes.json();
        console.log('\n--- USER ROLES (user_roles table) ---');
        console.log(JSON.stringify(userRoles, null, 2));
    } else {
        console.log('No profile found for jitesh@nasquest.com');
    }
}

check().catch(console.error);
