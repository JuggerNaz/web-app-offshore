// Test simulation script for MGI clock position thickness parsing logic (Chunk-based with precise context)

const parseMgiThicknessFromComment = (comment) => {
  const result = {
    mgi_hard_thickness_at_12: null,
    mgi_hard_thickness_at_3: null,
    mgi_hard_thickness_at_6: null,
    mgi_hard_thickness_at_9: null,
    mgi_soft_thickness_at_12: null,
    mgi_soft_thickness_at_3: null,
    mgi_soft_thickness_at_6: null,
    mgi_soft_thickness_at_9: null,
  };

  if (!comment) return result;

  const lowerComment = comment.toLowerCase();

  // Regexes for clock position keywords (longer alternatives first to avoid prefix issues)
  const clockRegex = /(?:at\s*|@\s*)?\b(12|3|6|9)\s*(?:o'clock|oclock|o\s*clock|o'clk|oclk|clock|clk|oc|o)\b/gi;

  const matches = [];
  let match;
  while ((match = clockRegex.exec(lowerComment)) !== null) {
    matches.push({
      clockPos: parseInt(match[1]),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  if (matches.length === 0) {
    return result;
  }

  // Sort matches by start index
  matches.sort((a, b) => a.startIndex - b.startIndex);

  // Extract chunks
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    
    // Chunk goes from the start of the current match to the start of the next match (or end of comment)
    const chunkStart = current.startIndex;
    const chunkEnd = next ? next.startIndex : lowerComment.length;
    const chunkText = lowerComment.substring(chunkStart, chunkEnd);

    // Find all thickness values like "5mm" or "5.5 mm" within this chunk
    const thicknessRegex = /(\d+(?:\.\d+)?)\s*mm\b/g;
    let thickMatch;
    while ((thickMatch = thicknessRegex.exec(chunkText)) !== null) {
      const val = parseFloat(thickMatch[1]);
      if (isNaN(val)) continue;

      // Check context in a window of 15 chars before and after the match within the chunk
      const thickIndexInChunk = thickMatch.index;
      const afterText = chunkText.substring(thickIndexInChunk + thickMatch[0].length, thickIndexInChunk + thickMatch[0].length + 15);
      const beforeText = chunkText.substring(Math.max(0, thickIndexInChunk - 15), thickIndexInChunk);

      if (afterText.includes("soft") || beforeText.includes("soft")) {
        result[`mgi_soft_thickness_at_${current.clockPos}`] = val;
      } else {
        result[`mgi_hard_thickness_at_${current.clockPos}`] = val;
      }
    }
  }

  return result;
};

// Test cases
const testCases = [
  "MGI THICKNESS AT 12 O'CLK: 5mm of hard marine growth",
  "MGI THICKNESS AT 12 O'CLK: 5mm of hard, 3mm of soft",
  "MGI THICKNESS: 12 O'CLK = 5mm, 3 O'CLK = 8mm, 6 O'CLK = 12mm, 9 O'CLK = 4mm",
  "12 O'CLK: 10mm soft, 3 O'CLK: 12mm hard, 6 O'CLK: 8mm soft, 9 O'CLK: 6mm hard",
  "MGI THICKNESS AT 6 O'CLOCK: 15mm of hard growth",
  "Some comments about member; 9 O'CLK has 7.5mm hard marine growth",
  "3 o'clock: 0mm soft growth; 12 oclock: 12.5mm"
];

console.log("=== RUNNING MGI PARSER TEST SIMULATION ===");
testCases.forEach((tc, idx) => {
  console.log(`\nTest Case #${idx + 1}: "${tc}"`);
  const res = parseMgiThicknessFromComment(tc);
  console.log("Parsed MGI Thickness Values:", JSON.stringify(res, null, 2));
});
