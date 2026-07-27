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
            console.log("No BKP-A platform found");
            return;
        }
        const platId = platforms[0].plat_id;
        console.log("Platform BKP-A ID:", platId);
        
        const rawComponents = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&is_deleted=eq.false&limit=2000`);
        
        const homMembers = rawComponents.filter(c => {
            const code = (c.code || "").toUpperCase();
            return ["HM", "HOM", "HD", "HDM"].includes(code);
        });
        
        console.log("\nAll Horizontal/Diagonal Members:");
        const byElev = {};
        homMembers.forEach(c => {
            const md = c.metadata || {};
            const elv = md.elv_1 || md.elv_2 || "N/A";
            const len = md.length || md.additionalInfo?.length || "N/A";
            const s_leg = md.s_leg || "N/A";
            const f_leg = md.f_leg || "N/A";
            
            if (md.elv_1 === md.elv_2 && elv !== "N/A") {
                if (!byElev[elv]) byElev[elv] = [];
                byElev[elv].push({ q_id: c.q_id, s_leg, f_leg, length: len });
            }
        });
        
        Object.keys(byElev).sort((a,b) => parseFloat(a) - parseFloat(b)).forEach(elv => {
            console.log(`\nElevation: ${elv}m`);
            byElev[elv].forEach(m => {
                console.log(`  - q_id: ${m.q_id}, legs: ${m.s_leg} -> ${m.f_leg}, length: ${m.length}`);
            });
        });
        
    } catch (err) {
        console.error(err);
    }
}

run();
