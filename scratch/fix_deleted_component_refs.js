require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const structureId = 234; // Plat-C structure ID

  console.log(`Analyzing structure components for structure_id: ${structureId}...`);

  // 1. Fetch all components for this structure
  const { data: comps, error: compsErr } = await supabase
    .from('structure_components')
    .select('id, q_id, is_deleted, metadata')
    .eq('structure_id', structureId);

  if (compsErr) {
    console.error('Error fetching components:', compsErr);
    return;
  }

  // Separate active and deleted components
  const activeComps = [];
  const deletedComps = [];

  comps.forEach(c => {
    const isDeleted = c.is_deleted === true || c.is_deleted === 1 || 
                      (c.metadata && (c.metadata.del === 1 || c.metadata.del === '1' || c.metadata.del === true));
    if (isDeleted) {
      deletedComps.push(c);
    } else {
      activeComps.push(c);
    }
  });

  console.log(`Found ${activeComps.length} active components and ${deletedComps.length} deleted components.`);

  // Build a map of q_id -> active component ID
  const qidToActiveId = new Map();
  activeComps.forEach(c => {
    if (c.q_id) {
      qidToActiveId.set(c.q_id.toUpperCase(), c.id);
    }
  });

  // Identify deleted components that have an active counterpart with the same q_id
  const deletedToActiveMap = new Map();
  deletedComps.forEach(c => {
    if (c.q_id) {
      const activeId = qidToActiveId.get(c.q_id.toUpperCase());
      if (activeId) {
        deletedToActiveMap.set(c.id, activeId);
      }
    }
  });

  console.log(`Identified ${deletedToActiveMap.size} deleted components that can be mapped to active ones.`);
  if (deletedToActiveMap.size === 0) return;

  const deletedIds = Array.from(deletedToActiveMap.keys());

  // 2. Query insp_records pointing to deleted components
  const { data: recs, error: recsErr } = await supabase
    .from('insp_records')
    .select('insp_id, component_id, inspection_type_code')
    .in('component_id', deletedIds);

  if (recsErr) {
    console.error('Error fetching records:', recsErr);
    return;
  }

  console.log(`Found ${recs.length} inspection records pointing to deleted components.`);

  // 3. Query u_sow_items pointing to deleted components
  const { data: sowItems, error: sowErr } = await supabase
    .from('u_sow_items')
    .select('id, component_id, component_qid, inspection_code, status')
    .in('component_id', deletedIds);

  if (sowErr) {
    console.error('Error fetching SOW items:', sowErr);
    return;
  }

  console.log(`Found ${sowItems.length} SOW items pointing to deleted components.`);

  // 4. Update references in insp_records
  if (recs.length > 0) {
    console.log('\nUpdating insp_records component_id references...');
    for (const r of recs) {
      const activeId = deletedToActiveMap.get(r.component_id);
      if (activeId) {
        const { error: updateErr } = await supabase
          .from('insp_records')
          .update({ component_id: activeId })
          .eq('insp_id', r.insp_id);

        if (updateErr) {
          console.error(`Failed to update record ${r.insp_id}:`, updateErr);
        } else {
          console.log(`  Record ID ${r.insp_id}: component_id ${r.component_id} -> ${activeId}`);
        }
      }
    }
  }

  // 5. Update references in u_sow_items
  if (sowItems.length > 0) {
    console.log('\nUpdating u_sow_items component_id references...');
    for (const item of sowItems) {
      const activeId = deletedToActiveMap.get(item.component_id);
      if (activeId) {
        // First check if there is already an SOW item for the active component with the same inspection code and report number?
        // Wait, if we just update the component_id, we might create a duplicate SOW item if one already exists for activeId.
        // Let's check if the active component already has an SOW item for the same inspection code!
        // We can fetch it first.
        const { data: siblingItem } = await supabase
          .from('u_sow_items')
          .select('id')
          .eq('component_id', activeId)
          .eq('inspection_code', item.inspection_code)
          .maybeSingle();

        if (siblingItem) {
          // A SOW item already exists for the active component!
          // So we should delete this legacy one, rather than updating component_id and causing a constraint/duplicate error!
          console.log(`  SOW Item ${item.id} already has active counterpart (SOW Item ${siblingItem.id}). Deleting legacy item.`);
          const { error: deleteErr } = await supabase
            .from('u_sow_items')
            .delete()
            .eq('id', item.id);
          if (deleteErr) {
            console.error(`Failed to delete legacy SOW item ${item.id}:`, deleteErr);
          }
        } else {
          // No counterpart, safe to update component_id to the active component ID
          const { error: updateErr } = await supabase
            .from('u_sow_items')
            .update({ component_id: activeId })
            .eq('id', item.id);

          if (updateErr) {
            console.error(`Failed to update SOW item ${item.id}:`, updateErr);
          } else {
            console.log(`  SOW Item ID ${item.id}: component_id ${item.component_id} -> ${activeId}`);
          }
        }
      }
    }
  }

  console.log('\nReference cleanup completed successfully.');
}

run().catch(console.error);
