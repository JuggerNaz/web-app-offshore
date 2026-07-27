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
        const platforms = await fetchJson(`${SUPABASE_URL}/rest/v1/platform?select=*`);
        console.log("All Platforms:");
        platforms.forEach(p => console.log(`- ID: ${p.plat_id}, Title: ${p.title}, Code: ${p.code}`));

        const bkjt = platforms.find(p => p.title.toUpperCase().includes("BKJT-A") || p.code?.toUpperCase().includes("BKJT-A"));
        if (!bkjt) {
            console.log("BKJT-A not found!");
            return;
        }
        console.log("\nFound BKJT-A:", bkjt);

        // Fetch components for BKJT-A
        const comps = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${bkjt.plat_id}&is_deleted=eq.false&limit=2000`);
        console.log(`\nTotal components for BKJT-A: ${comps.length}`);

        // Filter components referencing N12 or N18 in metadata (s_node, f_node, name, etc.)
        const relevantComps = comps.filter(c => {
            const md = c.metadata || {};
            const name = (c.name || "").toUpperCase();
            const sNode = (md.s_node || "").toUpperCase();
            const fNode = (md.f_node || "").toUpperCase();
            const code = (c.code || "").toUpperCase();
            return name.includes("N12") || name.includes("N18") || sNode.includes("N12") || sNode.includes("N18") || fNode.includes("N12") || fNode.includes("N18");
        });

        console.log(`\nFound ${relevantComps.length} relevant components:`);
        relevantComps.forEach(c => {
            console.log(JSON.stringify({
                id: c.id,
                name: c.name,
                code: c.code,
                desc: c.description,
                metadata: c.metadata
            }, null, 2));
        });

    } catch (err) {
        console.error(err);
    }
}

run();
