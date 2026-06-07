const { createClient } = require('@supabase/supabase-js');
const oracledb = require('oracledb');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });
const config = JSON.parse(fs.readFileSync('oracle_config.json', 'utf8'));

async function main() {
  const payload = {
    config: config,
    structureId: "255", // Test structure with rich ROV tape logs in Oracle
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

  console.log("Triggering migration execute via dev server using global fetch...");
  try {
    const res = await fetch("http://localhost:3000/api/migration/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("Status Code:", res.status);
    console.log("Success:", data.success);
    console.log("Error:", data.error);
    console.log("Logs count:", data.logs ? data.logs.length : 0);
    console.log("\nLast 30 Logs:");
    if (data.logs) {
      data.logs.slice(-30).forEach(l => console.log(l));
    }
    console.log("\nReport:", data.report);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

main();
