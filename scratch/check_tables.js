
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase.rpc('get_tables'); // Hope this exists or I can use another way
  
  if (error) {
    // Fallback: try to query some likely names
    const likely = ['attachment', 'insp_media', 'insp_findings', 'insp_anomalies', 'insp_video_logs'];
    for (const table of likely) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        console.log(`Table ${table} count: ${count}`);
    }
  } else {
    console.log("Tables:", data);
  }
}

checkTables();
