const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function dump() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT code, name, default_properties 
            FROM inspection_type
            ORDER BY code
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

dump();
