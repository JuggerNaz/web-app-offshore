const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '';
env.forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function check() {
    // get latest inspection id
    const { data: recs } = await supabase.from('insp_records').select('insp_id').order('insp_id', { ascending: false }).limit(1);
    if (!recs || recs.length === 0) return console.log("No inspection records");
    
    const anomalyPayload = {
        inspection_id: recs[0].insp_id,
        defect_type_code: "CATHODIC POTENTIAL",
        priority_code: "PRIORITY 1",
        defect_category_code: "CATHODIC POTENTIAL OVER PROTECTED",
        status: "OPEN",
        defect_description: "Cp over protected",
        recommended_action: "",
        rectified_date: null,
        rectified_remarks: null,
        severity: "MINOR",
        anomaly_ref_no: "2026/PLAT-C/A-999",
        sequence_no: 999
    };
    
    console.log("Attempting insert:", anomalyPayload);
    const { data, error } = await supabase.from('insp_anomalies').insert(anomalyPayload);
    console.log("Insert Result:", { data, error });
}
check();
