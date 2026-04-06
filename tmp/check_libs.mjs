
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLibraries() {
    const { data: codes } = await supabase.from('u_lib_list').select('*').eq('lib_code', 'AMLY_COD');
    const { data: prios } = await supabase.from('u_lib_list').select('*').eq('lib_code', 'AMLY_TYP');
    const { data: fnds } = await supabase.from('u_lib_list').select('*').eq('lib_code', 'AMLY_FND');
    
    console.log('--- AMLY_COD ---');
    console.log(JSON.stringify(codes?.slice(0, 5), null, 2));
    console.log('--- AMLY_TYP ---');
    console.log(JSON.stringify(prios?.slice(0, 5), null, 2));
    console.log('--- AMLY_FND ---');
    console.log(JSON.stringify(fnds?.slice(0, 5), null, 2));
}

checkLibraries();
