
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: records, error } = await supabase
        .from('insp_records')
        .select(`
            insp_id, 
            sow_report_no, 
            jobpack_id, 
            structure_id,
            inspection_type_id,
            inspection_type_code,
            structure_components:component_id(id, q_id, code)
        `)
        .eq('structure_id', 234);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Records for structure 234:');
    records.forEach(r => {
        console.log(`ID: ${r.insp_id} | SOW: ${r.sow_report_no} | Type: ${r.inspection_type_code} | CompQID: ${r.structure_components?.q_id} | CompCode: ${r.structure_components?.code}`);
    });
}

check();
