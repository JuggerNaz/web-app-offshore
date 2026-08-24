/**
 * Oil & Gas Offshore Subsea & Structural Inspection Spell Check, Terminology Normalizer, and Library Matcher
 */

export const OFFSHORE_SPEECH_CORRECTIONS: Record<string, string> = {
  // Acoustic Homophones & Common STT Misrecognitions for Offshore Inspection
  "\\b(?:those\\s*in\\s*one|those\\s*and\\s*one|housing\\s*one|house\\s*and\\s*one|dozen\\s*one)\\b": "1001",
  "\\b(?:those\\s*in\\s*two|those\\s*and\\s*two)\\b": "1002",
  "\\b(?:those\\s*in|those\\s*and|housing)\\s+": "thousand ",
  "\\b(?:immediately\\s*would|immediately\\s*wood|immediately\\s*volt|immediately\\s*volts)\\b": "mV",
  "\\b(?:many\\s*boat|mini\\s*bolt|many\\s*volt|mini\\s*volt|many\\s*volts|mini\\s*volts|million\\s*volt|million\\s*volts)\\b": "mV",
  "\\b(?:mili\\s*volt|milibolt|milibar|mili\\s*volts)\\b": "mV",
  "\\b(?:milli\\s*volts?|mv|m\\s*v)\\b": "mV",
  "\\b(?:milli\\s*meters?|m\\s*m)\\b": "mm",
  "\\b(?:centi\\s*meters?|c\\s*m)\\b": "cm",
  "\\b(?:kilo\\s*grams?|k\\s*g)\\b": "kg",
  "\\b(?:kilo\\s*meters?|k\\s*m)\\b": "km",

  // Acronyms & Telemetry
  "\\b(?:see\\s*pee|c\\s*p|cb)\\b": "CP",
  "\\b(?:you\\s*tee|u\\s*t)\\b": "UT",
  "\\b(?:g\\s*v\\s*i|gee\\s*vee\\s*eye)\\b": "GVI",
  "\\b(?:c\\s*v\\s*i|see\\s*vee\\s*eye)\\b": "CVI",
  "\\b(?:a\\s*c\\s*f\\s*m)\\b": "ACFM",
  "\\b(?:m\\s*p\\s*i)\\b": "MPI",
  "\\b(?:d\\s*p\\s*i|d\\s*p)\\b": "DPI",
  "\\b(?:m\\s*g\\s*i)\\b": "MGI",
  "\\b(?:k\\s*p|kilo\\s*meter\\s*post)\\b": "KP",
  "\\b(?:f\\s*p|field\\s*post)\\b": "FP",
  "\\b(?:h\\s*a\\s*z|h\\.a\\.z)\\b": "HAZ",
  "\\b(?:f\\s*b\\s*e)\\b": "FBE",
  "\\b(?:m\\s*s\\s*l)\\b": "MSL",
  "\\b(?:l\\s*a\\s*t)\\b": "LAT",
  "\\b(?:r\\s*o\\s*v)\\b": "ROV",
  "\\b(?:s\\s*o\\s*w)\\b": "SOW",

  // Numbers & Polarity Words
  "\\b(?:miners|main\\s*us)\\b": "minus",

  // Marine Growth & Biology
  "\\b(?:marine\\s*grove|marine\\s*groth|marne\\s*growth)\\b": "marine growth",
  "\\b(?:calcareus|calcerous|calcarious)\\b": "calcareous",
  "\\b(?:barnicles|barnacels)\\b": "barnacles",
  "\\b(?:tube\\s*worms?|tubeworm)\\b": "tubeworms",
  "\\b(?:soft\\s*fouling|hard\\s*fouling)\\b": "$&",

  // Anode & Cathodic Protection
  "\\b(?:a\\s*node|annode|a\\s*note)\\b": "anode",
  "\\b(?:sacrificial\\s*a\\s*node|sac\\s*anode)\\b": "sacrificial anode",
  "\\b(?:anode\\s*depletion|annode\\s*depletion)\\b": "anode depletion",
  "\\b(?:cathodic\\s*protection|cathodic\\s*potential)\\b": "$&",
  "\\b(?:disbondment|dis\\s*bondment)\\b": "disbondment",

  // Structural & Pipeline Components
  "\\b(?:rier|risr)\\b": "riser",
  "\\b(?:riser\\s*clamp|razer\\s*clamp|raider\\s*clamp)\\b": "riser clamp",
  "\\b(?:bell\\s*mouth|bellmouth)\\b": "bellmouth",
  "\\b(?:caisson|casion)\\b": "caisson",
  "\\b(?:conductor\\s*guide|conductor)\\b": "$&",
  "\\b(?:j\\s*tube|jtube)\\b": "J-tube",
  "\\b(?:i\\s*tube|itube)\\b": "I-tube",
  "\\b(?:mud\\s*mat|mudmat)\\b": "mudmat",
  "\\b(?:pile\\s*sleeve)\\b": "pile sleeve",
  "\\b(?:stinger|flange|gasket|spool|pigtail)\\b": "$&",
  "\\b(?:grout\\s*bag|rock\\s*dump|concrete\\s*mattress)\\b": "$&",
  "\\b(?:free\\s*span|freespan|frespan)\\b": "free span",
  "\\b(?:scour\\s*pit|scour|score\\s*pit)\\b": "scour pit",
  "\\b(?:splash\\s*zone|splah\\s*zone)\\b": "splash zone",

  // Corrosion & Defects
  "\\b(?:pittin|pitting\\s*corrosion|pit\\s*corrosion)\\b": "pitting corrosion",
  "\\b(?:delamination|de\\s*lamination)\\b": "delamination",
  "\\b(?:metal\\s*loss|wall\\s*loss|loss\\s*of\\s*thickness)\\b": "$&",
  "\\b(?:crack\\s*indication|linear\\s*indication)\\b": "$&",
  "\\b(?:weld\\s*toe|well\\s*toe)\\b": "weld toe",
  "\\b(?:weld\\s*seam|well\\s*seam)\\b": "weld seam",
  "\\b(?:weld\\s*cap|well\\s*cap)\\b": "weld cap",
  "\\b(?:mechanical\\s*damage|dent\\s*damage|gouge)\\b": "$&",

  // Clock Positions
  "\\b(?:12\\s*o\\s*clock|12\\s*oclock|12\\s*clk)\\b": "12 o'clock",
  "\\b(?:3\\s*o\\s*clock|3\\s*oclock|3\\s*clk)\\b": "3 o'clock",
  "\\b(?:6\\s*o\\s*clock|6\\s*oclock|6\\s*clk)\\b": "6 o'clock",
  "\\b(?:9\\s*o\\s*clock|9\\s*oclock|9\\s*clk)\\b": "9 o'clock",
};

