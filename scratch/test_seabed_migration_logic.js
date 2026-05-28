const oracledb = require("oracledb");
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .reduce((acc, line) => {
    const [key, ...value] = line.split('=');
    if (key && value) acc[key.trim()] = value.join('=').trim();
    return acc;
  }, {});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Copy helpers exactly as defined in route.ts
const parseMarineGrowthFromComment = (comment) => {
  if (!comment) return {};
  const cleanComment = comment.trim();
  const lowerComment = cleanComment.toLowerCase();
  let softMg = null;
  let hardMg = null;

  // Pattern 1: Explicit separate values
  const softMatch = lowerComment.match(/soft\s*(?:marine\s*growth)?\s*:?\s*(\d+(?:-\d+)?)\s*%/i);
  const hardMatch = lowerComment.match(/hard\s*(?:marine\s*growth)?\s*:?\s*(\d+(?:-\d+)?)\s*%/i);

  const mapPercentToRange = (val) => {
    if (val <= 20) return "0-20%";
    if (val <= 40) return "20-40%";
    if (val <= 60) return "40-60%";
    if (val <= 80) return "60-80%";
    return "80-100%";
  };

  const mapRangeStringToBucket = (rangeStr) => {
    const buckets = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"];
    const normalized = rangeStr.replace(/\s/g, '');
    for (const b of buckets) {
      if (normalized === b.replace('%', '') || normalized === b) return b;
    }
    const singleMatch = normalized.match(/^(\d+)%?$/);
    if (singleMatch) return mapPercentToRange(Number(singleMatch[1]));
    const rangeMatch = normalized.match(/^(\d+)-(\d+)%?$/);
    if (rangeMatch) return mapPercentToRange(Number(rangeMatch[2]));
    return null;
  };

  if (softMatch) softMg = mapRangeStringToBucket(softMatch[1]) || null;
  if (hardMatch) hardMg = mapRangeStringToBucket(hardMatch[1]) || null;

  // Pattern 2: Combined pattern
  if (!softMg && !hardMg) {
    const combinedMatch = lowerComment.match(/(\d+(?:-\d+)?)\s*%\s*(?:coverage\s+(?:of\s+)?)?(?:hard\s+(?:and|&)\s+soft|soft\s+(?:and|&)\s+hard)\s*(?:marine\s*)?(?:growth)?/i);
    if (combinedMatch) {
      const bucket = mapRangeStringToBucket(combinedMatch[1]);
      if (bucket) {
        softMg = bucket;
        hardMg = bucket;
      }
    }
  }

  // Pattern 3: Single marine growth mention
  if (!softMg && !hardMg) {
    const singleMgMatch = lowerComment.match(/(\d+(?:-\d+)?)\s*%\s*(?:coverage\s+(?:of\s+)?)?\s*(?:marine\s*growth|mg\b)/i);
    if (singleMgMatch) {
      const bucket = mapRangeStringToBucket(singleMgMatch[1]);
      if (bucket) {
        const hasHard = /hard/i.test(lowerComment);
        const hasSoft = /soft/i.test(lowerComment);
        if (hasHard && !hasSoft) hardMg = bucket;
        else if (hasSoft && !hasHard) softMg = bucket;
        else {
          softMg = bucket;
          hardMg = bucket;
        }
      }
    }
  }

  // Pattern 4: All Over
  if (!softMg && !hardMg) {
    if (/all\s*over/i.test(lowerComment) && /(?:marine\s*)?growth|mg\b/i.test(lowerComment)) {
      softMg = "All Over";
      hardMg = "All Over";
    }
  }

  return { softMg, hardMg };
};

const parseDebrisDimensions = (comment) => {
  if (!comment) return { length: null, width: null, height: null, diameter: null, unit: null };
  const lowerComment = comment.toLowerCase();
  let length = null;
  let width = null;
  let height = null;
  let diameter = null;
  let unit = null;

  const parseNum = (str) => {
    const parsed = parseFloat(str);
    return isNaN(parsed) ? null : parsed;
  };

  const lengthMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|in|ft|feet)?\s*(?:in\s+)?length/i);
  if (lengthMatch) {
    length = parseNum(lengthMatch[1]);
    if (lengthMatch[2]) unit = lengthMatch[2];
  }

  const widthMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|in|ft|feet)?\s*width/i);
  if (widthMatch) {
    width = parseNum(widthMatch[1]);
    if (widthMatch[2]) unit = widthMatch[2];
  }

  const heightMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|in|ft|feet)?\s*(?:in\s+)?(?:height|high\b)/i);
  if (heightMatch) {
    height = parseNum(heightMatch[1]);
    if (heightMatch[2]) unit = heightMatch[2];
  }

  const diaMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|inches|in|ft|feet)?\s*(?:in\s+)?(?:diameter|dia\b)/i);
  if (diaMatch) {
    diameter = parseNum(diaMatch[1]);
    if (diaMatch[2]) {
      const u = diaMatch[2];
      if (u.startsWith('inch')) unit = 'in';
      else unit = u;
    }
  }

  if (!length && !width) {
    const crossMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|in|ft)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(m|mm|in|ft)?/i);
    if (crossMatch) {
      length = parseNum(crossMatch[1]);
      width = parseNum(crossMatch[3]);
      if (crossMatch[4]) unit = crossMatch[4];
      else if (crossMatch[2]) unit = crossMatch[2];
    }
  }

  if (unit) {
    unit = unit.trim().toLowerCase();
    if (unit === 'in' || unit === 'inch' || unit === 'inches') unit = 'in';
    else if (unit === 'mm') unit = 'mm';
    else if (unit === 'm' || unit === 'meter' || unit === 'meters') unit = 'm';
    else if (unit === 'ft' || unit === 'feet') unit = 'ft';
  } else {
    unit = 'm';
  }

  return { length, width, height, diameter, unit };
};

