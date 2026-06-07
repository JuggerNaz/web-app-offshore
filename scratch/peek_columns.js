const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function main() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'insp_records'
      ORDER BY ordinal_position;
    `);
    console.log("insp_records columns:");
    res.rows.forEach(r => console.log(` - ${r.column_name}: ${r.data_type}`));

    const res2 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'insp_anomalies'
      ORDER BY ordinal_position;
    `);
    console.log("\ninsp_anomalies columns:");
    res2.rows.forEach(r => console.log(` - ${r.column_name}: ${r.data_type}`));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
