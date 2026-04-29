
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJobpack() {
    console.log("Searching for jobpack: UIMC2026/NQ/Plat01");
    const { data: jp, error } = await supabase
        .from('jobpack')
        .select('*')
        .ilike('name', '%UIMC2026/NQ/Plat01%');

    if (error) {
        console.error("Error fetching jobpack:", error);
        return;
    }

    if (!jp || jp.length === 0) {
        console.log("No jobpack found with that name.");
        return;
    }

    console.log("Jobpack found:", JSON.stringify(jp[0], null, 2));

    const jobPackId = jp[0].id;

    console.log("\nSearching for ROV jobs for this jobpack...");
    const { data: rovJobs, error: rovError } = await supabase
        .from('insp_rov_jobs')
        .select('*')
        .eq('jobpack_id', jobPackId);

    if (rovError) {
        console.error("Error fetching ROV jobs:", rovError);
    } else {
        console.log(`Found ${rovJobs.length} ROV jobs`);
        rovJobs.forEach(j => {
            console.log(`- Job ${j.deployment_no}: ROV=${j.rov_serial_no}, Operator=${j.rov_operator}, Supervisor=${j.rov_supervisor}`);
            console.log(`  Telemetry:`, j.rov_telemetry);
            console.log(`  Additional Info:`, j.additional_info);
        });
    }

    console.log("\nSearching for Dive jobs for this jobpack...");
    const { data: diveJobs, error: diveError } = await supabase
        .from('insp_dive_jobs')
        .select('*')
        .eq('jobpack_id', jobPackId);

    if (diveError) {
        console.error("Error fetching Dive jobs:", diveError);
    } else {
        console.log(`Found ${diveJobs.length} Dive jobs`);
        diveJobs.forEach(j => {
            console.log(`- Job ${j.dive_no}: Diver=${j.diver_name}, Supervisor=${j.dive_supervisor}`);
            console.log(`  Additional Info:`, j.additional_info);
        });
    }
}

checkJobpack();
