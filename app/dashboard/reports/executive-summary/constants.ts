
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
 * Section Filter Configuration.
 * Add or remove component codes, QID prefixes, or inspection type codes here
 * to adjust what is included or excluded for each section in the executive summary report.
 */
export const SECTION_COMPONENT_FILTERS: Record<string, {
    includeCodes?: string[];
    includeQidPrefixes?: string[];
    includeInspTypes?: string[];
    excludeCodes?: string[];
    excludeQidPrefixes?: string[];
    excludeInspTypes?: string[];
}> = {
    // ── GVI: Main structural jacket components only ──
    // Excludes all appurtenances (Risers, Caissons, Conductors, Boat Landings, Anodes, etc.)
    gvi: {
        excludeCodes: [
            // Risers & Flexible Hoses
            "RS", "RIS", "RISER", "RB", "HS",
            // Caissons & Guides
            "CA", "CAIS", "CAISSON", "CS", "CB", "SG", "FV",
            // Conductors & Guides
            "CD", "COND", "CONDUCTOR", "CF", "CG", "CU",
            // Boat Landings & Bumpers
            "BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD", "BO", "BB", "BOAT_BUMPER", "BOATBUMPER", "FD", "FENDER",
            // Riser Guards
            "RG", "RGUARD", "RISER_GUARD", "RISERGUARD",
            // Cathodic Protection / Anodes
            "AN", "ANODE", "CP", "IA", "SANI",
            // Seabed / Mooring
            "GP", "SD", "SEABED", "MR", "CH"
        ],
        excludeQidPrefixes: [
            "RS", "RIS", "CA", "CS", "CD", "COND", "C-", "BL", "BO", "BB", "RG", "SG", "AN", "CP", "SD"
        ],
        excludeInspTypes: [
            "RFMD", "FMD", "RMGI", "MGROW", "MGI", "RSCR", "SCOUR", "RSEAB", "SEAB", "CP", "RCP", "SANI", "ANMAIN", "CVI", "MPI"
        ]
    },

    // ── Caisson Sections ──
    caisson: {
        includeCodes: ["CA", "CAIS", "CAISSON", "CS", "CB"],
        includeQidPrefixes: ["CA", "CS"],
        includeInspTypes: ["CAISSON"]
    },
    caisson_top: {
        includeCodes: ["CA", "CAIS", "CAISSON", "CS", "CB"],
        includeQidPrefixes: ["CA", "CS"],
        includeInspTypes: ["CAISSON"]
    },
    caisson_sub: {
        includeCodes: ["CA", "CAIS", "CAISSON", "CS", "CB"],
        includeQidPrefixes: ["CA", "CS"],
        includeInspTypes: ["CAISSON"]
    },

    // ── Conductor Sections ──
    conductor: {
        includeCodes: ["CD", "COND", "CONDUCTOR", "CF", "CG", "CU"],
        includeQidPrefixes: ["CD", "COND", "C-"],
        includeInspTypes: ["CONDUCTOR"]
    },
    conductor_top: {
        includeCodes: ["CD", "COND", "CONDUCTOR", "CF", "CG", "CU"],
        includeQidPrefixes: ["CD", "COND", "C-"],
        includeInspTypes: ["CONDUCTOR"]
    },
    conductor_sub: {
        includeCodes: ["CD", "COND", "CONDUCTOR", "CF", "CG", "CU"],
        includeQidPrefixes: ["CD", "COND", "C-"],
        includeInspTypes: ["CONDUCTOR"]
    },

    // ── Riser Sections ──
    riser: {
        includeCodes: ["RS", "RISER", "RIS", "RB", "HS"],
        includeQidPrefixes: ["RS", "RIS"],
        includeInspTypes: ["RISER"]
    },

    // ── Boat Landing Sections ──
    boatlanding: {
        includeCodes: ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD", "BO"],
        includeQidPrefixes: ["BL", "BO"],
        includeInspTypes: ["BOAT"]
    },
    boatlanding_top: {
        includeCodes: ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD", "BO"],
        includeQidPrefixes: ["BL", "BO"],
        includeInspTypes: ["BOAT"]
    },
    boatlanding_sub: {
        includeCodes: ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD", "BO"],
        includeQidPrefixes: ["BL", "BO"],
        includeInspTypes: ["BOAT"]
    },

    // ── Riser Guard Sections ──
    riserguard: {
        includeCodes: ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD", "SG"],
        includeQidPrefixes: ["RG"],
        includeInspTypes: ["GUARD"]
    },
    riserguard_top: {
        includeCodes: ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD", "SG"],
        includeQidPrefixes: ["RG"],
        includeInspTypes: ["GUARD"]
    },
    riserguard_sub: {
        includeCodes: ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD", "SG"],
        includeQidPrefixes: ["RG"],
        includeInspTypes: ["GUARD"]
    },

    // ── Boat Bumper Sections ──
    boatbumper: {
        includeCodes: ["BB", "BOAT_BUMPER", "BOATBUMPER", "FD", "FENDER"],
        includeQidPrefixes: ["BB"],
        includeInspTypes: ["BUMPER", "FENDER"]
    },
    boatbumper_top: {
        includeCodes: ["BB", "BOAT_BUMPER", "BOATBUMPER", "FD", "FENDER"],
        includeQidPrefixes: ["BB"],
        includeInspTypes: ["BUMPER", "FENDER"]
    },
    boatbumper_sub: {
        includeCodes: ["BB", "BOAT_BUMPER", "BOATBUMPER", "FD", "FENDER"],
        includeQidPrefixes: ["BB"],
        includeInspTypes: ["BUMPER", "FENDER"]
    },

    // ── Conductor Guard Sections ──
    conductorguard_sub: {
        includeCodes: ["CG", "CU", "CF"],
        includeQidPrefixes: ["CG", "CU"]
    },
    conductorguard_top: {
        includeCodes: ["CG", "CU", "CF"],
        includeQidPrefixes: ["CG", "CU"]
    },

    // ── Caisson Guard Sections ──
    caissonguard_sub: {
        includeCodes: ["SG", "CB"],
        includeQidPrefixes: ["SG"]
    },
    caissonguard_top: {
        includeCodes: ["SG", "CB"],
        includeQidPrefixes: ["SG"]
    },

    // ── Cathodic Potential / Anode Sections ──
    cp: {
        includeCodes: ["AN", "ANODE", "CP", "IA"],
        includeQidPrefixes: ["AN", "CP"],
        includeInspTypes: ["ANODE", "CP", "RCP", "SANI"]
    },
    anode_gen: {
        includeCodes: ["AN", "ANODE", "CP", "IA"],
        includeQidPrefixes: ["AN", "CP"],
        includeInspTypes: ["ANODE", "CP", "RGVI", "GVI"]
    },
    anode_sel: {
        includeCodes: ["AN", "ANODE", "CP", "IA"],
        includeQidPrefixes: ["AN", "CP"],
        includeInspTypes: ["ANODE", "CP"]
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
    const config = SECTION_COMPONENT_FILTERS[sectionId];
    if (!config) return true; // Default (e.g. intro, anomaly_finding, incomplete) matches all

    const ct = String(item.component_type || item.component_code || "").toUpperCase().trim();
    const qid = String(item.qid || "").toUpperCase().trim();
    const insp = String(item.inspection_type_code || item.inspectionType || "").toUpperCase().trim();
    const desc = String(item.description || "").toUpperCase();

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

    // 2. If inclusion rules are defined, at least one must match
    const hasInclusions = (config.includeCodes && config.includeCodes.length > 0) ||
                          (config.includeQidPrefixes && config.includeQidPrefixes.length > 0) ||
                          (config.includeInspTypes && config.includeInspTypes.length > 0);

    if (hasInclusions) {
        const matchesCode = config.includeCodes ? config.includeCodes.some(c => ct === c || ct.startsWith(c)) : false;
        const matchesQid = config.includeQidPrefixes ? config.includeQidPrefixes.some(p => qid.startsWith(p)) : false;
        const matchesInsp = config.includeInspTypes ? config.includeInspTypes.some(t => insp.includes(t) || desc.includes(t)) : false;

        return matchesCode || matchesQid || matchesInsp;
    }

    return true;
}
