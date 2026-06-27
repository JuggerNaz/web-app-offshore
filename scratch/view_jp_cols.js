const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

async function main() {
    const envPath = path.resolve(".env.local");
    const env = fs.readFileSync(envPath, "utf8");
    const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
    const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

    // Fetch contractor library items
    const { data: items, error } = await supabase
        .from("u_lib_list")
        .select("*")
        .eq("lib_code", "CONTR_NAM");

    if (error) {
        console.error(error);
        return;
    }

    console.log("Found library items for CONTR_NAM:", items.length);
    items.forEach(item => {
        console.log("Item keys:", Object.keys(item));
        console.log("Item details:", JSON.stringify(item, null, 2));
    });
}

main();
