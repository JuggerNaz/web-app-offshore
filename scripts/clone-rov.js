const fs = require('fs');

function cloneWithReplace(src, dest, replacements) {
    let content = fs.readFileSync(src, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.replace(new RegExp(search, 'g'), replace);
    }
    fs.writeFileSync(dest, content);
    console.log(`Cloned ${src} to ${dest}`);
}

const pageReplacements = [
    ['DiveVideoRecorderProps', 'ROVVideoRecorderProps'],
    ['DiveJobSetupDialog', 'ROVJobSetupDialog'],
    ['DiveLiveDataDialog', 'ROVLiveDataDialog'],
    ['DiveVideoDialog', 'ROVVideoDialog'],
    ['DiveVideoRecorder', 'DiveVideoRecorder'],
    ['DiveMovementDialog', 'ROVMovementDialog'],
    ['DiveInspectionTypeCard', 'ROVInspectionTypeCard'],
    ['DiveInspectionList', 'ROVInspectionList'],
    ['InspectionRecordingDialog', 'ROVInspectionRecordingDialog'],
    ['DiveJob', 'ROVJob'],
    ['activeDiveJobs', 'activeROVJobs'],
    ['completedDiveJobs', 'completedROVJobs'],
    ['setActiveDiveJobs', 'setActiveROVJobs'],
    ['setCompletedDiveJobs', 'setCompletedROVJobs'],
    ['selectedDiveJob', 'selectedROVJob'],
    ['dive_job_id', 'rov_job_id'],
    ['dive_no', 'deployment_no'],
    ['diver_name', 'rov_serial_no'],
    ['dive_supervisor', 'rov_operator'],
    ['insp_dive_jobs', 'insp_rov_jobs'],
    ['insp_dive_data', 'insp_rov_data'],
    ['insp_dive_movements', 'insp_rov_movements'],
    ['DiveInspectionContent', 'ROVInspectionContent'],
    ['AIR_DIVE_ACTIONS', 'ROV_ACTIONS'],
    ['setDiveJob', 'setROVJob'],
    ['diveJob', 'rovJob'],
    ['Dive ', 'ROV '],
    ['dive ', 'rov '],
    ['Diver:', 'ROV:'],
    ['Supv:', 'Operator:'],
    ['Diver at Worksite', 'ROV at Worksite'],
    ['Diver Left Worksite', 'ROV Left Worksite'],
    ['Arrived Bottom', 'ROV at Bottom'],
    ['Left Bottom', 'ROV Left Bottom'],
    ['Left Surface', 'ROV Deployed'],
    ['Arrived Surface', 'ROV Recovered'],
    ['DiveInspectionPage', 'ROVInspectionPage'],
    ['rovJob=\\{', 'diveJob={']
];

cloneWithReplace(
    'app/dashboard/inspection/dive/page.tsx',
    'app/dashboard/inspection/rov/page.tsx',
    pageReplacements
);
cloneWithReplace(
    'app/dashboard/inspection/dive/components/DiveInspectionList.tsx',
    'app/dashboard/inspection/rov/components/ROVInspectionList.tsx',
    pageReplacements
);
cloneWithReplace(
    'app/dashboard/inspection/dive/components/DiveInspectionTypeCard.tsx',
    'app/dashboard/inspection/rov/components/ROVInspectionTypeCard.tsx',
    pageReplacements
);
cloneWithReplace(
    'app/dashboard/inspection/dive/components/InspectionRecordingDialog.tsx',
    'app/dashboard/inspection/rov/components/ROVInspectionRecordingDialog.tsx',
    pageReplacements
);
cloneWithReplace(
    'app/dashboard/inspection/dive/components/DiveVideoDialog.tsx',
    'app/dashboard/inspection/rov/components/ROVVideoDialog.tsx',
    pageReplacements
);
cloneWithReplace(
    'app/dashboard/inspection/dive/components/DiveLiveDataDialog.tsx',
    'app/dashboard/inspection/rov/components/ROVLiveDataDialog.tsx',
    pageReplacements
);
cloneWithReplace(
    'app/dashboard/inspection/dive/components/DiveMovementDialog.tsx',
    'app/dashboard/inspection/rov/components/ROVMovementDialog.tsx',
    pageReplacements
);