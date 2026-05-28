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

  console.log("Triggering migration execute and saving full log output...");
  try {
    const res = await fetch("http://[::1]:3000/api/migration/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    let output = `Status Code: ${res.status}\n`;
    output += `Success: ${data.success}\n`;
    output += `Error: ${data.error}\n\n`;
    output += `Logs (${data.logs ? data.logs.length : 0} lines):\n`;
    if (data.logs) {
      data.logs.forEach(l => {
        output += `[LOG] ${l}\n`;
      });
    }
    output += `\nReport:\n${JSON.stringify(data.report, null, 2)}\n`;

    fs.writeFileSync('scratch/migration_run.log', output, 'utf8');
    console.log("Saved full log output to scratch/migration_run.log");
  } catch (err) {
    console.error("Fetch Error:", err);
  }
}

main().catch(console.error);
