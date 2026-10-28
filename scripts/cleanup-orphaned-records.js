const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const envPath = path.resolve(__dirname, '../.env.local');
let envs = {};
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] ? match[2].trim() : '';
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      envs[key] = value;
    }
  });
} catch (e) {
  console.error("Could not read .env.local file", e);
}

const supabaseUrl = envs['NEXT_PUBLIC_SUPABASE_URL'] || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envs['SUPABASE_SERVICE_ROLE_KEY'] || envs['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isFixMode = process.argv.includes('--fix');

async function main() {
  console.log(`=======================================================`);
  console.log(`ORPHANED RECORDS AUDIT & CLEANUP (Mode: ${isFixMode ? 'EXECUTE CLEANUP' : 'DRY RUN (SCAN ONLY)'})`);
  console.log(`=======================================================\n`);

  // 1. Fetch valid inspection records
  console.log("Fetching all insp_records...");
  let allInspRecords = [];
  let allInspIds = new Set();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('insp_records')
      .select('insp_id, component_id, inspection_type_code, sow_report_no, status, has_anomaly, inspection_date')
      .order('insp_id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Error fetching insp_records:", error);
      break;
    }
    if (data && data.length > 0) {
      allInspRecords.push(...data);
      data.forEach(r => allInspIds.add(Number(r.insp_id)));
      if (data.length < pageSize) break;
      from += pageSize;
    } else {
      break;
    }
  }
  console.log(`Total valid insp_records in database: ${allInspIds.size}`);

  // 2. Fetch all anomalies
  console.log("Fetching all insp_anomalies...");
  let allAnomalies = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('insp_anomalies')
      .select('anomaly_id, anomaly_ref_no, inspection_id')
      .order('anomaly_id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Error fetching insp_anomalies:", error);
      break;
    }
    if (data && data.length > 0) {
      allAnomalies.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    } else {
      break;
    }
  }

  const orphanedAnomalies = allAnomalies.filter(a => !a.inspection_id || !allInspIds.has(Number(a.inspection_id)));
  console.log(`Total insp_anomalies: ${allAnomalies.length} | Orphaned: ${orphanedAnomalies.length}`);

  const validAnomalyIds = new Set(
    allAnomalies
      .filter(a => a.inspection_id && allInspIds.has(Number(a.inspection_id)))
      .map(a => Number(a.anomaly_id))
  );

  // 3. Fetch all attachments
  console.log("Fetching all attachment rows...");
  let allAttachments = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('attachment')
      .select('id, source_id, source_type, path')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Error fetching attachment:", error);
      break;
    }
    if (data && data.length > 0) {
      allAttachments.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    } else {
      break;
    }
  }

  const orphanedAttachments = allAttachments.filter(att => {
    const st = String(att.source_type || '').toLowerCase();
    const sid = Number(att.source_id);
    if (['inspection', 'insp_record'].includes(st)) {
      return !allInspIds.has(sid);
    }
    if (['anomaly', 'defect'].includes(st)) {
      return !validAnomalyIds.has(sid);
    }
    return false;
  });
  console.log(`Total attachments: ${allAttachments.length} | Orphaned: ${orphanedAttachments.length}`);

  // 4. Fetch all insp_media
  console.log("Fetching all insp_media rows...");
  let allMedia = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('insp_media')
      .select('media_id, inspection_id, anomaly_id, file_path, thumbnail_path')
      .order('media_id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Error fetching insp_media:", error);
      break;
    }
    if (data && data.length > 0) {
      allMedia.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    } else {
      break;
    }
  }

  const orphanedMedia = allMedia.filter(m => {
    const invalidInsp = m.inspection_id && !allInspIds.has(Number(m.inspection_id));
    const invalidAnom = m.anomaly_id && !validAnomalyIds.has(Number(m.anomaly_id));
    const noLink = !m.inspection_id && !m.anomaly_id;
    return invalidInsp || invalidAnom || noLink;
  });
  console.log(`Total insp_media: ${allMedia.length} | Orphaned: ${orphanedMedia.length}`);

  // 5. Fetch all insp_video_logs with inspection_id
  let allVideoLogs = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('insp_video_logs')
      .select('video_log_id, inspection_id, event_type')
      .not('inspection_id', 'is', null)
      .order('video_log_id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Error fetching insp_video_logs:", error);
      break;
    }
    if (data && data.length > 0) {
      allVideoLogs.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    } else {
      break;
    }
  }

  const orphanedVideoLogs = allVideoLogs.filter(vl => !allInspIds.has(Number(vl.inspection_id)));
  console.log(`Total insp_video_logs with inspection link: ${allVideoLogs.length} | Orphaned links: ${orphanedVideoLogs.length}`);

  // 6. Build lookup maps for insp_records by (comp_id + task + report) and by (comp_id + task)
  const recordsByScopedKey = new Map(); // key: compId_task_report
  const recordsByGenericKey = new Map(); // key: compId_task

  allInspRecords.forEach(r => {
    if (!r.component_id || !r.inspection_type_code) return;
    const taskCode = String(r.inspection_type_code).toUpperCase();
    const genKey = `${r.component_id}_${taskCode}`;
    if (!recordsByGenericKey.has(genKey)) recordsByGenericKey.set(genKey, []);
    recordsByGenericKey.get(genKey).push(r);

    if (r.sow_report_no) {
      const scopedKey = `${r.component_id}_${taskCode}_${String(r.sow_report_no).trim().toUpperCase()}`;
      if (!recordsByScopedKey.has(scopedKey)) recordsByScopedKey.set(scopedKey, []);
      recordsByScopedKey.get(scopedKey).push(r);
    }
  });

  // 7. Check SOW items inconsistency
  console.log("Fetching all u_sow_items...");
  let allSowItems = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('u_sow_items')
      .select('id, sow_id, component_id, component_qid, inspection_code, inspection_name, status, report_number, inspection_count, elevation_required, elevation_data, last_inspection_date')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("Error fetching u_sow_items:", error);
      break;
    }
    if (data && data.length > 0) {
      allSowItems.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    } else {
      break;
    }
  }

  const inconsistentSowItems = [];
  allSowItems.forEach(s => {
    const tCode = String(s.inspection_code || s.inspection_name || '').toUpperCase();
    if (!s.component_id || !tCode) return;

    // First try scoped lookup with report_number
    let matchingRecords = [];
    if (s.report_number) {
      const scopedKey = `${s.component_id}_${tCode}_${String(s.report_number).trim().toUpperCase()}`;
      matchingRecords = recordsByScopedKey.get(scopedKey) || [];
    }
    // If no scoped match, fallback to generic component + task
    if (matchingRecords.length === 0) {
      const genKey = `${s.component_id}_${tCode}`;
      matchingRecords = recordsByGenericKey.get(genKey) || [];
    }

    const realCount = matchingRecords.length;
    const currentStatus = String(s.status || '').toLowerCase();
    const currentCount = Number(s.inspection_count || 0);

    let targetStatus = 'pending';
    let targetCount = 0;
    let targetDate = null;

    if (realCount === 0) {
      targetStatus = 'pending';
      targetCount = 0;
      targetDate = null;
    } else {
      targetCount = realCount;
      const allIncomp = matchingRecords.every(r => String(r.status).toUpperCase() === 'INCOMPLETE');
      targetStatus = allIncomp ? 'incomplete' : 'completed';
      // Find latest date
      const sortedDates = matchingRecords.map(r => r.inspection_date).filter(Boolean).sort().reverse();
      targetDate = sortedDates[0] || null;
    }

    const statusDiff = currentStatus !== targetStatus;
    const countDiff = currentCount !== targetCount;

    if (statusDiff || countDiff) {
      inconsistentSowItems.push({
        item: s,
        targetStatus,
        targetCount,
        targetDate,
        reason: realCount === 0
          ? `Status is '${s.status}', count is ${currentCount}, but 0 matching insp_records exist -> reset to pending`
          : `Current status '${s.status}' (count ${currentCount}) -> should be '${targetStatus}' (count ${targetCount})`
      });
    }
  });

  console.log(`Total SOW items: ${allSowItems.length} | Inconsistent SOW items: ${inconsistentSowItems.length}`);

  console.log(`\n----------------- SUMMARY OF DETECTED ISSUES -----------------`);
  console.log(`• Orphaned Anomalies:     ${orphanedAnomalies.length}`);
  console.log(`• Orphaned Attachments:   ${orphanedAttachments.length}`);
  console.log(`• Orphaned Media:         ${orphanedMedia.length}`);
  console.log(`• Orphaned Video Log refs: ${orphanedVideoLogs.length}`);
  console.log(`• Inconsistent SOW Items: ${inconsistentSowItems.length}`);
  console.log(`--------------------------------------------------------------\n`);

  if (!isFixMode) {
    if (orphanedAnomalies.length > 0) {
      console.log('Sample Orphaned Anomalies:');
      orphanedAnomalies.slice(0, 5).forEach(a => console.log(`  - [ID ${a.anomaly_id}] Ref: ${a.anomaly_ref_no}, deleted inspection_id: ${a.inspection_id}`));
    }
    if (orphanedAttachments.length > 0) {
      console.log('Sample Orphaned Attachments:');
      orphanedAttachments.slice(0, 5).forEach(a => console.log(`  - [ID ${a.id}] Type: ${a.source_type}, Source ID: ${a.source_id}, Path: ${a.path}`));
    }
    if (inconsistentSowItems.length > 0) {
      console.log('Sample Inconsistent SOW Items:');
      inconsistentSowItems.slice(0, 5).forEach(({ item, reason }) => console.log(`  - [SOW Item ID ${item.id}] Component: ${item.component_qid || item.component_id}, Task: ${item.inspection_code} => ${reason}`));
    }
    console.log(`\nTo automatically clean up and synchronize these records, run:`);
    console.log(`node scripts/cleanup-orphaned-records.js --fix\n`);
    return;
  }

  // ===================== EXECUTE CLEANUP =====================
  console.log(`Starting cleanup operations...\n`);

  // 1. Delete Orphaned Attachments from Storage & DB
  if (orphanedAttachments.length > 0) {
    console.log(`Cleaning ${orphanedAttachments.length} orphaned attachments...`);
    // Only remove cloud paths (exclude local Windows paths like U:\...)
    const cloudStoragePaths = orphanedAttachments
      .map(a => a.path)
      .filter(p => p && !p.includes(':\\') && !p.startsWith('\\'));
    if (cloudStoragePaths.length > 0) {
      const { error: storageErr } = await supabase.storage.from('attachments').remove(cloudStoragePaths);
      if (storageErr) console.warn("  Warning removing files from 'attachments' storage:", storageErr.message);
    }
    const attIds = orphanedAttachments.map(a => a.id);
    for (let i = 0; i < attIds.length; i += 100) {
      const chunk = attIds.slice(i, i + 100);
      const { error } = await supabase.from('attachment').delete().in('id', chunk);
      if (error) console.error("  Error deleting attachment rows:", error.message);
    }
    console.log(`  ✅ Cleaned ${orphanedAttachments.length} attachments.`);
  }

  // 2. Delete Orphaned Media from Storage & DB
  if (orphanedMedia.length > 0) {
    console.log(`Cleaning ${orphanedMedia.length} orphaned media entries...`);
    const mediaPaths = [];
    orphanedMedia.forEach(m => {
      if (m.file_path && !m.file_path.includes(':\\')) mediaPaths.push(m.file_path);
      if (m.thumbnail_path && !m.thumbnail_path.includes(':\\')) mediaPaths.push(m.thumbnail_path);
    });
    if (mediaPaths.length > 0) {
      await supabase.storage.from('inspection-media').remove(mediaPaths);
      await supabase.storage.from('attachments').remove(mediaPaths);
    }
    const mediaIds = orphanedMedia.map(m => m.media_id);
    for (let i = 0; i < mediaIds.length; i += 100) {
      const chunk = mediaIds.slice(i, i + 100);
      await supabase.from('insp_media').delete().in('media_id', chunk);
    }
    console.log(`  ✅ Cleaned ${orphanedMedia.length} insp_media entries.`);
  }

  // 3. Delete Orphaned Video Log Links
  if (orphanedVideoLogs.length > 0) {
    console.log(`Nullifying ${orphanedVideoLogs.length} orphaned video log links...`);
    const logIds = orphanedVideoLogs.map(l => l.video_log_id);
    for (let i = 0; i < logIds.length; i += 100) {
      const chunk = logIds.slice(i, i + 100);
      await supabase.from('insp_video_logs').update({ inspection_id: null }).in('video_log_id', chunk);
    }
    console.log(`  ✅ Cleaned ${orphanedVideoLogs.length} video log links.`);
  }

  // 4. Delete Orphaned Anomalies
  if (orphanedAnomalies.length > 0) {
    console.log(`Cleaning ${orphanedAnomalies.length} orphaned anomalies...`);
    const anomIds = orphanedAnomalies.map(a => a.anomaly_id);
    for (let i = 0; i < anomIds.length; i += 100) {
      const chunk = anomIds.slice(i, i + 100);
      const { error } = await supabase.from('insp_anomalies').delete().in('anomaly_id', chunk);
      if (error) console.error("  Error deleting anomalies:", error.message);
    }
    console.log(`  ✅ Cleaned ${orphanedAnomalies.length} orphaned anomalies.`);
  }

  // 5. Correct Inconsistent SOW Items
  if (inconsistentSowItems.length > 0) {
    console.log(`Correcting ${inconsistentSowItems.length} inconsistent SOW items...`);
    const affectedSowIds = new Set();

    for (let i = 0; i < inconsistentSowItems.length; i++) {
      const { item, targetStatus, targetCount, targetDate } = inconsistentSowItems[i];
      if (item.sow_id) affectedSowIds.add(item.sow_id);

      const updatePayload = {
        status: targetStatus,
        inspection_count: targetCount,
        last_inspection_date: targetDate,
        updated_at: new Date().toISOString()
      };

      if (targetCount === 0 && item.elevation_required && Array.isArray(item.elevation_data)) {
        updatePayload.elevation_data = item.elevation_data.map(elev => ({
          ...elev,
          status: 'pending'
        }));
      }

      const { error: updErr } = await supabase.from('u_sow_items').update(updatePayload).eq('id', item.id);
      if (updErr) {
        console.error(`  ⚠️ Failed to update SOW item ${item.id}:`, updErr.message);
      }
      if ((i + 1) % 500 === 0 || i + 1 === inconsistentSowItems.length) {
        console.log(`  Progress: ${i + 1}/${inconsistentSowItems.length} SOW items updated...`);
      }
    }

    // 6. Recalculate parent u_sow totals for affected SOW IDs
    console.log(`Recalculating parent u_sow totals for ${affectedSowIds.size} SOW scopes...`);
    for (const sId of affectedSowIds) {
      if (!sId) continue;
      const { data: refreshedItems } = await supabase
        .from('u_sow_items')
        .select('status')
        .eq('sow_id', sId);

      if (refreshedItems) {
        const totalItems = refreshedItems.length;
        const completedItems = refreshedItems.filter(i => i.status === 'completed').length;
        const incompleteItems = refreshedItems.filter(i => i.status === 'incomplete').length;
        const pendingItems = refreshedItems.filter(i => i.status === 'pending').length;

        await supabase
          .from('u_sow')
          .update({
            total_items: totalItems,
            completed_items: completedItems,
            incomplete_items: incompleteItems,
            pending_items: pendingItems,
            updated_at: new Date().toISOString()
          })
          .eq('id', sId);
      }
    }
    console.log(`  ✅ Corrected ${inconsistentSowItems.length} SOW items and refreshed parent totals.`);
  }

  console.log(`\n🎉 All cleanup and synchronization tasks completed successfully!\n`);
}

main().catch(err => {
  console.error("Unhandled error during cleanup:", err);
  process.exit(1);
});
