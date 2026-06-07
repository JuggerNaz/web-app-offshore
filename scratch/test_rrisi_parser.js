// RRISI (ROV Riser) Migration Parser Test

const testRrisiParsing = (qid, comments, compCode) => {
  const inspectionDataObj = {};
  let riserComments = comments || '';

  // 1) Determine Riser Part (riser_item)
  const qidStr = qid ? String(qid).trim().toUpperCase() : '';
  let basePart = 'Riser'; // default fallback
  if (qidStr.startsWith('R')) {
    basePart = 'Riser';
  } else if (qidStr.startsWith('J')) {
    basePart = 'J-Tube';
  } else if (qidStr.startsWith('I')) {
    basePart = 'I-Tube';
  }

  let riserPart = basePart;
  const hasRiserBend = /riser\s*bend/i.test(riserComments);
  const hasPipeline = /pipeline/i.test(riserComments);

  // CRITICAL FIX: hasRiserBend MUST take precedence over hasPipeline
  // (prevents a comment with "pipeline" at the end overriding a clear "RISER BEND" label at the beginning!)
  if (hasRiserBend) {
    if (basePart === 'Riser') {
      riserPart = 'Riser Bend';
    } else if (basePart === 'J-Tube') {
      riserPart = 'J-Tube Bend';
    } else if (basePart === 'I-Tube') {
      riserPart = 'I-Tube Bend';
    }
  } else if (hasPipeline) {
    riserPart = 'Pipeline';
  }
  
  inspectionDataObj.riser_item = riserPart;

  // Cut "RISER BEND" or "Pipeline" from comments if matched to clean findings
  if (riserPart === 'Pipeline') {
    riserComments = riserComments.replace(/pipeline/i, '');
  } else if (riserPart.includes('Bend')) {
    riserComments = riserComments.replace(/riser\s*bend/i, '');
  }

  // 2) Extract suspension height (e.g. "Riser bend was suspended approximately 0.5m...")
  const suspRegex = /(?:suspended|suspen[st]ion(?:\s+(?:height|gap|of))?)(?:.{0,50}?)(?<![a-zA-Z])([0-9]+(?:\.[0-9]+)?)\s*(m|cm|mm|ft|in)?\b/i;
  const suspMatch = riserComments.match(suspRegex);
  if (suspMatch) {
    const suspVal = parseFloat(suspMatch[1]);
    if (!isNaN(suspVal)) {
      inspectionDataObj.suspention_height = suspVal;
      inspectionDataObj.suspention_height_unit = (suspMatch[2] || 'm').toLowerCase();
    }
    riserComments = riserComments.replace(suspMatch[0], '');
  }

  // 3) Extract distance from member (e.g. "Distance between riser bend and the leg A1 is approximately 100mm...")
  const distRegex = /distance(?:.{0,80}?)(?<![a-zA-Z])([0-9]+(?:\.[0-9]+)?)\s*(m|cm|mm|ft|in)?\b/i;
  const distMatch = riserComments.match(distRegex);
  if (distMatch) {
    const distVal = parseFloat(distMatch[1]);
    if (!isNaN(distVal)) {
      inspectionDataObj.distance_from_member = distVal;
      inspectionDataObj.distance_from_member_unit = (distMatch[2] || 'm').toLowerCase();
    }
    riserComments = riserComments.replace(distMatch[0], '');
  }

  // 4) Clamp-specific parsing if component type is CL
  if (compCode === 'CL') {
    // Simulated database library map for testing closest match
    const simulatedLibDescMap = new Map([
      ['riser clamp type j', 'RISER CLAMP TYPE J'],
      ['riser clamp type i', 'RISER CLAMP TYPE I'],
      ['riser clamp type h modified', 'RISER CLAMP TYPE H MODIFIED'],
      ['riser clamp type k', 'RISER CLAMP TYPE K'],
      ['riser clamp type l', 'RISER CLAMP TYPE L'],
      ['riser clamp type m', 'RISER CLAMP TYPE M'],
      ['riser clamp type n', 'RISER CLAMP TYPE N'],
      ['riser guard', 'RISER GUARD']
    ]);

    // a) Extract clamp type — supports explicit "RISER CLAMP TYPE:-J", "TYPE;J;" or "TYPE: J;" or regular "Clamp type:"
    const typeMatch = riserComments.match(/(?:riser\s+)?(?:clamp\s+)?type\s*[;:\-]+\s*([A-Za-z])\b/i);
    let clampTypeVal = '';
    let clampMatchedText = '';

    if (typeMatch) {
      const letter = typeMatch[1].toUpperCase();
      clampMatchedText = typeMatch[0];
      
      const simulatedOptionKey = `riser clamp type ${letter.toLowerCase()}`;
      if (simulatedLibDescMap.has(simulatedOptionKey)) {
        clampTypeVal = simulatedLibDescMap.get(simulatedOptionKey);
      } else {
        // Fallback letter mappings if not in library
        if (letter === 'R') {
          clampTypeVal = 'Riser Clamp';
        } else if (letter === 'J') {
          clampTypeVal = 'Riser Clamp Type J';
        } else if (letter === 'I') {
          clampTypeVal = 'Riser Clamp Type I';
        } else if (letter === 'N') {
          clampTypeVal = 'Neoprene Clamp';
        } else if (letter === 'G') {
          clampTypeVal = 'Guide Clamp';
        } else if (letter === 'S') {
          clampTypeVal = 'Structural Clamp';
        } else if (letter === 'M') {
          clampTypeVal = 'Monel Clamp';
        } else {
          clampTypeVal = `Riser Clamp Type ${letter}`;
        }
      }
    } else {
      const clampTypeRegex = /clamp\s+type\s*[:\-]?\s*([A-Za-z0-9\-\s]+?)(?:[;.,\n]|$)/i;
      const clampTypeMatch = riserComments.match(clampTypeRegex);
      if (clampTypeMatch) {
        clampTypeVal = clampTypeMatch[1].trim();
        clampMatchedText = clampTypeMatch[0];
      } else {
        const commonClampTypes = ['riser clamp', 'neoprene clamp', 'guide clamp', 'structural clamp', 'monel clamp', 'saddle clamp', 'flat bar clamp', 'half shell clamp', 'half shell'];
        for (const ct of commonClampTypes) {
          const reg = new RegExp(`\\b${ct}\\b`, 'i');
          const match = riserComments.match(reg);
          if (match) {
            clampTypeVal = ct;
            clampMatchedText = match[0];
            break;
          }
        }
      }
    }

    if (clampTypeVal) {
      const finalClampType = clampTypeVal.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      inspectionDataObj.clamp_type = finalClampType;
      riserComments = riserComments.replace(clampMatchedText, '');
    }

    // b) Check movement detected
    const noMovementRegex = /(?:no\s+movement|no\s+slippage|no\s+slip|no\s+displacement|no\s+rotation)/i;
    const movementRegex = /(?:movement\s+(?:detected|observed|present)|clamp\s+(?:has\s+)?(?:moved|slipped)|slippage|displacement\s+detected)/i;

    if (noMovementRegex.test(riserComments)) {
      inspectionDataObj.movement_detected = false;
      const match = riserComments.match(noMovementRegex);
      if (match) riserComments = riserComments.replace(match[0], '');
    } else if (movementRegex.test(riserComments)) {
      inspectionDataObj.movement_detected = true;
      const match = riserComments.match(movementRegex);
      if (match) riserComments = riserComments.replace(match[0], '');
    }

    // c) Extract max gap
    const gapRegex = /(?:max\s+)?gap(?:.{0,20}?)(?<![a-zA-Z])([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|m|in|ft)?\b/i;
    const gapMatch = riserComments.match(gapRegex);
    if (gapMatch) {
      const gapVal = parseFloat(gapMatch[1]);
      if (!isNaN(gapVal)) {
        inspectionDataObj.max_gap = gapVal;
        inspectionDataObj.max_gap_unit = (gapMatch[2] || 'mm').toLowerCase();
      }
      riserComments = riserComments.replace(gapMatch[0], '');
    }

    // d) Extract missing bolts/nuts
    let missingCount = null;
    let missingMatchText = '';
    const boltPatternA = /(?:missing\s+)?([0-9]+)\s*(?:missing\s+)?(?:bolt|nut|stud)s?(?:\s+missing)?\b/i;
    const boltPatternB = /(?:missing\s+)(?:bolt|nut|stud)s?\s*[:\-]?\s*([0-9]+)\b/i;

    const matchB = riserComments.match(boltPatternB);
    if (matchB) {
      missingCount = parseInt(matchB[1]);
      missingMatchText = matchB[0];
    } else {
      const matchA = riserComments.match(boltPatternA);
      if (matchA) {
        missingCount = parseInt(matchA[1]);
        missingMatchText = matchA[0];
      }
    }
    if (missingCount !== null && !isNaN(missingCount)) {
      inspectionDataObj.missing_bolts_nuts = missingCount;
      riserComments = riserComments.replace(missingMatchText, '');
    }
  }

  // Clean up remaining comments
  riserComments = riserComments
    .replace(/[;,.]\s*[;,.]/g, ';')
    .replace(/^\s*[;,.\-:\s]+/, '')
    .replace(/\s*[;,.\-:\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

  inspectionDataObj.findings = riserComments;
  return inspectionDataObj;
};

// Test scenarios
const testCases = [
  // ★ USER'S NEW SCREENSHOT PATTERN (RISER CLAMP TYPE:-J;)
  {
    qid: "RIS-1-SUPP-46.5M",
    comments: "RISER CLAMP TYPE:-J; Clamp was previously intact and nuts were intact. No sign any gap and movement or debris observed. The CP reading was within...",
    compCode: "CL"
  },
  // ★ USER'S SCREENSHOT PIC-2 (with RISER BEND at start and a pipeline reference at the end)
  {
    qid: "R1-SK380-D21JT-A",
    comments: "RISER BEND; Appears to be in good condition. Riser bend was suspended approximately 0.5m from the seabed. Distance between riser bend and the leg A1 is approximately 100mm. Note: adjacent pipeline is not affected.",
    compCode: "RS"
  },
  // ★ USER'S SCREENSHOT PIC-1 (TYPE;J; under component RIS-1-SUPP-46.5M)
  {
    qid: "RIS-1-SUPP-46.5M",
    comments: "TYPE;J; Riser stub was intact and secure. All the bolts and nuts were intact. No sign of obvious sign of damage, defect, deformation or debris observed. Unable to take CP.",
    compCode: "CL"
  },
  {
    qid: "RIS-1-SUPP-46.5M",
    comments: "TYPE;R; Clamp was intact.",
    compCode: "CL"
  },
  {
    qid: "RIS-1-SUPP-46.5M",
    comments: "TYPE;I; Support is in place.",
    compCode: "CL"
  },
  {
    qid: "J1-SK380-D21JT-A",
    comments: "RISER BEND; suspended approximately 1.2m. Distance from member is 200mm",
    compCode: "RS"
  },
  {
    qid: "I2-SK380-D21JT-A",
    comments: "RISER BEND; Riser bend was suspended approximately 3ft from mudline. Distance to leg A2: 50mm",
    compCode: "RS"
  },
  {
    qid: "R2-SK380-D21JT-A",
    comments: "Inspection shows pipeline is clear from obstructions. Distance from leg B1 is 1.5m.",
    compCode: "RS"
  }
];

console.log("=== RUNNING RRISI MIGRATION PARSER TEST ===\n");
testCases.forEach((tc, idx) => {
  const result = testRrisiParsing(tc.qid, tc.comments, tc.compCode);
  console.log(`#${idx + 1} | QID: "${tc.qid}" | CompCode: "${tc.compCode}"`);
  console.log(`   Input: "${tc.comments}"`);
  console.log(`   → Riser Part:     ${result.riser_item}`);
  console.log(`   → Susp. Height:   ${result.suspention_height ?? '(none)'} ${result.suspention_height_unit || ''}`);
  console.log(`   → Dist. Member:   ${result.distance_from_member ?? '(none)'} ${result.distance_from_member_unit || ''}`);
  if (tc.compCode === 'CL') {
    console.log(`   → Clamp Type:     ${result.clamp_type ?? '(none)'}`);
    console.log(`   → Movement Det:   ${result.movement_detected !== undefined ? result.movement_detected : '(none)'}`);
    console.log(`   → Max Gap:        ${result.max_gap ?? '(none)'} ${result.max_gap_unit || ''}`);
    console.log(`   → Missing Bolts:  ${result.missing_bolts_nuts ?? '(none)'}`);
  }
  console.log(`   → Findings:       "${result.findings}"`);
  console.log('');
});
