const fs = require('fs');
const { Client } = require('pg');

let connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

try {
    const envContent = fs.readFileSync('.env.local', 'utf-8');
    const dbUrlMatch = envContent.match(/DATABASE_URL=(.*)/);
    if (dbUrlMatch) {
        connectionString = dbUrlMatch[1].trim();
        // Remove quotes if present
        if ((connectionString.startsWith('"') && connectionString.endsWith('"')) ||
            (connectionString.startsWith("'") && connectionString.endsWith("'"))) {
            connectionString = connectionString.substring(1, connectionString.length - 1);
        }
    }
} catch (e) {
    console.log("No .env.local found or error reading");
}

const client = new Client({ connectionString });

async function run() {
    try {
        await client.connect();
        
        const res = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'platform_3d_scenes'
        `);
        console.log("COLUMNS OF platform_3d_scenes:");
        console.log(res.rows);
        
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
