const SUPABASE_URL = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function run() {
    const platId = 301; // BAP-AA
    console.log(`Purging cached webapp_3d rows for BAP-AA (plat_id: ${platId})...`);
    
    const res = await fetch(`${SUPABASE_URL}/rest/v1/webapp_3d?structure_id=eq.${platId}`, {
        method: 'DELETE',
        headers
    });
    
    console.log('Delete status:', res.status);
    console.log('Successfully purged cached rows for BAP-AA.');
}

run();
