const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  try {
    const { data: record, error } = await supabase
      .from('insp_records')
      .select('insp_id, inspection_data')
      .eq('insp_id', 490)
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    console.log("Record 490 inspection_data keys:");
    Object.keys(record.inspection_data).forEach(k => {
      console.log(` - ${k}: ${typeof record.inspection_data[k]} = ${record.inspection_data[k]}`);
    });
  } catch (err) {
    console.error(err);
  }
}

main();
