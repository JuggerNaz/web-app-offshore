import { NextRequest, NextResponse } from "next/server";
import { 
  correctOffshoreTerminology, 
  inferDebrisMaterial,
  matchOrInsertDebrisItem,
  matchOrInsertDebrisMaterial
} from "@/utils/offshore-spellcheck";

export interface ParsedVoiceInspection {
  raw_transcript: string;
  finding_type: "Complete" | "Finding" | "Anomaly" | "Incomplete";
  defect_code?: string;
  defect_type?: string;
  priority?: string;
  findings_summary: string;
  recommendations: string;
  extracted_fields: Record<string, any>;
  additional_readings?: Array<{
    type: "CP" | "UT" | "MGI" | "DIMENSION" | "OTHER";
    reading: number | string;
    clock_position?: string;
    location?: string;
    notes?: string;
  }>;
  confidence_score: number;
}

/**
 * Normalizes spoken speech patterns and corrects Oil & Gas offshore terminology
 */
function normalizeTranscript(text: string): string {
  let s = text.trim();
  // Collapse single digits separated by spaces into full numbers e.g. "1 0 0 1" -> "1001", "1 1 0 1" -> "1101", "9 8 5" -> "985"
  s = s.replace(/(\b\d)\s+(\d)\s+(\d)(?:\s+(\d))?\b/g, (_m, a, b, c, d) => `${a}${b}${c}${d || ""}`);
  s = s.replace(/(\b\d)\s+(\d)\b/g, "$1$2");
  // Collapse spaced decimals e.g. "1 4 . 2" -> "14.2", "1 3 . 8" -> "13.8"
  s = s.replace(/(\b\d{1,2})\s*\.\s*(\d\b)/g, "$1.$2");
  // Apply Oil & Gas phonetic & domain spell check
  s = correctOffshoreTerminology(s);
  return s;
}

/**
 * Normalizes marine growth percentage strings into standard offshore ranges:
 * "0-20%", "20-40%", "40-60%", "60-80%", "80-100%", "All Over", "None"
 */
