
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkComponent() {
    const { data, error } = await supabase
        .from('structure_components')
        .select('id, q_id, name, comp_grp_name, comp_grp_desc')
        .or('q_id.eq.VDM N3-N11,name.eq.VDM N3-N11')
        .limit(1)
        .single();
        
    if (error) {
        console.error(error);
        return;
    }
    
    console.log(JSON.stringify(data, null, 2));
}

checkComponent();
