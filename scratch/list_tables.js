const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  const fs = require('fs');
  const path = require('path');
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const dbUrlMatch = envContent.match(/DATABASE_URL=(.*)/);
  if (dbUrlMatch) {
    databaseUrl = dbUrlMatch[1].trim();
  }
}

// Strip comment if needed
if (databaseUrl && databaseUrl.startsWith('#')) {
  databaseUrl = databaseUrl.substring(1).trim();
}

// Use hardcoded pass if needed or prompt
const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  console.log("Tables:");
  res.rows.forEach(r => console.log(` - ${r.table_name}`));
  await client.end();
}

main().catch(console.error);
