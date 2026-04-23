import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConductors() {
    const { data, error } = await supabase
        .from('structure_components')
        .select('q_id, code, metadata')
        .or('q_id.ilike.CD%,q_id.ilike.CON%,code.eq.CD')
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Sample Conductors:');
    console.table(data);
}

checkConductors();
