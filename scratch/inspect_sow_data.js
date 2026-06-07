const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSow() {
  try {
    const jobpackId = 320;
    const structureId = 260;

    // Fetch u_sow
    const { data: sows, error: sowErr } = await supabase
      .from('u_sow')
      .select('*')
      .eq('jobpack_id', jobpackId)
      .eq('structure_id', structureId);
    
    console.log('--- SOWs ---');
    console.log(JSON.stringify(sows, null, 2), sowErr);

    // Fetch u_sow_items
    const { data: sowItems, error: itemsErr } = await supabase
      .from('u_sow_items')
      .select('sow_item_id, code, metadata')
      .eq('jobpack_id', jobpackId)
      .limit(5);

    console.log('--- SOW Items ---');
    console.log(sowItems, itemsErr);

    // Inspect job_vessel, workpl dates and report numbers in Oracle via executing query on migration endpoint?
    // Actually we can query what is in Postgres u_sow and insp_records

  } catch (err) {
    console.error(err);
  }
}

inspectSow();
