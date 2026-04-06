const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');
config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkTable() {
    const { data, error } = await supabase.from('attachment').select('*').limit(1);
    if (error) {
        console.error("Error fetching attachment:", error);
    } else {
        console.log("Found entry in attachment table:", data);
    }
}

checkTable();
