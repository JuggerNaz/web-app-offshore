const fs = require('fs');
const { Client } = require('pg');

let connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

try {
    const envContent = fs.readFileSync('.env.local', 'utf-8');
    const dbUrlMatch = envContent.match(/DATABASE_URL=(.*)/);
    if (dbUrlMatch) {
        connectionString = dbUrlMatch[1].trim();
    }
} catch (e) {
    console.log("No .env.local found or error reading");
}

const client = new Client({ connectionString });

async function runMigration() {
    try {
        await client.connect();
        await client.query('ALTER TABLE public.insp_video_tapes DROP CONSTRAINT IF EXISTS uk_tape_no;');
        console.log('Migration successful');
    } catch (err) {
        console.error('Migration failed', err);
    } finally {
        await client.end();
    }
}

runMigration();
