
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecords() {
    console.log("Searching for records with SOW Report No: 2026-01-01");
    
    const { data: records, error } = await supabase
        .from('insp_records')
        .select(`
            *,
            insp_rov_jobs(*),
            insp_dive_jobs(*)
        `)
        .eq('sow_report_no', '2026-01-01')
        .limit(10);

    if (error) {
        console.error("Error fetching records:", error);
    } else {
        console.log(`Found ${records.length} records`);
        records.forEach(r => {
            console.log(`- Record ${r.insp_id}: ROV_Job_ID=${r.rov_job_id}, Dive_Job_ID=${r.dive_job_id}`);
            if (r.insp_rov_jobs) console.log(`  ROV Job:`, JSON.stringify(r.insp_rov_jobs));
            if (r.insp_dive_jobs) console.log(`  Dive Job:`, JSON.stringify(r.insp_dive_jobs));
        });
    }
}

checkRecords();
