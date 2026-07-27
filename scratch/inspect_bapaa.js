const SUPABASE_URL = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function run() {
    const structureId = 301; // BAP-AA
    console.log(`\n======================================================`);
    console.log(`DEEP INSPECTION OF PLATFORM BAP-AA (plat_id: ${structureId})`);
    console.log(`======================================================`);

    // 1. Fetch Elevations from str_elv
    const elvRes = await fetch(`${SUPABASE_URL}/rest/v1/str_elv?plat_id=eq.${structureId}`, { headers });
    const elevations = await elvRes.json();
    console.log(`\nElevations from str_elv (${elevations.length}):`, elevations);

    // 2. Fetch Faces from str_faces
    const faceRes = await fetch(`${SUPABASE_URL}/rest/v1/str_faces?plat_id=eq.${structureId}`, { headers });
    const faces = await faceRes.json();
    console.log(`\nFaces from str_faces (${faces.length}):`, faces);
}

run();
