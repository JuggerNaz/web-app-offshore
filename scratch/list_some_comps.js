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

        console.log("Some components:");
        for (let i = 0; i < Math.min(10, comps.length); i++) {
            console.log(`- ID: ${comps[i].id}, Name: ${comps[i].name}, Code: ${comps[i].code}, Metadata:`, comps[i].metadata);
        }

        console.log("\nSearching for 'wn' or 'n1'...");
        const matched = comps.filter(c => {
            const name = (c.name || "").toLowerCase();
            return name.includes("wn") || name.includes("n1") || name.includes("12") || name.includes("18");
        });
        console.log(`Found ${matched.length} matches:`);
        matched.forEach(c => {
            console.log(`- ID: ${c.id}, Name: ${c.name}, Code: ${c.code}, Metadata:`, c.metadata);
        });

    } catch (err) {
        console.error(err);
    }
}

run();
