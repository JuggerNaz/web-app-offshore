const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- Checking str_elv table ---');
  const { data: elvData, error: elvError } = await supabase
    .from('str_elv')
    .select('*')
    .eq('plat_id', 1061);
  
  if (elvError) {
    console.error('str_elv Error:', elvError);
  } else {
    console.log('str_elv Success, rows found:', elvData.length);
  }

  console.log('\n--- Checking comment table ---');
  const { data: commentData, error: commentError } = await supabase
    .from('comment')
    .select('*')
    .eq('structure_id', 1061)
    .eq('structure_type', 'platform');
  
  if (commentError) {
    console.error('comment Error:', commentError);
  } else {
    console.log('comment Success, rows found:', commentData.length);
  }
}

check();
