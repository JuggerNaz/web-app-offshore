const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIndex() {
    const { data, error } = await supabase.rpc('get_table_indexes', { table_name: 'insp_video_tapes' });
    if (error) {
        // fallback if rpc fails
        console.error("RPC failed:", error.message);
    } else {
        console.log("Indexes from RPC:", data);
    }
}
checkIndex();