export const STANDARD_DEBRIS_LIBRARY = [
  "Scaffolding Pole",
  "Wire Rope",
  "Tyre",
  "Drill Pipe / String",
  "Anode Sled",
  "Grout Bag",
  "Chain / Shackle",
  "Steel Scrap",
  "Synthetic Sling",
  "Wood / Timber",
  "Metal Drum / Barrel",
  "Rope / Line",
  "Plastic Debris",
  "Concrete Block",
  "None",
];

export const STANDARD_DEBRIS_MATERIAL_LIBRARY = [
  "Metallic",
  "Steel",
  "Aluminium",
  "Plastic / Synthetic",
  "Rubber",
  "Concrete / Grout",
  "Wood / Timber",
  "Textile / Rope",
  "Non-Metallic",
  "Unknown",
];

const NUMBER_WORDS_MAP: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/**
 * Converts phrases of spoken number words into actual numeric digits
 * Examples:
 * - "thousand and one" -> "1001"
 * - "one thousand one" -> "1001"
 * - "one thousand fifty" -> "1050"
 * - "one thousand one hundred" -> "1100"
 * - "nine hundred eighty" -> "980"
 * - "fourteen point two" -> "14.2"
 * - "minus one thousand and one" -> "minus 1001"
 */
export function convertSpokenNumbersToDigits(text: string): string {
  if (!text || typeof text !== "string") return "";

  let result = text;

  // 1. Convert spoken patterns like "thousand and one" or "thousand one"
  result = result.replace(/\b(?:one\s+)?thousand\s+(?:and\s+)?([a-z0-9]+)\b/gi, (match, rem) => {
    const rLower = rem.toLowerCase();
    if (NUMBER_WORDS_MAP[rLower] !== undefined) {
      const val = 1000 + NUMBER_WORDS_MAP[rLower];
      return String(val);
    }
    if (/^\d{1,3}$/.test(rem)) {
      const val = 1000 + parseInt(rem, 10);
      return String(val);
    }
    return match;
  });

  // 2. Convert "eleven hundred" -> "1100", "twelve hundred" -> "1200", "ten fifty" -> "1050"
  result = result.replace(/\b(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s+hundred(?:\s+(?:and\s+)?([a-z0-9]+))?\b/gi, (match, h, rem) => {
    const hVal = (NUMBER_WORDS_MAP[h.toLowerCase()] || 0) * 100;
    if (!rem) return String(hVal);
    const rVal = NUMBER_WORDS_MAP[rem.toLowerCase()] || (parseInt(rem, 10) || 0);
    return String(hVal + rVal);
  });

  result = result.replace(/\bten\s+(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi, (_m, tens) => {
    return String(1000 + (NUMBER_WORDS_MAP[tens.toLowerCase()] || 0));
  });

  // 3. Convert "nine hundred eighty" / "nine hundred and eighty" -> "980"
  result = result.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred(?:\s+(?:and\s+)?(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))?(?:\s+(one|two|three|four|five|six|seven|eight|nine))?\b/gi, (_m, h, t, u) => {
    const hVal = (NUMBER_WORDS_MAP[h.toLowerCase()] || 0) * 100;
    const tVal = t ? (NUMBER_WORDS_MAP[t.toLowerCase()] || 0) : 0;
    const uVal = u ? (NUMBER_WORDS_MAP[u.toLowerCase()] || 0) : 0;
    return String(hVal + tVal + uVal);
  });

  // 4. Convert "fourteen point two" / "14 point 2" -> "14.2"
  result = result.replace(/\b([a-z]+|\d+)\s+point\s+([a-z]+|\d+)\b/gi, (match, a, b) => {
    const aVal = NUMBER_WORDS_MAP[a.toLowerCase()] !== undefined ? NUMBER_WORDS_MAP[a.toLowerCase()] : (/^\d+$/.test(a) ? a : null);
    const bVal = NUMBER_WORDS_MAP[b.toLowerCase()] !== undefined ? NUMBER_WORDS_MAP[b.toLowerCase()] : (/^\d+$/.test(b) ? b : null);
    if (aVal !== null && bVal !== null) {
      return `${aVal}.${bVal}`;
    }
    return match;
  });

  return result;
}

/**
 * Corrects common speech-to-text misspellings and normalizes Oil & Gas terminology.
 */
export function correctOffshoreTerminology(text: string): string {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  // 1. Replace phonetic distortions & offshore homophones
  for (const [pattern, replacement] of Object.entries(OFFSHORE_SPEECH_CORRECTIONS)) {
    try {
      const regex = new RegExp(pattern, "gi");
      cleaned = cleaned.replace(regex, (match) => {
        if (replacement === "$&") return match;
        return replacement;
      });
    } catch (e) {
      // Ignore invalid regex
    }
  }

  // 2. Convert spoken number words to actual numeric values
  cleaned = convertSpokenNumbersToDigits(cleaned);

  // 3. Fix standard uppercase acronyms
  const acronyms = ["CP", "UT", "GVI", "CVI", "ACFM", "MPI", "DPI", "MGI", "KP", "FP", "HAZ", "FBE", "ROV", "MSL", "LAT"];
  for (const ac of acronyms) {
    const acRegex = new RegExp(`\\b${ac}\\b`, "gi");
    cleaned = cleaned.replace(acRegex, ac);
  }

  // 4. Clean trailing / duplicate units
  cleaned = cleaned.replace(/\bCP\s*reading\s*(\d{3,4})\s*(?:immediately|would)\b/gi, "CP reading $1 mV");

  return cleaned.trim();
}

/**
 * AI / Heuristic helper to deduce Debris Material based on standard offshore debris catalog
 */
export function inferDebrisMaterial(debrisText: string): string {
  const lower = (debrisText || "").toLowerCase();
  if (
    lower.includes("scaffold") ||
    lower.includes("pole") ||
    lower.includes("steel") ||
    lower.includes("pipe") ||
    lower.includes("wire rope") ||
    lower.includes("wirerope") ||
    lower.includes("chain") ||
    lower.includes("shackle") ||
    lower.includes("metal") ||
    lower.includes("iron") ||
    lower.includes("drum") ||
    lower.includes("barrel") ||
    lower.includes("plate") ||
    lower.includes("anode") ||
    lower.includes("drill")
  ) {
    return "Metallic";
  }
  if (lower.includes("tyre") || lower.includes("tire") || lower.includes("rubber") || lower.includes("gasket") || lower.includes("hose")) {
    return "Rubber";
  }
  if (lower.includes("plastic") || lower.includes("synthetic") || lower.includes("nylon") || lower.includes("poly") || lower.includes("bottle") || lower.includes("container")) {
    return "Plastic / Synthetic";
  }
  if (lower.includes("rope") || lower.includes("sling") || lower.includes("strap") || lower.includes("textile") || lower.includes("net") || (lower.includes("sack") && !lower.includes("grout")) || (lower.includes("bag") && !lower.includes("grout"))) {
    return "Textile / Rope";
  }
  if (lower.includes("grout") || lower.includes("concrete") || lower.includes("rock") || lower.includes("cement") || lower.includes("mattress")) {
    return "Concrete / Grout";
  }
  if (lower.includes("wood") || lower.includes("timber") || lower.includes("pallet") || lower.includes("log") || lower.includes("plank")) {
    return "Wood / Timber";
  }
  if (lower.includes("aluminium") || lower.includes("aluminum")) {
    return "Aluminium";
  }
  return "Metallic"; // Default engineering standard for industrial offshore debris
}

/**
 * Checks if the spoken debris item matches any item in the library (case-insensitive fuzzy match).
 * If matched -> returns library item name.
 * If new / unlisted -> formats & returns the new item for direct insertion.
 */
export function matchOrInsertDebrisItem(spokenItem: string, customLibrary: string[] = []): string {
  if (!spokenItem || typeof spokenItem !== "string") return "";
  const cleaned = spokenItem.trim().replace(/^debris\s*[:\-]?\s*/i, "").replace(/\s*debris$/i, "").trim();
  if (!cleaned) return spokenItem;

  const library = Array.from(new Set([...customLibrary, ...STANDARD_DEBRIS_LIBRARY]));
  const lowerClean = cleaned.toLowerCase();

  // 1. Check exact or partial matches in the library
  for (const libItem of library) {
    const lowerLib = libItem.toLowerCase();
    if (lowerClean === lowerLib) return libItem;
    if (lowerLib.includes(lowerClean) || lowerClean.includes(lowerLib)) {
      return libItem;
    }
    // Specific synonyms & keywords
    if (lowerClean.includes("scaffold") && lowerLib.includes("scaffold")) return libItem;
    if ((lowerClean.includes("wire rope") || lowerClean.includes("cable")) && lowerLib.includes("wire rope")) return libItem;
    if ((lowerClean.includes("tyre") || lowerClean.includes("tire")) && lowerLib.includes("tyre")) return libItem;
    if (lowerClean.includes("drill") && lowerLib.includes("drill")) return libItem;
    if (lowerClean.includes("grout") && lowerLib.includes("grout")) return libItem;
    if ((lowerClean.includes("chain") || lowerClean.includes("shackle")) && lowerLib.includes("chain")) return libItem;
    if (lowerClean.includes("sling") && lowerLib.includes("sling")) return libItem;
  }

  // 2. If not in library, title-case the new item and insert directly!
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Checks if the debris material matches any item in the library.
 * If matched or inferrable -> returns library material name.
 * If custom/new -> formats & returns new material name.
 */
export function matchOrInsertDebrisMaterial(
  spokenMaterial: string,
  debrisItemName: string = "",
  customLibrary: string[] = []
): string {
  const library = Array.from(new Set([...customLibrary, ...STANDARD_DEBRIS_MATERIAL_LIBRARY]));
  
  if (spokenMaterial && typeof spokenMaterial === "string" && spokenMaterial.trim()) {
    const lowerSpoken = spokenMaterial.trim().toLowerCase();
    for (const libMat of library) {
      if (lowerSpoken === libMat.toLowerCase() || libMat.toLowerCase().includes(lowerSpoken)) {
        return libMat;
      }
    }
    // Return custom new material formatted
    return spokenMaterial.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // If material was not spoken explicitly, infer from debris item using standard library
  return inferDebrisMaterial(debrisItemName);
}
