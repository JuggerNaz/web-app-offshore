require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('defect_criteria_rules')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching rule:', error);
  } else {
    console.log('Sample rule columns:', data.length > 0 ? Object.keys(data[0]) : 'No rules in table');
  }
}
run();
