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
    try {
        const platId = 204;
        const comps = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&is_deleted=eq.false&limit=2000`);
        const filtered = comps.filter(c => {
            const md = c.metadata || {};
            const s = (md.s_node || "").toString().toUpperCase();
            const f = (md.f_node || "").toString().toUpperCase();
            return s.includes("4") || f.includes("4");
        });
        console.log(`Found ${filtered.length} components referencing Node 4/4A/4B/etc.:`);
        filtered.forEach(c => {
            console.log(`- q_id: ${c.q_id}, code: ${c.code}`);
            console.log(`  s_node: ${c.metadata.s_node}, f_node: ${c.metadata.f_node}`);
            console.log(`  s_leg: ${c.metadata.s_leg}, f_leg: ${c.metadata.f_leg}`);
            console.log(`  elv_1: ${c.metadata.elv_1}, elv_2: ${c.metadata.elv_2}`);
        });
    } catch (err) {
        console.error(err);
    }
}

run();
