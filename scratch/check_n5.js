const fs = require('fs');
const THREE = require('three');

async function run() {
    const envText = fs.readFileSync('.env.local', 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim();

    // 4. Fetch components
    const compRes = await fetch(`${url}/rest/v1/structure_components?structure_id=eq.1507&select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const rawComponents = await compRes.json();

    const targetN5 = rawComponents.find(c => c.q_id === "WN N5");
    if (targetN5) {
        console.log("WN N5 metadata:", JSON.stringify(targetN5.metadata, null, 2));
        if (targetN5.metadata.associated_comp_id) {
            const parent = rawComponents.find(c => c.id === targetN5.metadata.associated_comp_id);
            console.log("Parent component of WN N5:", JSON.stringify(parent, null, 2));
        }
    } else {
        console.log("WN N5 not found!");
    }

    const targetN1 = rawComponents.find(c => c.q_id === "WN N1");
    if (targetN1) {
        console.log("WN N1 metadata:", JSON.stringify(targetN1.metadata, null, 2));
        if (targetN1.metadata.associated_comp_id) {
            const parent = rawComponents.find(c => c.id === targetN1.metadata.associated_comp_id);
            console.log("Parent component of WN N1:", JSON.stringify(parent, null, 2));
        }
    }
}

run();
