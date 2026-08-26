/**
 * Standardizes inspection type names for UI consistency.
 * Specifically corrects "Ut Wall Thickness", maps legacy Oracle codes to full names, and normalizes prefixes.
 */

export const INSPECTION_TYPE_NAMES: Record<string, string> = {
  "NAVIG": "Pipeline Navigation Inspection",
  "ROVCLB": "ROV Sensor Calibration",
  "PLATGI": "Platform General Visual Inspection",
  "BSINS": "Bolted Support Inspection (Diving)",
  "CLEAN": "Cleaning Inspection",
  "CPSURV": "CP Survey / Cathodic Protection",
  "CVINS": "Close Visual Inspection (Diving)",
  "RCASN": "Caisson Inspection (ROV)",
  "DCASN": "Caisson Inspection (Diving)",
  "RGVI": "General Visual Inspection (ROV)",
  "DGVI": "General Visual Inspection (Diving)",
  "RRISI": "Riser Inspection (ROV)",
  "DRISI": "Riser Inspection (Diving)",
  "UTWTK": "UT Wall Thickness Inspection",
  "DUTWT": "UT Wall Thickness Inspection (Diving)",
  "RUTWT": "UT Wall Thickness Inspection (ROV)",
  "RSZCI": "Splash Zone Close Visual Inspection (ROV)",
  "DSZCI": "Splash Zone Close Visual Inspection (Diving)",
  "SZONE": "Splash Zone Inspection",
  "RCOND": "Conductor Inspection (ROV)",
  "DCOND": "Conductor Inspection (Diving)",
  "RMGI": "Marine Growth Inspection (ROV)",
  "DMGI": "Marine Growth Inspection (Diving)",
  "RFMD": "Flooded Member Detection (ROV)",
  "DFMD": "Flooded Member Detection (Diving)",
  "RSCOR": "Scour Inspection (ROV)",
  "DSCOR": "Scour Inspection (Diving)",
  "RSWNI": "Structural Weld & Node Inspection (ROV)",
  "DSWNI": "Structural Weld & Node Inspection (Diving)",
  "RSANI": "Anode Inspection (ROV)",
  "ANMAIN": "Anode Maintenance Inspection",
  "CPCLB": "CP Contact / Stab Calibration",
  "UTCLB": "UT Thickness Calibration",
  "ACFMC": "ACFM Crack Inspection (Diving)",
  "PLCO": "Pipeline Crossing Inspection",
  "PL_CO": "Pipeline Crossing Inspection",
  "GVINS": "General Visual Inspection (Diving)",
  "MPINS": "Magnetic Particle Inspection (Diving)"
};

export function formatInspectionTypeName(name: string | null | undefined): string {
  if (!name) return "";
  const uc = name.toUpperCase().trim();
  if (INSPECTION_TYPE_NAMES[uc]) return INSPECTION_TYPE_NAMES[uc];
  
  // 1. Fix common mislabeled UT names (casing)
  let formatted = name.replace(/\bUt\b/g, "UT");
  
  // 2. Normalize "UT Thickness" to "UT Wall Thickness"
  if (formatted === "UT Thickness") formatted = "UT Wall Thickness";

  // 3. Format ROV and Diving prefixes into postfixes
  // E.g., "ROV General Visual Inspection" -> "General Visual Inspection (ROV)"
  // E.g., "Diving Bolted Support Inspection" -> "Bolted Support Inspection (Diving)"
  if (/^ROV\s+/i.test(formatted)) {
    formatted = formatted.replace(/^ROV\s+/i, "") + " (ROV)";
  } else if (/^DIVING\s+/i.test(formatted)) {
    formatted = formatted.replace(/^DIVING\s+/i, "") + " (Diving)";
  }
  
  return formatted;
}
