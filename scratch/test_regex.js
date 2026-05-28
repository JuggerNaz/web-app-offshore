// Upgraded test script to verify separate unit tracking for each dimension
const parseDebrisDimensions = (comment) => {
  if (!comment) return {
    length: null, lengthUnit: null,
    width: null, widthUnit: null,
    height: null, heightUnit: null,
    diameter: null, diameterUnit: null
  };
  const lowerComment = comment.toLowerCase();
  let length = null;
  let lengthUnit = null;
  let width = null;
  let widthUnit = null;
  let height = null;
  let heightUnit = null;
  let diameter = null;
  let diameterUnit = null;

  const parseNum = (str) => {
    const parsed = parseFloat(str);
    return isNaN(parsed) ? null : parsed;
  };

  const normalizeUnit = (u) => {
    if (!u) return null;
    u = u.trim().toLowerCase();
    if (u === 'in' || u === 'inch' || u === 'inches') return 'in';
    if (u === 'mm') return 'mm';
    if (u === 'm' || u === 'meter' || u === 'meters') return 'm';
    if (u === 'ft' || u === 'feet') return 'ft';
    return 'm';
  };

  const lengthMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|in|ft|feet)?\s*(?:in\s+)?length/i);
  if (lengthMatch) {
    length = parseNum(lengthMatch[1]);
    lengthUnit = normalizeUnit(lengthMatch[2]) || 'm';
  }

  const widthMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|in|ft|feet)?\s*width/i);
  if (widthMatch) {
    width = parseNum(widthMatch[1]);
    widthUnit = normalizeUnit(widthMatch[2]) || 'm';
  }

  const heightMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|in|ft|feet)?\s*(?:in\s+)?(?:height|high\b)/i);
  if (heightMatch) {
    height = parseNum(heightMatch[1]);
    heightUnit = normalizeUnit(heightMatch[2]) || 'm';
  }

  const diaMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|inches|in|ft|feet)?\s*(?:in\s+)?(?:diameter|dia\b)/i);
  if (diaMatch) {
    diameter = parseNum(diaMatch[1]);
    diameterUnit = normalizeUnit(diaMatch[2]) || 'm';
  }

  if (!length && !width) {
    const crossMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|in|ft)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(m|mm|in|ft)?/i);
    if (crossMatch) {
      length = parseNum(crossMatch[1]);
      width = parseNum(crossMatch[3]);
      
      const u2 = normalizeUnit(crossMatch[4]);
      const u1 = normalizeUnit(crossMatch[2]);
      
      lengthUnit = u1 || u2 || 'm';
      widthUnit = u2 || u1 || 'm';
    }
  }

  return {
    length, lengthUnit: length ? (lengthUnit || 'm') : null,
    width, widthUnit: width ? (widthUnit || 'm') : null,
    height, heightUnit: height ? (heightUnit || 'm') : null,
    diameter, diameterUnit: diameter ? (diameterUnit || 'm') : null
  };
};

// Test cases
const testComments = [
  "Scaffold pole (approximately 3m in length x 50mm in diameter)",
  "Steel wire approx. 2m length",
  "Rubber hose 1.5m in length x 75mm diameter",
  "Metallic drum (approx. 1m high x 0.5m dia)",
  "Fishing net 5m x 5m in size",
  "Anode piece 300mm length x 100mm width x 50mm height"
];

for (const comment of testComments) {
  console.log(`Original: "${comment}"`);
  console.log("Parsed:  ", parseDebrisDimensions(comment));
  console.log("-".repeat(60));
}
