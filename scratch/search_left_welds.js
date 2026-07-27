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

        const weldDesc = ["WN N6", "WN N8", "WN N10", "WN N16", "WN N20", "WN N22"];
        const matches = comps.filter(c => {
            const desc = c.metadata?.description || "";
            return weldDesc.includes(desc);
        });

        console.log(`Found ${matches.length} matching left welds:`);
        matches.forEach(c => {
            console.log(JSON.stringify({
                id: c.id,
                q_id: c.q_id,
                metadata: c.metadata
            }, null, 2));
        });

    } catch (err) {
        console.error(err);
    }
}

run();
