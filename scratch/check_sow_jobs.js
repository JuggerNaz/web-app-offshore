
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSowJobs() {
    console.log("Searching for jobs with SOW Report No: 2026-01-01");
    
    console.log("\nROV Jobs:");
    const { data: rovJobs, error: rovError } = await supabase
        .from('insp_rov_jobs')
        .select('*')
        .eq('sow_report_no', '2026-01-01');

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

    console.log("\nDive Jobs:");
    const { data: diveJobs, error: diveError } = await supabase
        .from('insp_dive_jobs')
        .select('*')
        .eq('sow_report_no', '2026-01-01');

    if (diveError) {
        console.error("Error fetching Dive jobs:", diveError);
    } else {
        console.log(`Found ${diveJobs.length} Dive jobs`);
        diveJobs.forEach(j => {
            console.log(`- Job ${j.dive_no}: Diver=${j.diver_name}, Supervisor=${j.dive_supervisor}`);
            console.log(`  Additional Info:`, JSON.stringify(j.additional_info));
        });
    }
}

checkSowJobs();
