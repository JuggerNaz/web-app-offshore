const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSow1() {
    try {
        const { data, error } = await supabase.from('u_sow_items').select('*').eq('sow_id', 1).limit(5);
        if (error) throw error;
        console.log('Items for SOW 1:', data.length);
        console.log('First item sow_id type:', typeof data[0]?.sow_id);
    } catch (e) {
        console.error(e);
    }
}

checkSow1();
