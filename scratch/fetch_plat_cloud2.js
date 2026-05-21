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

    // 4. Components - summary by code
    const comps = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&select=id,q_id,code,metadata&is_deleted=eq.false&limit=1000`);
    console.log(`\n=== COMPONENTS TOTAL: ${comps.length} ===`);
    
    const byCode = {};
    comps.forEach(c => {
        const code = c.code || 'null';
        if (!byCode[code]) byCode[code] = 0;
        byCode[code]++;
    });
    console.log('By code:', JSON.stringify(byCode, null, 2));

    // 5. Build the node coordinate map from components - show unique nodes
    const nodeData = {};
    comps.forEach(c => {
        const md = c.metadata || {};
        if (md.s_node) {
            if (!nodeData[md.s_node]) {
                nodeData[md.s_node] = { s_leg: md.s_leg, elv_1: md.elv_1, component: c.q_id };
            }
        }
        if (md.f_node) {
            if (!nodeData[md.f_node]) {
                nodeData[md.f_node] = { f_leg: md.f_leg, elv_2: md.elv_2, component: c.q_id };
            }
        }
    });
    
    // Sort nodes numerically
    const sortedNodes = Object.entries(nodeData).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    console.log(`\n=== UNIQUE NODES (${sortedNodes.length}) ===`);
    sortedNodes.forEach(([node, data]) => console.log(`  Node ${node}: leg=${data.s_leg || data.f_leg}, elv=${data.elv_1 || data.elv_2}, via ${data.component}`));

    // 6. Check distinct elevations in node data
    const allElvs = new Set();
    comps.forEach(c => {
        const md = c.metadata || {};
        if (md.elv_1) allElvs.add(parseFloat(md.elv_1));
        if (md.elv_2) allElvs.add(parseFloat(md.elv_2));
    });
    const sortedElvs = [...allElvs].sort((a, b) => a - b);
    console.log('\n=== DISTINCT ELEVATIONS IN METADATA ===');
    console.log(sortedElvs);

    // 7. Sample members (structural members with both s_node and f_node)
    const members = comps.filter(c => c.metadata?.s_node && c.metadata?.f_node && c.code !== 'AN').slice(0, 15);
    console.log('\n=== SAMPLE STRUCTURAL MEMBERS ===');
    members.forEach(c => {
        const md = c.metadata;
        console.log(`  ${c.q_id} (${c.code}): s_node=${md.s_node}(leg=${md.s_leg},elv=${md.elv_1}) -> f_node=${md.f_node}(leg=${md.f_leg},elv=${md.elv_2})`);
    });
}

run().catch(console.error);
