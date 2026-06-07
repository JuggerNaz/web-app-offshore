const { Client } = require('pg');
const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function test() {
  console.log('Connecting to local Supabase PG...');
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('SUCCESSFULLY CONNECTED TO LOCAL DB!');
    
    console.log('Querying pg_policies for jobpack table...');
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename = 'jobpack';
    `);
    console.log('Policies count:', res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));

    console.log('Checking row level security status for jobpack...');
    const resRLS = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity 
      FROM pg_class 
      WHERE relname = 'jobpack';
    `);
    console.log('RLS Status:', resRLS.rows);

    await client.end();
  } catch (err) {
    console.error('Connection to local DB failed:', err);
  }
}

test();
