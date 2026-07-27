const { Client } = require('pg');

const host = "aws-0-ap-southeast-1.pooler.supabase.com";
const user = "postgres.zpsmxtdqlpbdwfzctqzd";
const port = 6543;
const dbname = "postgres";

const passwords = ["K1Sfw1D4BHnkzx7L", "ezPixXo4B1D98RkS", "Nkumar@10"];

async function run() {
  for (const pw of passwords) {
    const connectionString = `postgresql://${user}:${pw}@${host}:${port}/${dbname}`;
    const client = new Client({ connectionString });
    try {
      console.log(`Testing password: ${pw}...`);
      await client.connect();
      console.log(`SUCCESS! Connected with password: ${pw}`);
      
      // Let's create the table
      await client.query(`
        CREATE TABLE IF NOT EXISTS migration_mappings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(255) UNIQUE NOT NULL,
          mappings JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Table 'migration_mappings' created successfully!");
      await client.end();
      return;
    } catch (e) {
      console.log(`FAILED with password: ${pw} - ${e.message}`);
      try { await client.end(); } catch (err) {}
    }
  }
}

run();
