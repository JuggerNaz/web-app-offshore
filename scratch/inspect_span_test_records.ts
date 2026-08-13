import { createClient } from "@supabase/supabase-js";
import fs from "fs";

async function inspectSpanTestRecords() {
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

    console.log("=== Inspecting insp_id 105453 ===");
    const { data: rec105453 } = await sb.from("insp_records").select("*").eq("insp_id", 105453).single();
    console.log("Record 105453:", JSON.stringify(rec105453, null, 2));

    if (rec105453) {
        console.log(`\n=== Querying all insp_records for jobpack_id=${rec105453.jobpack_id}, structure_id=${rec105453.structure_id} ===`);
        const { data: allRecs } = await sb
            .from("insp_records")
            .select("*")
            .eq("jobpack_id", rec105453.jobpack_id)
            .eq("structure_id", rec105453.structure_id)
            .order("insp_id", { ascending: true });

        console.log(`Found ${allRecs?.length} records for jobpack ${rec105453.jobpack_id} structure ${rec105453.structure_id}:`);
        for (const r of allRecs || []) {
            console.log(`\nInsp ID: ${r.insp_id}, KP: ${r.fp_kp}, elevation: ${r.elevation}, description: ${r.description}`);
            let idraw = r.inspection_data;
            if (typeof idraw === "string") { try { idraw = JSON.parse(idraw); } catch (e) {} }
            console.log("  inspection_data:", JSON.stringify(idraw, null, 2));
        }
    }
}

inspectSpanTestRecords().catch(console.error);
