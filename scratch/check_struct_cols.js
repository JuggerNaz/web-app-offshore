
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStructure() {
    console.log("Listing one row from structure table...");
    const { data: s, error } = await supabase
        .from('structure')
        .select('*')
        .limit(1);

    if (error) {
        console.error("Error fetching structure:", error);
        return;
    }

    if (!s || s.length === 0) {
        console.log("No structure found.");
        return;
    }

    console.log("Columns:", Object.keys(s[0]));
}

checkStructure();
