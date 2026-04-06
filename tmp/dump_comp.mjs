
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function dumpOneComp() {
    const { data, error } = await supabase
        .from('structure_components')
        .select('metadata')
        .limit(1);
        
    if (error) {
        console.error(error);
        return;
    }
    
    console.log(JSON.stringify(data[0].metadata, null, 2));
}

dumpOneComp();
