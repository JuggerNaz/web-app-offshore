const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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

async function main() {
  console.log("Fetching migrated tapes for tape '015/03/R01' to verify dynamic chapter sequences:");
  const { data: tapes, error: tapeErr } = await supabase
    .from("insp_video_tapes")
    .select("tape_id, tape_no, chapter_no, tape_type, status, rov_job_id, dive_job_id")
    .eq("tape_no", "015/03/R01")
    .order("chapter_no", { ascending: true });

  if (tapeErr) {
    console.error("Error reading tapes:", tapeErr.message);
  } else {
    console.table(tapes);
    console.log(`Total chapter rows migrated for tape '015/03/R01': ${tapes.length}`);
  }
}

main().catch(console.error);
