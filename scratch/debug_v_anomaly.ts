import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function checkAnomalies() {
    let envUrl = "";
    let envKey = "";
    if (fs.existsSync(".env.local")) {
        const text = fs.readFileSync(".env.local", "utf8");
        for (const line of text.split("\n")) {
            if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) envUrl = line.split("=")[1].trim();
            if (line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) envKey = line.split("=")[1].trim();
        }
    }

    const sb = createClient(envUrl, envKey);

    console.log("--- Querying all v_anomaly_details ---");
    const { data: viewAnoms, error: e2 } = await sb.from("v_anomaly_details").select("anomaly_id, display_ref_no, jobpack_id, structure_id, sow_report_no, str_type, structure_name, component_type, component_qid, description").limit(50);
    console.log("Total v_anomaly_details count:", viewAnoms?.length, "error:", e2);
    if (viewAnoms) {
        console.table(viewAnoms.slice(0, 15));
    }
}

checkAnomalies().catch(console.error);