const predictMaterialFromComment = (comment) => {
  if (!comment) return 'Unknown';
  const lower = comment.toLowerCase();
  if (lower.includes('non-metallic') || lower.includes('non metallic')) return 'Non-Metallic';
  if (lower.includes('metallic') || lower.includes('metal')) return 'Metallic';

  const metallicKeywords = [
    'scaffold', 'pole', 'drum', 'bar', 'rail', 'strip', 'iron', 'steel', 
    'chain', 'shackle', 'bolt', 'pipe', 'plate', 'aluminum', 'copper', 
    'zinc', 'anode', 'bracket', 'clamp', 'structural'
  ];
  if (metallicKeywords.some(kw => lower.includes(kw))) {
    return 'Metallic';
  }

  const nonMetallicKeywords = [
    'rubber', 'hose', 'rope', 'fishing', 'net', 'plastic', 'nylon', 
    'wood', 'timber', 'concrete', 'sandbag', 'grout', 'bag', 'cloth', 
    'textile', 'sling', 'tyre', 'tire', 'synthetic', 'fiber'
  ];
  if (nonMetallicKeywords.some(kw => lower.includes(kw))) {
    return 'Non-Metallic';
  }

  return 'Unknown';
};

const extractDebrisDesc = (comment) => {
  if (!comment) return '';
  let clean = comment.replace(/\r\n/g, ' ').replace(/\n/g, ' ');
  
  clean = clean.replace(/approx(?:imate(?:ly)?)?\b\.?\s*\d+\s*m\s*from\s*(?:leg\s*)?[a-z]\d+/gi, '');
  clean = clean.replace(/approx(?:imate(?:ly)?)?\b\.?\s*\d+\s*m\s*from\s*[^,;.\n]*/gi, '');
  
  clean = clean.replace(/(?:approx(?:imate(?:ly)?)?\b\.?\s*)?\d+(?:\.\d+)?\s*(?:m|mm|inch|inches|in|ft|feet)?\s*(?:in\s+)?(?:diameter|dia\b)/gi, '');
  clean = clean.replace(/(?:approx(?:imate(?:ly)?)?\b\.?\s*)?\d+(?:\.\d+)?\s*(?:m|mm|inch|in|ft|feet)?\s*(?:in\s+)?width/gi, '');
  clean = clean.replace(/(?:approx(?:imate(?:ly)?)?\b\.?\s*)?\d+(?:\.\d+)?\s*(?:m|mm|inch|in|ft|feet)?\s*(?:in\s+)?length/gi, '');
  clean = clean.replace(/(?:approx(?:imate(?:ly)?)?\b\.?\s*)?\d+(?:\.\d+)?\s*(?:m|mm|inch|in|ft|feet)?\s*(?:in\s+)?(?:height|high\b)/gi, '');
  clean = clean.replace(/\d+(?:\.\d+)?\s*(?:m|mm|in|ft)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:m|mm|in|ft)?/gi, '');
  
  clean = clean.replace(/\bapprox(?:imate(?:ly)?)?\b\.?/gi, '');
  clean = clean.replace(/\b(?:in\s+)?length\b/gi, '');
  clean = clean.replace(/\b(?:in\s+)?width\b/gi, '');
  clean = clean.replace(/\b(?:in\s+)?(?:height|high\b)\b/gi, '');
  clean = clean.replace(/\b(?:in\s+)?diameter\b/gi, '');
  clean = clean.replace(/\bx\b/gi, '');
  clean = clean.replace(/\bin\b/gi, '');
  
  clean = clean.replace(/[,;.:\-\r\n\t()]/g, ' ');
  clean = clean.replace(/\s+/g, ' ').trim();
  
  if (clean.length > 0) {
    clean = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return clean;
};

