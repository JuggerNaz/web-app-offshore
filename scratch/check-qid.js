const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://zpsmxtdqlpbdwfzctqzd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4');

async function simulate() {
    const structureId = 234;
    const sowId = 1;
    const targetReportNumber = '2026-01';

    let allCompsDataRaw = [];
    let hasMore = true;
    let offset = 0;
    const pageSize = 1000;
    while (hasMore) {
        const { data: pageData } = await supabase.from('structure_components')
            .select('*').eq('structure_id', structureId).range(offset, offset + pageSize - 1);
        
        if (pageData && pageData.length > 0) {
            allCompsDataRaw = [...allCompsDataRaw, ...pageData];
            offset += pageSize;
            if (pageData.length < pageSize) hasMore = false;
        } else {
            hasMore = false;
        }
    }

    const r11s = allCompsDataRaw.filter(c => c.q_id === 'R11-SK358-WLP-A');
    console.log("R11s fetched from DB:", r11s.map(c => ({ id: c.id, is_deleted: c.is_deleted, del: c.metadata?.del })));

    const allCompsData = allCompsDataRaw.filter((c) => {
        if (c.is_deleted === true || c.is_deleted === 1) return false;
        if (c.metadata && (c.metadata.del === 1 || c.metadata.del === '1' || c.metadata.del === true)) return false;
        return true;
    });

    console.log("R11s AFTER filter:", allCompsData.filter(c => c.q_id === 'R11-SK358-WLP-A').map(c => ({ id: c.id })));
}
simulate();
