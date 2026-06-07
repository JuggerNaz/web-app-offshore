require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const compIdMap = new Map();
  const qIdMap = new Map();
  
  const { data: existingComps, error } = await supabase
    .from('structure_components')
    .select('id, comp_id, q_id, code')
    .eq('structure_id', 1061);
    
  const { count, error: countErr } = await supabase
    .from('structure_components')
    .select('id', { count: 'exact', head: true })
    .eq('structure_id', 1061);
  console.log('Total components in DB for structure 1061:', count);
  
  existingComps?.forEach((comp) => {
    const pgId = Number(comp.id);
    if (comp.comp_id) {
      compIdMap.set(Number(comp.comp_id), pgId);
    }
    if (comp.q_id) {
      qIdMap.set(String(comp.q_id).trim().toUpperCase(), pgId);
    }
  });
  
  console.log('compIdMap size:', compIdMap.size);
  console.log('qIdMap size:', qIdMap.size);
  console.log('compIdMap has 183285:', compIdMap.has(183285));
  console.log('compIdMap.get(183285):', compIdMap.get(183285));
  console.log('qIdMap has CD04-SUPP-12.672:', qIdMap.has('CD04-SUPP-12.672'));
  console.log('qIdMap.get(CD04-SUPP-12.672):', qIdMap.get('CD04-SUPP-12.672'));
}

run();
