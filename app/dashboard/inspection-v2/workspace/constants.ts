export const AIR_DIVE_ACTIONS = [
    { label: "Left Surface", value: "LEAVING_SURFACE" },
    { label: "Arrived Bottom", value: "AT_WORKSITE" },
    { label: "Diver at Worksite", value: "AT_WORKSITE" },
    { label: "Diver Left Worksite", value: "LEAVING_WORKSITE" },
    { label: "Left Bottom", value: "LEAVING_WORKSITE" },
    { label: "Arrived Surface", value: "BACK_TO_SURFACE" }
];

export const BELL_DIVE_ACTIONS = [
    { label: "Left Surface", value: "BELL_LAUNCHED" },
    { label: "Bell at Working Depth", value: "BELL_AT_DEPTH" },
    { label: "Diver Locked Out", value: "DIVER_EXITING_BELL" },
    { label: "Diver Locked In", value: "DIVER_RETURNING_TO_BELL" },
    { label: "Bell Left Bottom", value: "BELL_ASCENDING" },
    { label: "Bell on Surface", value: "BELL_AT_SURFACE" },
    { label: "TUP Complete", value: "BELL_MATED_TO_CHAMBER" }
];

export const MARINE_GROWTH_LIST = [
    "Hard: 0-20% Coverage", "Hard: 20-40% Coverage", "Hard: 40-60% Coverage", "Hard: 60-80% Coverage", "Hard: 80-100% Coverage", "Hard: All Over",
    "Soft: 0-20% Coverage", "Soft: 20-40% Coverage", "Soft: 40-60% Coverage", "Soft: 60-80% Coverage", "Soft: 80-100% Coverage", "Soft: All Over",
    "Hard and Soft: 0-20% Coverage", "Hard and Soft: 20-40% Coverage", "Hard and Soft: 40-60% Coverage", "Hard and Soft: 60-80% Coverage", "Hard and Soft: 80-100% Coverage", "Hard and Soft: All Over",
    "MGI: 0-20% Coverage", "MGI: 20-40% Coverage", "MGI: 40-60% Coverage", "MGI: 60-80% Coverage", "MGI: 80-100% Coverage", "MGI: All Over"
];

export const COATING_CONDITION_LIST = [
    "Good", "Satisfactory", "Bare Metal Showing", "Coating Cracked", "Coating Cracked Longitudinally",
    "Coating Cracked Circumferentially", "Superficial Damage", "Other Defect", "None", "N/A"
];

export const COMPONENT_CONDITION_LIST = [
    "Good", "Satisfactory", "None", "N/A",
    "Dent: At 3 'O Clock", "Dent: At 6 'O Clock", "Dent: At 9 'O Clock", "Dent: At 12 'O Clock",
    "Ruptured", "Fittings", "Other Defect"
];

export const ANODE_TYPE_LIST = [
    "Zn - Zinc", "Al - Aluminum", "Mg - Magnesium", "Other"
];

export const ANODE_DEPLETION_GROUPS: { type: string; options: string[] }[] = [
    {
        type: "Bar",
        options: [
            "Bar: 0 - 25% Depletion",
            "Bar: 25 - 50% Depletion",
            "Bar: 50 - 75% Depletion",
            "Bar: 75 - 100% Depletion",
            "Bar: Unable to Estimate"
        ]
    },
    {
        type: "Bracelet",
        options: [
            "Bracelet: 0 - 25% Depletion",
            "Bracelet: 25 - 50% Depletion",
            "Bracelet: 50 - 75% Depletion",
            "Bracelet: 75 - 100% Depletion",
            "Bracelet: Unable to Estimate"
        ]
    },
    {
        type: "Collar",
        options: [
            "Collar: 0 - 25% Depletion",
            "Collar: 25 - 50% Depletion",
            "Collar: 50 - 75% Depletion",
            "Collar: 75 - 100% Depletion",
            "Collar: Unable to Estimate"
        ]
    },
    {
        type: "Sled",
        options: [
            "Sled: 0 - 25% Depletion",
            "Sled: 25 - 50% Depletion",
            "Sled: 50 - 75% Depletion",
            "Sled: 75 - 100% Depletion",
            "Sled: Unable to Estimate"
        ]
    }
];

// Flat list for backward compatibility
export const ANODE_DEPLETION_LIST = ANODE_DEPLETION_GROUPS.flatMap(g => g.options);


export const ROV_MOVEMENT_BRANCHES: Record<string, string[]> = {
    'Awaiting Deployment': ['Rov On Hire', 'Rov Launched'],
    'Rov On Hire': ['Rov Launched'],
    'Rov Launched': ['Rov at the Worksite'],
    'ROV_DEPLOYED': ['Rov at the Worksite'],
    'ROV_TRANSITING': ['Rov at the Worksite'],
    'Rov at the Worksite': ['Rov Leaving the Worksite'],
    'ROV_AT_WORKSITE': ['Rov Leaving the Worksite'],
    'ROV_WORKING': ['Rov Leaving the Worksite'],
    'Rov Leaving the Worksite': ['Rov Recovered', 'Rov Back to TMS'],
    'ROV_LEAVING_WORKSITE': ['Rov Recovered', 'Rov Back to TMS'],
    'Rov Back to TMS': ['Rov Launched', 'Rov Recovered'],
    'Rov Recovered': ['Rov Launched', 'Rov Off Hire'],
    'ROV_RECOVERED': ['Rov Launched', 'Rov Off Hire'],
    'Rov Off Hire': []
};

export const INITIAL_VIDEO_EVENTS = [
    { id: 1, time: "00:00:00", action: "Start Tape", diveLogId: "DIVE-02" },
    { id: 2, time: "00:15:20", action: "Pause", diveLogId: "DIVE-02" },
    { id: 3, time: "00:16:05", action: "Resume", diveLogId: "DIVE-02" },
];

export const COMPONENTS_SOW = [
    { id: "LEG_B2", name: "LEG B2", depth: "-12m", tasks: ["GVINS", "HSTAT"] },
    { id: "BAN_001", name: "BAN001", depth: "-8m", tasks: ["CVINS"] },
];

export const COMPONENTS_NON_SOW = [
    { id: "NODE_X", name: "NODE X", depth: "-15m", tasks: ["GVINS"] },
    { id: "RISER_A", name: "RISER A", depth: "-22m", tasks: ["CVINS"] },
];

export const HISTORICAL_DATA = [
    { year: 2024, type: "GVINS", status: "Anomaly", finding: "Minor marine growth", inspector: "Alex" },
    { year: 2022, type: "CVINS", status: "Complete", finding: "Clear", inspector: "Jitesh" },
];

export const CURRENT_RECORDS = [
    { id: 1, time: "10:57", type: "GVINS", comp: "LEG B2", status: "Complete", timer: "00:15:10", hasPhoto: true },
    { id: 2, time: "11:20", type: "HSTAT", comp: "LEG B2", status: "Anomaly", timer: "00:30:45", hasPhoto: false },
];
