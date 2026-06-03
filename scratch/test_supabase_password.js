const { Client } = require('pg');

const passwords = ["password123", "Nkumar@10", "K1Sfw1D4BHnkzx7L", "ezPixXo4B1D98RkS"];
const host = "aws-0-ap-southeast-1.pooler.supabase.com";
const port = 6543;
const user = "postgres.zpsmxtdqlpbdwfzctqzd";
const database = "postgres";

async function testPasswords() {
  for (const pw of passwords) {
    console.log(`Testing password: ${pw}`);
    const client = new Client({
      user,
      host,
      database,
      password: pw,
      port,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`SUCCESS! Connected with password: ${pw}`);
      
      console.log("Querying RLS and policies for jobpack...");
      const res1 = await client.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'jobpack';");
      console.log("jobpack RLS status (relrowsecurity):", res1.rows);
      
      const res2 = await client.query("SELECT * FROM pg_policies WHERE tablename = 'jobpack';");
      console.log("jobpack policies:", res2.rows);

      const res3 = await client.query("SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('jobpack', 'structure', 'platform');");
      console.log("pg_tables rowsecurity:", res3.rows);

      await client.end();
      return;
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }
}

testPasswords();
