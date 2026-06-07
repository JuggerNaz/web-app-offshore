const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPolicies() {
  console.log('Fetching policies from pg_policies...');
  // We can execute raw sql query via standard RPC if available, or fetch system info
  // Let's check if there's any RPC to execute SQL or get policies
  const { data, error } = await supabase.rpc('execute_sql', { 
    sql_query: "SELECT * FROM pg_policies WHERE tablename = 'insp_video_tapes'" 
  });
  
  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('Policies:', data);
  }
}

checkPolicies();
