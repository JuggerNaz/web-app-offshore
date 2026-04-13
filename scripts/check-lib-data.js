const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve('.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('.env.local not found');
        process.exit(1);
    }
    const env = fs.readFileSync(envPath, 'utf8');

    const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

    if (!urlMatch || !keyMatch) {
        console.error('Could not parse Supabase URL/Key');
        process.exit(1);
    }

    const url = urlMatch[1].trim();
    const key = keyMatch[1].trim();

    const supabase = createClient(url, key);

    async function checkData() {
        console.log("Checking u_lib_mast for RISG_TYP...");
        const { data: masterData, error: masterError } = await supabase
            .from("u_lib_mast")
            .select("*")
            .eq("lib_code", "RISG_TYP");

        if (masterError) {
            console.error("Error fetching from u_lib_mast:", masterError);
        } else {
            console.log("u_lib_mast data for RISG_TYP:", masterData);
        }

        console.log("\nChecking u_lib_list for RISG_TYP...");
        const { data: listData, error: listError } = await supabase
            .from("u_lib_list")
            .select("*")
            .eq("lib_code", "RISG_TYP");

        if (listError) {
            console.error("Error fetching from u_lib_list:", listError);
        } else {
            console.log("u_lib_list data for RISG_TYP:", listData);
        }
    }

    checkData();

} catch (e) {
    console.error(e);
}
