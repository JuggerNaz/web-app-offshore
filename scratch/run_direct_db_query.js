const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

let databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    
    // 1. Get columns of profiles table
    const colsRes = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'profiles'
      ORDER BY ordinal_position;
    `);
    console.log("--- profiles Columns ---");
    console.table(colsRes.rows);
    
    // 2. Get constraints on profiles table
    const constraintsRes = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.conrelid = 'profiles'::regclass;
    `);
    console.log("--- profiles Constraints ---");
    console.table(constraintsRes.rows);
    
    await client.end();
  } catch (err) {
    console.error(err);
    try { await client.end(); } catch(e) {}
  }
}

run();
