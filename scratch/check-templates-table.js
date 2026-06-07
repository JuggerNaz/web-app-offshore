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

async function checkTable(tableName) {
  console.log(`Checking columns for ${tableName}...`);
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  
  if (error) {
    console.error(`Error reading ${tableName}:`, error);
  } else {
    console.log(`Sample ${tableName} row keys:`, data.length > 0 ? Object.keys(data[0]) : 'Table is empty');
    if (data.length > 0) {
      console.log('Sample data:', data[0]);
    }
  }
}

checkTable('report_templates');
