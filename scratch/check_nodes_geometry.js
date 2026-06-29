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
        
        const targetQIds = [
            'WN N29', 'WN N30', 'WN N31', 'WN N32',
            'HOM N30-N29', 'HOM N31-N30', 'HOM N32-N31', 'HOM N29-N32',
            'HOM N29-N30', 'HOM N30-N31', 'HOM N31-N32', 'HOM N32-N29'
        ];
        
        const matched = rawComponents.filter(c => targetQIds.includes(c.q_id));
        
        console.log("Matched components:");
        matched.forEach(c => {
            console.log(`- q_id: ${c.q_id}`);
            console.log(`  code: ${c.code}`);
            console.log(`  name: ${c.name}`);
            console.log(`  metadata:`, JSON.stringify(c.metadata, null, 2));
        });
        
    } catch (err) {
        console.error(err);
    }
}

run();
