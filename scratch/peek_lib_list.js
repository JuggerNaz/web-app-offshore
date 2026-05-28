const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function main() {
  try {
    await client.connect();
    const res = await client.query(`
      SELECT DISTINCT lib_code 
      FROM u_lib_list;
    `);
    console.log("Distinct lib_code values in u_lib_list:");
    res.rows.forEach(r => console.log(` - ${r.lib_code}`));

    const res2 = await client.query(`
      SELECT lib_id, lib_code, lib_desc 
      FROM u_lib_list 
      WHERE lib_code IN ('AMLY_COD', 'AMLY_TYP', 'AMLY_FND', 'DEBRIS_TYPE', 'COMP_COND', 'COAT_COND')
      LIMIT 100;
    `);
    console.log("\nu_lib_list sample rows:");
    res2.rows.forEach(r => console.log(` - [${r.lib_code}] ID: ${r.lib_id} | DESC: ${r.lib_desc}`));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main();
