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

        const cgfs = comps.filter(c => {
            const code = (c.code || "").toUpperCase();
            const desc = (c.metadata?.description || "").toUpperCase();
            return code === "CF" || desc.includes("CGF") || desc.includes("GUIDE");
        });

        console.log(`Found ${cgfs.length} CGF components:`);
        cgfs.forEach(c => {
            console.log(JSON.stringify({
                id: c.id,
                code: c.code,
                q_id: c.q_id,
                desc: c.metadata?.description,
                s_node: c.metadata?.s_node,
                f_node: c.metadata?.f_node,
                s_leg: c.metadata?.s_leg,
                f_leg: c.metadata?.f_leg,
                dist: c.metadata?.dist
            }, null, 2));
        });

    } catch (err) {
        console.error(err);
    }
}

run();
