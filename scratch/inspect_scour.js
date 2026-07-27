const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  try {
    const { data, error } = await supabase
      .from('insp_records')
      .select('inspection_data, inspection_type_code')
      .or("inspection_type_code.eq.RSCOR,inspection_type_code.eq.SCOUR")
      .limit(10);

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    console.log("Found", data.length, "scour records.");
    data.forEach((record, idx) => {
      console.log(`\nRecord ${idx + 1} inspection_data keys:`);
      Object.keys(record.inspection_data || {}).forEach(k => {
        console.log(` - ${k}: ${record.inspection_data[k]}`);
      });
    });
  } catch (err) {
    console.error(err);
  }
}

main();
