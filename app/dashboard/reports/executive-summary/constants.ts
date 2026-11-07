export const EXECUTIVE_SUMMARY_TOC = [
    { id: "intro", title: "Introduction" },
    { id: "gvi", title: "General Visual Inspection (GVI)" },
    { id: "cp", title: "Cathodic Potential (CP) Survey" },
    { id: "fmd", title: "Flooded Member Detection" },
    { id: "caisson_top", title: "Caisson Survey Topside" },
    { id: "caisson_sub", title: "Caisson Survey Subsea" },
    { id: "boatlanding_top", title: "Boat Landing Inspection Topside" },
    { id: "boatlanding_sub", title: "Boat Landing Inspection Subsea" },
    { id: "riserguard_top", title: "Riser Guard Inspection Topside" },
    { id: "riserguard_sub", title: "Riser Guard Inspection Subsea" },
    { id: "conductor_top", title: "Conductors Inspection Topside" },
    { id: "conductor_sub", title: "Conductors Inspection Subsea" },
    { id: "riser", title: "Riser Inspection" },
    { id: "splashzone", title: "Splash Zone Coating Inspection" },
    { id: "anode_gen", title: "General Anode Inspection" },
    { id: "anode_sel", title: "Selected Anode Inspection" },
    { id: "mgi", title: "Marine Growth Inspection" },
    { id: "scour", title: "Base Level / Scour Survey" },
    { id: "seabed", title: "Seabed Survey" },
    { id: "anode_maint", title: "Anode Maintenance Work" },
    { id: "node_cvi", title: "Selected Node - Close Visual Inspection" },
    { id: "node_mpi", title: "Selected Node - Magnetic Particle Inspection" },
    { id: "boatbumper_top", title: "Boat Bumper Inspection Topside" },
    { id: "boatbumper_sub", title: "Boat Bumper Inspection Subsea" },
    { id: "conductorguard_sub", title: "Conductor Guard Inspection Subsea" },
    { id: "caissonguard_sub", title: "Caisson Guard Inspection Subsea" },
    { id: "conductorguard_top", title: "Conductor Guard Inspection Topside" },
    { id: "caissonguard_top", title: "Caisson Guard Inspection Topside" },
    { id: "anomaly_finding", title: "Anomaly & Findings Summary" },
    { id: "incomplete", title: "Incomplete Scope Summary" },
];

/**
 * Maps any section ID, title, or fuzzy label to a canonical section ID from EXECUTIVE_SUMMARY_TOC.
 */
