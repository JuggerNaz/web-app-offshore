const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function run() {
    try {
        await client.connect();
        
        // 1. Get platform
        const platRes = await client.query(`
            SELECT * FROM platform WHERE title ILIKE '%D21JT-A%' OR title ILIKE '%D21JT%'
        `);
        console.log("PLATFORMS:");
        console.log(platRes.rows);
        
        if (platRes.rows.length === 0) {
            console.log("No platform found matching D21JT-A");
            return;
        }
        
        const platId = platRes.rows[0].plat_id;
        
        // 2. Get elevations
        const elvRes = await client.query(`
            SELECT * FROM str_elv WHERE plat_id = $1 ORDER BY CAST(elv AS numeric) DESC
        `, [platId]);
        console.log("\nELEVATIONS:");
        console.log(elvRes.rows);
        
        // 3. Get faces
        const facesRes = await client.query(`
            SELECT * FROM str_faces WHERE plat_id = $1
        `, [platId]);
        console.log("\nFACES:");
        console.log(facesRes.rows);
        
        // 4. Get components count and some details
        const compRes = await client.query(`
            SELECT count(*), code, count(metadata->'s_node') as start_nodes, count(metadata->'f_node') as end_nodes
            FROM structure_components 
            WHERE structure_id = $1
            GROUP BY code
        `, [platId]);
        console.log("\nCOMPONENTS BY CODE:");
        console.log(compRes.rows);

        // 5. Get a sample of components with nodes
        const sampleRes = await client.query(`
            SELECT q_id, code, metadata 
            FROM structure_components 
            WHERE structure_id = $1 AND (metadata->>'s_node' IS NOT NULL OR metadata->>'f_node' IS NOT NULL)
            LIMIT 15
        `, [platId]);
        console.log("\nSAMPLE COMPONENTS WITH NODES:");
        console.log(JSON.stringify(sampleRes.rows, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

run();
