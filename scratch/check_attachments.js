require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: comps, error: err1 } = await supabase
    .from('structure_components')
    .select('*')
    .in('q_id', ['BAN002', 'BL-supp-10', 'CS-S1-SUPP-9M']);
    
  console.log("Components:", comps);
  
  if (comps && comps.length > 0) {
    const ids = comps.map(c => c.id);
    const { data: atts, error: err2 } = await supabase
      .from('attachment')
      .select('*')
      .in('source_id', ids)
      .in('source_type', ['component', 'COMPONENT', 'structure_component']);
      
    console.log("Direct Component Attachments:", atts);
    
    // Also check inspection records
    const { data: inspRecords } = await supabase
      .from('insp_records')
      .select('insp_id, component_id')
      .in('component_id', ids);
      
    console.log("Inspection Records:", inspRecords);
    
    if (inspRecords && inspRecords.length > 0) {
      const inspIds = inspRecords.map(r => r.insp_id);
      const { data: inspAtts } = await supabase
        .from('attachment')
        .select('*')
        .in('source_id', inspIds)
        .in('source_type', ['INSPECTION', 'inspection']);
        
      console.log("Inspection Attachments:", inspAtts);
    }
  }
}

check().catch(console.error);