export function normalizeSectionId(secIdOrTitle?: string): string {
    if (!secIdOrTitle) return "";
    const raw = String(secIdOrTitle).trim();
    if (!raw) return "";

    // 1. Direct match on TOC ID
    const directToc = EXECUTIVE_SUMMARY_TOC.find(s => s.id.toLowerCase() === raw.toLowerCase());
    if (directToc) return directToc.id;

    // 2. Direct match on TOC Title
    const matchByTitle = EXECUTIVE_SUMMARY_TOC.find(s => s.title.toLowerCase() === raw.toLowerCase());
    if (matchByTitle) return matchByTitle.id;

    // 3. Normalized alphanumeric string matching
    const s = raw.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Introduction & Summaries
    if (s.includes("intro")) return "intro";
    if (s.includes("anomaly") || s.includes("finding")) return "anomaly_finding";
    if (s.includes("incomplete") || s.includes("outstand")) return "incomplete";

    // Conductor Guard vs Conductor
    if (s.includes("conductor") && s.includes("guard")) {
        if (s.includes("top") || s.includes("above") || s.includes("air")) return "conductorguard_top";
        return "conductorguard_sub";
    }
    // Caisson Guard vs Caisson
    if (s.includes("caisson") && s.includes("guard")) {
        if (s.includes("top") || s.includes("above") || s.includes("air")) return "caissonguard_top";
        return "caissonguard_sub";
    }
    // Riser Guard vs Riser
    if (s.includes("riser") && s.includes("guard")) {
        if (s.includes("top") || s.includes("above") || s.includes("air")) return "riserguard_top";
        return "riserguard_sub";
    }
    // Boat Bumper vs Boat Landing
    if (s.includes("bumper") || s.includes("fender")) {
        if (s.includes("top") || s.includes("above") || s.includes("air")) return "boatbumper_top";
        return "boatbumper_sub";
    }
    if (s.includes("boat") || s.includes("landing")) {
        if (s.includes("top") || s.includes("above") || s.includes("air")) return "boatlanding_top";
        return "boatlanding_sub";
    }
    // Conductor
    if (s.includes("conductor")) {
        if (s.includes("top") || s.includes("above") || s.includes("air")) return "conductor_top";
        return "conductor_sub";
    }
    // Caisson
    if (s.includes("caisson")) {
        if (s.includes("top") || s.includes("above") || s.includes("air")) return "caisson_top";
        return "caisson_sub";
    }
    // Riser
    if (s.includes("riser")) {
        return "riser";
    }
    // Splash Zone
    if (s.includes("splash") || s.includes("coating")) {
        return "splashzone";
    }
    // Anodes & CP
    if (s.includes("cp") || s.includes("cathodic") || s.includes("potential")) {
        return "cp";
    }
    if (s.includes("anode")) {
        if (s.includes("maint") || s.includes("work") || s.includes("replace")) return "anode_maint";
        if (s.includes("sel") || s.includes("sample")) return "anode_sel";
        return "anode_gen";
    }
    // Specialized
    if (s.includes("fmd") || s.includes("flood")) return "fmd";
    if (s.includes("mgi") || s.includes("marine") || s.includes("growth")) return "mgi";
    if (s.includes("scour") || s.includes("baselevel")) return "scour";
    if (s.includes("seabed") || s.includes("debris")) return "seabed";
    if (s.includes("mpi") || (s.includes("node") && s.includes("mag"))) return "node_mpi";
    if (s.includes("cvi") || s.includes("node")) return "node_cvi";
    if (s.includes("gvi") || s.includes("visual")) return "gvi";

    return raw;
}

/**
 * Section Filter Configuration.
 * Mutual exclusions and specific QID prefixes ensure complete data isolation between sections.
 */
