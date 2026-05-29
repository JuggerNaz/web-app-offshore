const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      // Read comments too if uncommented or look for commented one
      const dbUrlMatch = envContent.match(/^\s*DATABASE_URL\s*=\s*(.*)/m) || envContent.match(/^\s*#\s*DATABASE_URL\s*=\s*(.*)/m);
      if (dbUrlMatch) {
        databaseUrl = dbUrlMatch[1].trim();
      }
    }
  }

  if (!databaseUrl) {
    console.error("No DATABASE_URL found");
    return;
  }

  // Replace PASSWORD placeholder if present, or just try to connect
  if (databaseUrl.includes('YOUR_DATABASE_PASSWORD')) {
    // Let's check if we can read the password from another place, or just log
    console.log("Found commented database url, but PASSWORD needs to be replaced.");
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  console.log("=== Checking structure_components columns ===");
  const cols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'structure_components';
  `);
  cols.rows.forEach(c => console.log(`${c.column_name}: ${c.data_type}`));

  console.log("\n=== Checking structure_components constraints ===");
  const res = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'public.structure_components'::regclass;
  `);
  res.rows.forEach(r => console.log(r));

  await client.end();
}

main().catch(console.error);
