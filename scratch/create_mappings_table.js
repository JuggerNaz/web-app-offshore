require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is missing in environment!");
  process.exit(1);
}

async function run() {
  console.log("Connecting to PostgreSQL...");
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    console.log("Creating migration_mappings table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS migration_mappings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        mappings JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log("Table created successfully!");
    
    // Verify it exists
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'migration_mappings';
    `);
    console.log("Verification:", res.rows);
    
    await client.end();
  } catch (err) {
    console.error("Failed to run SQL:", err);
    try { await client.end(); } catch(e) {}
  }
}

run();
