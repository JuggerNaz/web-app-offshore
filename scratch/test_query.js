const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing overallLatestTape query...');
  const { data, error } = await supabase
    .from('insp_video_tapes')
    .select('tape_no, chapter_no')
    .order('tape_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Query 1 Error:', error);
  } else {
    console.log('Query 1 Success:', data);
    
    if (data) {
      console.log('Testing latestTapeForNo query...');
      const { data: data2, error: error2 } = await supabase
        .from('insp_video_tapes')
        .select('chapter_no')
        .eq('tape_no', data.tape_no)
        .order('chapter_no', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error2) {
        console.error('Query 2 Error:', error2);
      } else {
        console.log('Query 2 Success:', data2);
      }
    }
  }
}

run();
