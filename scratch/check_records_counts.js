const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecords() {
    try {
        const { data: recs, error } = await supabase.from('insp_records').select('jobpack_id, structure_id');
        if (error) throw error;
        
        const grouped = recs.reduce((acc, r) => {
            const key = `${r.jobpack_id}:${r.structure_id}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        
        console.log('--- insp_records counts per jp:str ---');
        console.table(grouped);

    } catch (e) {
        console.error(e);
    }
}

checkRecords();
