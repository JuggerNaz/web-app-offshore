import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugReportsCenter() {
    const url = "http://localhost:3000/api/reports/pipeline-defect-summary?jobpack_id=591&structure_id=2&sow_report_no=P%2F2026";
    const res = await fetch(url);
    const json = await res.json();

    console.log("json.data:", json.data);
    console.log("json.all_inspection_records:", json.all_inspection_records);
}

debugReportsCenter().catch(console.error);
