// Test script to verify spatial approximation math with perpendicular face-based offsets
const calculateApproxCoords = (legacyQId, structureName) => {
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

  const match = legacyQId.match(/S\/BED\s*\(\s*([a-zA-Z0-9]+)\s*-\s*([a-zA-Z0-9]+)\s*\)\s*-\s*(\d+(?:\.\d+)?)\s*M/i);
  if (!match) return null;

  const startLeg = match[1].toUpperCase();
  const endLeg = match[2].toUpperCase();
  const distVal = parseFloat(match[3]);

  const startPos = legPositions.find(p => p.name === startLeg);
  const endPos = legPositions.find(p => p.name === endLeg);

  if (!startPos || !endPos) return null;

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

  let targetX = startPos.x;
  let targetY = startPos.y;

  const startRow = startLeg.charAt(0);
  const endRow = endLeg.charAt(0);
  const startCol = parseInt(startLeg.slice(1));
  const endCol = parseInt(endLeg.slice(1));

  if (startRow === endRow) {
    // Horizontal face (NORTH or SOUTH)
    // Offset along the line by 3m to keep it inside the sector visually
    const signX = endCol > startCol ? 1 : -1;
    targetX = startPos.x + signX * (3 * pxPerMeter);

    if (startRow === 'A') {
      // NORTH face: offset goes NORTH (upwards / subtract Y)
      targetY = startPos.y - (distVal * pxPerMeter);
    } else {
      // SOUTH face: offset goes SOUTH (downwards / add Y)
      targetY = startPos.y + (distVal * pxPerMeter);
    }
  } else if (startCol === endCol) {
    // Vertical face (WEST or EAST)
    // Offset along the line by 3m
    const signY = endRow.charCodeAt(0) > startRow.charCodeAt(0) ? 1 : -1;
    targetY = startPos.y + signY * (3 * pxPerMeter);

    if (startCol === 1) {
      // WEST face: offset goes WEST (leftwards / subtract X)
      targetX = startPos.x - (distVal * pxPerMeter);
    } else {
      // EAST face: offset goes EAST (rightwards / add X)
      targetX = startPos.x + (distVal * pxPerMeter);
    }
  } else {
    // Diagonal fallback: project directly along the line
    const vx = endPos.x - startPos.x;
    const vy = endPos.y - startPos.y;
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0) {
      const ux = vx / len;
      const uy = vy / len;
      targetX = startPos.x + ux * (distVal * pxPerMeter);
      targetY = startPos.y + uy * (distVal * pxPerMeter);
    }
  }

  let mappedX = parseFloat(((targetX / VIEW_SIZE) * 100).toFixed(2));
  let mappedY = parseFloat(((targetY / VIEW_SIZE) * 100).toFixed(2));

  mappedX = parseFloat(Math.max(5, Math.min(95, mappedX)).toFixed(2));
  mappedY = parseFloat(Math.max(5, Math.min(95, mappedY)).toFixed(2));

  return { mappedX, mappedY, startLeg, endLeg, distVal };
};

// Test with B1-B2-12M on a 4-leg platform
console.log("4-leg B1-B2-12M (South Face):", calculateApproxCoords("S/BED(B1-B2)-12M", "D21JT-A"));
console.log("4-leg A1-A2-3M (North Face):", calculateApproxCoords("S/BED(A1-A2)-3M", "D21JT-A"));
console.log("8-leg A1-A2-6M (North Face):", calculateApproxCoords("S/BED(A1-A2)-6M", "D21JT-8"));
console.log("4-leg A1-B1-9M (West Face):", calculateApproxCoords("S/BED(A1-B1)-9M", "D21JT-A"));