export const SECTION_COMPONENT_FILTERS: Record<string, {
    includeCodes?: string[];
    includeQidPrefixes?: string[];
    includeInspTypes?: string[];
    includeDefectTypes?: string[];
    excludeCodes?: string[];
    excludeQidPrefixes?: string[];
    excludeInspTypes?: string[];
    excludeDefectTypes?: string[];
}> = {
    // ── GVI: Main structural jacket components only ──
    gvi: {
        excludeCodes: [
            "RS", "RIS", "RISER", "RB", "HS",
            "CA", "CAIS", "CAISSON", "CS", "CB", "SG", "FV",
            "CD", "COND", "CONDUCTOR", "CF", "CG", "CU",
            "BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD", "BO", "BB", "BOAT_BUMPER", "BOATBUMPER", "FD", "FENDER", "FEND",
            "RG", "RGUARD", "RISER_GUARD", "RISERGUARD", "RISG",
            "AN", "ANODE", "CP", "IA", "SANI",
            "GP", "SD", "SEABED", "MR", "CH"
        ],
        excludeQidPrefixes: [
            "RS", "RIS", "CA", "CS", "CD", "COND", "C-", "CGF", "BL", "BO", "BB", "FD", "FEND", "RG", "RISG", "SG", "AN", "CP", "SD"
        ],
        excludeInspTypes: [
            "RFMD", "FMD", "RMGI", "MGROW", "MGI", "RSCR", "SCOUR", "RSEAB", "SEAB", "CP", "RCP", "SANI", "ANMAIN", "CVI", "MPI"
        ]
    },

    // ── Caisson Sections ──
    caisson: {
        includeCodes: ["CA", "CAIS", "CAISSON", "CS", "CB"],
        includeQidPrefixes: ["CA", "CS"],
        includeInspTypes: ["CAISSON", "RCA"],
        excludeCodes: ["CD", "COND", "CGF", "FD", "FEND", "BB", "BL", "RG", "RISG", "RS", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "FEND", "FD", "BB", "BL", "RG", "RISG", "RS", "AN", "CP"]
    },
    caisson_top: {
        includeCodes: ["CA", "CAIS", "CAISSON", "CS", "CB"],
        includeQidPrefixes: ["CA", "CS"],
        includeInspTypes: ["CAISSON", "RCA"],
        excludeCodes: ["CD", "COND", "CGF", "FD", "FEND", "BB", "BL", "RG", "RISG", "RS", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "FEND", "FD", "BB", "BL", "RG", "RISG", "RS", "AN", "CP"]
    },
    caisson_sub: {
        includeCodes: ["CA", "CAIS", "CAISSON", "CS", "CB"],
        includeQidPrefixes: ["CA", "CS"],
        includeInspTypes: ["CAISSON", "RCA"],
        excludeCodes: ["CD", "COND", "CGF", "FD", "FEND", "BB", "BL", "RG", "RISG", "RS", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "FEND", "FD", "BB", "BL", "RG", "RISG", "RS", "AN", "CP"]
    },

    // ── Conductor Sections ──
    conductor: {
        includeCodes: ["CD", "COND", "CONDUCTOR"],
        includeQidPrefixes: ["CD", "COND", "C-", "CGF"],
        includeInspTypes: ["CONDUCTOR", "RCD", "RCOND"],
        excludeCodes: ["FD", "FEND", "FENDER", "BB", "BL", "RG", "RISG", "RS", "RIS", "CA", "CS", "AN", "CP", "SC", "SD"],
        excludeQidPrefixes: ["FEND", "FD", "BB", "BL", "RG", "RISG", "RS", "RIS", "CA", "CS", "AN", "CP", "SC", "SD"],
        excludeInspTypes: ["FENDER", "BUMPER", "BOAT", "RISER GUARD", "CAISSON", "ANODE", "CP", "SCOUR", "SEABED"]
    },
    conductor_top: {
        includeCodes: ["CD", "COND", "CONDUCTOR"],
        includeQidPrefixes: ["CD", "COND", "C-", "CGF"],
        includeInspTypes: ["CONDUCTOR", "RCD", "RCOND"],
        excludeCodes: ["FD", "FEND", "FENDER", "BB", "BL", "RG", "RISG", "RS", "RIS", "CA", "CS", "AN", "CP", "SC", "SD"],
        excludeQidPrefixes: ["FEND", "FD", "BB", "BL", "RG", "RISG", "RS", "RIS", "CA", "CS", "AN", "CP", "SC", "SD"],
        excludeInspTypes: ["FENDER", "BUMPER", "BOAT", "RISER GUARD", "CAISSON", "ANODE", "CP", "SCOUR", "SEABED"]
    },
    conductor_sub: {
        includeCodes: ["CD", "COND", "CONDUCTOR"],
        includeQidPrefixes: ["CD", "COND", "C-", "CGF"],
        includeInspTypes: ["CONDUCTOR", "RCD", "RCOND"],
        excludeCodes: ["FD", "FEND", "FENDER", "BB", "BL", "RG", "RISG", "RS", "RIS", "CA", "CS", "AN", "CP", "SC", "SD"],
        excludeQidPrefixes: ["FEND", "FD", "BB", "BL", "RG", "RISG", "RS", "RIS", "CA", "CS", "AN", "CP", "SC", "SD"],
        excludeInspTypes: ["FENDER", "BUMPER", "BOAT", "RISER GUARD", "CAISSON", "ANODE", "CP", "SCOUR", "SEABED"]
    },

    // ── Riser Sections ──
    riser: {
        includeCodes: ["RS", "RISER", "RIS", "RB", "HS"],
        includeQidPrefixes: ["RS", "RIS"],
        includeInspTypes: ["RISER"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "FD", "FEND", "BB", "BL", "RG", "RISG", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "FD", "FEND", "BB", "BL", "RG", "RISG", "AN", "CP"]
    },

    // ── Boat Landing Sections ──
    boatlanding: {
        includeCodes: ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD", "BO"],
        includeQidPrefixes: ["BL", "BO"],
        includeInspTypes: ["BOAT LANDING", "BOATLANDING", "LANDING"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "RS", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "RS", "AN", "CP"]
    },
    boatlanding_top: {
        includeCodes: ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD", "BO"],
        includeQidPrefixes: ["BL", "BO"],
        includeInspTypes: ["BOAT LANDING", "BOATLANDING", "LANDING"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "RS", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "RS", "AN", "CP"]
    },
    boatlanding_sub: {
        includeCodes: ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD", "BO"],
        includeQidPrefixes: ["BL", "BO"],
        includeInspTypes: ["BOAT LANDING", "BOATLANDING", "LANDING"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "RS", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "RS", "AN", "CP"]
    },

    // ── Riser Guard Sections ──
    riserguard: {
        includeCodes: ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD", "RISG"],
        includeQidPrefixes: ["RG", "RISG"],
        includeInspTypes: ["RISER GUARD", "RISERGUARD", "RGUARD"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "FD", "FEND", "BB", "BL", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "FD", "FEND", "BB", "BL", "AN", "CP"]
    },
    riserguard_top: {
        includeCodes: ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD", "RISG"],
        includeQidPrefixes: ["RG", "RISG"],
        includeInspTypes: ["RISER GUARD", "RISERGUARD", "RGUARD"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "FD", "FEND", "BB", "BL", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "FD", "FEND", "BB", "BL", "AN", "CP"]
    },
    riserguard_sub: {
        includeCodes: ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD", "RISG"],
        includeQidPrefixes: ["RG", "RISG"],
        includeInspTypes: ["RISER GUARD", "RISERGUARD", "RGUARD"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "FD", "FEND", "BB", "BL", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "FD", "FEND", "BB", "BL", "AN", "CP"]
    },

    // ── Boat Bumper Sections ──
    boatbumper: {
        includeCodes: ["BB", "BOAT_BUMPER", "BOATBUMPER", "BOAT_BUMBER", "BOATBUMBER", "FD", "FENDER", "FEND"],
        includeQidPrefixes: ["BB", "FD", "FEND"],
        includeInspTypes: ["BUMPER", "FENDER", "BUMBER", "BOAT BUMPER", "BOAT BUMBER"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "RG", "RISG", "RS", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "RG", "RISG", "RS", "AN", "CP"]
    },
    boatbumper_top: {
        includeCodes: ["BB", "BOAT_BUMPER", "BOATBUMPER", "BOAT_BUMBER", "BOATBUMBER", "FD", "FENDER", "FEND"],
        includeQidPrefixes: ["BB", "FD", "FEND"],
        includeInspTypes: ["BUMPER", "FENDER", "BUMBER", "BOAT BUMPER", "BOAT BUMBER"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "RG", "RISG", "RS", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "RG", "RISG", "RS", "AN", "CP"]
    },
    boatbumper_sub: {
        includeCodes: ["BB", "BOAT_BUMPER", "BOATBUMPER", "BOAT_BUMBER", "BOATBUMBER", "FD", "FENDER", "FEND"],
        includeQidPrefixes: ["BB", "FD", "FEND"],
        includeInspTypes: ["BUMPER", "FENDER", "BUMBER", "BOAT BUMPER", "BOAT BUMBER"],
        excludeCodes: ["CD", "COND", "CGF", "CA", "CS", "RG", "RISG", "RS", "AN", "CP"],
        excludeQidPrefixes: ["CD", "COND", "CGF", "CA", "CS", "RG", "RISG", "RS", "AN", "CP"]
    },

    // ── Conductor Guard Sections ──
    conductorguard: {
        includeCodes: ["CG", "CU", "RCDG", "CONDUCTOR_GUARD", "CONDUCTORGUARD", "CDG"],
        includeQidPrefixes: ["CG", "CU", "CDG", "RCDG"],
        includeInspTypes: ["CONDUCTOR GUARD", "CONDUCTOR_GUARD", "CONDUCTORGUARD"],
        excludeCodes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CA", "CS", "AN", "CP"],
        excludeQidPrefixes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CA", "CS", "AN", "CP"]
    },
    conductorguard_top: {
        includeCodes: ["CG", "CU", "RCDG", "CONDUCTOR_GUARD", "CONDUCTORGUARD", "CDG"],
        includeQidPrefixes: ["CG", "CU", "CDG", "RCDG"],
        includeInspTypes: ["CONDUCTOR GUARD", "CONDUCTOR_GUARD", "CONDUCTORGUARD"],
        excludeCodes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CA", "CS", "AN", "CP"],
        excludeQidPrefixes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CA", "CS", "AN", "CP"]
    },
    conductorguard_sub: {
        includeCodes: ["CG", "CU", "RCDG", "CONDUCTOR_GUARD", "CONDUCTORGUARD", "CDG"],
        includeQidPrefixes: ["CG", "CU", "CDG", "RCDG"],
        includeInspTypes: ["CONDUCTOR GUARD", "CONDUCTOR_GUARD", "CONDUCTORGUARD"],
        excludeCodes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CA", "CS", "AN", "CP"],
        excludeQidPrefixes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CA", "CS", "AN", "CP"]
    },

    // ── Caisson Guard Sections ──
    caissonguard: {
        includeCodes: ["SG", "CB", "RCG", "CAISSON_GUARD", "CAISSONGUARD", "CSG"],
        includeQidPrefixes: ["SG", "RCG", "CSG"],
        includeInspTypes: ["CAISSON GUARD", "CAISSON_GUARD", "CAISSONGUARD"],
        excludeCodes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CD", "COND", "CGF", "AN", "CP"],
        excludeQidPrefixes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CD", "COND", "CGF", "AN", "CP"]
    },
    caissonguard_top: {
        includeCodes: ["SG", "CB", "RCG", "CAISSON_GUARD", "CAISSONGUARD", "CSG"],
        includeQidPrefixes: ["SG", "RCG", "CSG"],
        includeInspTypes: ["CAISSON GUARD", "CAISSON_GUARD", "CAISSONGUARD"],
        excludeCodes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CD", "COND", "CGF", "AN", "CP"],
        excludeQidPrefixes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CD", "COND", "CGF", "AN", "CP"]
    },
    caissonguard_sub: {
        includeCodes: ["SG", "CB", "RCG", "CAISSON_GUARD", "CAISSONGUARD", "CSG"],
        includeQidPrefixes: ["SG", "RCG", "CSG"],
        includeInspTypes: ["CAISSON GUARD", "CAISSON_GUARD", "CAISSONGUARD"],
        excludeCodes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CD", "COND", "CGF", "AN", "CP"],
        excludeQidPrefixes: ["FD", "FEND", "BB", "BL", "RG", "RISG", "CD", "COND", "CGF", "AN", "CP"]
    },

    // ── Cathodic Potential (CP) Survey Section (Strictly CP potential / survey anomalies) ──
    cp: {
        includeCodes: ["CP", "IA"],
        includeQidPrefixes: ["CP"],
        includeInspTypes: ["CP", "RCP", "CPSURV", "CPCLB", "CATHODIC", "POTENTIAL"],
        includeDefectTypes: [
            "CATHODIC POTENTIAL", "CP", "CP POTENTIAL", "LOW CP", "CP READING", 
            "CATHODIC POTENTIAL OVER PROTECTED", "CATHODIC POTENTIAL UNDER PROTECTED",
            "OVER PROTECTED", "UNDER PROTECTED", "POTENTIAL"
        ],
        excludeCodes: ["AN", "ANODE"],
        excludeQidPrefixes: ["AN", "BAN"],
        excludeDefectTypes: [
            "ANODE WASTAGE", "ANODE NOT PRESENT", "ANODE MISSING", "ANODE CORROSION",
            "ANODE WASTAGE ANODE BAR PARTIALLY VISIBLE"
        ]
    },

    // ── Anode Sections ──
    anode_gen: {
        includeCodes: ["AN", "ANODE", "CP", "IA"],
        includeQidPrefixes: ["AN", "CP"],
        includeInspTypes: ["ANODE", "CP", "RGVI", "GVI", "RAN", "SANI", "RSANI"]
    },
    anode_sel: {
        includeCodes: ["AN", "ANODE", "CP", "IA"],
        includeQidPrefixes: ["AN", "CP"],
        includeInspTypes: ["ANODE", "CP", "SANI", "RSANI"]
    },
    anode_maint: {
        includeCodes: ["AN", "ANODE", "CP"],
        includeInspTypes: ["ANMAIN", "ANODE"]
    },

    // ── Specialized Inspection Sections ──
    fmd: {
        includeInspTypes: ["FMD", "RFMD", "FLOOD"]
    },
    mgi: {
        includeInspTypes: ["MGI", "RMGI", "MGROW", "MARINE_GROWTH", "GROWTH"]
    },
    scour: {
        includeCodes: ["SC", "SD", "SCOUR"],
        includeInspTypes: ["SCOUR", "RSCR"]
    },
    seabed: {
        includeCodes: ["SD", "SEABED"],
        includeInspTypes: ["SEAB", "RSEAB", "SEABED"]
    },
    node_cvi: {
        includeCodes: ["ND", "WN", "NODE"],
        includeQidPrefixes: ["ND", "WN"],
        includeInspTypes: ["NODE", "CVI", "RCVI"]
    },
    node_mpi: {
        includeCodes: ["ND", "WN", "NODE"],
        includeQidPrefixes: ["ND", "WN"],
        includeInspTypes: ["NODE", "MPI", "RMPI"]
    },
    splashzone: {
        includeInspTypes: ["SZONE", "SPLASH"]
    }
};

