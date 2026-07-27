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
        if (!platforms.length) {
            console.log("BKP-A not found");
            return;
        }
        const platId = platforms[0].plat_id;
        console.log("BKP-A plat_id:", platId);

        const url = `${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&q_id=eq.HOM N4A-N4B&select=*`;
        console.log("URL:", url);
        const components = await fetchJson(url);
        console.log("Components found:", JSON.stringify(components, null, 2));

        // Let's also check for any component containing "N4A" or "4A"
        const allComps = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&is_deleted=eq.false&limit=2000`);
        const matchingComps = allComps.filter(c => {
            const q = (c.q_id || "").toUpperCase();
            return q.includes("N4A") || q.includes("N4B") || q.includes("4A") || q.includes("4B");
        });
        console.log("\nMatching components with N4A/N4B/4A/4B:");
        matchingComps.forEach(c => {
            console.log(`- q_id: ${c.q_id}, id: ${c.id}, code: ${c.code}`);
            console.log(`  metadata:`, JSON.stringify(c.metadata, null, 2));
        });

    } catch (err) {
        console.error(err);
    }
}

run();
