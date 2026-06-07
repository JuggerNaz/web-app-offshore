const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbUrlMatch = envContent.match(/^\s*DATABASE_URL\s*=\s*(.*)/m);
const databaseUrl = dbUrlMatch ? dbUrlMatch[1].trim() : null;

if (!databaseUrl) {
  console.error("No DATABASE_URL found in .env.local!");
  process.exit(1);
}

const client = new Client({ connectionString: databaseUrl });

async function run() {
  await client.connect();
  console.log("Connected to PG. Checking column nullability for insp_records.component_id...");

  const res = await client.query(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'insp_records' AND column_name = 'component_id'
  `);

  console.log("Column Details:", res.rows);
  await client.end();
}

run().catch(console.error);
