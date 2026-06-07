require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  try {
    console.log('Fetching all SOWs from PostgreSQL...');
    const { data: sows, error: sowErr } = await supabase
      .from('u_sow')
      .select('id, jobpack_id, structure_id, report_numbers');

    if (sowErr) {
      console.error('Failed to fetch sows:', sowErr);
      return;
    }

    console.log(`Found ${sows?.length || 0} SOW record(s).`);

    for (const sow of sows) {
      const jpId = sow.jobpack_id;
      const strId = sow.structure_id;
      const reportNumbers = sow.report_numbers || [];
      if (reportNumbers.length === 0) continue;

      // Extract the primary SOW report number
      const sowRepNo = reportNumbers[0]?.number;
      if (!sowRepNo) continue;

      console.log(`Processing SOW ${sow.id} (Jobpack: ${jpId}, Structure: ${strId}) -> sow_report_no: "${sowRepNo}"`);

      // 1. Update insp_records
      const { data: recUpdate, error: recErr } = await supabase
        .from('insp_records')
        .update({ sow_report_no: sowRepNo })
        .eq('jobpack_id', jpId)
        .eq('structure_id', strId)
        .or('sow_report_no.is.null,sow_report_no.eq.""');

      if (recErr) {
        console.error(`  Error updating insp_records:`, recErr.message);
      } else {
        console.log(`  Updated insp_records successfully.`);
      }

      // 2. Update insp_rov_jobs
      const { error: rovErr } = await supabase
        .from('insp_rov_jobs')
        .update({ sow_report_no: sowRepNo })
        .eq('jobpack_id', jpId)
        .eq('structure_id', strId)
        .or('sow_report_no.is.null,sow_report_no.eq.""');

      if (rovErr) {
        console.error(`  Error updating insp_rov_jobs:`, rovErr.message);
      } else {
        console.log(`  Updated insp_rov_jobs successfully.`);
      }

      // 3. Update insp_dive_jobs
      const { error: diveErr } = await supabase
        .from('insp_dive_jobs')
        .update({ sow_report_no: sowRepNo })
        .eq('jobpack_id', jpId)
        .eq('structure_id', strId)
        .or('sow_report_no.is.null,sow_report_no.eq.""');

      if (diveErr) {
        console.error(`  Error updating insp_dive_jobs:`, diveErr.message);
      } else {
        console.log(`  Updated insp_dive_jobs successfully.`);
      }

      // 4. Update insp_anomalies
      // Check if table insp_anomalies has jobpack_id/structure_id columns
      const { error: anomErr } = await supabase
        .from('insp_anomalies')
        .update({ sow_report_no: sowRepNo })
        .eq('jobpack_id', jpId)
        .eq('structure_id', strId)
        .or('sow_report_no.is.null,sow_report_no.eq.""');

      if (anomErr) {
        // If columns do not exist directly, try updating via join/subquery or ignore
        console.log(`  Skipped/failed direct update of insp_anomalies: ${anomErr.message}`);
      } else {
        console.log(`  Updated insp_anomalies successfully.`);
      }
    }

    console.log('Database SOW update finished successfully!');
  } catch (err) {
    console.error('Error running fix:', err);
  }
}

run();
