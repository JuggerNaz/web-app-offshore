require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Fetching all components with q_id using pagination...');
  
  let allComps = [];
  let hasMore = true;
  let offset = 0;
  const pageSize = 1000;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('structure_components')
      .select('id, structure_id, q_id, is_deleted, metadata')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching components page:', error);
      return;
    }
    
    if (data && data.length > 0) {
      allComps = allComps.concat(data);
      offset += pageSize;
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  
  console.log(`Fetched ${allComps.length} components total.`);

  // Group components by structure_id and q_id (case-insensitive)
  const groups = {};
  allComps.forEach(c => {
    if (!c.q_id || !c.structure_id) return;
    const key = `${c.structure_id}:${c.q_id.trim().toUpperCase()}`;
    if (!groups[key]) {
      groups[key] = { active: [], deleted: [] };
    }
    
    const isDeleted = c.is_deleted === true || c.is_deleted === 1 || 
                      (c.metadata && (c.metadata.del === 1 || c.metadata.del === '1' || c.metadata.del === true));
    
    if (isDeleted) {
      groups[key].deleted.push(c);
    } else {
      groups[key].active.push(c);
    }
  });

  const deletedToActiveMap = new Map();
  console.log('\nMapping deleted components to active counterparts...');

  for (const [key, group] of Object.entries(groups)) {
    if (group.deleted.length > 0 && group.active.length > 0) {
      const activeComp = group.active[0]; // Map to the first active component
      group.deleted.forEach(delComp => {
        deletedToActiveMap.set(delComp.id, activeComp.id);
        console.log(`  Structure ${delComp.structure_id} | ${delComp.q_id}: Deleted ID ${delComp.id} -> Active ID ${activeComp.id}`);
      });
    }
  }

  if (deletedToActiveMap.size === 0) {
    console.log('No mismatched components found to align.');
    return;
  }

  const legacyIds = Array.from(deletedToActiveMap.keys());
  console.log(`\nFound ${deletedToActiveMap.size} component mappings to process.`);

  // 1. Update insp_records
  console.log('\nFetching insp_records for legacy components...');
  const { data: recs, error: recsErr } = await supabase
    .from('insp_records')
    .select('insp_id, component_id, inspection_type_code')
    .in('component_id', legacyIds);

  if (recsErr) {
    console.error('Error fetching records:', recsErr);
    return;
  }

  console.log(`Found ${recs.length} inspection records pointing to legacy components.`);
  if (recs.length > 0) {
    console.log('Updating insp_records component_id references...');
    for (const r of recs) {
      const activeId = deletedToActiveMap.get(r.component_id);
      if (activeId) {
        const { error: updateErr } = await supabase
          .from('insp_records')
          .update({ component_id: activeId })
          .eq('insp_id', r.insp_id);

        if (updateErr) {
          console.error(`  Failed to update record ${r.insp_id}:`, updateErr);
        } else {
          console.log(`  Record ID ${r.insp_id}: component_id ${r.component_id} -> ${activeId}`);
        }
      }
    }
  }

  // 2. Fetch all SOW items for legacy components
  console.log('\nFetching u_sow_items for legacy components...');
  const { data: sowItems, error: sowErr } = await supabase
    .from('u_sow_items')
    .select('*')
    .in('component_id', legacyIds);

  if (sowErr) {
    console.error('Error fetching legacy SOW items:', sowErr);
    return;
  }

  console.log(`Found ${sowItems.length} SOW items pointing to legacy components.`);

  for (const item of sowItems) {
    const activeId = deletedToActiveMap.get(item.component_id);
    if (!activeId) continue;

    console.log(`\nProcessing legacy SOW Item ID ${item.id} (Component: ${item.component_qid}, Code: ${item.inspection_code}, Status: ${item.status}, Report: ${item.report_number})`);

    // Fetch ALL sibling items for this active component and inspection code
    const { data: activeSiblings, error: sibsErr } = await supabase
      .from('u_sow_items')
      .select('*')
      .eq('component_id', activeId)
      .eq('inspection_code', item.inspection_code);

    if (sibsErr) {
      console.error(`  Error fetching siblings for active component ${activeId}:`, sibsErr);
      continue;
    }

    // Check if there is a sibling with matching report number or matching sow_id
    const matchingSibling = (activeSiblings || []).find(sib => {
      // Prioritize matching by sow_id AND (report_number or unassigned)
      return sib.sow_id === item.sow_id && (sib.report_number === item.report_number || !sib.report_number);
    }) || (activeSiblings || []).find(sib => sib.sow_id === item.sow_id); // Fallback to any sibling in same SOW

    if (matchingSibling) {
      console.log(`  Found active sibling SOW Item ID ${matchingSibling.id} (Status: ${matchingSibling.status}, Report: ${matchingSibling.report_number})`);
      
      // If the legacy item is completed, but active sibling is pending, update the active sibling to completed
      const legacyCompleted = item.status === 'completed';
      const siblingPending = matchingSibling.status === 'pending' || matchingSibling.status === 'incomplete';

      if (legacyCompleted && siblingPending) {
        console.log(`  Updating active sibling ${matchingSibling.id} to status = completed, report_number = ${item.report_number || matchingSibling.report_number}`);
        const { error: sibUpdateErr } = await supabase
          .from('u_sow_items')
          .update({
            status: 'completed',
            report_number: item.report_number || matchingSibling.report_number,
            elevation_data: item.elevation_data || matchingSibling.elevation_data,
            updated_at: new Date().toISOString(),
            updated_by: 'cleanup-script'
          })
          .eq('id', matchingSibling.id);

        if (sibUpdateErr) {
          console.error(`    Failed to update active sibling SOW item:`, sibUpdateErr);
        } else {
          console.log(`    Active sibling SOW item ${matchingSibling.id} updated successfully.`);
        }
      }

      // Now we delete the legacy SOW item as it's fully merged/represented by the active sibling
      console.log(`  Deleting merged legacy SOW item ${item.id}...`);
      const { error: deleteErr } = await supabase
        .from('u_sow_items')
        .delete()
        .eq('id', item.id);

      if (deleteErr) {
        console.error(`    Failed to delete legacy SOW item ${item.id}:`, deleteErr);
      } else {
        console.log(`    Deleted legacy SOW item ${item.id} successfully.`);
      }

    } else {
      // No active sibling exists in this SOW. We can just migrate this SOW item to the active component ID.
      console.log(`  No active sibling found in SOW. Updating legacy SOW item ${item.id} component_id to active ID ${activeId}...`);
      const { error: updateErr } = await supabase
        .from('u_sow_items')
        .update({
          component_id: activeId,
          updated_at: new Date().toISOString(),
          updated_by: 'cleanup-script'
        })
        .eq('id', item.id);

      if (updateErr) {
        console.error(`    Failed to update legacy SOW item ${item.id}:`, updateErr);
      } else {
        console.log(`    Updated legacy SOW item ${item.id} to component_id ${activeId}.`);
      }
    }
  }

  console.log('\nDatabase alignment completed successfully.');
}

run().catch(console.error);
