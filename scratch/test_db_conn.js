const { Client } = require('pg');

const connectionString = 'postgresql://postgres.zpsmxtdqlpbdwfzctqzd:yourpassword@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

async function test() {
  console.log('Connecting to Supabase PG with pooler URL...');
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('SUCCESSFULLY CONNECTED!');
    
    console.log('Querying pg_policies...');
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename IN ('str_elv', 'comment');
    `);
    console.log('Policies:');
    console.log(JSON.stringify(res.rows, null, 2));

    console.log('Checking table description of str_elv...');
    const resElvCols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'str_elv';
    `);
    console.log('Columns:');
    console.log(resElvCols.rows);

    await client.end();
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

test();
