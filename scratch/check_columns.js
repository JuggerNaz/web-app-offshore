
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('structure_components')
        .select('*')
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Columns in structure_components:', Object.keys(data[0]));
}

check();
