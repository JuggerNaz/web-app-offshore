
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: comps, error } = await supabase
        .from('structure_components')
        .select('id, q_id, code, comp_name, metadata')
        .eq('structure_id', 234);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Components for structure 234:');
    comps.forEach(c => {
        console.log(`ID: ${c.id} | QID: ${c.q_id} | Code: ${c.code} | CompName: ${c.comp_name} | Metadata: ${JSON.stringify(c.metadata)}`);
    });
}

check();
