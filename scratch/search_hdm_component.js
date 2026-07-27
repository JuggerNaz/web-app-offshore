require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const targetQids = ["HDM N178-N185", "HDM N178-N186", "HDM N183-N185", "HDM N478-N532", "HDM N182-N187", "HDM N492-N500", "VEM N188-N235", "HDM N481-N579", "VEM N50-N97", "HDM N479-N482", "VDM N473-N478", "VDM N105-N184", "VDM N104-N183", "VDM N179-N193", "WN N93", "WN N99", "WN N238", "CON011", "CGF010-42M", "VEM N489-N577"];
  
  const { data, error } = await supabase
    .from('structure_components')
    .select('id, q_id, structure_id, company_id, metadata')
    .in('q_id', targetQids);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Found ${data?.length || 0} components:`);
  data.forEach(c => {
    console.log(`QID: ${c.q_id}, Structure ID: ${c.structure_id}, elv_1: ${c.metadata?.elv_1}, elv_2: ${c.metadata?.elv_2}`);
  });
}

run();
