
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSpecificJob() {
    console.log("Searching for ROV job ID: 22");
    
    const { data: job, error } = await supabase
        .from('insp_rov_jobs')
        .select('*')
        .eq('rov_job_id', 22)
        .single();

    if (error) {
        console.error("Error fetching job:", error);
    } else {
        console.log(`Job 22 found:`, JSON.stringify(job, null, 2));
    }
}

checkSpecificJob();
