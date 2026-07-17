require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  // We also want to find the u_sow for a jobpack to get the actual sow_items
  const { data: sows } = await supabase
    .from('u_sow')
    .select('id')
    .limit(1);
    
  if (sows && sows.length > 0) {
    const sowId = sows[0].id;
    console.log('Using SOW ID:', sowId);
    
    const { data: items } = await supabase
      .from('u_sow_items')
      .select('id, component_id, component_qid, status, notes')
      .eq('sow_id', sowId)
      .eq('status', 'incomplete')
      .limit(15);
      
    console.log('--- Incomplete SOW Items ---');
    console.log(JSON.stringify(items, null, 2));
    
    if (items) {
      const compIds = items.map(i => i.component_id).filter(Boolean);
      const { data: dbComps } = await supabase
        .from('structure_components')
        .select('id, q_id, code, metadata')
        .in('id', compIds);
        
      console.log('--- Matching Components by ID ---');
      console.log(JSON.stringify(dbComps, null, 2));
    }
  }
}

run();
