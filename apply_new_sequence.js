const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function runMigration() {
    try {
        await client.connect();
        const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260318_refined_anomaly_sequence.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('Migration successful: get_next_record_sequence created.');
    } catch (err) {
        console.error('Migration failed', err);
    } finally {
        await client.end();
    }
}

runMigration();