function normalizeMarineGrowthPercentage(val: string | number): string {
  if (!val) return "";
  const s = String(val).trim();
  if (s.includes("-") || s.toLowerCase().includes("all") || s.toLowerCase().includes("none")) {
    if (s.toLowerCase().includes("all")) return "All Over";
    if (s.toLowerCase().includes("none")) return "0-20%";
    return s.endsWith("%") ? s : `${s}%`;
  }
  const num = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return s;
  if (num === 0) return "0-20%";
  if (num <= 20) return "0-20%";
  if (num <= 40) return "20-40%";
  if (num <= 60) return "40-60%";
  if (num <= 80) return "60-80%";
  return "80-100%";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      transcript,
      inspMethod = "ROV",
      structureType = "platform",
      componentInfo = {},
      activeSpec = "",
      availableFields = [],
    } = body;

    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    const cleanTranscript = normalizeTranscript(transcript);

    // 1. Google Gemini API (Preferred Free / High-Speed Model)
    if (process.env.GOOGLE_API_KEY) {
      try {
        const geminiResult = await parseWithGemini(
          cleanTranscript,
          inspMethod,
          structureType,
          componentInfo,
          activeSpec,
          availableFields,
          process.env.GOOGLE_API_KEY
        );
        if (geminiResult) {
          ensureTelemetriesAndFieldAliases(geminiResult, cleanTranscript);
          return NextResponse.json(geminiResult);
        }
      } catch (err) {
        console.error("Gemini Parse Error, falling back to OpenAI/Rule-based:", err);
      }
    }

    // 2. OpenAI API Fallback
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiResult = await parseWithOpenAI(
          cleanTranscript,
          inspMethod,
          structureType,
          componentInfo,
          activeSpec,
          availableFields,
          process.env.OPENAI_API_KEY
        );
        if (openaiResult) {
          ensureTelemetriesAndFieldAliases(openaiResult, cleanTranscript);
          return NextResponse.json(openaiResult);
        }
      } catch (err) {
        console.error("OpenAI Parse Error, falling back to rule-based:", err);
      }
    }

    // 3. Robust Built-in Offshore Domain Heuristic Fallback
    const fallbackResult = parseWithRules(
      cleanTranscript,
      inspMethod,
      structureType,
      componentInfo,
      activeSpec,
      availableFields
    );

    ensureTelemetriesAndFieldAliases(fallbackResult, cleanTranscript);
    return NextResponse.json(fallbackResult);
  } catch (error: any) {
    console.error("AI Voice Parse Endpoint Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Ensures CP values, UT thickness columns, Debris, Marine Growth percentages, Conditions, field aliases, and Defect Criteria are cleanly populated and validated.
 */
function ensureTelemetriesAndFieldAliases(result: ParsedVoiceInspection, transcript: string) {
  if (!result.extracted_fields) result.extracted_fields = {};
  if (!result.additional_readings) result.additional_readings = [];

  // Oil & Gas Terminology Spell Check on text outputs
  if (result.findings_summary) {
    result.findings_summary = correctOffshoreTerminology(result.findings_summary);
  }
  if (result.recommendations) {
    result.recommendations = correctOffshoreTerminology(result.recommendations);
  }
  if (result.defect_type) {
    result.defect_type = correctOffshoreTerminology(result.defect_type);
  }

  const lower = transcript.toLowerCase();

  // --- 1. Marine Growth Hard & Soft Percentage Coverage ---
  const hardMgMatch = transcript.match(/(?:hard\s*(?:marine\s*growth|mgi|growth|coverage)?)\s*(?:of|is|at|:)?\s*(\d{1,3}(?:\s*-\s*\d{1,3})?%?|\bAll\s*Over\b|\bNone\b)/i) ||
                      transcript.match(/(?:marine\s*growth\s*hard)\s*(?:of|is|at|:)?\s*(\d{1,3}(?:\s*-\s*\d{1,3})?%?|\bAll\s*Over\b|\bNone\b)/i);
  if (hardMgMatch) {
    const rawVal = hardMgMatch[1];
    const norm = normalizeMarineGrowthPercentage(rawVal);
    result.extracted_fields.marine_growth_hard = norm;
    result.extracted_fields.mgi_hard_growth = norm;
    result.extracted_fields.mgi_hard_coverage = norm;
  } else if (result.extracted_fields.marine_growth_hard) {
    result.extracted_fields.marine_growth_hard = normalizeMarineGrowthPercentage(result.extracted_fields.marine_growth_hard);
    result.extracted_fields.mgi_hard_growth = result.extracted_fields.marine_growth_hard;
    result.extracted_fields.mgi_hard_coverage = result.extracted_fields.marine_growth_hard;
  }

  const softMgMatch = transcript.match(/(?:soft\s*(?:marine\s*growth|mgi|growth|coverage)?)\s*(?:of|is|at|:)?\s*(\d{1,3}(?:\s*-\s*\d{1,3})?%?|\bAll\s*Over\b|\bNone\b)/i) ||
                      transcript.match(/(?:marine\s*growth\s*soft)\s*(?:of|is|at|:)?\s*(\d{1,3}(?:\s*-\s*\d{1,3})?%?|\bAll\s*Over\b|\bNone\b)/i);
  if (softMgMatch) {
    const rawVal = softMgMatch[1];
    const norm = normalizeMarineGrowthPercentage(rawVal);
    result.extracted_fields.marine_growth_soft = norm;
    result.extracted_fields.mgi_soft_growth = norm;
    result.extracted_fields.mgi_soft_coverage = norm;
  } else if (result.extracted_fields.marine_growth_soft) {
    result.extracted_fields.marine_growth_soft = normalizeMarineGrowthPercentage(result.extracted_fields.marine_growth_soft);
    result.extracted_fields.mgi_soft_growth = result.extracted_fields.marine_growth_soft;
    result.extracted_fields.mgi_soft_coverage = result.extracted_fields.marine_growth_soft;
  }

  // --- 2. Debris & Debris Material Auto-Fill / Library Matching ---
  if (result.extracted_fields.debris || lower.includes("debris") || lower.includes("scaffold") || lower.includes("wire rope") || lower.includes("tyre") || lower.includes("grout bag") || lower.includes("drill pipe") || lower.includes("chain") || lower.includes("shackle") || lower.includes("metal") || lower.includes("pipe")) {
    let rawDebris = result.extracted_fields.debris;
    if (!rawDebris) {
      if (lower.includes("scaffold") || lower.includes("pole")) {
        rawDebris = "Scaffolding Pole";
      } else if (lower.includes("wire rope") || lower.includes("wirerope")) {
        rawDebris = "Wire Rope";
      } else if (lower.includes("tyre") || lower.includes("tire")) {
        rawDebris = "Tyre";
      } else if (lower.includes("drill pipe") || lower.includes("drill string")) {
        rawDebris = "Drill Pipe / String";
      } else if (lower.includes("anode sled")) {
        rawDebris = "Anode Sled";
      } else if (lower.includes("grout bag")) {
        rawDebris = "Grout Bag";
      } else if (lower.includes("chain") || lower.includes("shackle")) {
        rawDebris = "Chain / Shackle";
      } else {
        const debMatch = transcript.match(/(?:debris\s*(?:is|of|type|description|:)?\s*([a-zA-Z0-9\s\/\-_]+?)(?:\s*(?:found|observed|at|with|made|material|coating|condition|\.|\,|$)))/i) ||
                         transcript.match(/([a-zA-Z0-9\s\/\-_]+?)\s*debris/i);
        rawDebris = debMatch ? debMatch[1].trim() : "Debris Observed";
      }
    }

    // 1. Check & match library list first, if not in library -> insert new item directly!
    const matchedDebris = matchOrInsertDebrisItem(rawDebris);
    result.extracted_fields.debris = matchedDebris;

    // 2. Check & match material from library, if not in library -> insert new material!
    const rawMaterial = result.extracted_fields.debris_material || "";
    result.extracted_fields.debris_material = matchOrInsertDebrisMaterial(rawMaterial, matchedDebris);
  }

  // --- 3. Coating Condition Auto-Fill ---
  if (!result.extracted_fields.coating_condition) {
    if (lower.includes("bare metal") || lower.includes("exposed steel") || lower.includes("coating loss") || lower.includes("coating gone")) {
      result.extracted_fields.coating_condition = "Bare Metal Showing";
    } else if (lower.includes("coating cracked longitudinally") || lower.includes("longitudinal crack")) {
      result.extracted_fields.coating_condition = "Coating Cracked Longitudinally";
    } else if (lower.includes("coating cracked circumferentially") || lower.includes("circumferential crack")) {
      result.extracted_fields.coating_condition = "Coating Cracked Circumferentially";
    } else if (lower.includes("coating cracked") || lower.includes("cracked coating")) {
      result.extracted_fields.coating_condition = "Coating Cracked";
    } else if (lower.includes("superficial damage") || lower.includes("scratched coating") || lower.includes("light scratch")) {
      result.extracted_fields.coating_condition = "Superficial Damage";
    } else if (lower.includes("coating good") || lower.includes("coating in good") || lower.includes("coating intact")) {
      result.extracted_fields.coating_condition = "Good";
    } else if (lower.includes("coating satisfactory")) {
      result.extracted_fields.coating_condition = "Satisfactory";
    } else if (lower.includes("no coating") || lower.includes("uncoated")) {
      result.extracted_fields.coating_condition = "None";
    }
  }

  // --- 4. Component Condition Auto-Fill ---
  if (!result.extracted_fields.component_condition) {
    if (lower.includes("dent at 12") || lower.includes("dent: at 12")) {
      result.extracted_fields.component_condition = "Dent: At 12 'O Clock";
    } else if (lower.includes("dent at 3") || lower.includes("dent: at 3")) {
      result.extracted_fields.component_condition = "Dent: At 3 'O Clock";
    } else if (lower.includes("dent at 6") || lower.includes("dent: at 6")) {
      result.extracted_fields.component_condition = "Dent: At 6 'O Clock";
    } else if (lower.includes("dent at 9") || lower.includes("dent: at 9")) {
      result.extracted_fields.component_condition = "Dent: At 9 'O Clock";
    } else if (lower.includes("ruptured") || lower.includes("rupture")) {
      result.extracted_fields.component_condition = "Ruptured";
    } else if (lower.includes("fitting") || lower.includes("fittings damaged")) {
      result.extracted_fields.component_condition = "Fittings";
    } else if (lower.includes("component in good") || lower.includes("component good") || lower.includes("member good")) {
      result.extracted_fields.component_condition = "Good";
    } else if (lower.includes("component satisfactory") || lower.includes("member satisfactory")) {
      result.extracted_fields.component_condition = "Satisfactory";
    }
  }

  // --- 5. CP Readings Handling ---
  const isExplicitAdditionalCp =
    lower.includes("another cp") ||
    lower.includes("second cp") ||
    lower.includes("2nd cp") ||
    lower.includes("additional cp") ||
    lower.includes("extra cp");

  const cpVal =
    result.extracted_fields.cp_rdg ??
    result.extracted_fields.cp_fg_rdg ??
    result.extracted_fields.cp_reading ??
    result.extracted_fields.cp ??
    result.extracted_fields.cp_potential;

  if (cpVal !== undefined && cpVal !== null && cpVal !== "") {
    result.extracted_fields.cp_rdg = cpVal;
    result.extracted_fields.cp_fg_rdg = cpVal;
    result.extracted_fields.cp_reading = cpVal;
    result.extracted_fields.cp = cpVal;
    result.extracted_fields.cp_potential = cpVal;
  } else {
    const cpMatches = Array.from(
      transcript.matchAll(/(?:cp|cathodic|potential|stab)?\s*(?:reading|value|is|at|level)?\s*(?:of|:)?\s*(?:minus|negative|-)\s*(\d{3,4}(?:\.\d+)?)/gi)
    );
    const fallbackMatches = cpMatches.length > 0 ? cpMatches : Array.from(
      transcript.matchAll(/(?:cp|cathodic|potential|stab)\s*(?:reading|value|is|at|level)?\s*(?:of|:)?\s*(?:minus|negative|-)?\s*(\d{3,4}(?:\.\d+)?)/gi)
    );

    if (fallbackMatches.length > 0) {
      let firstVal = parseFloat(fallbackMatches[0][1]);
      if (fallbackMatches[0][0].toLowerCase().includes("minus") || fallbackMatches[0][0].toLowerCase().includes("negative") || fallbackMatches[0][0].includes("-")) {
        firstVal = -Math.abs(firstVal);
      } else if (firstVal > 500) {
        firstVal = -firstVal;
      }

      if (isExplicitAdditionalCp) {
        result.additional_readings.push({
          type: "CP",
          reading: firstVal,
          location: "Additional CP",
        });
      } else {
        result.extracted_fields.cp_rdg = firstVal;
        result.extracted_fields.cp_fg_rdg = firstVal;
        result.extracted_fields.cp_reading = firstVal;
        result.extracted_fields.cp = firstVal;
        result.extracted_fields.cp_potential = firstVal;
      }

      for (let i = 1; i < fallbackMatches.length; i++) {
        let val = parseFloat(fallbackMatches[i][1]);
        if (fallbackMatches[i][0].toLowerCase().includes("minus") || fallbackMatches[i][0].toLowerCase().includes("negative") || fallbackMatches[i][0].includes("-")) {
          val = -Math.abs(val);
        } else if (val > 500) {
          val = -val;
        }
        result.additional_readings.push({
          type: "CP",
          reading: val,
          location: `Additional CP ${i}`,
        });
      }
    }
  }

  // Ensure additional_readings does NOT contain duplicate of the primary CP reading
  if (result.extracted_fields.cp_rdg !== undefined && result.additional_readings.length > 0 && !isExplicitAdditionalCp) {
    const primaryCp = result.extracted_fields.cp_rdg;
    const cpIndices = result.additional_readings
      .map((r, i) => (r.type === "CP" && r.reading === primaryCp ? i : -1))
      .filter((i) => i !== -1);
    if (cpIndices.length > 0) {
      result.additional_readings.splice(cpIndices[0], 1);
    }
  }

  // --- 6. UT Readings Handling (Deduplicate default 12, 3, 6, 9 from additional_readings) ---
  const defaultUtClocks = ["12", "3", "6", "9"];
  const defaultUtKeys = ["ut_12_o_clock", "ut_3_o_clock", "ut_6_o_clock", "ut_9_o_clock"];
  const addReadings = result.additional_readings || (result.additional_readings = []);
  
  defaultUtClocks.forEach((clk, i) => {
    const key = defaultUtKeys[i];
    const defaultVal = result.extracted_fields[key];
    if (defaultVal !== undefined && defaultVal !== null && defaultVal !== "") {
      const dupIdx = addReadings.findIndex(
        (r) => r.type === "UT" && r.clock_position === clk && Number(r.reading) === Number(defaultVal)
      );
      if (dupIdx !== -1) {
        addReadings.splice(dupIdx, 1);
      }
    }
  });

  // --- 7. Automatic Defect Criteria & Anomaly Flagging Validation ---
  const primaryCpVal = Number(result.extracted_fields.cp_rdg);
  if (!isNaN(primaryCpVal) && primaryCpVal !== 0) {
    // Standard offshore protection criteria: -800mV to -1050mV
    if (primaryCpVal > -800) {
      result.finding_type = "Anomaly";
      result.defect_code = "Cathodic Protection";
      result.defect_type = `CP Under-Protection (${primaryCpVal}mV > -800mV Criteria)`;
      result.priority = "High";
      if (!result.recommendations || result.recommendations.includes("No immediate")) {
        result.recommendations = "CP potential breached -800mV acceptance criteria. Inspect sacrificial anodes and plan retrofit campaign.";
      }
    } else if (primaryCpVal < -1150) {
      result.finding_type = "Anomaly";
      result.defect_code = "Cathodic Protection";
      result.defect_type = `CP Over-Protection (${primaryCpVal}mV < -1150mV Criteria)`;
      result.priority = "High";
      if (!result.recommendations || result.recommendations.includes("No immediate")) {
        result.recommendations = "Investigate over-protection potential and hydrogen embrittlement risk.";
      }
    }
  }

  // Coating condition criteria check
  const coating = String(result.extracted_fields.coating_condition || "").toLowerCase();
  if (coating.includes("bare metal") || coating.includes("cracked")) {
    result.finding_type = "Anomaly";
    if (!result.defect_code) result.defect_code = "Coating";
    if (!result.defect_type) result.defect_type = result.extracted_fields.coating_condition;
    if (!result.priority) result.priority = "Medium";
  }

  // Component condition criteria check
  const compCond = String(result.extracted_fields.component_condition || "").toLowerCase();
  if (compCond.includes("dent") || compCond.includes("rupture") || compCond.includes("defect")) {
    result.finding_type = "Anomaly";
    if (!result.defect_code) result.defect_code = compCond.includes("dent") ? "Mechanical Damage / Dent" : "Structural Defect";
    if (!result.defect_type) result.defect_type = result.extracted_fields.component_condition;
    result.priority = "High";
  }

  // Debris criteria check
  if (result.extracted_fields.debris && result.extracted_fields.debris !== "None") {
    if (result.finding_type !== "Anomaly") {
      result.finding_type = "Finding";
      if (!result.defect_code) result.defect_code = "Debris";
      if (!result.defect_type) result.defect_type = `${result.extracted_fields.debris} (${result.extracted_fields.debris_material || "Debris"})`;
      if (!result.priority) result.priority = "Medium";
    }
  }
}

// ============================================================================
// GEMINI PARSER
// ============================================================================
async function parseWithGemini(
  transcript: string,
  inspMethod: string,
  structureType: string,
  componentInfo: any,
  activeSpec: string,
  availableFields: string[],
  apiKey: string
): Promise<ParsedVoiceInspection | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const systemPrompt = `You are an expert offshore marine inspection AI assistant for Subsea & Structural integrity (ROV and Diving surveys for offshore Platforms and Pipelines).
Your job is to parse spoken voice logs into structured inspection telemetry, perform automatic spelling correction for Oil & Gas domain terms, check defect acceptance criteria, and generate professional engineering findings summaries and recommendations.

CURRENT INSPECTION CONTEXT:
- Inspection Method: ${inspMethod} (ROV or DIVING)
- Structure Type: ${structureType} (platform or pipeline)
- Active Component: ${componentInfo?.name || "N/A"} (${componentInfo?.type || "N/A"})
- Component Depth/Elevation: ${componentInfo?.elevation || componentInfo?.depth || "N/A"}
- Active Inspection Task/Spec Code: ${activeSpec || "GENERAL"}
- Target Form Available Fields: ${JSON.stringify(availableFields)}

CRITICAL DEFECT ACCEPTANCE CRITERIA & ANOMALY FLAGGING:
1. CP ACCEPTANCE CRITERIA: Standard protection is -800mV to -1050mV. If CP reading is more positive than -800mV (e.g. -750mV, -680mV, -500mV) or more negative than -1150mV, YOU MUST CLASSIFY finding_type = "Anomaly", priority = "High", defect_code = "Cathodic Protection".
2. COATING CRITERIA: If coating is "Bare Metal Showing" or "Coating Cracked", YOU MUST CLASSIFY finding_type = "Anomaly", defect_code = "Coating".
3. COMPONENT INTEGRITY: If component has Dents, Cracks, or Ruptures, YOU MUST CLASSIFY finding_type = "Anomaly", priority = "High".
4. DEBRIS: If debris is present, classify finding_type = "Finding" (or "Anomaly" if heavy/metallic hazard).
5. If all values are within normal limits and no damage exists, classify finding_type = "Complete".

CRITICAL MARINE GROWTH PERCENTAGE RULES:
- Map Hard and Soft Marine Growth percentage/coverage to the standard range list: "0-20%" | "20-40%" | "40-60%" | "60-80%" | "80-100%" | "All Over" | "None".

CRITICAL DEBRIS & MATERIAL SUGGESTIONS:
- "debris": Match against standard library if possible, or insert new item.
- "debris_material": Intelligently suggest material type ("Metallic" | "Steel" | "Rubber" | "Concrete / Grout" | "Textile / Rope" | "Plastic / Synthetic").

CP & UT TELEMETRY RULES:
1. CP READINGS: First CP -> extracted_fields.cp_rdg. Subsequent CPs -> additional_readings array.
2. UT THICKNESS: Readings at 12, 3, 6, 9 o'clock -> "ut_12_o_clock", "ut_3_o_clock", "ut_6_o_clock", "ut_9_o_clock". Other angles -> additional_readings.

OUTPUT REQUIREMENTS:
Return pure JSON conforming to this schema:
{
  "raw_transcript": "${transcript.replace(/"/g, '\\"')}",
  "finding_type": "Complete" | "Finding" | "Anomaly" | "Incomplete",
  "defect_code": "Cathodic Protection | Coating | Mechanical Damage | Debris | Marine Growth | etc.",
  "defect_type": "string",
  "priority": "Low" | "Medium" | "High" | "Critical" | "Anomalous" | "",
  "findings_summary": "Clean, concise engineering summary with correct Oil & Gas terminology.",
  "recommendations": "Clear, actionable engineering recommendations with correct Oil & Gas terminology.",
  "extracted_fields": {
    "marine_growth_hard": "0-20% | 20-40% | 40-60% | 60-80% | 80-100% | All Over",
    "marine_growth_soft": "0-20% | 20-40% | 40-60% | 60-80% | 80-100% | All Over",
    "debris": "string (e.g. 'Scaffolding Pole')",
    "debris_material": "Metallic | Rubber | Concrete / Grout | etc.",
    "coating_condition": "Good | Bare Metal Showing | Coating Cracked | etc.",
    "component_condition": "Good | Satisfactory | Dent: At 3 'O Clock | etc.",
    "cp_rdg": "number (first CP reading, e.g. -1101)",
    "cp_fg_rdg": "number (first CP reading, e.g. -1101)",
    "verification_depth": "number or string",
    "fp_kp": "number or string",
    "mgi_hard_thickness_at_12": "number",
    "ut_12_o_clock": "number",
    "ut_3_o_clock": "number",
    "ut_6_o_clock": "number",
    "ut_9_o_clock": "number"
  },
  "additional_readings": [],
  "confidence_score": 0.95
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          { text: `SPOKEN VOICE TRANSCRIPT:\n"${transcript}"` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini API call failed:", errText);
    return null;
  }

  const json = await res.json();
  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  try {
    const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    parsed.raw_transcript = transcript;
    return parsed;
  } catch (e) {
    console.error("Failed to parse Gemini JSON response:", e, rawText);
    return null;
  }
}

// ============================================================================
// OPENAI PARSER
// ============================================================================
async function parseWithOpenAI(
  transcript: string,
  inspMethod: string,
  structureType: string,
  componentInfo: any,
  activeSpec: string,
  availableFields: string[],
  apiKey: string
): Promise<ParsedVoiceInspection | null> {
  const url = "https://api.openai.com/v1/chat/completions";

  const prompt = `You are an expert offshore marine inspection AI assistant for Subsea & Structural integrity.
Context: Method=${inspMethod}, Structure=${structureType}, Component=${componentInfo?.name || "N/A"}, Spec=${activeSpec || "GENERAL"}, Fields=${JSON.stringify(availableFields)}.

ACCEPTANCE CRITERIA:
- CP protection limit: -800mV to -1050mV. If CP > -800mV or < -1150mV, flag as Anomaly (High priority, Cathodic Protection).
- If Bare Metal Showing, Coating Cracked, Dents, Cracks, Rupture, flag as Anomaly.
- If Debris, flag as Finding.

Parse the spoken voice transcript into structured JSON:
{
  "raw_transcript": "${transcript.replace(/"/g, '\\"')}",
  "finding_type": "Complete" | "Finding" | "Anomaly" | "Incomplete",
  "defect_code": "Cathodic Protection | Coating | Mechanical Damage | Debris",
  "defect_type": "string",
  "priority": "High | Medium | Low",
  "findings_summary": "Professional summary with correct Oil & Gas terminology",
  "recommendations": "Actionable engineering recommendations",
  "extracted_fields": {
    "marine_growth_hard": "40-60%",
    "marine_growth_soft": "0-20%",
    "debris": "Scaffolding Pole",
    "debris_material": "Metallic",
    "coating_condition": "Good",
    "component_condition": "Satisfactory"
  },
  "additional_readings": [],
  "confidence_score": 0.95
}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Spoken transcript:\n${transcript}` },
      ],
    }),
  });

  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  const rawText = json?.choices?.[0]?.message?.content;
  if (!rawText) return null;

  try {
    const parsed = JSON.parse(rawText);
    parsed.raw_transcript = transcript;
    return parsed;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// HEURISTIC / REGEX RULE-BASED FALLBACK PARSER
// ============================================================================
function parseWithRules(
  transcript: string,
  inspMethod: string,
  structureType: string,
  componentInfo: any,
  activeSpec: string,
  availableFields: string[]
): ParsedVoiceInspection {
  const extracted_fields: Record<string, any> = {};
  const additional_readings: ParsedVoiceInspection["additional_readings"] = [];
  const lower = transcript.toLowerCase();

  // 1. Marine Growth Hard & Soft Percentage
  const hardMgMatch = transcript.match(/(?:hard\s*(?:marine\s*growth|mgi|growth|coverage)?)\s*(?:of|is|at|:)?\s*(\d{1,3}(?:\s*-\s*\d{1,3})?%?|\bAll\s*Over\b|\bNone\b)/i) ||
                      transcript.match(/(?:marine\s*growth\s*hard)\s*(?:of|is|at|:)?\s*(\d{1,3}(?:\s*-\s*\d{1,3})?%?|\bAll\s*Over\b|\bNone\b)/i);
  if (hardMgMatch) {
    const norm = normalizeMarineGrowthPercentage(hardMgMatch[1]);
    extracted_fields.marine_growth_hard = norm;
    extracted_fields.mgi_hard_growth = norm;
    extracted_fields.mgi_hard_coverage = norm;
  }

  const softMgMatch = transcript.match(/(?:soft\s*(?:marine\s*growth|mgi|growth|coverage)?)\s*(?:of|is|at|:)?\s*(\d{1,3}(?:\s*-\s*\d{1,3})?%?|\bAll\s*Over\b|\bNone\b)/i) ||
                      transcript.match(/(?:marine\s*growth\s*soft)\s*(?:of|is|at|:)?\s*(\d{1,3}(?:\s*-\s*\d{1,3})?%?|\bAll\s*Over\b|\bNone\b)/i);
  if (softMgMatch) {
    const norm = normalizeMarineGrowthPercentage(softMgMatch[1]);
    extracted_fields.marine_growth_soft = norm;
    extracted_fields.mgi_soft_growth = norm;
    extracted_fields.mgi_soft_coverage = norm;
  }

  // 2. Debris & Debris Material
  if (lower.includes("debris") || lower.includes("scaffold") || lower.includes("wire rope") || lower.includes("tyre") || lower.includes("grout bag") || lower.includes("drill pipe")) {
    let rawDebris = "";
    if (lower.includes("scaffold") || lower.includes("pole")) {
      rawDebris = "Scaffolding Pole";
    } else if (lower.includes("wire rope") || lower.includes("wirerope")) {
      rawDebris = "Wire Rope";
    } else if (lower.includes("tyre") || lower.includes("tire")) {
      rawDebris = "Tyre";
    } else if (lower.includes("drill pipe") || lower.includes("drill string")) {
      rawDebris = "Drill Pipe / String";
    } else if (lower.includes("anode sled")) {
      rawDebris = "Anode Sled";
    } else if (lower.includes("grout bag")) {
      rawDebris = "Grout Bag";
    } else if (lower.includes("chain") || lower.includes("shackle")) {
      rawDebris = "Chain / Shackle";
    } else {
      rawDebris = "Debris Observed";
    }
    extracted_fields.debris = matchOrInsertDebrisItem(rawDebris);
    extracted_fields.debris_material = matchOrInsertDebrisMaterial("", extracted_fields.debris);
  }

  // 3. Coating Condition
  if (lower.includes("bare metal") || lower.includes("exposed steel") || lower.includes("coating loss") || lower.includes("coating gone")) {
    extracted_fields.coating_condition = "Bare Metal Showing";
  } else if (lower.includes("coating cracked longitudinally") || lower.includes("longitudinal crack")) {
    extracted_fields.coating_condition = "Coating Cracked Longitudinally";
  } else if (lower.includes("coating cracked circumferentially") || lower.includes("circumferential crack")) {
    extracted_fields.coating_condition = "Coating Cracked Circumferentially";
  } else if (lower.includes("coating cracked") || lower.includes("cracked coating")) {
    extracted_fields.coating_condition = "Coating Cracked";
  } else if (lower.includes("superficial damage") || lower.includes("scratched coating") || lower.includes("light scratch")) {
    extracted_fields.coating_condition = "Superficial Damage";
  } else if (lower.includes("coating good") || lower.includes("coating in good") || lower.includes("coating intact")) {
    extracted_fields.coating_condition = "Good";
  } else if (lower.includes("coating satisfactory")) {
    extracted_fields.coating_condition = "Satisfactory";
  }

  // 4. Component Condition
  if (lower.includes("dent at 12") || lower.includes("dent: at 12")) {
    extracted_fields.component_condition = "Dent: At 12 'O Clock";
  } else if (lower.includes("dent at 3") || lower.includes("dent: at 3")) {
    extracted_fields.component_condition = "Dent: At 3 'O Clock";
  } else if (lower.includes("dent at 6") || lower.includes("dent: at 6")) {
    extracted_fields.component_condition = "Dent: At 6 'O Clock";
  } else if (lower.includes("dent at 9") || lower.includes("dent: at 9")) {
    extracted_fields.component_condition = "Dent: At 9 'O Clock";
  } else if (lower.includes("ruptured") || lower.includes("rupture")) {
    extracted_fields.component_condition = "Ruptured";
  } else if (lower.includes("fitting") || lower.includes("fittings damaged")) {
    extracted_fields.component_condition = "Fittings";
  } else if (lower.includes("component in good") || lower.includes("component good") || lower.includes("member good")) {
    extracted_fields.component_condition = "Good";
  } else if (lower.includes("component satisfactory") || lower.includes("member satisfactory")) {
    extracted_fields.component_condition = "Satisfactory";
  }

  // 5. CP Readings
  const isExplicitAdditionalCp =
    lower.includes("another cp") ||
    lower.includes("second cp") ||
    lower.includes("2nd cp") ||
    lower.includes("additional cp") ||
    lower.includes("extra cp");

  const cpMatches = Array.from(
    transcript.matchAll(/(?:cp|cathodic|potential|stab)?\s*(?:reading|value|is|at|level)?\s*(?:of|:)?\s*(?:minus|negative|-)\s*(\d{3,4}(?:\.\d+)?)/gi)
  );

  const fallbackCpMatches = cpMatches.length > 0 ? cpMatches : Array.from(
    transcript.matchAll(/(?:cp|cathodic|potential|stab)\s*(?:reading|value|is|at|level)?\s*(?:of|:)?\s*(?:minus|negative|-)?\s*(\d{3,4}(?:\.\d+)?)/gi)
  );

  if (fallbackCpMatches.length > 0) {
    let rawStr = fallbackCpMatches[0][1];
    let cpVal = parseFloat(rawStr);
    const fullMatchText = fallbackCpMatches[0][0].toLowerCase();
    
    if (fullMatchText.includes("minus") || fullMatchText.includes("negative") || fullMatchText.includes("-")) {
      cpVal = -Math.abs(cpVal);
    } else if (cpVal > 500) {
      cpVal = -cpVal;
    }

    if (isExplicitAdditionalCp) {
      additional_readings.push({
        type: "CP",
        reading: cpVal,
        location: "Additional CP",
      });
    } else {
      extracted_fields.cp_rdg = cpVal;
      extracted_fields.cp_fg_rdg = cpVal;
      extracted_fields.cp_reading = cpVal;
      extracted_fields.cp = cpVal;
      extracted_fields.cp_potential = cpVal;
    }

    for (let idx = 1; idx < fallbackCpMatches.length; idx++) {
      const m = fallbackCpMatches[idx];
      let val = parseFloat(m[1]);
      const mText = m[0].toLowerCase();
      if (mText.includes("minus") || mText.includes("negative") || mText.includes("-")) {
        val = -Math.abs(val);
      } else if (val > 500) {
        val = -val;
      }
      additional_readings.push({
        type: "CP",
        reading: val,
        location: `Additional CP ${idx}`,
      });
    }
  }

  // 6. Elevation / Depth / KP
  const elevMatch = transcript.match(/(?:elevation|elev|depth|at)\s*(?:is|of|level)?\s*(-?\d+(?:\.\d+)?)\s*(?:m|meters|meter|ft|feet)?/i);
  if (elevMatch) {
    extracted_fields.verification_depth = elevMatch[1];
    extracted_fields.depth = elevMatch[1];
    extracted_fields.elevation = elevMatch[1];
  }

  const kpMatch = transcript.match(/(?:kp|kilometer post|fp|field post)\s*(?:is|at|of)?\s*(\d+(?:\.\d+)?)/i);
  if (kpMatch) {
    extracted_fields.fp_kp = kpMatch[1];
    extracted_fields.kp = kpMatch[1];
  }

  // 7. Marine Growth Thickness
  const mgMatch = transcript.match(/(?:marine growth|mgi|fouling|thickness)\s*(?:of|is|at)?\s*(\d+(?:\.\d+)?)\s*(?:mm|millimeter|millimeters)?/i);
  if (mgMatch) {
    const mgVal = parseFloat(mgMatch[1]);
    extracted_fields.mgi_hard_thickness_at_12 = mgVal;
    extracted_fields.mgi_thickness = mgVal;
    extracted_fields.marine_growth_thickness = mgVal;
  }

  // 8. UT Thickness Readings
  const isExplicitAdditionalUt =
    lower.includes("another ut") ||
    lower.includes("additional ut") ||
    lower.includes("extra ut");

  const utMatches = Array.from(
    transcript.matchAll(/(?:ut|wall thickness|wt|thickness)\s*(?:reading|at|of|is)?\s*(\d{1,2}(?:\.\d+)?)\s*(?:mm|millimeter)?(?:\s*at\s*(\d{1,2})\s*(?:o'?clock|clk|clock))?/gi)
  );

  if (utMatches.length > 0) {
    utMatches.forEach((m) => {
      const val = parseFloat(m[1]);
      const clk = m[2];

      if (isExplicitAdditionalUt) {
        additional_readings.push({
          type: "UT",
          reading: val,
          clock_position: clk || "",
          location: clk ? `${clk} o'clock` : "Additional UT Reading",
        });
      } else if (clk === "12" && extracted_fields.ut_12_o_clock === undefined) {
        extracted_fields.ut_12_o_clock = val;
      } else if (clk === "3" && extracted_fields.ut_3_o_clock === undefined) {
        extracted_fields.ut_3_o_clock = val;
      } else if (clk === "6" && extracted_fields.ut_6_o_clock === undefined) {
        extracted_fields.ut_6_o_clock = val;
      } else if (clk === "9" && extracted_fields.ut_9_o_clock === undefined) {
        extracted_fields.ut_9_o_clock = val;
      } else if (!clk && extracted_fields.min_reading === undefined && extracted_fields.ut_12_o_clock === undefined) {
        extracted_fields.min_reading = val;
      } else {
        additional_readings.push({
          type: "UT",
          reading: val,
          clock_position: clk || "",
          location: clk ? `${clk} o'clock` : "Additional UT Reading",
        });
      }
    });
  }

  // 9. Defect & Finding Classification
  let finding_type: ParsedVoiceInspection["finding_type"] = "Complete";
  let defect_code = "";
  let defect_type = "";
  let priority = "";

  const parsedCp = Number(extracted_fields.cp_rdg);
  if (!isNaN(parsedCp) && parsedCp !== 0 && (parsedCp > -800 || parsedCp < -1150)) {
    finding_type = "Anomaly";
    defect_code = "Cathodic Protection";
    defect_type = parsedCp > -800 ? `CP Under-Protection (${parsedCp}mV > -800mV)` : `CP Over-Protection (${parsedCp}mV < -1150mV)`;
    priority = "High";
  } else if (extracted_fields.coating_condition && (extracted_fields.coating_condition.includes("Bare Metal") || extracted_fields.coating_condition.includes("Cracked"))) {
    finding_type = "Anomaly";
    defect_code = "Coating";
    defect_type = extracted_fields.coating_condition;
    priority = "Medium";
  } else if (extracted_fields.component_condition && (extracted_fields.component_condition.includes("Dent") || extracted_fields.component_condition.includes("Ruptured"))) {
    finding_type = "Anomaly";
    defect_code = extracted_fields.component_condition.includes("Dent") ? "Mechanical Damage / Dent" : "Structural Defect";
    defect_type = extracted_fields.component_condition;
    priority = "High";
  } else if (lower.includes("crack") || lower.includes("severely damaged") || lower.includes("critical") || lower.includes("heavy loss")) {
    finding_type = "Anomaly";
    defect_code = "Mechanical Damage / Crack";
    defect_type = "Crack Indication";
    priority = "High";
  } else if (lower.includes("corrosion") || lower.includes("pitting") || lower.includes("rust") || lower.includes("metal loss")) {
    finding_type = "Anomaly";
    defect_code = "Corrosion";
    defect_type = lower.includes("pitting") ? "Pitting Corrosion" : "General Corrosion";
    priority = "Medium";
  } else if (lower.includes("debris") || lower.includes("scaffold") || lower.includes("wire rope") || lower.includes("tyre") || lower.includes("grout bag") || lower.includes("drill pipe")) {
    finding_type = "Finding";
    defect_code = "Debris";
    defect_type = extracted_fields.debris ? `${extracted_fields.debris} Debris` : "Debris";
    priority = "Medium";
  } else if (lower.includes("scour") || lower.includes("freespan") || lower.includes("free span")) {
    finding_type = "Finding";
    defect_code = lower.includes("freespan") ? "Free Span" : "Scour";
    defect_type = defect_code;
    priority = "Medium";
  } else if (lower.includes("marine growth") || lower.includes("fouling") || lower.includes("barnacle")) {
    finding_type = "Finding";
    defect_code = "Marine Growth";
    defect_type = "Hard / Soft Fouling";
    priority = "Low";
  } else if (lower.includes("incomplete") || lower.includes("aborted") || lower.includes("visibility issue")) {
    finding_type = "Incomplete";
  }

  // 10. Generate Summary & Recommendations with Oil & Gas Spell Check
  const rawSummary = transcript.length > 10 
    ? `${componentInfo?.name ? componentInfo.name + ": " : ""}${transcript}` 
    : "Visual inspection completed as observed.";
  const findings_summary = correctOffshoreTerminology(rawSummary);

  let recommendations = "";
  if (finding_type === "Anomaly") {
    if (defect_code === "Cathodic Protection") {
      recommendations = "CP potential breached -800mV acceptance criteria. Inspect sacrificial anodes and plan retrofit campaign.";
    } else {
      recommendations = "Conduct close visual inspection and ultrasonic grid thickness profiling during next maintenance campaign.";
    }
  } else if (finding_type === "Finding") {
    if (defect_code === "Debris") {
      recommendations = "Log debris location, evaluate clearance from structure, and schedule for ROV/diver recovery campaign.";
    } else {
      recommendations = "Monitor condition and record in periodic integrity management register.";
    }
  } else if (finding_type === "Complete") {
    recommendations = "No immediate maintenance action required. Continue standard routine inspection interval.";
  }

  return {
    raw_transcript: transcript,
    finding_type,
    defect_code,
    defect_type,
    priority,
    findings_summary,
    recommendations,
    extracted_fields,
    additional_readings,
    confidence_score: 0.95,
  };
}
