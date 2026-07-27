const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  try {
    const { data, error } = await supabase
      .from('report_aliases')
      .select('*');

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    console.log("Current report aliases in DB:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
