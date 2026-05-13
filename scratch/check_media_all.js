
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllMedia() {
  const { count, error } = await supabase
    .from('insp_media')
    .select('*', { count: 'exact', head: true });
    
  console.log("Total insp_media count:", count);
  
  const { data: samples } = await supabase
    .from('insp_media')
    .select('media_id, inspection_id, name, file_path')
    .limit(5);
    
  console.log("Samples:", JSON.stringify(samples, null, 2));
}

checkAllMedia();
