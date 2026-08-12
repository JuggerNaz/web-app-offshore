import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function inspectRecords() {
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

    console.log("=== 1. Checking insp_records inspection_data keys ===");
    const { data: recs } = await sb.from("insp_records").select("*").limit(20);
    if (recs) {
        recs.forEach((r, idx) => {
            let idraw = r.inspection_data || r.inspection_dat || {};
            if (typeof idraw === "string") {
                try { idraw = JSON.parse(idraw); } catch (e) {}
            }
            console.log(`Record #${idx + 1} (insp_id: ${r.insp_id}):`);
            console.log("  Top-level keys:", Object.keys(r).filter(k => r[k] !== null));
            console.log("  inspection_data keys:", Object.keys(idraw));
            console.log("  fp_kp:", r.fp_kp, "elevation:", r.elevation);
            console.log("  inspection_data.easting:", idraw.easting, "northing:", idraw.northing, "kp:", idraw.kp, "fp_kp:", idraw.fp_kp);
            if (idraw.fields) {
                console.log("  idraw.fields:", idraw.fields);
            }
            console.log("-----------------------------------------");
        });
    }
}

inspectRecords().catch(console.error);
