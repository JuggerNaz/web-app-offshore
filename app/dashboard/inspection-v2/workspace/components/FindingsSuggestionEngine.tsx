"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, History, Book, Check, Search, X, Loader2, Copy } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface FindingsSuggestionEngineProps {
  supabase: any;
  componentType: string;
  inspectionTypeCode: string;
  formData?: Record<string, any>;
  onSelect: (finding: string) => void;
  currentFinding: string;
}

// Standard dictionary of offshore inspection findings organized by task / category
const STANDARD_FINDINGS: Record<string, string[]> = {
  "SCOUR": [
    "No evidence of seabed scour observed around component base.",
    "Local seabed scour depression observed near component base; depth estimated at 0.3m.",
    "Significant scour pit detected with pile exposure extending 1.2m below nominal seabed level.",
    "Scour protection rock dump appears intact and stable around the foundation.",
    "Seabed burial level is 100%; component is fully buried with no exposed section.",
  ],
  "GENERAL": [
    "General condition appears good with no significant defects observed.",
    "Component is in satisfactory condition at the time of inspection.",
    "No significant anomalies or areas of concern noted during the survey.",
    "Visual inspection completed; no mechanical damage or structural distortion detected.",
  ],
  "MARINE_GROWTH": [
    "Light filamentous marine growth observed covering approximately 20% of the surface area.",
    "Moderate hard marine growth (barnacles/tubeworms) noted, thickness approximately 10-20mm.",
    "Heavy calcareous marine growth covering 100% of the component surface.",
    "Marine growth removed for close visual inspection; base material appears intact.",
  ],
  "COATING": [
    "Coating system appears intact with minimal signs of degradation.",
    "Localized coating breakdown observed with minor surface corrosion (Grade Re 3).",
    "Significant coating loss noted with pitting corrosion evident on the substrate.",
    "Calcareous deposits noted beneath loose coating flakes.",
  ],
  "CORROSION": [
    "Minor surface oxidation/rust staining observed; no loss of section detected.",
    "Active corrosion noted with significant scaling; UT thickness readings recommended.",
    "Localized pitting corrosion observed; maximum pit depth estimated at 2mm.",
    "General uniform corrosion noted across exposed steel surface; wall thickness within tolerance.",
  ],
  "ANODE": [
    "Anode shows approximately 25% depletion; remaining material appears secure.",
    "Anode shows approximately 50% depletion; material loss is uniform with core bar intact.",
    "Anode is heavily depleted (approx. 75%); replacement should be considered in next campaign.",
    "Anode core bar is visible; depletion estimated at >90%.",
    "Anode appears secure with good electrical continuity to the structure.",
    "Anode attachment welds/straps inspected; intact with no structural cracking or damage.",
  ],
  "CP_SURVEY": [
    "CP potential reading recorded at -980 mV (Ag/AgCl), indicating adequate cathodic protection.",
    "CP potential reading is less negative than -800 mV; structure may be under-protected.",
    "CP calibration check verified pre and post dive within acceptable limits (±5mV).",
    "CP readings consistent along component elevation; structure electrical continuity verified.",
  ],
  "UT_THICKNESS": [
    "UT thickness readings taken at cardinal points; all values match nominal wall thickness within tolerance.",
    "Minor wall loss detected by UT measurement; minimum thickness recorded at 92% of nominal.",
    "Localized wall reduction observed; minimum UT reading indicates 15% section loss.",
    "UT calibration confirmed on step block prior to component measurements.",
  ],
  "WELD": [
    "Weld profile appears smooth and consistent with no visible surface-breaking defects.",
    "Minor undercut noted at the weld toe; no further action required at this stage.",
    "Significant erosion/corrosion observed at the weld heat-affected zone (HAZ).",
    "Weld inspection completed after cleaning; no crack-like indications detected.",
  ],
  "ACFM_NDT": [
    "ACFM inspection completed along weld toe; no crack-like indications detected.",
    "ACFM defect indication recorded; estimated length 25mm, depth 2.5mm.",
    "MPI / NDT survey conducted; zero surface-breaking linear indications observed.",
  ],
  "DEBRIS": [
    "Metallic debris (scaffolding tube/grating) observed on the seabed near the structure base.",
    "Non-metallic debris (cement bag/plastic shroud) noted partially buried in the silt.",
    "Scrapped wire rope observed coiled on the seabed; no contact with the structure.",
    "Unknown metallic object noted; item appears to be legacy construction debris.",
    "Debris item is in close proximity to the component; potential snagging hazard.",
  ],
  "SEABED_SURVEY": [
    "Active gas seepage (moderate bubbles) observed from the seabed.",
    "Intermittent gas seepage noted; no associated cratering observed.",
    "Small crater (estimated 1m diameter) observed; likely from legacy activities.",
    "Depression/Scour observed near the component base; approx. 0.5m deep.",
    "Seabed appears clear of any significant debris or anomalies in the immediate vicinity.",
  ],
  "FLOODED_MEMBER": [
    "FMD survey performed; member confirmed UNFLOODED (dry internal cavity).",
    "FMD survey indicates FLOODED member condition; potential through-wall defect or ingress.",
    "FMD background and test counts verified prior to member soundings.",
  ],
  "BOLTED_SUPPORT": [
    "All clamp support bolts present, tight, and double-nutted with washers intact.",
    "Minor gap observed between clamp halves; flange alignment within acceptable limits.",
    "Missing or loose bolt detected on clamp assembly; maintenance action required.",
    "Neoprene liner present and intact between clamp support and structural member.",
  ],
  "SPLASH_ZONE": [
    "Splash zone coating shows localized breakdown with minor surface oxidation.",
    "Monopile / leg surface in splash zone shows marine growth accretion and minor scaling.",
    "Splash zone area visually inspected; no severe mechanical damage or gouges observed.",
    "Splash zone corrosion protection wrap intact with no tears or disbondment.",
  ],
  "RISER_CAISSON": [
    "Riser pipe surface appears intact with no visible coating disbondment or heavy corrosion.",
    "Caisson guide clamp supports present and secure; clear internal bore.",
    "Riser splash zone wrap intact with no tears or detachment.",
    "Caisson discharge pipe clear of obstructions.",
  ],
  "CONDUCTOR": [
    "Conductor guide funnel alignment satisfactory; centralizer intact.",
    "Conductor casing surface shows light uniform surface rust; wall thickness intact.",
    "Conductor clamp bolts intact and secure; no movement detected.",
  ]
};

