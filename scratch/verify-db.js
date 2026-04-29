const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verify() {
  console.log('Fetching columns for u_sow_items...');
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'u_sow_items' });
  
  if (error) {
    console.error('Error with RPC:', error);
    
    // Fallback: Just read one item from u_sow_items
    console.log('Falling back to reading one row from u_sow_items...');
    const { data: rowData, error: rowErr } = await supabase
      .from('u_sow_items')
      .select('*')
      .limit(1);
      
    if (rowErr) {
      console.error('Error reading u_sow_items:', rowErr);
    } else {
      console.log('Sample u_sow_items row keys:', rowData.length > 0 ? Object.keys(rowData[0]) : 'Table is empty');
      if (rowData.length > 0) {
        console.log('Sample data:', rowData[0]);
      }
    }
  } else {
    console.log('Columns:', data);
  }
}

verify();
