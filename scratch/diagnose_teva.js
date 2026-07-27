const SUPABASE_URL = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function run() {
    try {
        const platsRes = await fetch(`${SUPABASE_URL}/rest/v1/platform?title=ilike.*TEV*`, { headers });
        const plats = await platsRes.json();
        console.log('Platforms matching TEV:', plats);

        if (!plats || plats.length === 0) {
            console.log('No platform found matching TEV');
            return;
        }

        for (const p of plats) {
            console.log('\n========================================');
            console.log(`PLATFORM: ${p.title} (ID: ${p.plat_id})`);
            console.log('Leg Columns in DB:', {
                leg_t1: p.leg_t1,
                leg_t2: p.leg_t2,
                leg_t3: p.leg_t3,
                leg_t4: p.leg_t4,
                leg_t5: p.leg_t5,
                leg_t6: p.leg_t6,
                leg_t7: p.leg_t7,
                leg_t8: p.leg_t8,
            });

            const faces = await (await fetch(`${SUPABASE_URL}/rest/v1/str_faces?plat_id=eq.${p.plat_id}`, { headers })).json();
            console.log('Faces count:', faces.length, 'Faces:', faces);

            const elvs = await (await fetch(`${SUPABASE_URL}/rest/v1/str_elv?plat_id=eq.${p.plat_id}`, { headers })).json();
            console.log('Elevations count:', elvs.length, 'Elevations:', elvs);

            const comps = await (await fetch(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${p.plat_id}&is_deleted=eq.false&limit=2000`, { headers })).json();
            console.log('Components count:', comps.length);

            // Group components by code
            const codeCounts = {};
            comps.forEach(c => {
                const code = c.code || 'UNKNOWN';
                codeCounts[code] = (codeCounts[code] || 0) + 1;
            });
            console.log('Component counts by code:', codeCounts);

            // Sample some component q_ids
            const qIds = comps.map(c => c.q_id).filter(Boolean);
            console.log('Sample Q_IDs (first 30):', qIds.slice(0, 30));

            const webapp3d = await (await fetch(`${SUPABASE_URL}/rest/v1/webapp_3d?structure_id=eq.${p.plat_id}`, { headers })).json();
            console.log('webapp_3d stored 3D items count:', webapp3d.length);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
