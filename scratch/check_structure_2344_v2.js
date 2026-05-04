
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: comps, error } = await supabase
        .from('structure_components')
        .select('*')
        .eq('structure_id', 2344);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Components for structure 2344:');
    comps.forEach(c => {
        console.log(`ID: ${c.id} | QID: ${c.q_id} | Code: ${c.code} | CompName: ${c.comp_name} | Metadata: ${JSON.stringify(c.metadata)}`);
    });
}

check();
