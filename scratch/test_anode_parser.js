// Test simulation script for Anode Details parsing logic

const parseAnodeDetails = (comment) => {
  if (!comment) return {};
  const cleanComment = comment.trim();
  const lowerComment = cleanComment.toLowerCase();
  let depletion = null;
  let anodeType = null;

  // Pattern 1: Parse depletion percentage e.g. "0-25% Depleted" or "50% depletion" or "depletion 30%"
  const deplMatch = lowerComment.match(/(\d+(?:-\d+)?\s*%)\s*(?:depleted|depletion|dep)?/i) ||
                   lowerComment.match(/(?:depleted|depletion|dep)\s*:?\s*(\d+(?:-\d+)?\s*%)/i);
  if (deplMatch) {
    depletion = deplMatch[1].toUpperCase().trim();
  } else {
    // Try plain number followed by "depleted" or preceded by "depletion"
    const deplNumMatch = lowerComment.match(/(?:depleted|depletion|dep)\s*:?\s*(\d+)\b/i) ||
                        lowerComment.match(/\b(\d+)\s*(?:percent|pct)?\s*(?:depleted|depletion)/i);
    if (deplNumMatch) {
      depletion = deplNumMatch[1] + "%";
    }
  }

  // Pattern 2: Parse Anode Type
  const sections = cleanComment.split(/[;]+/);
  for (const sec of sections) {
    const trimmedSec = sec.trim();
    const lowerSec = trimmedSec.toLowerCase();

    // If section mentions anode
    if (lowerSec.includes("anode")) {
      // Match type suffix (A, B, C, D, E, F, G, B2)
      const typeLetterMatch = lowerSec.match(/\btype\s*[-:\s]?\s*([a-g]|b2)\b/i) ||
                              lowerSec.match(/\banode\s*[-:\s]?\s*(?:type\s*[-:\s]?)?\s*([a-g]|b2)\b/i);
      if (typeLetterMatch) {
        const code = typeLetterMatch[1].toUpperCase();
        anodeType = `ANODE TYPE ${code}`;
        break;
      }

      // If it is something like "ANODE: BAR-0-25% Depleted"
      const barTypeMatch = lowerSec.match(/anode\s*:\s*([a-z0-9]+)\s*-\s*\d+/i);
      if (barTypeMatch && barTypeMatch[1].toUpperCase() !== "TYPE") {
        anodeType = barTypeMatch[1].toUpperCase();
        break;
      }
    }
  }

  // Fallback for Anode Type
  if (!anodeType) {
    const fallbackMatch = lowerComment.match(/\btype\s*[-:\s]?\s*([a-g]|b2)\b/i) ||
                          lowerComment.match(/\banode\s*[-:\s]?\s*(?:type\s*[-:\s]?)?\s*([a-g]|b2)\b/i);
    if (fallbackMatch) {
      const code = fallbackMatch[1].toUpperCase();
      anodeType = `ANODE TYPE ${code}`;
    }
  }

  return { depletion, anodeType };
};

// Test cases
const testCases = [
  "ANODE: TYPE-F; ANODE: BAR-0-25% Depleted; Both stubs secured to the member with no apparent sign of any damage, defect or debris observed.",
  "ANODE TYPE: A; Depletion: 50%; CP: -1050mV",
  "ANODE TYPE B2; 0-25% depleted",
  "Component is an anode; depletion: 75%",
  "Depleted: 40% (ANODE TYPE E)",
  "ANODE: BAR-0-25% Depleted;"
];

console.log("=== RUNNING ANODE PARSER TEST SIMULATION ===");
testCases.forEach((tc, idx) => {
  console.log(`\nTest Case #${idx + 1}: "${tc}"`);
  const res = parseAnodeDetails(tc);
  console.log("Parsed Anode Details:", JSON.stringify(res, null, 2));
});
