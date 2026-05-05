const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    try {
        const { data: counts, error } = await supabase.from('u_sow_items').select('sow_id');
        if (error) throw error;
        
        const grouped = counts.reduce((acc, it) => {
            acc[it.sow_id] = (acc[it.sow_id] || 0) + 1;
            return acc;
        }, {});
        
        console.log('--- u_sow_items counts per sow_id ---');
        console.table(grouped);

        const { data: sows } = await supabase.from('u_sow').select('*');
        console.log('--- u_sow table ---');
        console.table(sows?.map(s => ({ id: s.id, jp: s.jobpack_id, str: s.structure_id, rep: s.report_number })));

    } catch (e) {
        console.error(e);
    }
}

checkData();
