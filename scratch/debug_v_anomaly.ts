import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugVAnomaly() {
    console.log("=== Querying v_anomaly_details ===");
    const { data: vData, error } = await supabase
        .from("v_anomaly_details")
        .select("*")
        .eq("jobpack_id", 591);
    console.log("v_anomaly_details rows for jobpack 591:", vData);
}

debugVAnomaly().catch(console.error);
