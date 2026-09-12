const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function test() {
  console.log('1. Checking JSON configs...');
  const uiConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'utils', 'spec-ui-config.json'), 'utf8'));
  const addDetails = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'utils', 'spec-additional-details.json'), 'utf8'));

  const cbUi = uiConfig.components.find(c => c.code === 'cb');
  const cbAdd = addDetails.data.find(c => c.code === 'cb');

  console.log('cbUi found:', !!cbUi, JSON.stringify(cbUi));
  console.log('cbAdd found:', !!cbAdd, JSON.stringify(cbAdd));

  if (!cbUi || !cbAdd) {
    throw new Error('Config missing for cb');
  }

  console.log('2. Checking Supabase components query for plat = 1 and is_active = true...');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
  const sb = createClient(url, key);

  const { data, error } = await sb
    .from('components')
    .select('id, name, code, descrip, is_active, plat, pipe')
    .eq('is_active', true)
    .neq('code', 'WD')
    .order('name');

  if (error) {
    console.error('Supabase query error:', error);
  } else {
    const cbEntry = data.find(c => c.code === 'CB');
    console.log('Found CB in components API query:', cbEntry);
  }
}

test().catch(console.error);
