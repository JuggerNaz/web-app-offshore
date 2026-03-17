require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkRules() {
    const { data, error } = await supabase.from('defect_criteria_rules').select('*').limit(10);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Rules:", JSON.stringify(data, null, 2));
    }
}

checkRules();
