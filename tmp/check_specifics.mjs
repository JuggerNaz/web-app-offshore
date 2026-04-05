
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecifics() {
    const { data: cpCode } = await supabase.from('u_lib_list').select('lib_id, lib_desc').eq('lib_id', 'CP').eq('lib_code', 'AMLY_COD');
    const { data: cpupType } = await supabase.from('u_lib_list').select('lib_id, lib_desc').eq('lib_id', 'CPUP').eq('lib_code', 'AMLY_FND');
    const { data: p2Prio } = await supabase.from('u_lib_list').select('lib_id, lib_desc').eq('lib_id', 'P2').eq('lib_code', 'AMLY_TYP');
    
    console.log(JSON.stringify({ cpCode, cpupType, p2Prio }, null, 2));
}

checkSpecifics();
