const http = require('http');

async function test() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/inspection-summary?jobpack_id=610&structure_id=211&sow_report_no=PP-19025',
    method: 'GET',
    headers: {
      // Mock cookie/tenant header if needed, but since it's local development with tenant auth, let's see
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log("Status Code:", res.statusCode);
        console.log("Outstanding tasks list count:", json.data?.outstanding_tasks?.length || 0);
        
        const ban135Tasks = (json.data?.outstanding_tasks || []).filter(t => t.qid === "BAN135");
        console.log("Outstanding Tasks for BAN135:", JSON.stringify(ban135Tasks, null, 2));
      } catch (e) {
        console.log("Raw Response:", data.slice(0, 500));
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
  });

  req.end();
}

test();
