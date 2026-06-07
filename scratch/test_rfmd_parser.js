// RFMD Migration Logic Test — Flexible Density Extraction

const testFmdMapping = (rowObj, findingsVal) => {
  const inspectionDataObj = {
    findings: findingsVal,
    finding: findingsVal
  };

  // 1) Map COMP_COND to member_status
  const compCondRaw = String(rowObj.COMP_COND || '').trim().toLowerCase();
  let memberStatusVal = null;
  if (compCondRaw) {
    if (compCondRaw === 'fmd unable to take' || compCondRaw.includes('unable to take') || compCondRaw.includes('unable') || compCondRaw.includes('not take')) {
      memberStatusVal = 'Unable to Take Reading';
    } else if (compCondRaw.includes('flood') || compCondRaw === 'f') {
      memberStatusVal = 'Flooded';
    } else if (compCondRaw.includes('dry') || compCondRaw === 'd') {
      memberStatusVal = 'Dry';
    } else if (compCondRaw.includes('grout') || compCondRaw === 'g') {
      memberStatusVal = 'Grouted';
    } else if (compCondRaw.includes('inconclusive') || compCondRaw === 'i') {
      memberStatusVal = 'Inconclusive';
    } else {
      memberStatusVal = compCondRaw.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }
  if (memberStatusVal) {
    inspectionDataObj.member_status = memberStatusVal;
  }

  // 2) Extract and cut density value + unit from comments/findings
  const densityRegex = new RegExp("density[^0-9]{0,40}([0-9]+(?:\\.[0-9]+)?)\\s*(g\\/cm3|g\\/cm³|g\\/cc|kg\\/m3|kg\\/m³|lb\\/ft3|lb\\/ft³|lb\\/in3|lb\\/in³)?\\.?", "i");
  const currentComments = findingsVal || '';
  const densityMatch = currentComments.match(densityRegex);
  let updatedFindings = currentComments;
  
  if (densityMatch) {
    const parsedDensity = parseFloat(densityMatch[1]);
    if (!isNaN(parsedDensity)) {
      inspectionDataObj.density_value = parsedDensity;
      
      const rawUnit = (densityMatch[2] || '').toLowerCase().trim();
      let mappedUnit = 'g/cm³';
      if (rawUnit === 'g/cm3' || rawUnit === 'g/cm³' || rawUnit === 'g/cc') {
        mappedUnit = 'g/cm³';
      } else if (rawUnit === 'kg/m3' || rawUnit === 'kg/m³') {
        mappedUnit = 'kg/m³';
      } else if (rawUnit === 'lb/ft3' || rawUnit === 'lb/ft³') {
        mappedUnit = 'lb/ft³';
      } else if (rawUnit === 'lb/in3' || rawUnit === 'lb/in³') {
        mappedUnit = 'lb/in³';
      }
      inspectionDataObj.density_value_unit = mappedUnit;
      
      let cutComments = currentComments.replace(densityMatch[0], "");
      cutComments = cutComments.replace(/[;,.]\s*[;,.]/g, ';')
                               .replace(/^\s*[;,.\-:\s]+/, '')
                               .replace(/\s*[;,.\-:\s]+$/, '')
                               .replace(/\s+/g, ' ')
                               .trim();
      
      updatedFindings = cutComments;
      inspectionDataObj.findings = cutComments;
      inspectionDataObj.finding = cutComments;
    }
  }

  return { inspectionDataObj, updatedFindings };
};

const testCases = [
  // ★ THE EXACT PATTERN FROM THE USER'S SCREENSHOT
  { row: { COMP_COND: "dry" }, comments: "Density measured was 1.43 g/cc." },
  
  // Other natural language patterns from Oracle data
  { row: { COMP_COND: "flood" }, comments: "Density reading is 1.025 g/cm3; flooded member" },
  { row: { COMP_COND: "F" }, comments: "Member flooded; density result was 1.03 g/cc" },
  { row: { COMP_COND: "dry" }, comments: "FMD completed. Density was 1.05 kg/m3. Member dry." },
  { row: { COMP_COND: "D" }, comments: "FMD test completed. density:1.02 g/cc" },
  { row: { COMP_COND: "G" }, comments: "Density: 1.01 g/cc; member is grouted" },
  { row: { COMP_COND: "inconclusive" }, comments: "Inconclusive results; Density value: 1.015 kg/m3" },
  { row: { COMP_COND: "FMD UNABLE TO TAKE" }, comments: "Density: 0.00; unable to take reading" },
  { row: { COMP_COND: "" }, comments: "dry; no density" },
  { row: { COMP_COND: "unknown" }, comments: "density value = 1.08; test completed" },
  { row: { COMP_COND: "dry" }, comments: "Density value: 2.45 lb/ft3; member is dry" },
  { row: { COMP_COND: "flood" }, comments: "DENSITY: 1.025 g/cm3; other comment text here" },
  { row: { COMP_COND: "F" }, comments: "flooded; density value: 1.03; test point 1" },
  { row: { COMP_COND: "dry" }, comments: "density 1.05 kg/m3; dry" },
  { row: { COMP_COND: "FLOODED" }, comments: "All upper case test, no density" },
  { row: { COMP_COND: "dry" }, comments: "Density of member was 1.43 g/cc." },
  { row: { COMP_COND: "flood" }, comments: "Density recorded at 1.50 g/cc; member flooded." },
];

console.log("=== RUNNING RFMD MIGRATION PARSER SIMULATION ===\n");
let passed = 0;
testCases.forEach((tc, idx) => {
  const res = testFmdMapping(tc.row, tc.comments);
  const hasD = res.inspectionDataObj.density_value !== undefined;
  console.log(`#${idx + 1} | COMP_COND: "${tc.row.COMP_COND}" | Comments: "${tc.comments}"`);
  console.log(`   → status: ${res.inspectionDataObj.member_status || "(none)"} | density: ${hasD ? res.inspectionDataObj.density_value : "(none)"} ${hasD ? res.inspectionDataObj.density_value_unit : ""} | findings: "${res.updatedFindings}"`);
  if (hasD) passed++;
  console.log("");
});
console.log(`\n${passed} of ${testCases.length} test cases extracted density values.`);
