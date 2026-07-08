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
        const platId = 203;
        const comps = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&is_deleted=eq.false&limit=2000`);
        
        const targets = comps.filter(c => {
            const md = c.metadata || {};
            const s = (md.s_node || "").toString();
            const f = (md.f_node || "").toString();
            const q = (c.q_id || "").toString();
            const desc = (md.description || "").toString();
            return s.includes("18") || s.includes("19") || f.includes("18") || f.includes("19") || q.includes("18") || q.includes("19") || desc.includes("18") || desc.includes("19");
        });

        console.log(`Found ${targets.length} matches for 18/19:`);
        targets.forEach(c => {
            console.log(JSON.stringify({
                id: c.id,
                code: c.code,
                q_id: c.q_id,
                metadata: {
                    s_node: c.metadata?.s_node,
                    f_node: c.metadata?.f_node,
                    s_leg: c.metadata?.s_leg,
                    f_leg: c.metadata?.f_leg,
                    elv_1: c.metadata?.elv_1,
                    elv_2: c.metadata?.elv_2,
                    dist: c.metadata?.dist,
                    clk_pos: c.metadata?.clk_pos,
                    associated_comp_id: c.metadata?.associated_comp_id,
                    description: c.metadata?.description
                }
            }, null, 2));
        });
    } catch (err) {
        console.error(err);
    }
}

run();
