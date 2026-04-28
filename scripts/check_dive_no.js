const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

try {
    const envPath = path.resolve('.env.local');
    const env = fs.readFileSync(envPath, 'utf8');
    const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
    const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
    const supabase = createClient(url, key);

    async function check() {
        console.log('Querying jobs...');
        const { data: diveJobs, error: diveError } = await supabase.from('insp_dive_jobs').select('*').eq('dive_job_id', 39);
        console.log('Dive Jobs with ID 39:', diveJobs, diveError);

        const { data: rovJobs, error: rovError } = await supabase.from('insp_rov_jobs').select('*').eq('rov_job_id', 39);
        console.log('ROV Jobs with ID 39:', rovJobs, rovError);

        const { data: recordDetails } = await supabase.from('insp_records').select('*').eq('insp_id', 46);
        console.log('Record details for 46:', JSON.stringify(recordDetails, null, 2));
    }
    check();
} catch (e) { console.error(e); }