export function FindingsSuggestionEngine({
  supabase,
  componentType,
  inspectionTypeCode,
  formData = {},
  onSelect,
  currentFinding
}: FindingsSuggestionEngineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<{ text: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"history" | "standard">("history");
  const [showAll, setShowAll] = useState(false);

  // Generate dynamic, AI-powered suggestions based on live form values and industry defect criteria
  const liveSmartAISuggestions = React.useMemo(() => {
    if (!formData || Object.keys(formData).length === 0) return [];
    const suggestions: { text: string; label: string; badge: string; isAiPowered: boolean }[] = [];

    // Helper to safely extract numeric values from formData
    const getNum = (...keys: string[]): number | null => {
      for (const k of keys) {
        if (formData[k] !== undefined && formData[k] !== null && formData[k] !== "") {
          const val = parseFloat(formData[k]);
          if (!isNaN(val)) return val;
        }
      }
      return null;
    };

    // Helper to safely extract string values from formData
    const getStr = (...keys: string[]): string | null => {
      for (const k of keys) {
        if (formData[k] && typeof formData[k] === "string" && formData[k].trim() !== "") {
          return formData[k].trim();
        }
      }
      return null;
    };

    const cpValue = getNum("cp_rdg", "cp_reading", "cp", "cp_potential", "cp_value");
    const surfaceCond = getStr("surface_condition", "surfaceCondition");
    const cleanMethod = getStr("cleaning_method", "cleaningMethod");
    const nomThickness = getNum("nominal_thickness", "nominal_wall_thickness", "wall_thickness", "nom_wt");
    const minReading = getNum("min_reading", "minimum_thickness", "ut_min");
    const ut3 = getNum("ut_3_o_clock");
    const ut6 = getNum("ut_6_o_clock");
    const ut9 = getNum("ut_9_o_clock");
    const ut12 = getNum("ut_12_o_clock");
    const anodeDepletion = getStr("anode_depletion", "anodeDepletion");
    const anodeType = getStr("anode_type", "anodeType");
    const marineSoft = getStr("marine_growth_soft", "mgi_soft");
    const marineHard = getStr("marine_growth_hard", "mgi_hard");
    const coatingCond = getStr("coating_condition", "coatingCondition");
    const compCond = getStr("component_condition", "componentCondition");

    // 1. CP SURVEY & CP READING REAL-TIME AI EVALUATION (-800mV to -1100mV Criteria)
    if (cpValue !== null) {
      let cpEval = "";
      let cpBadge = "CP Criteria Checked";

      if (cpValue <= -800 && cpValue >= -1100) {
        cpEval = `CP potential reading recorded at ${cpValue} mV (Ag/AgCl), indicating adequate cathodic protection (meets -800 mV to -1100 mV criteria).`;
      } else if (cpValue < -1100) {
        cpEval = `CP potential reading recorded at ${cpValue} mV (Ag/AgCl); structure is OVER-PROTECTED (< -1100 mV threshold, risk of hydrogen embrittlement).`;
        cpBadge = "CP Over-Protection Flag";
      } else {
        cpEval = `CP potential reading recorded at ${cpValue} mV (Ag/AgCl); structure is UNDER-PROTECTED (> -800 mV threshold). Anode depletion / CP defect flagged.`;
        cpBadge = "CP Under-Protection Defect";
      }

      if (cleanMethod) {
        cpEval += ` Inspection surface prepared using ${cleanMethod}.`;
      } else if (surfaceCond) {
        cpEval += ` Surface condition noted as ${surfaceCond}.`;
      }

      suggestions.push({
        text: cpEval,
        label: "Live CP Form Data & Defect Evaluation",
        badge: cpBadge,
        isAiPowered: true,
      });
    }

    // 2. UT THICKNESS REAL-TIME AI EVALUATION (% Wall Loss Criteria)
    const effectiveMin = minReading ?? Math.min(...[ut3, ut6, ut9, ut12].filter((v): v is number => v !== null));
    if (nomThickness !== null && effectiveMin !== null && !isNaN(effectiveMin) && effectiveMin > 0 && nomThickness > 0) {
      const lossMm = Math.max(0, nomThickness - effectiveMin);
      const lossPct = ((lossMm / nomThickness) * 100).toFixed(1);
      let utEval = "";
      let utBadge = "UT Defect Evaluation";

      if (parseFloat(lossPct) < 10) {
        utEval = `UT wall thickness measured: min reading ${effectiveMin} mm vs ${nomThickness} mm nominal (${lossPct}% wall loss). Material condition within allowable tolerance.`;
      } else if (parseFloat(lossPct) <= 20) {
        utEval = `UT wall thickness measured: min reading ${effectiveMin} mm vs ${nomThickness} mm nominal (${lossPct}% wall loss). Moderate uniform metal loss detected.`;
        utBadge = "Moderate Wall Loss";
      } else {
        utEval = `UT wall thickness measured: min reading ${effectiveMin} mm vs ${nomThickness} mm nominal (${lossPct}% wall loss). SIGNIFICANT wall loss detected (>20% defect criteria). UT Anomaly candidate.`;
        utBadge = "Critical UT Defect";
      }

      suggestions.push({
        text: utEval,
        label: "Live UT Form Data & Wall Loss Calculation",
        badge: utBadge,
        isAiPowered: true,
      });
    }

    // 3. ANODE DEPLETION REAL-TIME AI EVALUATION
    if (anodeDepletion || anodeType) {
      const typeStr = anodeType ? `${anodeType} ` : "";
      const deplStr = anodeDepletion || "depletion inspected";
      let anodeEval = `${typeStr}anode condition: ${deplStr}.`;

      if (anodeDepletion?.includes("75") || anodeDepletion?.includes("90") || anodeDepletion?.includes("100")) {
        anodeEval += " Anode is heavily depleted (>75%); replacement recommended for upcoming maintenance campaign.";
      } else if (anodeDepletion?.includes("50")) {
        anodeEval += " Material loss is uniform across anode body with standoff attachment secure.";
      } else {
        anodeEval += " Remaining material appears secure with good electrical continuity to structure.";
      }

      suggestions.push({
        text: anodeEval,
        label: "Live Anode Depletion & Attachment AI Evaluation",
        badge: "Anode Assessment",
        isAiPowered: true,
      });
    }

    // 4. MARINE GROWTH REAL-TIME AI EVALUATION
    if (marineSoft || marineHard) {
      let mgEval = "Marine growth survey completed:";
      if (marineHard) mgEval += ` Hard growth (${marineHard})`;
      if (marineSoft) mgEval += ` Soft growth (${marineSoft})`;
      mgEval += ". Base material visually inspected where cleaned.";

      suggestions.push({
        text: mgEval,
        label: "Live Marine Growth AI Assessment",
        badge: "Marine Growth Data",
        isAiPowered: true,
      });
    }

    // 5. COATING & COMPONENT CONDITION REAL-TIME AI EVALUATION
    if (coatingCond && coatingCond.toUpperCase() !== "NONE" && coatingCond.toUpperCase() !== "N/A") {
      suggestions.push({
        text: `Coating inspection: ${coatingCond} condition observed. Substrate integrity checked.`,
        label: "Live Coating Condition Evaluation",
        badge: "Coating Data",
        isAiPowered: true,
      });
    }

    if (compCond && compCond.toUpperCase() !== "NONE" && compCond.toUpperCase() !== "N/A") {
      suggestions.push({
        text: `Component condition noted: ${compCond}. Visual inspection completed with no unrecorded structural distortion.`,
        label: "Live Component Condition Evaluation",
        badge: "Component Data",
        isAiPowered: true,
      });
    }

    return suggestions;
  }, [formData]);

  // Helper to dynamically format static dictionary suggestions using live form readings (e.g. replacing -980 mV with live -1002 mV)
  const formatItemWithFormData = (item: string) => {
    if (!formData) return item;
    const cpVal = formData.cp_rdg ?? formData.cp_reading ?? formData.cp ?? formData.cp_potential;
    if (cpVal !== undefined && cpVal !== null && cpVal !== "") {
      return item.replace(/-?\d{3,4}\s*mV/gi, `${cpVal} mV`);
    }
    return item;
  };

  // Helper to determine primary task category based on inspectionTypeCode (code or name)
  const primaryCategory = React.useMemo(() => {
    const code = (inspectionTypeCode || "").toUpperCase().trim();
    if (!code) return null;
    
    // 1. Anode Inspection
    if (
      code.includes("ANODE") || 
      code.includes("SANI") || 
      code.includes("SANOD") || 
      code.includes("RANOD") || 
      code.includes("DANOD") || 
      code === "RSANI" || 
      code === "DSANI" || 
      code === "PL_AN" || 
      code === "ANMAIN" ||
      code.includes("SELECTED ANODE")
    ) return "ANODE";

    // 2. Scour Inspection
    if (
      code.includes("SCOUR") || 
      code === "RSCOR" || 
      code === "DSCOR"
    ) return "SCOUR";

    // 3. Flooded Member (FMD)
    if (
      code.includes("FLOOD") || 
      code.includes("FMD") || 
      code === "RFMD" || 
      code === "DFMD"
    ) return "FLOODED_MEMBER";

    // 4. CP Survey & Calibration
    if (
      code.includes("CATHODIC") || 
      code.includes("PROTECTION") || 
      code.includes("CPSURV") || 
      code.includes("CPCLB") || 
      code.includes("ROVCPCLB") ||
      code === "RCP" ||
      code === "DCP"
    ) return "CP_SURVEY";

    // 5. Splash Zone Inspection
    if (
      code.includes("SZONE") ||
      code === "RSZCI" ||
      code === "DSZCI" ||
      code.includes("SPLASH")
    ) return "SPLASH_ZONE";

    // 6. UT Thickness
    if (
      code.includes("THICKNESS") || 
      code.includes("UT") || 
      code === "RUTWT" || 
      code === "DUTWT" || 
      code === "UTWTK" || 
      code === "UTCLB"
    ) return "UT_THICKNESS";

    // 7. ACFM / MPI NDT
    if (
      code.includes("ACFM") || 
      code.includes("MPI") || 
      code.includes("NDT") || 
      code === "ACFMC" || 
      code === "MPINS" ||
      code === "RACFM" ||
      code === "DACFM" ||
      code === "RMPI" ||
      code === "DMPI"
    ) return "ACFM_NDT";

    // 8. Weld Inspection
    if (
      code.includes("WELD") || 
      code === "RSWNI" || 
      code === "DSWNI" || 
      code === "SWNI"
    ) return "WELD";

    // 9. Bolted Support / Clamp
    if (
      code.includes("BOLT") || 
      code.includes("SUPPORT") || 
      code.includes("CLAMP") || 
      code === "BSINS" ||
      code === "RBSIN" ||
      code === "DBSIN"
    ) return "BOLTED_SUPPORT";

    // 10. Coating
    if (
      code.includes("COAT") || 
      code === "PL_CO" ||
      code === "RCOAT" ||
      code === "DCOAT"
    ) return "COATING";

    // 11. Marine Growth
    if (
      code.includes("GROWTH") || 
      code.includes("MGI") || 
      code === "MGROW" || 
      code === "RMGI" || 
      code === "DMGI" ||
      code === "CLEAN"
    ) return "MARINE_GROWTH";

    // 12. Riser & Caisson
    if (
      code.includes("RISER") ||
      code.includes("CAISSON") ||
      code === "RRISI" ||
      code === "DRISR" ||
      code === "RCASN" ||
      code === "DCASN"
    ) return "RISER_CAISSON";

    // 13. Conductor
    if (
      code.includes("CONDUCTOR") ||
      code === "RCOND" ||
      code === "DCOND"
    ) return "CONDUCTOR";

    // 14. Seabed Survey
    if (
      code.includes("SEABED") || 
      code === "SBD" || 
      code === "RSEAB" ||
      code === "DSEAB"
    ) return "SEABED_SURVEY";

    // 15. Debris
    if (
      code.includes("DEBRIS") || 
      code.includes("WRECK") || 
      code === "RWDI"
    ) return "DEBRIS";

    // 16. General / Close Visual
    if (
      code === "GVINS" || 
      code === "CVINS" || 
      code === "RGVI" || 
      code === "DGVI" || 
      code === "RCVI" || 
      code === "DCVI" || 
      code.includes("VISUAL")
    ) return "GENERAL";

    return null;
  }, [inspectionTypeCode]);

  // Helper to determine recommended categories based on inspectionTypeCode (code or name) and componentType
  const recommendedCategories = React.useMemo(() => {
    const code = (inspectionTypeCode || "").toUpperCase().trim();
    const comp = (componentType || "").toUpperCase().trim();
    const targetText = `${code} ${comp}`;
    const recommended = new Set<string>(["GENERAL"]);

    if (primaryCategory) {
      recommended.add(primaryCategory);
    }

    const compIsAnode = comp === "AN" || comp === "ANODE" || comp === "SAN" || comp === "BAN" || comp.startsWith("ANODE") || comp.includes("_ANODE");
    const compIsWeld = comp === "WLD" || comp === "WELD" || comp.startsWith("WELD") || comp === "NODE";
    const compIsRiserOrPipe = comp.includes("RIS") || comp.includes("RISER") || comp.includes("CAISSON") || comp.includes("CONDUCTOR");

    // 1. Scour & Seabed
    if (
      targetText.includes("SCOUR") || 
      code.includes("SBD") || 
      code.includes("SEABED") || 
      code === "RSEAB" || 
      code === "RWDI" ||
      comp.includes("SD") || 
      comp.includes("SEABED") || 
      comp.includes("SBD") ||
      comp.includes("PILE")
    ) {
      recommended.add("SCOUR");
      recommended.add("SEABED_SURVEY");
      recommended.add("DEBRIS");
    }

    // 2. Marine Growth
    if (
      targetText.includes("GROWTH") || 
      targetText.includes("MARINE") || 
      targetText.includes("MGI") || 
      targetText.includes("MGROW") || 
      targetText.includes("CLEAN") ||
      code === "GVINS" || 
      code === "CVINS" ||
      comp.includes("MB") || 
      comp.includes("CS") || 
      comp.includes("CD") || 
      comp.includes("LEG") || 
      compIsRiserOrPipe || 
      compIsAnode || 
      compIsWeld ||
      comp.includes("MEMBER")
    ) {
      recommended.add("MARINE_GROWTH");
    }

    // 3. Coating
    if (
      targetText.includes("COAT") || 
      code === "PL_CO" ||
      code === "GVINS" || 
      code === "CVINS" ||
      comp.includes("MB") || 
      comp.includes("CS") || 
      comp.includes("CD") || 
      comp.includes("LEG") || 
      comp.includes("CL") ||
      compIsRiserOrPipe ||
      comp.includes("MEMBER") ||
      comp.includes("CLAMP")
    ) {
      recommended.add("COATING");
    }

    // 4. Corrosion
    if (
      targetText.includes("CORR") || 
      targetText.includes("RUST") || 
      targetText.includes("OXID") || 
      code.includes("UT") || 
      code === "ACFMC" || 
      code === "PL_CO" ||
      code === "GVINS" || 
      code === "CVINS" ||
      comp.includes("MB") || 
      comp.includes("CS") || 
      comp.includes("CD") || 
      comp.includes("LEG") || 
      comp.includes("CL") ||
      compIsWeld ||
      compIsAnode ||
      compIsRiserOrPipe ||
      comp.includes("MEMBER") ||
      comp.includes("CLAMP")
    ) {
      recommended.add("CORROSION");
    }

    // 5. Anode
    if (
      targetText.includes("ANODE") || 
      code.includes("ANODE") || 
      code.includes("SANI") ||
      code === "RSANI" ||
      code === "DSANI" ||
      code === "SANOD" ||
      code === "RANOD" ||
      code === "DANOD" ||
      code === "PL_AN" ||
      code === "ANMAIN" ||
      compIsAnode
    ) {
      recommended.add("ANODE");
      recommended.add("CP_SURVEY");
    }

    // 6. CP Survey & Calibration
    if (
      targetText.includes("CATHODIC") || 
      targetText.includes("PROTECTION") || 
      targetText.includes("CP") || 
      code.includes("CPSURV") || 
      code.includes("CPCLB") || 
      code.includes("ROVCPCLB") ||
      code === "RSANI" ||
      code === "DSANI" ||
      compIsAnode
    ) {
      recommended.add("CP_SURVEY");
    }

    // 7. Weld & ACFM / MPI NDT
    if (
      targetText.includes("WELD") || 
      targetText.includes("ACFM") || 
      targetText.includes("MPI") || 
      targetText.includes("NDT") || 
      code === "ACFMC" || 
      code.includes("MPINS") || 
      compIsWeld || 
      comp.includes("NODE")
    ) {
      recommended.add("WELD");
      recommended.add("ACFM_NDT");
      recommended.add("CORROSION");
    }

    // 8. Debris
    if (
      targetText.includes("DEBRIS") || 
      targetText.includes("SBD") || 
      targetText.includes("SEABED") || 
      targetText.includes("SCOUR") || 
      code === "RSEAB" || 
      code === "RWDI" ||
      comp.includes("SD") || 
      comp.includes("SEABED") || 
      comp.includes("SBD")
    ) {
      recommended.add("DEBRIS");
    }

    // 9. UT Thickness
    if (
      targetText.includes("THICKNESS") || 
      targetText.includes("UT") || 
      code.includes("UTCLB") || 
      code.includes("WALL")
    ) {
      recommended.add("UT_THICKNESS");
      recommended.add("CORROSION");
    }

    // 10. Flooded Member
    if (
      targetText.includes("FLOOD") || 
      targetText.includes("FMD") || 
      code.includes("FLOOD") ||
      code === "RFMD" ||
      code === "DFMD"
    ) {
      recommended.add("FLOODED_MEMBER");
    }

    // 11. Bolted Support / Clamp
    if (
      targetText.includes("BOLT") || 
      targetText.includes("SUPPORT") || 
      targetText.includes("CLAMP") || 
      code.includes("BSINS")
    ) {
      recommended.add("BOLTED_SUPPORT");
    }

    // 12. Splash Zone
    if (
      targetText.includes("SPLASH") ||
      targetText.includes("SZONE") ||
      code === "RSZCI" ||
      code === "DSZCI"
    ) {
      recommended.add("SPLASH_ZONE");
      recommended.add("COATING");
      recommended.add("CORROSION");
    }

    // 13. Riser & Caisson
    if (
      targetText.includes("RISER") ||
      targetText.includes("CAISSON") ||
      code === "RRISI" ||
      code === "RCASN"
    ) {
      recommended.add("RISER_CAISSON");
    }

    // 14. Conductor
    if (
      targetText.includes("CONDUCTOR") ||
      code === "RCOND"
    ) {
      recommended.add("CONDUCTOR");
    }

    return Array.from(recommended);
  }, [inspectionTypeCode, componentType, primaryCategory]);

  useEffect(() => {
    if (isOpen && tab === "history" && history.length === 0) {
      fetchHistory();
    }
  }, [isOpen, tab]);

  // Query ALL historical completed inspection records across ALL previous jobpacks and structures
  const fetchHistory = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("insp_records")
        .select("description, finding, inspection_data, inspection_type_code")
        .limit(300);

      // Search broadly across all jobpacks for matching or similar inspection type codes
      if (inspectionTypeCode) {
        const cleanCode = inspectionTypeCode.toUpperCase().trim();
        query = query.or(`inspection_type_code.eq.${cleanCode},inspection_type_code.ilike.%${cleanCode}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let finalData = data || [];

      // Fallback: If no records match exact inspectionTypeCode, fetch recent findings across all completed jobpacks
      if (finalData.length === 0) {
        const fallbackRes = await supabase
          .from("insp_records")
          .select("description, finding, inspection_data, inspection_type_code")
          .limit(300);
        if (fallbackRes.data) {
          finalData = fallbackRes.data;
        }
      }

      if (finalData.length > 0) {
        const counts: Record<string, number> = {};
        finalData.forEach((r: any) => {
          const text = (r.description || r.finding || r.inspection_data?.findings || r.inspection_data?.observation || r.inspection_data?.component_condition || "").trim();
          // Filter out short non-descriptive test strings (like "sdsd tsedg")
          if (text && text.length > 8 && !/^[a-z\s]{3,12}$/i.test(text)) {
            counts[text] = (counts[text] || 0) + 1;
          }
        });

        const sortedItems = Object.entries(counts)
          .map(([text, count]) => ({ text, count }))
          .sort((a, b) => b.count - a.count);

        setHistory(sortedItems);
      }
    } catch (err) {
      console.error("Error fetching finding history across jobpacks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const categoryDisplayNames: Record<string, string> = {
    "SCOUR": "Scour Inspection",
    "GENERAL": "General Visual Inspection",
    "MARINE_GROWTH": "Marine Growth Inspection",
    "COATING": "Coating Inspection",
    "CORROSION": "Corrosion Inspection",
    "ANODE": "Anode Inspection",
    "CP_SURVEY": "Cathodic Protection (CP) Survey",
    "UT_THICKNESS": "Ultrasonic Thickness (UT) Survey",
    "WELD": "Weld Inspection",
    "ACFM_NDT": "ACFM / NDT Inspection",
    "DEBRIS": "Debris Inspection",
    "SEABED_SURVEY": "Seabed Survey",
    "FLOODED_MEMBER": "Flooded Member (FMD) Inspection",
    "BOLTED_SUPPORT": "Bolted Support Inspection",
    "SPLASH_ZONE": "Splash Zone Inspection",
    "RISER_CAISSON": "Riser & Caisson Inspection",
    "CONDUCTOR": "Conductor Inspection",
  };

  const displayStandardCategories = React.useMemo(() => {
    const entries = Object.entries(STANDARD_FINDINGS);
    // When user types a search query, search across ALL categories in the dictionary
    const filtered = (showAll || searchQuery.trim().length > 0)
      ? entries
      : entries.filter(([category]) => recommendedCategories.includes(category));

    return filtered.sort(([catA], [catB]) => {
      // Primary category for the active inspection task goes first
      if (primaryCategory) {
        if (catA === primaryCategory && catB !== primaryCategory) return -1;
        if (catA !== primaryCategory && catB === primaryCategory) return 1;
      }

      const isRecA = recommendedCategories.includes(catA);
      const isRecB = recommendedCategories.includes(catB);

      // Recommended categories next
      if (isRecA && !isRecB) return -1;
      if (!isRecA && isRecB) return 1;

      // When both are recommended, put task-specific categories before GENERAL
      if (catA === "GENERAL" && catB !== "GENERAL") return 1;
      if (catA !== "GENERAL" && catB === "GENERAL") return -1;

      return 0;
    });
  }, [recommendedCategories, primaryCategory, showAll, searchQuery]);

  const filteredHistory = React.useMemo(() => {
    if (!searchQuery) return history;
    return history.filter(item => item.text.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [history, searchQuery]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Suggestions
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950" align="end">
        <div className="flex flex-col h-[400px]">
          {/* Header */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">Findings Assistant</span>
            </div>
            <Badge variant="outline" className="text-[9px] font-bold bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50 uppercase">
              {inspectionTypeCode}
            </Badge>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search suggestions..."
                className="pl-8 h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 dark:text-slate-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 p-1 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              onClick={() => setTab("history")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                tab === "history" 
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700" 
                  : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <History className="w-3 h-3" />
              HISTORY
            </button>
            <button
              onClick={() => setTab("standard")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold rounded-md transition-all ${
                tab === "standard" 
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700" 
                  : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Book className="w-3 h-3" />
              STANDARD
            </button>
          </div>

          {/* Recommended vs All Toggle Switch */}
          {tab === "standard" && (
            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {showAll ? "All Suggestions" : "AI Recommended Only"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="h-5 px-2 text-[8px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-950"
              >
                {showAll ? "AI Recommended" : "Show All"}
              </Button>
            </div>
          )}

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1.5">
              {isLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Analyzing Jobpack History...</span>
                </div>
              ) : tab === "history" ? (
                filteredHistory.length > 0 ? (
                  filteredHistory.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onSelect(item.text);
                        setIsOpen(false);
                      }}
                      className="w-full text-left p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group relative flex flex-col gap-1"
                    >
                      <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed pr-6">
                        {item.text}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/40">
                          Used {item.count} {item.count === 1 ? "time in jobpacks" : "times in jobpacks"}
                        </span>
                      </div>
                      <Copy className="absolute top-2.5 right-2.5 w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                    <History className="w-10 h-10 text-slate-200 mb-3" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">No common historical wording found in previous campaigns.</span>
                  </div>
                )
              ) : (
                <div className="space-y-4 pt-1">
                  {/* LIVE FORM DATA AI SUGGESTIONS (REAL-TIME DEFECT EVALUATION) */}
                  {liveSmartAISuggestions.length > 0 && !searchQuery && (
                    <div className="space-y-1.5 p-2 rounded-xl bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-slate-50 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-slate-900 border border-blue-200/80 dark:border-blue-800/60 shadow-xs">
                      <div className="px-1 py-0.5 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                          AI Smart Suggestion (Live Form Data)
                        </span>
                        <Badge className="text-[7px] py-0 px-1.5 font-black bg-blue-600 text-white border-0 uppercase tracking-tight shadow-xs">
                          Real-Time Evaluated
                        </Badge>
                      </div>
                      {liveSmartAISuggestions.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            onSelect(item.text);
                            setIsOpen(false);
                          }}
                          className="w-full text-left p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/80 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm transition-all group relative flex flex-col gap-1.5"
                        >
                          <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 leading-relaxed pr-6">
                            {item.text}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-800">
                              {item.badge}
                            </span>
                            <span className="text-[8px] font-medium text-slate-400 italic">{item.label}</span>
                          </div>
                          <Copy className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* STANDARD FINDINGS BY CATEGORY (WITH LIVE FORM INTERPOLATION) */}
                  {displayStandardCategories
                    .map(([category, items]) => {
                      const formattedItems = items.map(formatItemWithFormData);
                      const filteredItems = searchQuery 
                        ? formattedItems.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
                        : formattedItems;
                      
                      if (filteredItems.length === 0) return null;

                      const isPrimary = category === primaryCategory;
                      const title = categoryDisplayNames[category] || category.replace("_", " ");

                      return (
                        <div key={category} className="space-y-1.5">
                          <div className={`px-2 py-1 text-[9px] font-black uppercase tracking-widest flex items-center justify-between ${
                            isPrimary 
                              ? "border-l-4 border-blue-600 bg-blue-100/60 dark:bg-blue-900/30 text-blue-950 dark:text-blue-200 font-extrabold" 
                              : "border-l-2 border-blue-400 bg-blue-50/30 dark:bg-blue-900/10 text-slate-500 dark:text-slate-400"
                          }`}>
                            <span>{title}</span>
                            {isPrimary ? (
                              <Badge className="text-[7px] py-0 px-1.5 font-black bg-blue-600 text-white border-0 uppercase tracking-tighter shadow-xs">
                                Target Task Type
                              </Badge>
                            ) : recommendedCategories.includes(category) ? (
                              <Badge variant="outline" className="text-[7px] py-0 px-1 font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/30 uppercase tracking-tighter bg-blue-50/30">
                                Recommended
                              </Badge>
                            ) : null}
                          </div>
                          {filteredItems.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                onSelect(item);
                                setIsOpen(false);
                              }}
                              className="w-full text-left p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group relative"
                            >
                              <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed pr-6">
                                {item}
                              </div>
                              <Copy className="absolute top-2.5 right-2.5 w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Click to apply to findings</span>
            <Button variant="ghost" size="sm" className="h-6 text-[9px] font-black text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400" onClick={() => setIsOpen(false)}>
              CLOSE
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
