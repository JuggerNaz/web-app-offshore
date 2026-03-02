const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let envConfig = {};
try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const fileContent = fs.readFileSync(envPath, 'utf8');
    fileContent.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, ''); // Simple unquote
            envConfig[key] = value;
        }
    });
} catch (err) {
    console.warn("Could not load .env.local", err);
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectPriorities() {
    console.log("Fetching Anomaly Priorities (AMLY_TYP)...");

    // 1. Check u_lib_list columns again (limit 1)
    let { data: listData, error: listError } = await supabase
        .from('u_lib_list')
        .select('*')
        .eq('lib_code', 'AMLY_TYP')
        .limit(1);

    if (listData && listData.length > 0) {
        console.log("u_lib_list Sample:", Object.keys(listData[0]));
    }

    // 2. Check u_lib_combo
    console.log("Checking u_lib_combo...");
    let { data: comboData, error: comboError } = await supabase
        .from('u_lib_combo')
        .select('*')
        .or(`code1.eq.AMLY_TYP,code2.eq.AMLY_TYP`) // Check if used in combo
        .limit(5);

    if (comboData && comboData.length > 0) {
        console.log("u_lib_combo Sample:");
        console.log(JSON.stringify(comboData, null, 2));
    } else {
        console.log("No u_lib_combo records found for AMLY_TYP");
    }
}

inspectPriorities();
