
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    console.log("--- OILFIELD LIST ---");
    const { data: fields } = await supabase
        .from('u_lib_list')
        .select('lib_id, lib_desc')
        .eq('lib_code', 'OILFIELD');
    console.table(fields);

    console.log("\n--- PLATFORM SAMPLE (PFIELD) ---");
    const { data: plats } = await supabase
        .from('platform')
        .select('plat_id, pfield')
        .limit(10);
    console.table(plats);
    
    console.log("\n--- JOBPACK SAMPLE (METADATA) ---");
    const { data: jps } = await supabase
        .from('jobpack')
        .select('id, metadata')
        .limit(5);
    jps.forEach(jp => {
        console.log(`Jobpack ${jp.id}:`, JSON.stringify(jp.metadata?.structures)?.slice(0, 100));
    });
}

check();