const calculateSeabedGeometry = (x, y, structureName) => {
  const legCount = structureName.includes('8') ? 8 : 4;
  const padding = 80;
  const VIEW_SIZE = 600;
  const CENTER = VIEW_SIZE / 2;
  const innerSize = VIEW_SIZE - (padding * 2);

  let rows = 2;
  let cols = 2;
  if (legCount === 8) { rows = 2; cols = 4; }

  const dx = innerSize / (cols - 1 || 1) * 0.4;
  const dy = innerSize / (rows - 1 || 1) * 0.4;

  const legPositions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rowName = String.fromCharCode(65 + r);
      legPositions.push({
        x: CENTER + (c - (cols - 1) / 2) * dx,
        y: CENTER + (r - (rows - 1) / 2) * dy,
        name: `${rowName}${c + 1}`
      });
    }
  }

  const minX = Math.min(...legPositions.map(p => p.x));
  const minY = Math.min(...legPositions.map(p => p.y));
  const maxX = Math.max(...legPositions.map(p => p.x));
  const maxY = Math.max(...legPositions.map(p => p.y));

  const maxDistValue = 21;
  const distanceOffset = 0;
  const availableX = (VIEW_SIZE - (maxX - minX)) / 2 - 20;
  const availableY = (VIEW_SIZE - (maxY - minY)) / 2 - 20;
  const minAvailable = Math.min(availableX, availableY);
  const pxPerMeter = minAvailable / maxDistValue;

  const toScreen = (v) => (v / 100) * VIEW_SIZE;
  const screenX = toScreen(x);
  const screenY = toScreen(y);

  let dxBorder = 0;
  if (screenX < minX) dxBorder = minX - screenX;
  else if (screenX > maxX) dxBorder = screenX - maxX;

  let dyBorder = 0;
  if (screenY < minY) dyBorder = minY - screenY;
  else if (screenY > maxY) dyBorder = screenY - maxY;

  const visualDist = Math.max(dxBorder, dyBorder) / pxPerMeter;
  const logicalDist = visualDist + distanceOffset;

  const dxCenter = screenX - CENTER;
  const dyCenter = screenY - CENTER;

  let angle = Math.atan2(dxCenter, -dyCenter) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  let face = 'Unknown';
  let startLeg = '';
  let endLeg = '';

  const tl = 'A1';
  const tr = `A${cols}`;
  const bl = `${String.fromCharCode(64 + rows)}1`;
  const br = `${String.fromCharCode(64 + rows)}${cols}`;

  if (angle >= 315 || angle < 45) { face = 'NORTH'; startLeg = tl; endLeg = tr; }
  else if (angle >= 45 && angle < 135) { face = 'EAST'; startLeg = tr; endLeg = br; }
  else if (angle >= 135 && angle < 225) { face = 'SOUTH'; startLeg = bl; endLeg = br; }
  else { face = 'WEST'; startLeg = tl; endLeg = bl; }

  let nearestLeg = startLeg;
  let distToNearestLeg = 0;

  const startPos = legPositions.find(p => p.name === startLeg);
  const endPos = legPositions.find(p => p.name === endLeg);

  if (startPos && endPos) {
    const dStart = Math.sqrt(Math.pow(screenX - startPos.x, 2) + Math.pow(screenY - startPos.y, 2));
    const dEnd = Math.sqrt(Math.pow(screenX - endPos.x, 2) + Math.pow(screenY - endPos.y, 2));

    if (dStart < dEnd) {
      nearestLeg = startLeg;
      distToNearestLeg = dStart / pxPerMeter;
    } else {
      nearestLeg = endLeg;
      distToNearestLeg = dEnd / pxPerMeter;
    }
  }

  return {
    distance: logicalDist,
    nearestLeg,
    distToNearestLeg,
    face
  };
};

