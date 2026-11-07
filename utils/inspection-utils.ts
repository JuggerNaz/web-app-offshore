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

export const isBLRecord = (r: any, compMap?: Map<string | number, any> | Record<string | number, any>) => {
    if (!r) return false;
    const comp = r.structure_components || r.component || {};
    const qid = String(comp.q_id || comp.qid || r.component_qid || "").toUpperCase().trim();
    const typeCode = String(r.inspection_type_code || r.inspection_type?.code || "").toUpperCase().trim();
    const compCode = String(comp.code || comp.metadata?.comp_type || comp.metadata?.type || "").toUpperCase().trim();
    const compName = String(comp.comp_name || comp.name || "").toUpperCase().trim();

    // 1. Check Boatlanding or Boat Fender / FD code
    const isBLCode = ["BL", "BLTG", "BOATLANDING"].includes(compCode) || ["BL", "BLTG", "BOATLANDING", "RBLTG", "DBLTG"].includes(typeCode);
    const isBFCode = ["BF", "BOATFENDER", "FENDER", "FD", "FND", "FEND", "BB", "BOATBUMPER", "BOAT_BUMPER"].includes(compCode) || ["FD", "BF", "FENDER"].includes(typeCode);
    if (isBLCode || isBFCode) return true;

    // 2. Explicit Exclusions for non-Boatlanding/Fender components (Conductor Shield, Riser Guard, etc.)
    const excludedPrefixes = ["CS_", "CS-", "RG_", "RG-", "CU_", "CU-", "SG_", "SG-", "CD_", "CD-", "LEG_", "LEG-", "R_"];
    const excludedCodes = ["CS", "RG", "CU", "SG", "CD", "CON", "LEG", "RS", "JT"];
    if (excludedCodes.includes(compCode)) return false;
    if (excludedPrefixes.some(p => qid.startsWith(p))) return false;

    // 3. Direct QID check
    const isBLQid = qid.startsWith("BL") || qid.startsWith("BOATLANDING") || qid.startsWith("BOAT_LANDING");
    const isBFQid = qid.startsWith("BF") || qid.startsWith("BOATFENDER") || qid.startsWith("BOAT_FENDER") || qid.startsWith("FENDER") ||
                    qid.startsWith("FD") || qid.startsWith("FND") || qid.startsWith("FEND") ||
                    qid.includes("BUMPER") || qid.includes("FENDER");
    if (isBLQid || isBFQid) return true;

    // 4. Component Name & Description check
    if (compName.includes("BOATLANDING") || compName.includes("BOAT LANDING") || 
        compName.includes("BOAT FENDER") || compName.includes("BOATFENDER") || 
        compName.includes("FENDER") || compName.includes("BUMPER") || 
        compName.startsWith("FD")) {
        return true;
    }

    const metadata = comp.metadata || r.metadata || {};
    const desc = String(comp.description || metadata.description || r.description || "").trim().toUpperCase();
    if (desc.includes("FENDER") || desc.includes("BOAT BUMPER") || desc.includes("BOATBUMPER") || desc.startsWith("FEND") || desc.includes("BOATLANDING") || desc.includes("BOAT LANDING")) {
        return true;
    }

    // 5. Associated / Parent Component Check (for FD and BL associated components)
    const assocId = metadata.associated_comp_id || 
                    metadata.parent_id || 
                    metadata.comp_id_parent || 
                    metadata.parent_comp_id || 
                    metadata.associated_id || null;
    const assocQid = String(
        metadata.associated_comp_qid || 
        metadata.parent_qid || 
        metadata.parent_q_id || 
        ""
    ).trim().toUpperCase();

    if (assocQid) {
        if (assocQid.startsWith("FD") || assocQid.startsWith("FEND") || assocQid.startsWith("FND") || 
            assocQid.includes("FENDER") || assocQid.includes("BUMPER") ||
            assocQid.startsWith("BL") || assocQid.startsWith("BF") || 
            assocQid.startsWith("BOATLANDING") || assocQid.startsWith("BOAT_LANDING")) {
            return true;
        }
    }

    const getCompFromMap = (map: any, key: any) => {
        if (!map || key === undefined || key === null) return null;
        if (map instanceof Map) {
            return map.get(key) || map.get(String(key)) || (typeof key === "string" && !isNaN(Number(key)) ? map.get(Number(key)) : null);
        }
        return map[key] || map[String(key)] || (typeof key === "string" && !isNaN(Number(key)) ? map[Number(key)] : null);
    };

    // Check parent in compMap
    if (assocId && compMap) {
        let currId: any = assocId;
        let depth = 0;
        while (currId && depth < 5) {
            depth++;
            const parentComp = getCompFromMap(compMap, currId);
            if (!parentComp) break;

            const pCode = String(parentComp.code || parentComp.comp_type || parentComp.metadata?.comp_type || "").trim().toUpperCase();
            if (["FD", "FND", "FEND", "BF", "BOATFENDER", "FENDER", "BB", "BOATBUMPER", "BL", "BLTG", "BOATLANDING"].includes(pCode)) {
                return true;
            }

            const pQid = String(parentComp.q_id || "").trim().toUpperCase();
            if (pQid.startsWith("FD") || pQid.startsWith("FEND") || pQid.startsWith("FND") || 
                pQid.includes("FENDER") || pQid.includes("BUMPER") ||
                pQid.startsWith("BL") || pQid.startsWith("BF") || pQid.startsWith("BOATLANDING")) {
                return true;
            }

            const pDesc = String(parentComp.metadata?.description || parentComp.description || "").trim().toUpperCase();
            if (pDesc.includes("FENDER") || pDesc.includes("BOAT BUMPER") || pDesc.includes("BOATBUMPER") || pDesc.startsWith("FEND") || pDesc.includes("BOATLANDING")) {
                return true;
            }

            const pMeta = parentComp.metadata || {};
            currId = pMeta.associated_comp_id || pMeta.parent_id || pMeta.comp_id_parent || pMeta.parent_comp_id || pMeta.associated_id || null;
        }
    }

    // Check direct comp in compMap
    const directCompId = r.component_id || comp.id;
    if (directCompId && compMap) {
        const fullComp = getCompFromMap(compMap, directCompId);
        if (fullComp) {
            const fCode = String(fullComp.code || fullComp.comp_type || fullComp.metadata?.comp_type || "").trim().toUpperCase();
            if (["FD", "FND", "FEND", "BF", "BOATFENDER", "FENDER", "BB", "BOATBUMPER", "BL", "BLTG", "BOATLANDING"].includes(fCode)) {
                return true;
            }
            const fQid = String(fullComp.q_id || "").trim().toUpperCase();
            if (fQid.startsWith("FD") || fQid.startsWith("FEND") || fQid.startsWith("FND") || 
                fQid.includes("FENDER") || fQid.includes("BUMPER") ||
                fQid.startsWith("BL") || fQid.startsWith("BF") || fQid.startsWith("BOATLANDING")) {
                return true;
            }
            const fMeta = fullComp.metadata || {};
            const fAssocQid = String(fMeta.associated_comp_qid || fMeta.parent_qid || "").trim().toUpperCase();
            if (fAssocQid && (fAssocQid.startsWith("FD") || fAssocQid.startsWith("FEND") || fAssocQid.startsWith("FND") || 
                              fAssocQid.includes("FENDER") || fAssocQid.includes("BUMPER") ||
                              fAssocQid.startsWith("BL") || fAssocQid.startsWith("BF") || fAssocQid.startsWith("BOATLANDING"))) {
                return true;
            }
            const fAssocId = fMeta.associated_comp_id || fMeta.parent_id || fMeta.comp_id_parent || fMeta.parent_comp_id || fMeta.associated_id;
            if (fAssocId) {
                const parentOfFull = getCompFromMap(compMap, fAssocId);
                if (parentOfFull) {
                    const pfCode = String(parentOfFull.code || parentOfFull.comp_type || parentOfFull.metadata?.comp_type || "").trim().toUpperCase();
                    if (["FD", "FND", "FEND", "BF", "BOATFENDER", "FENDER", "BB", "BOATBUMPER", "BL", "BLTG", "BOATLANDING"].includes(pfCode)) {
                        return true;
                    }
                    const pfQid = String(parentOfFull.q_id || "").trim().toUpperCase();
                    if (pfQid.startsWith("FD") || pfQid.startsWith("FEND") || pfQid.startsWith("FND") || 
                        pfQid.includes("FENDER") || pfQid.includes("BUMPER") ||
                        pfQid.startsWith("BL") || pfQid.startsWith("BF") || pfQid.startsWith("BOATLANDING")) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
};
