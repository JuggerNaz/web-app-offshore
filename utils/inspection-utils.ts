/**
 * Standardizes inspection type names for UI consistency.
 * Specifically corrects "Ut Wall Thickness" and other mislabeled UT types.
 */
export function formatInspectionTypeName(name: string | null | undefined): string {
  if (!name) return "";
  
  // 1. Fix common mislabeled UT names (casing)
  let formatted = name.replace(/\bUt\b/g, "UT");
  
  // 2. Normalize "UT Thickness" to "UT Wall Thickness" if it's the specific code code
  if (formatted === "UT Thickness") return "UT Wall Thickness";
  
  // 3. Remove "ROV " or "DIVING " prefixes if it's for UT Wall Thickness 
  // to match user's desired "UT Wall Thickness" display
  if (formatted.includes("UT Wall Thickness")) {
    formatted = formatted.replace(/^(ROV|DIVING)\s+/, "");
  }
  
  return formatted;
}
