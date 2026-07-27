const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  let dbUrl = '';
  envContent.split('\n').forEach(line => {
    if (line.trim().startsWith('DATABASE_URL=')) {
      dbUrl = line.trim().split('=')[1].trim();
      if ((dbUrl.startsWith('"') && dbUrl.endsWith('"')) || (dbUrl.startsWith("'") && dbUrl.endsWith("'"))) {
        dbUrl = dbUrl.slice(1, -1);
      }
    }
  });

  console.log('Database URL parsed length:', dbUrl.length);
  // Parse connection string manually to ensure password is string
  const urlObj = new URL(dbUrl);

  const client = new Client({
    host: urlObj.hostname,
    port: urlObj.port || 5432,
    user: decodeURIComponent(urlObj.username),
    password: decodeURIComponent(urlObj.password),
    database: urlObj.pathname.replace(/^\//, ''),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected successfully to Postgres database!');

  // Query table existence and info for u_obj3d_param
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%obj3d%';
  `);
  console.log('Tables matching %obj3d%:', res.rows);

  const allUTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE 'u_%'
    ORDER BY table_name;
  `);
  console.log('All u_* tables in database:', allUTables.rows.map(r => r.table_name));

  // Check columns of u_obj3d_param if it exists
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'u_obj3d_param'
    ORDER BY ordinal_position;
  `);
  console.log('\n=== COLUMNS OF u_obj3d_param ===');
  console.log(cols.rows);

  // Check row count and sample rows if any
  const count = await client.query(`SELECT COUNT(*) FROM u_obj3d_param;`);
  console.log('\nTotal rows in u_obj3d_param:', count.rows[0].count);

  if (parseInt(count.rows[0].count) > 0) {
    const sample = await client.query(`SELECT * FROM u_obj3d_param LIMIT 5;`);
    console.log('\nSample rows:', sample.rows);
  }

  await client.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
