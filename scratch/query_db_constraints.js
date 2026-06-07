const { Client } = require('pg');

async function main() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const dbUrlMatch = envContent.match(/^\s*DATABASE_URL\s*=\s*(.*)/m);
      if (dbUrlMatch) {
        databaseUrl = dbUrlMatch[1].trim();
      }
    }
  }

  if (!databaseUrl) {
    console.error("No DATABASE_URL found");
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  console.log("=== Checking structure_components constraints ===");
  const res = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'public.structure_components'::regclass;
  `);
  res.rows.forEach(r => console.log(r));

  console.log("\n=== Checking structure_components unique indexes ===");
  const resIdx = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'structure_components';
  `);
  resIdx.rows.forEach(r => console.log(r));

  await client.end();
}

main().catch(console.error);
