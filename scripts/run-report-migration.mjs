import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  const sql = fs.readFileSync(path.resolve(process.cwd(), 'scripts/create-report-templates-table.sql'), 'utf8');
  
  console.log('Attempting to run migration via RPC...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Migration failed via RPC. You might need to run the SQL manually in Supabase Dashboard.');
    console.error('Error:', error.message);
    console.log('\n--- SQL TO RUN MANUALLY ---\n');
    console.log(sql);
    console.log('\n---------------------------\n');
  } else {
    console.log('Migration completed successfully.');
  }
}

runMigration();
