const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJobs() {
    const { data, error } = await supabase.from('insp_rov_jobs').select('rov_job_id, deployment_no, sow_report_no').limit(5);
    if (error) console.error(error);
    else console.log("Recent jobs:", data);
}
// checkJobs();
