const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.substring(0, idx).trim();
          let value = trimmed.substring(idx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
          if (key === 'DATABASE_URL') {
            databaseUrl = value;
          }
        }
      }
    });
  } catch (e) {
    console.log('No .env.local found:', e.message);
  }
}

if (!databaseUrl) {
  databaseUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
}

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    const res = await client.query(`
      SELECT schemaname, tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime';
    `);
    console.log("Tables in supabase_realtime publication:");
    console.table(res.rows);
    
    await client.end();
  } catch (err) {
    console.error(err);
    try { await client.end(); } catch(e) {}
  }
}

run();
