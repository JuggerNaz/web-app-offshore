import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
    // Assuming we know some IDs from typical usage
    // Search for any anomaly first
    const { data: anyAnom, error: err1 } = await supabase.from('v_anomaly_details').select('*').limit(1);
    console.log("Any anomaly from view:", anyAnom);
    if (err1) console.error("View Query Error:", err1);

    const { data: rawAnom, error: err2 } = await supabase.from('insp_anomalies').select('*').limit(1);
    console.log("Any anomaly from table:", rawAnom);
}

check();
