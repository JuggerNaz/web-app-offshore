const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://zpsmxtdqlpbdwfzctqzd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4'
);

async function fetchRGVI() {
    // Fetch all inspection types with their default_properties
    const { data, error } = await supabase
        .from('inspection_type')
        .select('code, name, default_properties, metadata, category')
        .order('code');

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    // Output as formatted JSON
    console.log(JSON.stringify(data, null, 2));
}

fetchRGVI();
