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

async function checkSchema() {
  const { data: queryData, error: queryErr } = await supabase
    .from('insp_video_tapes')
    .select('*')
    .limit(1);
  
  if (queryErr) {
    console.error('Query Error:', queryErr);
    return;
  }

  if (queryData && queryData.length > 0) {
    console.log('Columns and their JS types in returned row:');
    Object.keys(queryData[0]).forEach(k => {
      console.log(`- ${k}: ${typeof queryData[0][k]} (Value: ${queryData[0][k]})`);
    });
  } else {
    console.log('No rows in insp_video_tapes to inspect types.');
  }
}

checkSchema();
