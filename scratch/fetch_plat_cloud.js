const SUPABASE_URL = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function fetchJson(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
}

async function run() {
    // 1. Find the D21JT-A platform
    const platforms = await fetchJson(`${SUPABASE_URL}/rest/v1/platform?title=ilike.*D21JT*&select=*`);
    console.log('=== PLATFORMS ===');
    console.log(JSON.stringify(platforms, null, 2));

    if (!platforms.length) {
        console.log('No platform found!');
        return;
    }

    const platId = platforms[0].plat_id;
    console.log(`\nUsing plat_id: ${platId}`);

    // 2. Elevations
    const elvs = await fetchJson(`${SUPABASE_URL}/rest/v1/str_elv?plat_id=eq.${platId}&select=*&order=elv.asc`);
    console.log('\n=== ELEVATIONS ===');
    console.log(JSON.stringify(elvs, null, 2));

    // 3. Faces
    const faces = await fetchJson(`${SUPABASE_URL}/rest/v1/str_faces?plat_id=eq.${platId}&select=*`);
    console.log('\n=== FACES ===');
    console.log(JSON.stringify(faces, null, 2));

    // 4. Platform details (leg columns)
    const platDetails = platforms[0];
    const legKeys = Object.keys(platDetails).filter(k => k.startsWith('leg_'));
    console.log('\n=== LEG COLUMNS ===');
    legKeys.forEach(k => {
        if (platDetails[k]) console.log(`  ${k}: ${platDetails[k]}`);
    });

    // 5. Components - summary by code
    const comps = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&select=id,q_id,code,metadata&is_deleted=eq.false`);
    console.log(`\n=== COMPONENTS TOTAL: ${comps.length} ===`);
    
    const byCode = {};
    comps.forEach(c => {
        const code = c.code || 'null';
        if (!byCode[code]) byCode[code] = 0;
        byCode[code]++;
    });
    console.log('By code:', JSON.stringify(byCode, null, 2));

    // 6. Sample of components with node data
    const withNodes = comps.filter(c => c.metadata?.s_node || c.metadata?.f_node).slice(0, 10);
    console.log('\n=== SAMPLE COMPONENTS WITH NODES ===');
    console.log(JSON.stringify(withNodes, null, 2));

    // 7. Sample of components with leg data
    const withLegs = comps.filter(c => c.metadata?.s_leg || c.metadata?.f_leg).slice(0, 10);
    console.log('\n=== SAMPLE COMPONENTS WITH LEGS ===');
    console.log(JSON.stringify(withLegs, null, 2));

    // 8. Sample of components with easting/northing
    const withEasting = comps.filter(c => c.metadata?.easting || c.metadata?.northing).slice(0, 5);
    console.log('\n=== SAMPLE COMPONENTS WITH EASTING/NORTHING ===');
    console.log(JSON.stringify(withEasting, null, 2));

    // 9. Show unique metadata keys used across components
    const allKeys = new Set();
    comps.forEach(c => { if (c.metadata) Object.keys(c.metadata).forEach(k => allKeys.add(k)); });
    console.log('\n=== ALL METADATA KEYS USED ===');
    console.log([...allKeys].sort().join(', '));
}

run().catch(console.error);
