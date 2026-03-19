const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '';
env.forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

// Use service role key if available to bypass RLS, otherwise use anon key
// Since we found out .env.local only has anon key, we'll try to just read using anon key if public policies allow
const supabase = createClient(url, key);

async function check() {
    const { data: recs, error: recErr } = await supabase.from('insp_records').select('insp_id, created_at, observation, has_anomaly').order('created_at', { ascending: false }).limit(5);
    console.log("Recent Records:", recs, recErr);

    if (recs && recs.length > 0) {
        const { data: anoms, error: anomErr } = await supabase.from('insp_anomalies').select('*').in('inspection_id', recs.map(r => r.insp_id));
        console.log("Recent Anomalies:", anoms, anomErr);
    }
}
check();
