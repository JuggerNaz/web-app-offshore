require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Fetching attachments...");
  const { data: attachments, error } = await supabase
    .from('attachment')
    .select('*')
    .eq('source_id', 44) // Let's check structure 44 (PLAT-C) or all structure attachments
    .limit(10);

  if (error) {
    console.error(error);
  } else {
    console.log("Attachments found:", attachments.map(a => ({
      id: a.id,
      name: a.name,
      source_id: a.source_id,
      source_type: a.source_type,
      is_deleted: a.is_deleted
    })));
  }

  // Let's also query all attachments with source_type containing 'structure'
  const { data: structAtts } = await supabase
    .from('attachment')
    .select('*')
    .ilike('source_type', '%structure%')
    .limit(10);
  console.log("Structure Attachments:", structAtts.map(a => ({
    id: a.id,
    name: a.name,
    source_id: a.source_id,
    source_type: a.source_type,
    is_deleted: a.is_deleted,
    meta: a.meta
  })));
}

run();
