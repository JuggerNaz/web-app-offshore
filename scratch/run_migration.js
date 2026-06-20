const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const client = new Client({ connectionString });

  const migrationSql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260616_add_login_scheduling.sql'),
    'utf8'
  );

  console.log("Connecting to local database on 54322...");
  await client.connect();
  console.log("Connected! Executing migration SQL...");
  await client.query(migrationSql);
  console.log("Migration executed successfully!");
  await client.end();
}

main().catch(e => {
  console.error("Migration execution failed:", e.message);
  process.exit(1);
});
