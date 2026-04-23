import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJobPackMetadata() {
    const { data, error } = await supabase
        .from('jobpack')
        .select('name, metadata')
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    console.log('JobPack Metadata:');
    data.forEach(jp => {
        console.log(`- ${jp.name}:`, jp.metadata);
    });
}

checkJobPackMetadata();
