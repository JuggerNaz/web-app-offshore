require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data: insps, error } = await supabase
    .from("insp_records")
    .select(`
        *,
        structure_components:component_id!left (
            id,
            q_id, 
            code,
            metadata
        )
    `);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const rscorRecords = insps.filter(r => {
    const typeCode = (r.inspection_type_code || '').toUpperCase();
    return typeCode === 'RSCOR' || typeCode === 'SCOUR';
  });

  console.log(`Found ${rscorRecords.length} RSCOR/SCOUR records across all structures:`);
  rscorRecords.forEach(r => {
    console.log({
      insp_id: r.insp_id,
      structure_id: r.structure_id,
      jobpack_id: r.jobpack_id,
      qid: r.structure_components?.q_id,
      scour_location: r.inspection_data?.scour_location,
      scour_depth: r.inspection_data?.scour_depth,
      description: r.description
    });
  });
}

run();
