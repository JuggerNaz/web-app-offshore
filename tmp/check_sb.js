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
    const anomalyPayload = {
        inspection_id: 1,
        defect_type_code: "foo",
        priority_code: "foo",
        defect_category_code: "foo",
        status: "CLOSED",
        defect_description: "foo",
        recommended_action: "foo",
        rectified_date: new Date().toISOString(),
        rectified_remarks: "foo",
        severity: "foo",
        record_category: "ANOMALY",
        anomaly_ref_no: "foo",
        sequence_no: 1
    };
    
    const { data, error } = await supabase.from('insp_anomalies').insert(anomalyPayload);
    console.log("Error:", error);
}
check();
