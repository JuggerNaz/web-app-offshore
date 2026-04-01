
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMetadata() {
    const { data, error } = await supabase
        .from('structure_components')
        .select('q_id, metadata')
        .eq('q_id', 'VDM N3-N11')
        .single();
        
    if (error) {
        console.error(error);
        return;
    }
    
    console.log(JSON.stringify(data, null, 2));
}

checkMetadata();
