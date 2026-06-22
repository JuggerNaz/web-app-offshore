const { Client } = require('pg');

const passwords = ["password123", "Nkumar@10", "K1Sfw1D4BHnkzx7L", "ezPixXo4B1D98RkS"];
const host = "aws-0-ap-southeast-1.pooler.supabase.com";
const port = 6543;
const user = "postgres.zpsmxtdqlpbdwfzctqzd";
const database = "postgres";

async function testPasswords() {
  for (const pw of passwords) {
    const connectionString = `postgresql://${user}:${pw}@${host}:${port}/${database}`;
    console.log(`Testing password: ${pw}`);
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`SUCCESS! Connected with password: ${pw}`);
      await client.end();
      return;
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }
}

testPasswords();
