
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStructure() {
    console.log("Searching for structure: PLAT-B");
    const { data: s, error } = await supabase
        .from('structure')
        .select('*')
        .ilike('name', '%PLAT-B%');

    if (error) {
        console.error("Error fetching structure:", error);
        return;
    }

    if (!s || s.length === 0) {
        console.log("No structure found with that name.");
        return;
    }

    console.log("Structure found:", JSON.stringify(s[0], null, 2));
    const strId = s[0].str_id;

    console.log("\nSearching for ROV jobs for this structure...");
    const { data: rovJobs, error: rovError } = await supabase
        .from('insp_rov_jobs')
        .select('*')
        .eq('structure_id', strId);

    if (rovError) {
        console.error("Error fetching ROV jobs:", rovError);
    } else {
        console.log(`Found ${rovJobs.length} ROV jobs`);
        rovJobs.forEach(j => {
            console.log(`- Job ${j.deployment_no}: JobPackId=${j.jobpack_id}, Operator=${j.rov_operator}`);
            console.log(`  Telemetry:`, JSON.stringify(j.rov_telemetry));
            console.log(`  Additional Info:`, JSON.stringify(j.additional_info));
        });
    }
}

checkStructure();
