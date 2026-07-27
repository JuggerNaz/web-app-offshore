const SUPABASE_URL = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function run() {
    const platId = 315;
    const webapp3d = await (await fetch(`${SUPABASE_URL}/rest/v1/webapp_3d?structure_id=eq.${platId}&limit=50`, { headers })).json();

    console.log('--- SAMPLE STORED WEBAPP_3D ROWS FOR TEV-A (315) ---');
    webapp3d.forEach((w, i) => {
        console.log(`[${i}] q_id: ${w.q_id}, code: ${w.code}, start: [${w.start_x}, ${w.start_y}, ${w.start_z}], end: [${w.end_x}, ${w.end_y}, ${w.end_z}]`);
    });
}

run();
