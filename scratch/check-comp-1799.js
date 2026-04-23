import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkComponent(id) {
    const { data, error } = await supabase
        .from('structure_components')
        .select('id, q_id, structure_id, code')
        .eq('id', id)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Component ${id}:`);
    console.log(data);
}

checkComponent(1799);
