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
        console.log(`Loaded ${comps.length} components.`);

        const codes = new Set(comps.map(c => c.code));
        console.log("Unique codes in BKJT-A:", Array.from(codes));

        // Find components where description or metadata contains "12" or "18"
        console.log("\nSearching for components with '12' or '18' in description/metadata:");
        const matched = comps.filter(c => {
            const desc = (c.description || "").toLowerCase();
            const md = JSON.stringify(c.metadata || "").toLowerCase();
            const code = (c.code || "").toLowerCase();
            return desc.includes("12") || desc.includes("18") || md.includes("12") || md.includes("18") || code.includes("wn");
        });

        console.log(`Found ${matched.length} matches:`);
        matched.forEach(c => {
            console.log(`- ID: ${c.id}, Code: ${c.code}, Desc: ${c.description}, Metadata:`, c.metadata);
        });

    } catch (err) {
        console.error(err);
    }
}

run();
