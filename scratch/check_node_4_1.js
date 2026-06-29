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
        const platforms = await fetchJson(`${SUPABASE_URL}/rest/v1/platform?title=ilike.*BKP-A*&select=*`);
        if (!platforms.length) return;
        const platId = platforms[0].plat_id;
        
        const rawComponents = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&is_deleted=eq.false&limit=2000`);
        
        const filtered = rawComponents.filter(c => {
            const md = c.metadata || {};
            const s = (md.s_node || "").toString();
            const f = (md.f_node || "").toString();
            return (s === "4" && f === "1") || (s === "1" && f === "4");
        });
        
        console.log("Members connecting Node 4 and Node 1:");
        filtered.forEach(c => {
            console.log(`- q_id: ${c.q_id}`);
            console.log(`  id: ${c.id}`);
            console.log(`  code: ${c.code}`);
            console.log(`  metadata:`, JSON.stringify(c.metadata, null, 2));
        });
        
    } catch (err) {
        console.error(err);
    }
}

run();
