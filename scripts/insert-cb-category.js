const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(url, key);

async function run() {
  console.log('Checking if CB already exists...');
  const { data: existing, error: fetchErr } = await supabase
    .from('components')
    .select('*')
    .ilike('code', 'CB');

  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
  } else {
    console.log('Existing entries for CB:', existing);
  }

  if (existing && existing.length > 0) {
    console.log('Updating existing CB record...');
    const { data: updated, error: updateErr } = await supabase
      .from('components')
      .update({
        name: 'CONDUCTOR / CAISSON GUIDES',
        descrip: 'conductor guide bucket',
        plat: 1,
        pipe: 0,
        is_active: true,
        comp_ico: 'comp_others.ico',
        brdg: 0,
        sbm: 0,
        tank: 0
      })
      .eq('id', existing[0].id)
      .select();

    if (updateErr) {
      console.error('Update error:', updateErr);
    } else {
      console.log('Updated successfully:', updated);
    }
  } else {
    console.log('Inserting new CB record...');
    const { data: inserted, error: insertErr } = await supabase
      .from('components')
      .insert({
        name: 'CONDUCTOR / CAISSON GUIDES',
        code: 'CB',
        descrip: 'conductor guide bucket',
        plat: 1,
        pipe: 0,
        is_active: true,
        comp_ico: 'comp_others.ico',
        brdg: 0,
        sbm: 0,
        tank: 0
      })
      .select();

    if (insertErr) {
      console.error('Insert error:', insertErr);
    } else {
      console.log('Inserted successfully:', inserted);
    }
  }
}

run().catch(console.error);
