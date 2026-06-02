const { Client } = require("pg");

async function run() {
  const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to local postgres!");

  async function getInfo(tableName) {
    console.log(`\n=== Table information for: ${tableName} ===`);
    try {
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [tableName]);
      
      console.log("Columns:");
      colRes.rows.forEach(r => {
        console.log(`  - ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
      });

      const constRes = await client.query(`
        SELECT conname, pg_get_constraintdef(c.oid) AS def
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE conrelid = $1::regclass
      `, [tableName]);

      console.log("Constraints:");
      constRes.rows.forEach(r => {
        console.log(`  - ${r.conname}: ${r.def}`);
      });

    } catch (err) {
      console.error("Error getting info:", err.message);
    }
  }

  await getInfo("u_lib_mast");
  await getInfo("u_lib_list");
  await getInfo("u_lib_combo");

  await client.end();
}

run();
