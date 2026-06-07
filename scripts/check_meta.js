
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttachments() {
    const { data, error } = await supabase
        .from('attachment')
        .select('*')
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

checkAttachments();
