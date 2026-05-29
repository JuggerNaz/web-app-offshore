// Test simulation script for Anode Details parsing logic
const anodeTypeLib = new Map([
  ["anode type a", "ANODE TYPE A"],
  ["type a", "ANODE TYPE A"],
  ["anode type b", "ANODE TYPE B"],
  ["type b", "ANODE TYPE B"],
  ["anode type c", "ANODE TYPE C"],
  ["type c", "ANODE TYPE C"],
  ["anode type d", "ANODE TYPE D"],
  ["type d", "ANODE TYPE D"],
  ["anode type e", "ANODE TYPE E"],
  ["type e", "ANODE TYPE E"],
  ["anode type f", "ANODE TYPE F"],
  ["type f", "ANODE TYPE F"],
  ["anode type g", "ANODE TYPE G"],
  ["type g", "ANODE TYPE G"],
  ["anode retropod", "ANODE RETROPOD"],
  ["retropod", "ANODE RETROPOD"],
  ["original", "ORIGINAL"],
  ["anode type b1", "ANODE TYPE B1"],
  ["type b1", "ANODE TYPE B1"],
  ["b1", "TYPE B1"],
  ["anode type b2", "ANODE TYPE B2"],
  ["type b2", "ANODE TYPE B2"],
  ["retrofit", "RETROFIT"],
  ["type c1", "Type C1"],
]);

const parseAnodeDetails = (comment, anodeTypeLib) => {
  if (!comment) return {};
  const cleanComment = comment.trim();
  const lowerComment = cleanComment.toLowerCase();

  let anodeType = null;
  let depletion = null;

  // Split comment by semicolon first (plain split to avoid Tailwind CSS regex static analysis bugs)
  const sections = cleanComment.split(';');

  // Construct regular expressions dynamically to shield them from Tailwind scanner
  const typeRegex = new RegExp("\\btype\\s*(?:-|:|\\s)?\\s*([a-g0-9]+)\\b", "i");
  const rangeRegex = new RegExp("(\\d+)\\s*-\\s*(\\d+)\\s*%");
  const pctRegex = new RegExp("(\\d+)\\s*%");

  for (const sec of sections) {
    const trimmedSec = sec.trim();
    const lowerSec = trimmedSec.toLowerCase();

    // 1. Parse Anode Type
    // If section mentions "anode" and we haven't found anodeType yet
    if (lowerSec.includes("anode") && !anodeType) {
      // Check if it has a pattern like "type-X" or "type X"
      const typeMatch = lowerSec.match(typeRegex);
      if (typeMatch) {
        const code = typeMatch[1].toLowerCase().trim();
        const candidates = [`type ${code}`, `anode type ${code}`, code];
        for (const cand of candidates) {
          if (anodeTypeLib.has(cand)) {
            anodeType = anodeTypeLib.get(cand);
            break;
          }
        }
      }

      // If we didn't find it by type match, maybe the word after "anode:" is in the library?
      if (!anodeType) {
        const colonParts = trimmedSec.split(":");
        if (colonParts.length > 1) {
          const valPart = colonParts[1].replace(/[-]/g, " ").trim().toLowerCase();
          const candidates = [valPart, valPart.split(/\s+/)[0]];
          for (const cand of candidates) {
            if (anodeTypeLib.has(cand)) {
              anodeType = anodeTypeLib.get(cand);
              break;
            }
          }
        }
      }
    }

    // 2. Parse Depletion from section
    if ((lowerSec.includes("deplet") || lowerSec.includes("%")) && !depletion) {
      let category = "Bar";
      if (lowerSec.includes("bracelet")) category = "Bracelet";
      else if (lowerSec.includes("collar")) category = "Collar";
      else if (lowerSec.includes("sled")) category = "Sled";
      else if (lowerSec.includes("bar")) category = "Bar";

      const rangeMatch = lowerSec.match(rangeRegex);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);
        depletion = `${category}: ${start} - ${end}% Depletion`;
      } else {
        const pctMatch = lowerSec.match(pctRegex);
        if (pctMatch) {
          const pct = parseInt(pctMatch[1]);
          if (pct >= 0 && pct <= 25) depletion = `${category}: 0 - 25% Depletion`;
          else if (pct > 25 && pct <= 50) depletion = `${category}: 25 - 50% Depletion`;
          else if (pct > 50 && pct <= 75) depletion = `${category}: 50 - 75% Depletion`;
          else if (pct > 75 && pct <= 100) depletion = `${category}: 75 - 100% Depletion`;
        } else if (lowerSec.includes("unable to estimate") || lowerSec.includes("unable to assess") || lowerSec.includes("cannot estimate")) {
          depletion = `${category}: Unable to Estimate`;
        }
      }
    }
  }

  // Fallback for anode type globally if not found in sections
  if (!anodeType) {
    const typeMatch = lowerComment.match(typeRegex);
    if (typeMatch) {
      const code = typeMatch[1].toLowerCase().trim();
      const candidates = [`type ${code}`, `anode type ${code}`, code];
      for (const cand of candidates) {
        if (anodeTypeLib.has(cand)) {
          anodeType = anodeTypeLib.get(cand);
          break;
        }
      }
    }
  }

  // Fallback for depletion globally if not found in sections
  if (!depletion) {
    let category = "Bar";
    if (lowerComment.includes("bracelet")) category = "Bracelet";
    else if (lowerComment.includes("collar")) category = "Collar";
    else if (lowerComment.includes("sled")) category = "Sled";
    else if (lowerComment.includes("bar")) category = "Bar";

    const rangeMatch = lowerComment.match(rangeRegex);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]);
      const end = parseInt(rangeMatch[2]);
      depletion = `${category}: ${start} - ${end}% Depletion`;
    } else {
      const pctMatch = lowerComment.match(pctRegex);
      if (pctMatch) {
        const pct = parseInt(pctMatch[1]);
        if (pct >= 0 && pct <= 25) depletion = `${category}: 0 - 25% Depletion`;
        else if (pct > 25 && pct <= 50) depletion = `${category}: 25 - 50% Depletion`;
        else if (pct > 50 && pct <= 75) depletion = `${category}: 50 - 75% Depletion`;
        else if (pct > 75 && pct <= 100) depletion = `${category}: 75 - 100% Depletion`;
      }
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

console.log("=== RUNNING SHIELDED ANODE PARSER TEST SIMULATION ===");
testCases.forEach((tc, idx) => {
  console.log(`\nTest Case #${idx + 1}: "${tc}"`);
  const res = parseAnodeDetails(tc, anodeTypeLib);
  console.log("Parsed Anode Details:", JSON.stringify(res, null, 2));
});
