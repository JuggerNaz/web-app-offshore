require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: insps, error } = await supabase
    .from("insp_records")
    .select(`
        *,
        structure_components:component_id!left (
            id,
            q_id, 
            code,
            metadata
        )
    `)
    .eq("structure_id", 234)
    .eq("jobpack_id", 591);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const rscorRecords = insps.filter(r => {
    const typeCode = (r.inspection_type_code || '').toUpperCase();
    return typeCode === 'RSCOR' || typeCode === 'SCOUR';
  });

  const groupedMap = new Map();
  rscorRecords.forEach(r => {
    const qid = r.structure_components?.q_id || 'Unknown';
    if (!groupedMap.has(qid)) groupedMap.set(qid, []);
    groupedMap.get(qid).push(r);
  });

  groupedMap.forEach((compRecordsRaw, qid) => {
    console.log(`\n=================== COMPONENT: ${qid} ===================`);
    const compData = compRecordsRaw[0]?.structure_components || {};

    const foundLegNames = [];
    compRecordsRaw.forEach(r => {
      const loc = (r.inspection_data?.scour_location || '').toLowerCase();
      if (loc.includes('leg') && loc.includes(':')) {
        const parts = loc.split(':');
        const name = parts[1].trim();
        if (name && !foundLegNames.includes(name)) foundLegNames.push(name);
      } else if (loc.includes('leg')) {
        const match = loc.match(/leg\s+([a-zA-Z0-9]+)/);
        if (match && !foundLegNames.includes(match[1])) foundLegNames.push(match[1]);
      }
    });

    const leg1 = (compData.startLeg || compData.metadata?.s_leg || (foundLegNames[0] || '')).toUpperCase();
    const leg2 = (compData.endLeg || compData.metadata?.f_leg || (foundLegNames[1] || '')).toUpperCase();
    console.log(`Leg1: "${leg1}", Leg2: "${leg2}", foundLegNames:`, foundLegNames);

    const consolidatedMap = new Map();
    compRecordsRaw.forEach(r => {
      const rd = r.inspection_data || {};
      const locTag = (rd.scour_location || '').toLowerCase();
      const depth = parseFloat(rd.scour_depth || '0');
      
      let key = 'mid';
      if (locTag.includes('start') || (leg1 && locTag.includes(leg1.toLowerCase()))) {
        key = 'start';
      } else if (locTag.includes('end') || (leg2 && locTag.includes(leg2.toLowerCase()))) {
        key = 'end';
      }

      console.log(`Record insp_id: ${r.insp_id}, locTag: "${locTag}", key resolved: "${key}", depth: ${depth}`);
      
      const existing = consolidatedMap.get(key);
      if (!existing) {
        consolidatedMap.set(key, r);
      } else {
        const existingDepth = parseFloat(existing.inspection_data?.scour_depth || '0');
        const existingIsAnom = existing.has_anomaly || (existing.insp_anomalies && existing.insp_anomalies.length > 0);
        const currentIsAnom = r.has_anomaly || (r.insp_anomalies && r.insp_anomalies.length > 0);
        
        if (isNaN(existingDepth) || depth > existingDepth || (depth === existingDepth && currentIsAnom && !existingIsAnom)) {
          consolidatedMap.set(key, r);
        }
      }
    });

    console.log('Consolidated displayRecords keys:');
    const compRecords = [];
    if (consolidatedMap.has('start')) compRecords.push(consolidatedMap.get('start'));
    if (consolidatedMap.has('mid')) compRecords.push(consolidatedMap.get('mid'));
    if (consolidatedMap.has('end')) compRecords.push(consolidatedMap.get('end'));

    compRecords.forEach(r => {
      console.log(`  -> Key: ${r.inspection_data?.scour_location || 'N/A'}, Depth: ${r.inspection_data?.scour_depth}`);
    });
  });
}

run();