async function run() {
  let conn;
  try {
    oracledb.initOracleClient({ libDir: "C:\\instantclient64_12_2" });
    conn = await oracledb.getConnection({
      user: "sko251",
      password: "sko251",
      connectString: "nq-35:1522/orcl10"
    });

    console.log("Connected to Oracle.");

    // Fetch bounds for structure 824
    const coordsRes = await conn.execute(
      `SELECT MIN(SD_XPOS), MAX(SD_XPOS), MIN(SD_YPOS), MAX(SD_YPOS) 
       FROM PLATGI 
       WHERE STR_ID = 824 AND (SD_XPOS IS NOT NULL OR SD_YPOS IS NOT NULL)`
    );
    const crow = coordsRes.rows[0];
    const minSdX = Number(crow[0]);
    const maxSdX = Number(crow[1]);
    const minSdY = Number(crow[2]);
    const maxSdY = Number(crow[3]);

    console.log(`Bounds: X=[${minSdX}, ${maxSdX}], Y=[${minSdY}, ${maxSdY}]`);

    // Fetch a sample row
    const rowRes = await conn.execute(
      `SELECT INSP_ID, COMMENTS, SD_XPOS, SD_YPOS 
       FROM PLATGI 
       WHERE STR_ID = 824 AND INSP_SCODE = 'RSEAB' AND SD_XPOS IS NOT NULL AND ROWNUM = 1`
    );
    
    if (rowRes.rows && rowRes.rows.length > 0) {
      const row = rowRes.rows[0];
      const inspId = row[0];
      const comments = row[1];
      const sdX = Number(row[2]);
      const sdY = Number(row[3]);

      console.log(`\n--- Test Row (Oracle ID: ${inspId}) ---`);
      console.log(`Original Comments:\n"${comments}"`);
      console.log(`SD_XPOS: ${sdX}, SD_YPOS: ${sdY}`);

      // 1. Clean marine growth (simulate)
      // Original comments might have marine growth (let's add some to test parsing too!)
      const testMgComments = comments + "\r\nSoft marine growth: 40%, Hard: 20%";
      console.log(`\nTest Comments (with marine growth added):\n"${testMgComments}"`);

      const mgDetails = parseMarineGrowthFromComment(testMgComments);
      console.log("Parsed Marine Growth:", JSON.stringify(mgDetails, null, 2));

      let cleanedFindings = testMgComments;
      if (mgDetails.softMg || mgDetails.hardMg) {
        cleanedFindings = cleanedFindings.replace(/soft\s*(?:marine\s*growth)?\s*:?\s*(\d+(?:-\d+)?)\s*%/gi, '');
        cleanedFindings = cleanedFindings.replace(/hard\s*(?:marine\s*growth)?\s*:?\s*(\d+(?:-\d+)?)\s*%/gi, '');
        cleanedFindings = cleanedFindings.replace(/(\d+(?:-\d+)?)\s*%\s*(?:coverage\s+(?:of\s+)?)?(?:hard\s+(?:and|&)\s+soft|soft\s+(?:and|&)\s+hard)\s*(?:marine\s*)?(?:growth)?/gi, '');
        cleanedFindings = cleanedFindings.replace(/(\d+(?:-\d+)?)\s*%\s*(?:coverage\s+(?:of\s+)?)?\s*(?:marine\s*growth|mg\b)/gi, '');
        cleanedFindings = cleanedFindings.replace(/all\s*over\s+(?:marine\s*)?growth|all\s*over\s+mg\b/gi, '');
        
        cleanedFindings = cleanedFindings.replace(/[,;.:\-\s]+[,;.:\-]/g, ';');
        cleanedFindings = cleanedFindings.replace(/\s+/g, ' ').trim();
        cleanedFindings = cleanedFindings.replace(/^[;,:\-\s]+|[;,:\-\s]+$/g, '');
      }
      console.log(`Cleaned Findings:\n"${cleanedFindings}"`);

      // 2. Coordinate Mapping
      const xRaw = 100 - ((sdX - minSdX) / (maxSdX - minSdX) * 100);
      const yRaw = 100 - ((sdY - minSdY) / (maxSdY - minSdY) * 100);
      const mappedX = parseFloat(Math.max(5, Math.min(95, xRaw)).toFixed(2));
      const mappedY = parseFloat(Math.max(5, Math.min(95, yRaw)).toFixed(2));

      console.log(`\nMapped Coordinates: x = ${mappedX}%, y = ${mappedY}%`);

      const geom = calculateSeabedGeometry(mappedX, mappedY, "D21JT-A"); // Mock structure name
      console.log("Geometry Solver Output:", JSON.stringify(geom, null, 2));

      // 3. Debris & Dimension Parsing
      const originalComment = comments.trim();
      let categoryVal = 'Debris';
      if (/seepage|gas/i.test(originalComment)) {
        categoryVal = 'Gas Seepage';
      } else if (/crater/i.test(originalComment)) {
        categoryVal = 'Crater';
      }

      console.log(`\nPredicted Category: ${categoryVal}`);

      if (categoryVal === 'Debris') {
        const dims = parseDebrisDimensions(originalComment);
        console.log("Parsed Debris Dimensions:", JSON.stringify(dims, null, 2));

        const dimsTextParts = [];
        if (dims.length !== null) dimsTextParts.push(`${dims.length}m`);
        if (dims.width !== null) dimsTextParts.push(`${dims.width}m`);
        const size_dimensions = dimsTextParts.join(' x ') || (dims.length !== null ? `${dims.length}m` : null);

        const material = predictMaterialFromComment(originalComment);
        const debris_desc = extractDebrisDesc(originalComment);

        console.log(`Debris Description: "${debris_desc}"`);
        console.log(`Predicted Material: "${material}"`);
        console.log(`Size Dimensions: "${size_dimensions}"`);
      }
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    if (conn) {
      await conn.close();
    }
  }
}

run();