/**
 * Checks if a given item (anomaly, finding, or task) matches a specific section ID based on the rules.
 */
export function isItemMatchingSection(item: any, sectionId: string): boolean {
    const normSecId = normalizeSectionId(sectionId);
    if (!normSecId || normSecId === "intro" || normSecId === "anomaly_finding" || normSecId === "incomplete") {
        return true; // Default matches all
    }

    const config = SECTION_COMPONENT_FILTERS[normSecId];
    if (!config) return true;

    const ct = String(item.component_type || item.component_code || item.component || item.type || "").toUpperCase().trim();
    const qid = String(item.qid || item.component_qid || item.target || "").toUpperCase().trim();
    const insp = String(item.inspection_type_code || item.inspection_type || item.inspectionType || item.inspection_name || item.scope || item.inspection_type?.code || "").toUpperCase().trim();
    const defectType = String(item.defect_type_code || item.defect_type || item.defect || item.defectCode || "").toUpperCase().trim();
    const defectCat = String(item.defect_category_code || item.defect_category || "").toUpperCase().trim();
    const desc = String(item.description || item.defect_description || item.comments || item.notes || item.reason || "").toUpperCase();

    // 1. Check exclusions
    if (config.excludeCodes && config.excludeCodes.some(c => ct === c || ct.startsWith(c))) {
        return false;
    }
    if (config.excludeQidPrefixes && config.excludeQidPrefixes.some(p => qid.startsWith(p))) {
        return false;
    }
    if (config.excludeInspTypes && config.excludeInspTypes.some(t => insp.includes(t))) {
        return false;
    }
    if (config.excludeDefectTypes && config.excludeDefectTypes.some(d => defectType === d || defectCat === d || defectType.includes(d) || defectCat.includes(d))) {
        return false;
    }

    // 2. If inclusion rules are defined, at least one must match
    const hasInclusions = (config.includeCodes && config.includeCodes.length > 0) ||
                          (config.includeQidPrefixes && config.includeQidPrefixes.length > 0) ||
                          (config.includeInspTypes && config.includeInspTypes.length > 0) ||
                          (config.includeDefectTypes && config.includeDefectTypes.length > 0);

    if (hasInclusions) {
        const matchesCode = config.includeCodes ? config.includeCodes.some(c => ct === c || ct.startsWith(c)) : false;
        const matchesQid = config.includeQidPrefixes ? config.includeQidPrefixes.some(p => qid.startsWith(p)) : false;
        const inspName = String(item.inspection_type?.name || item.inspection_type_name || item.inspectionName || item.scope || "").toUpperCase();
        const matchesInsp = config.includeInspTypes ? config.includeInspTypes.some(t => insp.includes(t) || inspName.includes(t) || desc.includes(t)) : false;
        const matchesDefect = config.includeDefectTypes ? config.includeDefectTypes.some(d => defectType.includes(d) || defectCat.includes(d) || desc.includes(d)) : false;

        // CP Section special case: also match records that contain CP readings
        let matchesReading = false;
        if (normSecId === "cp") {
            const d = (typeof item.inspection_data === "string" ? (() => { try { return JSON.parse(item.inspection_data); } catch { return {}; } })() : item.inspection_data) || item.inspection_dat || {};
            const primaryCP = item.cp_reading ?? item.cp_rdg ?? item.cp_reading_mv ?? item.cp ?? d.cp_rdg ?? d.cp_reading_mv ?? d.cp ?? d.cp_reading;
            if (primaryCP !== undefined && primaryCP !== null && String(primaryCP).trim() !== "" && String(primaryCP).trim() !== "-" && String(primaryCP).trim().toUpperCase() !== "N/A") {
                matchesReading = true;
            }
            const additionals: any[] = Array.isArray(d.cp_rdg_additional) ? d.cp_rdg_additional : (Array.isArray(d.cp_readings) ? d.cp_readings : []);
            if (additionals.some((a: any) => { const v = a?.reading ?? a?.cp_rdg ?? a?.cp; return v !== undefined && v !== null && String(v).trim() !== ""; })) {
                matchesReading = true;
            }
        }

        const passesInclusion = matchesCode || matchesQid || matchesInsp || matchesDefect || matchesReading;
        if (!passesInclusion) return false;
    }

    // 3. Elevation & Zone Filter (Strict Topside vs Subsea vs Splash Zone)
    const rawElv = item.elevation ?? item.elev ?? item.elevation_m ?? item.el;
    const zoneStr = String(item.zone || item.elevation_zone || item.location || item.area || "").toUpperCase();

    let elvNum: number | null = null;
    let isExplicitlySubsea = false;
    let isExplicitlyTopside = false;

    if (rawElv !== undefined && rawElv !== null && String(rawElv).trim() !== "" && String(rawElv).trim() !== "-") {
        const s = String(rawElv).trim();
        if (s.includes("(-)") || s.startsWith("-")) {
            isExplicitlySubsea = true;
        } else if (s.includes("(+)") || s.startsWith("+")) {
            isExplicitlyTopside = true;
        }
        const cleaned = s.replace(/\(-\)/g, "-").replace(/\(\+\)/g, "+").replace(/[^\d.+-]/g, "");
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) {
            elvNum = parsed;
        }
    }

    if (zoneStr.includes("SUBSEA") || zoneStr.includes("UNDERWATER") || zoneStr.includes("BELOW")) {
        isExplicitlySubsea = true;
    }
    if (zoneStr.includes("TOPSIDE") || zoneStr.includes("ABOVE WATER") || zoneStr.includes("AIR")) {
        isExplicitlyTopside = true;
    }

    if (normSecId.endsWith("_top")) {
        // Section is strictly Topside / Above Water
        if (isExplicitlySubsea) return false;
        if (elvNum !== null && elvNum <= 0) return false;
    } else if (normSecId.endsWith("_sub")) {
        // Section is strictly Subsea / Below Water
        if (isExplicitlyTopside && !isExplicitlySubsea) return false;
        if (elvNum !== null && elvNum > 0) return false;
    } else if (normSecId === "splashzone") {
        // Section is strictly Splash Zone (-3m to +3m or explicitly marked SPLASH)
        if (zoneStr.includes("SPLASH")) return true;
        if (elvNum !== null && (elvNum < -3 || elvNum > 3)) return false;
    }

    return true;
}
