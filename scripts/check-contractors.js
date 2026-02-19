import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
try {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim();
            }
        });
    }
} catch (e) {
    console.warn("Could not load .env.local", e);
}

// Init Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContractors() {
    console.log("Checking contractors in u_lib_list...");

    // 1. Check all contractors (CONTR_NAM)
    const { data: contractors = [], error } = await supabase
        .from("u_lib_list")
        .select("*")
        .eq("lib_code", "CONTR_NAM");

    if (error) {
        console.error("Error fetching contractors:", error);
        return;
    }

    console.log(`Found ${contractors ? contractors.length : 0} contractors:`);
    contractors?.forEach(c => {
        console.log(`- ID (PK): ${c.id}, LibID: ${c.lib_id}, Name: ${c.lib_desc}, Logo: ${c.logo_url ? "YES" : "NO"}`);
        if (c.logo_url) console.log(`  Logo URL: ${c.logo_url}`);
    });

    // 2. Check JobPacks for 'contrac' metadata
    console.log("\nChecking JobPack metadata...");
    const { data: jobpacks, error: jpError } = await supabase
        .from("jobpack")
        .select("id, name, metadata")
        .not("metadata", "is", null);

    if (jpError) {
        console.error("Error fetching jobpacks:", jpError);
        return;
    }

    let countWithContrac = 0;
    jobpacks?.forEach(jp => {
        if (jp.metadata && jp.metadata.contrac) {
            countWithContrac++;
            // Check matching
            const contracId = String(jp.metadata.contrac);
            const contractor = contractors?.find(c => String(c.lib_id) === contracId || String(c.id) === contracId);

            if (contractor) {
                console.log(`- Verified JobPack ${jp.name} -> Contractor: ${contractor.lib_desc} (Matched ID: ${contracId})`);
            } else {
                console.log(`- WARNING: JobPack ${jp.name} missing contractor match for ID ${contracId}`);
            }
        }
    });

    console.log(`Total JobPacks with 'contrac': ${countWithContrac}`);
}

checkContractors();
