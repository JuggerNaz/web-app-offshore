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
        for (const plat of platforms) {
            const comps = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${plat.plat_id}&is_deleted=eq.false&limit=2000`);
            const nodeLegMap = new Map();
            let duplicates = 0;
            comps.forEach(c => {
                const md = c.metadata || {};
                const code = (c.code || "").toUpperCase();
                const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);
                if (!isPrimary) return;

                const checkNode = (node, leg, elv) => {
                    if (!node) return;
                    const key = `${node.toUpperCase().trim()}|${elv}`;
                    const legVal = leg?.toUpperCase() || "";
                    if (nodeLegMap.has(key)) {
                        const existingLeg = nodeLegMap.get(key);
                        if (existingLeg && legVal && existingLeg !== legVal) {
                            duplicates++;
                            console.log(`Duplicate node in platform ${plat.title} (${plat.plat_id}): Node ${node} at elv ${elv} is associated with both leg ${existingLeg} and leg ${legVal}`);
                        }
                    } else {
                        nodeLegMap.set(key, legVal);
                    }
                };

                checkNode(md.s_node, md.s_leg, md.elv_1);
                checkNode(md.f_node, md.f_leg, md.elv_2);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

run();
