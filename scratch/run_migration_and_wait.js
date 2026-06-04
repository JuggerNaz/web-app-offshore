const fs = require('fs');
require('dotenv').config({ path: '.env.local' });
const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

async function main() {
  const payload = {
    config: config,
    structureId: "1061",
    selectedInspNo: "00000003454",
    mappings: {
      "STRUCTURE": [],
      "LOGS_ROV": [
        { oracleCol: "DIVE_NO", pgCol: "job.deployment_no" },
        { oracleCol: "INSP_DATE", pgCol: "job.deployment_date" },
        { oracleCol: "SUPV", pgCol: "job.rov_supervisor" },
        { oracleCol: "DIVR", pgCol: "job.rov_operator" },
        { oracleCol: "REC_CORD", pgCol: "job.report_coordinator" }
      ],
      "LOGS_DIVE": [
        { oracleCol: "DIVE_NO", pgCol: "job.dive_no" },
        { oracleCol: "INSP_DATE", pgCol: "job.dive_date" },
        { oracleCol: "SUPV", pgCol: "job.dive_supervisor" },
        { oracleCol: "DIVR", pgCol: "job.diver_name" },
        { oracleCol: "REC_CORD", pgCol: "job.report_coordinator" }
      ]
    }
  };

  console.log("Connecting to migration endpoint...");
  const response = await fetch("http://127.0.0.1:3000/api/migration/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    console.error("HTTP error:", response.status, response.statusText);
    return;
  }

  console.log("Connected! Streaming logs...");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'log') {
          console.log(`[LOG] ${event.message}`);
        } else if (event.type === 'table_report') {
          console.log(`[REPORT] Table: ${event.table}, Status: ${event.status}, Oracle Rows: ${event.oracleRows}, Migrated Rows: ${event.migratedRows}`);
        } else {
          console.log(`[EVENT]`, event);
        }
      } catch (err) {
        console.log(`[RAW] ${line}`);
      }
    }
  }
}

main().catch(console.error);
