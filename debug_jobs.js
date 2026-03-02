const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local manually
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

if (!url || !anonKey) {
    console.error("Could not find Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(url, anonKey);

async function checkJobs() {
    console.log("Checking jobs for jobpack 591...");

    // 1. Check all jobs, no filter
    const { data: allJobs, error: allErr } = await supabase
        .from('insp_dive_jobs')
        .select('*')
        .limit(10);

    if (allErr) {
        console.error("Error fetching all:", allErr);
    } else {
        // console.log("First 10 jobs found:", allJobs);
    }

    // 2. Check jobs for 591
    const { data: jobs, error } = await supabase
        .from('insp_dive_jobs')
        .select('*')
        .eq('jobpack_id', 591);

    if (error) {
        console.error("Error fetching jobs for 591:", error);
        return;
    }

    console.log(`Found ${jobs.length} jobs for jobpack 591.`);

    jobs.forEach(j => {
        console.log(`ID: ${j.dive_job_id}, No: ${j.dive_no}, Status: '${j.status}', Jobpack: ${j.jobpack_id}`);

        // Check for weird whitespace
        if (j.status !== 'IN_PROGRESS') {
            console.log(`  Expected 'IN_PROGRESS', got '${j.status}' (char codes: ${j.status.split('').map(c => c.charCodeAt(0))})`);
        } else {
            console.log('  Status matches exactly.');
        }
    });
}

checkJobs();
