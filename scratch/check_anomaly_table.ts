import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log("=== Checking all anomaly tables for 105453 ===");

    // Check u_anom_rec or similar
    const { data: anomRecs } = await supabase.from("u_anom_rec").select("*").limit(10);
    console.log("u_anom_rec sample:", anomRecs);

    // Check u_defect_criteria
    const { data: criteria } = await supabase.from("u_defect_criteria").select("*").limit(20);
    console.log("u_defect_criteria sample:", criteria);
}

checkTables().catch(console.error);
