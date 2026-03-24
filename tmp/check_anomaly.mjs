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
    const { data, error } = await supabase
        .from('v_anomaly_details')
        .select('id, anomaly_id, jobpack_id, structure_id, sow_report_no, jobpack_name, structure_name');
        
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Total records:", data?.length);
        console.log("Sample records:", data?.slice(0, 5));
        
        // Find records where sow_report_no is '2026-01'
        const matches = data?.filter(r => r.sow_report_no === '2026-01' || r.structure_name === 'PLAT-C' || String(r.jobpack_id) === '98' || r.jobpack_name === 'UIMC2026/NQ/Plat01');
        console.log("Matches:", matches);
    }
}
check();
