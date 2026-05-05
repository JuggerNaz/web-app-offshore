
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    const { data, error } = await supabase.rpc('get_table_names'); // If this RPC exists
    if (error) {
        // Fallback: try to query a known table
    const res2 = await supabase.from('inspection_type').select('*').limit(1);
    console.log('inspection_type data:', res2.data);
    } else {
        console.log('Tables:', data);
    }
}

checkTables();
