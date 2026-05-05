const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    try {
        // 1. Get u_sow entries
        const { data: sow, error: sowErr } = await supabase.from('u_sow').select('*');
        if (sowErr) throw sowErr;
        console.log('--- u_sow ---');
        console.table(sow?.map(s => ({ id: s.id, jp: s.jobpack_id, str: s.structure_id, rep: s.report_number, total: s.total_items })));

        // 2. Get u_sow_items for the latest sow
        if (sow && sow.length > 0) {
            const latestSow = sow[sow.length - 1];
            const { data: items, error: itemsErr } = await supabase.from('u_sow_items').select('report_number').eq('sow_id', latestSow.id);
            if (itemsErr) throw itemsErr;
            
            if (items) {
                const counts = items.reduce((acc, it) => {
                    const rep = it.report_number || 'NULL';
                    acc[rep] = (acc[rep] || 0) + 1;
                    return acc;
                }, {});
                console.log(`--- u_sow_items for SOW ${latestSow.id} ---`);
                console.table(counts);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

checkData();
