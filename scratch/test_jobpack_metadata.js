// Test querying all jobpacks with metadata to measure payload size and query speed
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log("=== Testing Jobpacks Query with Metadata ===");
  const start = Date.now();
  
  const { data, error } = await supabase
    .from('jobpack')
    .select('id, name, metadata, mgi_profile_id');

  const duration = Date.now() - start;
  
  if (error) {
    console.error("Query failed:", error.message);
  } else {
    const size = JSON.stringify(data).length;
    console.log(`Query succeeded in ${duration}ms.`);
    console.log(`Total size of data: ${(size / 1024 / 1024).toFixed(2)} MB`);
    
    // Check some metadata sizes
    let totalMetadataSize = 0;
    data.forEach(jp => {
      if (jp.metadata) totalMetadataSize += JSON.stringify(jp.metadata).length;
    });
    console.log(`Total metadata size: ${(totalMetadataSize / 1024 / 1024).toFixed(2)} MB`);
  }
}

main().catch(console.error);
