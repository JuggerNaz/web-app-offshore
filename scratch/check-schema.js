import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking u_sow_items schema...");
    const { data, error } = await supabase
        .from('u_sow_items')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error("Error fetching table info:", error);
    } else {
        console.log("Sample row:", data[0]);
    }

    // Try to get column info
    const { data: cols, error: colsError } = await supabase
        .rpc('get_table_columns', { table_name: 'u_sow_items' });
    
    if (colsError) {
        console.log("RPC get_table_columns failed, trying another way...");
    } else {
        console.log("Columns:", cols);
    }
}

checkSchema();
