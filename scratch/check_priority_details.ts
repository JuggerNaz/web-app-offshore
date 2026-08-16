import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPriority() {
    console.log("=== Checking Priority for insp_id 105453 & 105452 ===");

    // 1. Check v_anomaly_details
    const { data: vAnoms, error: vErr } = await supabase
        .from("v_anomaly_details")
        .select("*")
        .or("id.eq.105453,insp_id.eq.105453");
    console.log("v_anomaly_details for 105453:", vAnoms);

    // 2. Check insp_records
    const { data: inspRecs, error: iErr } = await supabase
        .from("insp_records")
        .select("*")
        .in("insp_id", [105452, 105453]);
    console.log("insp_records for 105452 & 105453:");
    for (const r of inspRecs || []) {
        console.log(`  insp_id: ${r.insp_id}, status: ${r.status}, priority: ${r.priority}, priority_color: ${r.priority_color}, inspection_data:`, r.inspection_data);
    }

    // 3. Check u_anom_rec (if exists)
    const { data: uAnomRecs } = await supabase
        .from("u_anom_rec")
        .select("*")
        .or("insp_id.eq.105453,insp_id.eq.105452");
    console.log("u_anom_rec:", uAnomRecs);

    // 4. Check priority color mapping from u_lib_list (lib_code = 'PRIORITY' or similar)
    const { data: libPriority } = await supabase
        .from("u_lib_list")
        .select("*")
        .ilike("lib_code", "%PRIORITY%");
    console.log("u_lib_list Priority entries:", libPriority);
}

checkPriority().catch(console.error);
