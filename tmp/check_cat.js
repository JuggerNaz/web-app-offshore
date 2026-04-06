const { Client } = require('pg');
const client = new Client({connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});
client.connect().then(() => client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'insp_anomalies';"))
.then(res => { console.log(res.rows.map(r => r.column_name)); client.end(); });
