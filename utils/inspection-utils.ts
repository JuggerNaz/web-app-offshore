/**
 * Standardizes inspection type names for UI consistency.
 * Specifically corrects "Ut Wall Thickness" and other mislabeled UT types.
 */
export function formatInspectionTypeName(name: string | null | undefined): string {
  if (!name) return "";
  
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
