const { createClient } = require('@supabase/supabase-js');

// These would normally be in env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking columns for insp_rov_jobs...");
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'insp_rov_jobs' });
    if (error) {
        console.error("Error fetching columns:", error);
        // Fallback: try to select one row and check types
        const { data: oneRow } = await supabase.from('insp_rov_jobs').select('*').limit(1);
        if (oneRow && oneRow.length > 0) {
            console.log("Sample row types:");
            for (const key in oneRow[0]) {
                console.log(`${key}: ${typeof oneRow[0][key]} (value: ${oneRow[0][key]})`);
            }
        }
    } else {
        console.log("Columns:", data);
    }
}

// checkSchema();
