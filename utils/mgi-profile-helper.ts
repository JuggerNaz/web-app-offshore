/**
 * Shared MGI Profile Resolution & Linear Interpolation Utility
 */

export interface MGIThreshold {
  from_elevation: string | number;
  max_thickness: number;
}

export interface MGIProfile {
  id: number;
  name: string;
  description?: string;
  thresholds: MGIThreshold[];
  is_active: boolean;
  is_job_specific: boolean;
  company_id?: string;
}

/**
 * Resolves the appropriate MGI Profile for a Jobpack / Inspection Record.
 * Order of precedence:
 * 1. Specific record _mgi_profile_id (if provided and valid)
 * 2. Jobpack assigned mgi_profile_id (if jobpackId provided and set)
 * 3. Default active global profile (is_active = true, is_job_specific = false)
 * 4. Fallback: Any active profile (is_active = true)
 */
export async function getMGIProfileForJobpack(
  supabase: any,
  jobpackId?: number | string | null,
  recordProfileId?: number | string | null
): Promise<MGIProfile | null> {
  try {
    // 1. Check record profile id override if specified
    if (recordProfileId) {
      const { data: recordProf } = await supabase
        .from("mgi_profiles")
        .select("*")
        .eq("id", Number(recordProfileId))
        .eq("is_archived", false)
        .maybeSingle();

      if (recordProf) return recordProf;
    }

    // 2. Check Jobpack assigned profile
    if (jobpackId) {
      const { data: jobData } = await supabase
        .from("jobpack")
        .select("mgi_profile_id")
        .eq("id", Number(jobpackId))
        .maybeSingle();

      if (jobData?.mgi_profile_id) {
        const { data: jobProf } = await supabase
          .from("mgi_profiles")
          .select("*")
          .eq("id", Number(jobData.mgi_profile_id))
          .eq("is_archived", false)
          .maybeSingle();

        if (jobProf) return jobProf;
      }
    }

    // 3. Fetch default active global profile
    const { data: globalProf } = await supabase
      .from("mgi_profiles")
      .select("*")
      .eq("is_active", true)
      .eq("is_job_specific", false)
      .eq("is_archived", false)
      .maybeSingle();

    if (globalProf) return globalProf;

    // 4. Fallback: Any active profile
    const { data: anyActiveProf } = await supabase
      .from("mgi_profiles")
      .select("*")
      .eq("is_active", true)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return anyActiveProf || null;
  } catch (err) {
    console.error("[getMGIProfileForJobpack] Error resolving MGI profile:", err);
    return null;
  }
}

/**
 * Calculates linear depth interpolation for MGI Allowable Thickness based on elevation thresholds and water depth.
 * 
 * @param vDepth Current depth value or string (e.g. "-10.0m", "10", 10)
 * @param wDepth Total water depth at structure
 * @param thresholds List of profile elevation thresholds
 * @param unit Unit of measurement for vDepth ('m', 'ft', 'in', 'mm', 'cm')
 * @returns Interpolated allowable thickness in mm
 */
export function calculateInterpolatedMgiThreshold(
  vDepth: any,
  wDepth: number,
  thresholds: MGIThreshold[],
  unit: string = 'm'
): number | null {
  if (!thresholds || thresholds.length === 0) return null;

  const vDepthStr = String(vDepth ?? 0).replace(/[^\d.-]/g, "");
  let currentDepth = Math.abs(parseFloat(vDepthStr) || 0);
  const waterDepth = Math.abs(wDepth || 0);

  if (unit === 'ft') currentDepth *= 0.3048;
  else if (unit === 'in') currentDepth *= 0.0254;
  else if (unit === 'mm') currentDepth /= 1000;
  else if (unit === 'cm') currentDepth /= 100;

  const rawResolved = thresholds
    .map((t) => {
      let d = 0;
      const from = String(t.from_elevation).toUpperCase().trim();
      if (from === "MSL" || from === "0") d = 0;
      else if (from === "MUDLINE") d = waterDepth;
      else if (from.includes("WD")) {
        const m = from.match(/(\d+)\/(\d+)\s*WD/i);
        if (m && parseInt(m[2]) !== 0) d = (parseInt(m[1]) / parseInt(m[2])) * waterDepth;
        else d = waterDepth;
      } else d = Math.abs(parseFloat(from) || 0);
      return { depth: d, max: parseFloat(String(t.max_thickness)) || 0 };
    })
    .sort((a, b) => a.depth - b.depth);

  if (rawResolved.length === 0) return null;

  // If intermediate step points have identical max_thickness to start point while end point is different,
  // collapse redundant flat intermediate points so linear slope is continuous from top to bottom
  const startMax = rawResolved[0].max;
  const endMax = rawResolved[rawResolved.length - 1].max;

  let resolved = rawResolved;
  if (startMax !== endMax && rawResolved.length > 2) {
    resolved = rawResolved.filter((pt, index) => {
      if (index === 0 || index === rawResolved.length - 1) return true;
      return pt.max !== startMax;
    });
  }

  // Boundary checks
  if (currentDepth <= resolved[0].depth) return resolved[0].max;
  if (currentDepth >= resolved[resolved.length - 1].depth)
    return resolved[resolved.length - 1].max;

  // Segment interpolation
  for (let i = 0; i < resolved.length - 1; i++) {
    const p1 = resolved[i];
    const p2 = resolved[i + 1];
    if (currentDepth >= p1.depth && currentDepth <= p2.depth) {
      if (p2.depth === p1.depth) return p1.max;
      const ratio = (currentDepth - p1.depth) / (p2.depth - p1.depth);
      return p1.max + (p2.max - p1.max) * ratio;
    }
  }

  return resolved[resolved.length - 1].max;
}
