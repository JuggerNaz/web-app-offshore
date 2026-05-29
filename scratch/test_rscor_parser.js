// RSCOR (ROV Scour) Migration Parser Test

const testScourParsing = (comments) => {
  const inspectionDataObj = {};
  let scourComments = comments || '';

  // 1) Extract scour location
  const locRegex = /(?:scour\s+)?(?:at\s+)?(?:leg|location)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i;
  const locMatch = scourComments.match(locRegex);
  if (locMatch) {
    inspectionDataObj.scour_location = `At Leg: ${locMatch[1].toUpperCase()}`;
    scourComments = scourComments.replace(locMatch[0], '');
  }

  // 2) Extract scour depth
  const depthRegex = /(?:scour\s+)?depth\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|m|in|ft)?/i;
  const depthMatch = scourComments.match(depthRegex);
  if (depthMatch) {
    const depthVal = parseFloat(depthMatch[1]);
    if (!isNaN(depthVal)) {
      inspectionDataObj.scour_depth = depthVal;
      inspectionDataObj.scour_depth_unit = (depthMatch[2] || 'mm').toLowerCase();
    }
    scourComments = scourComments.replace(depthMatch[0], '');
  }

  // 3) Extract exposed pile flag
  const exposedRegex = /(?:pile\s+(?:not\s+)?exposed|(?:not\s+)?exposed\s+pile|pile\s+is\s+(?:not\s+)?exposed|(?:not\s+)?exposed(?:\s+pile)?)/i;
  const exposedMatch = scourComments.match(exposedRegex);
  if (exposedMatch) {
    const matchText = exposedMatch[0].toLowerCase();
    inspectionDataObj.Exposed_pile = !matchText.includes('not') ? 'Yes' : 'No';
    scourComments = scourComments.replace(exposedMatch[0], '');
  }

  // 4) Extract burial percentage
  const burialRegex = /(?:burial|buried)\s*(?:percent(?:age)?)?\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*%?|([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:burial|buried)/i;
  const burialMatch = scourComments.match(burialRegex);
  if (burialMatch) {
    const burialVal = parseFloat(burialMatch[1] || burialMatch[2]);
    if (!isNaN(burialVal)) {
      inspectionDataObj.Burial_percent = burialVal;
    }
    scourComments = scourComments.replace(burialMatch[0], '');
  }

  // Clean up
  scourComments = scourComments
    .replace(/[;,.]\s*[;,.]/g, ';')
    .replace(/^\s*[;,.\-:\s]+/, '')
    .replace(/\s*[;,.\-:\s]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/\bseabed\s*[:\-]?\s*/gi, '')
    .trim();

  inspectionDataObj.findings = scourComments;
  return inspectionDataObj;
};

const testCases = [
  // ★ THE EXACT PATTERN FROM THE USER'S SCREENSHOT
  "SCOUR AT LEG: A1; SCOUR DEPTH: 200mm; SEABED: PILE NOT EXPOSED",
  
  // Variations
  "SCOUR AT LEG: B2; SCOUR DEPTH: 150mm; SEABED: PILE EXPOSED",
  "SCOUR AT LEG A3; DEPTH: 300 mm; PILE NOT EXPOSED; BURIAL: 30%",
  "AT LEG: C1; SCOUR DEPTH 450mm; PILE EXPOSED; BURIAL 25%",
  "LOCATION: D4; DEPTH: 100mm; SEABED: PILE NOT EXPOSED",
  "SCOUR AT LEG: E5; SCOUR DEPTH: 0mm; SEABED: PILE NOT EXPOSED; BURIED 60%",
  "LEG: A1-B2; SCOUR DEPTH: 500 mm; PILE EXPOSED; General scour observed around member",
  "SCOUR AT LEG: F3; DEPTH 250mm; NOT EXPOSED; BURIAL PERCENT: 45",
  "NO SIGNIFICANT SCOUR OBSERVED AT THIS LOCATION",
  "30% BURIED; SCOUR AT LEG: G1; DEPTH: 50mm; PILE NOT EXPOSED",
];

console.log("=== RUNNING RSCOR MIGRATION PARSER TEST ===\n");
testCases.forEach((tc, idx) => {
  const result = testScourParsing(tc);
  console.log(`#${idx + 1} | Input: "${tc}"`);
  console.log(`   → location: ${result.scour_location || '(none)'}`);
  console.log(`   → depth: ${result.scour_depth ?? '(none)'} ${result.scour_depth_unit || ''}`);
  console.log(`   → exposed: ${result.Exposed_pile || '(none)'}`);
  console.log(`   → burial: ${result.Burial_percent !== undefined ? result.Burial_percent + '%' : '(none)'}`);
  console.log(`   → findings: "${result.findings}"`);
  console.log('');
});
