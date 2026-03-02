const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function runMigration() {
    try {
        await client.connect();
        const fs = require('fs');
        const sql = fs.readFileSync('create_anomaly_view.sql', 'utf8');
        await client.query(sql);
        console.log('Migration successful');
    } catch (err) {
        console.error('Migration failed', err);
    } finally {
        await client.end();
    }
}

runMigration();
