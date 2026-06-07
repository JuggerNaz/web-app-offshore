const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCodes() {
    console.log("Checking unique inspection type codes in records...");
    const { data, error } = await supabase
        .from('insp_records')
        .select('inspection_type_code')
        .limit(100);

    if (error) {
        console.error(error);
        return;
    }

    const codes = new Set(data.map(r => r.inspection_type_code));
    console.log("Found codes:", Array.from(codes));
}

checkCodes();
