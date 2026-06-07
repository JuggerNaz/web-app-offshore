const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables from .env.local
let supabaseUrl, supabaseKey;
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseKey = keyMatch[1].trim();
} catch (e) {}

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function peekDb() {
  try {
    console.log("Connected to Supabase at:", supabaseUrl);

    // Query list of structures in structure table
    console.log("\n👀 Peeking at 'structure' table rows:");
    const { data: structures, error: structErr } = await supabase
      .from("structure")
      .select("*")
      .limit(5);
    
    if (structErr) {
      console.error("Error reading structures:", structErr.message);
    } else {
      console.table(structures);
    }

    // 2. Query count and sample rows of insp_video_logs
    console.log("\n📊 Columns and rows of 'insp_video_logs':");
    const { count, error: countErr } = await supabase
      .from("insp_video_logs")
      .select("*", { count: 'exact', head: true });
    
    if (countErr) {
      console.error("Error reading count:", countErr.message);
    } else {
      console.log(`Total rows in 'insp_video_logs': ${count}`);
    }

    const { data: logs, error: logErr } = await supabase
      .from("insp_video_logs")
      .select("*")
      .order("video_log_id", { ascending: false })
      .limit(5);
    
    if (logErr) {
      console.error("Error reading logs:", logErr.message);
    } else {
      console.table(logs);
    }

  } catch (err) {
    console.error("Error peeking database:", err.message);
  }
}

peekDb();
