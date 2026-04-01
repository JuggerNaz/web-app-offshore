import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        env[key.trim()] = values.join('=').trim();
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: recs, error } = await supabase
        .from('insp_records')
        .select('insp_id, jobpack_id, structure_id, sow_report_no')
        .in('insp_id', [39]);
        
    console.log("Record 39:", recs);
    
    // Check v_anomaly_details logic
    const { data: dj } = await supabase.from('insp_dive_jobs').select('dive_job_id, sow_report_no').limit(5);
    const { data: rj } = await supabase.from('insp_rov_jobs').select('rov_job_id, sow_report_no').limit(5);
    console.log("ROV jobs:", rj);
}
check();
