const fs = require('fs');
const { Client } = require('pg');

const envLocal = fs.readFileSync('.env.local', 'utf8');

// The user might have a NEXT_PUBLIC_SUPABASE_URL and Anon key, but do they have NEXT_PUBLIC_SUPABASE_DB_URL?
// Sometimes it's DATABASE_URL or SUPABASE_DB_URL
const dbUrlMatch = envLocal.match(/DATABASE_URL=(.*)/);
if(dbUrlMatch) {
    console.log("Found DB URL");
    const client = new Client({ connectionString: dbUrlMatch[1].trim() });
    client.connect()
        .then(() => client.query(`ALTER TABLE insp_anomalies ADD COLUMN IF NOT EXISTS record_category VARCHAR(50) DEFAULT 'ANOMALY';`))
        .then(() => { console.log('Successfully added record_category'); return client.end(); })
        .catch(err => console.error(err));
} else {
    console.log("No DB URL found in .env.local");
}
