import inspectionRegistry from "@/utils/types/inspection-types.json";

export type InspectionMode = "DIVING" | "ROV";

const registryTypes: any[] = (inspectionRegistry as any)?.inspectionTypes || [];

/**
 * Resolves whether an inspection type (by code, name, or object) belongs to
 * the active inspection mode ("DIVING" or "ROV").
 * Checks both `inspection-types.json` (`methods`) and DB `inspection_type.metadata`.
 */
export function doesInspectionTypeMatchMode(
  taskOrCode: any,
  mode: InspectionMode,
  allInspectionTypes?: any[]
): boolean {
  const code =
    typeof taskOrCode === "string"
      ? taskOrCode
      : taskOrCode?.code || taskOrCode?.inspection_code || taskOrCode?.name || "";
  const codeUpper = String(code || "").toUpperCase().trim();
  if (!codeUpper) return true;

  const dbObj =
    typeof taskOrCode === "object" && taskOrCode?.metadata
      ? taskOrCode
      : (allInspectionTypes || []).find(
          (t: any) =>
            String(t?.code || "").toUpperCase().trim() === codeUpper ||
            String(t?.name || "").toUpperCase().trim() === codeUpper
        );

  const jsonObj = registryTypes.find(
    (t: any) =>
      String(t?.code || "").toUpperCase().trim() === codeUpper ||
      String(t?.name || "").toUpperCase().trim() === codeUpper
  );

  const methods: string[] = [
    ...(Array.isArray(dbObj?.default_properties?.methods) ? dbObj.default_properties.methods : []),
    ...(Array.isArray(dbObj?.methods) ? dbObj.methods : []),
    ...(Array.isArray(jsonObj?.methods) ? jsonObj.methods : []),
  ].map((m: any) => String(m || "").toUpperCase().trim());

  const meta = dbObj?.metadata || {};
  const jobTypeStr = String(meta?.job_type || "").toUpperCase();

  const isRov =
    methods.includes("ROV") ||
    meta?.rov === 1 ||
    meta?.rov === "1" ||
    meta?.rov === true ||
    jobTypeStr.includes("ROV");

  const isDiving =
    methods.includes("DIVING") ||
    methods.includes("DIVE") ||
    meta?.diving === 1 ||
    meta?.diving === "1" ||
    meta?.diving === true ||
    jobTypeStr.includes("DIVING") ||
    jobTypeStr.includes("DIVE");

  if (isRov || isDiving) {
    return mode === "ROV" ? isRov : isDiving;
  }

  // Heuristic fallback when neither JSON nor DB metadata declares a mode
  const rovCodes = ["RGVI", "RSANI", "RFMD", "RMGI", "RSEAB", "RUTWT", "RRISI", "RCOND", "RCASN", "RSWNI", "RSZCI", "RCP", "RMPI", "RSCOR", "RICMI", "RWDI", "ROVGVI"];
  const looksRov = rovCodes.includes(codeUpper) || codeUpper.startsWith("ROV");
  return mode === "ROV" ? looksRov : !looksRov;
}

/**
 * Resolves whether an inspection record (`insp_records` row or workspace event)
 * belongs to the active inspection mode ("DIVING" or "ROV").
 */
export function doesRecordMatchMode(
  rec: any,
  mode: InspectionMode,
  allInspectionTypes?: any[]
): boolean {
  if (!rec) return false;

  const hasDiveJob =
    rec.dive_job_id !== null &&
    rec.dive_job_id !== undefined &&
    String(rec.dive_job_id).trim() !== "";
  const hasRovJob =
    rec.rov_job_id !== null &&
    rec.rov_job_id !== undefined &&
    String(rec.rov_job_id).trim() !== "";

  // 1. Reject records explicitly belonging to the opposite deployment type
  if (mode === "DIVING" && hasRovJob && !hasDiveJob) return false;
  if (mode === "ROV" && hasDiveJob && !hasRovJob) return false;

  // 2. Also require the record's inspection type to match the active mode
  //    (prevents ROV-only types like RRISI recorded under a dive job from appearing in DIVING mode, and vice versa)
  const typeCode =
    rec.inspection_type_code ||
    rec.inspection_type?.code ||
    rec.inspection_data?.inspection_type_code ||
    "";
  if (typeCode) {
    return doesInspectionTypeMatchMode(typeCode, mode, allInspectionTypes);
  }

  return mode === "DIVING" ? hasDiveJob : hasRovJob;
}
