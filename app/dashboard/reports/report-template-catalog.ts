import {
    Building2,
    Layers,
    Package,
    Calendar,
    Wrench,
    FileBarChart,
    FileText,
    FileCheck,
    Eye,
    Compass
} from "lucide-react";

// Report Templates Definition
// (Kept in a lightweight standalone module so constant-only consumers such as
// ReportSettingsDialog don't need to pull in the full report-wizard graph.)
export const REPORT_TEMPLATES = {
    structure: [
        { id: "structure-summary", name: "Structure Summary Report", icon: Building2, description: "Complete overview of structure details and specifications", requires: ["structure"] },
        { id: "component-catalog", name: "Component Catalogue", icon: Layers, description: "Detailed list of all components with specifications", requires: ["structure"] },
        { id: "technical-specs", name: "Technical Specifications", icon: FileBarChart, description: "Technical data and engineering specifications", requires: ["structure"] },
        { id: "component-spec", name: "Component Data Sheet", icon: FileText, description: "Individual technical data sheet for specific components", requires: ["structure", "component"] },
    ],
    jobpack: [
        { id: "jobpack-summary", name: "Job Pack Summary", icon: Package, description: "Overview of job pack details and assignments", requires: ["jobpack"] },
        { id: "work-scope-report", name: "Work Scope Report", icon: Wrench, description: "Detailed work scope for a specific platform", requires: ["jobpack", "structure"] },
        { id: "work-scope-status", name: "Work Scope Status Summary", icon: FileBarChart, description: "Status completion summary with charts", requires: ["jobpack", "structure"] },
        { id: "work-scope-incomplete", name: "Work Scope Incomplete Status", icon: FileBarChart, description: "Incomplete status breakdown with charts", requires: ["jobpack", "structure"] },

    ],
    planning: [
        { id: "inspection-schedule", name: "Inspection Schedule", icon: Calendar, description: "Planned inspection timeline and milestones", requires: ["planning"] },
        { id: "planning-overview", name: "Planning Overview", icon: FileText, description: "Complete planning documentation", requires: ["planning"] },
    ],
    inspection: [
        { id: "defect-summary", name: "Defect Summary Report", icon: FileBarChart, description: "Priority-ordered summary of all anomalies with colour coding and rectification status", requires: ["jobpack", "structure", "sow_report"] },
        { id: "defect-summary-pipeline", name: "Defect Summary Report (Pipeline)", icon: FileBarChart, description: "Priority-ordered summary of pipeline anomalies and associated structure risers with combined span/burial events and color coding", requires: ["jobpack", "structure", "sow_report"] },
        { id: "findings-summary-pipeline", name: "Finding Summary Report (Pipeline)", icon: FileBarChart, description: "Priority-ordered summary of pipeline findings with reference numbers containing 'F' and combined span/burial events", requires: ["jobpack", "structure", "sow_report"] },
        { id: "findings-summary", name: "Findings Summary Report", icon: FileBarChart, description: "Priority-ordered summary of all findings with colour coding and rectification status", requires: ["jobpack", "structure", "sow_report"] },
        { id: "compliance-report", name: "Compliance Report", icon: FileText, description: "Regulatory compliance documentation", requires: ["jobpack"] },
        { id: "defect-anomaly-report", name: "Defect / Anomaly Report", icon: FileCheck, description: "Detailed defect and anomaly report with images", requires: ["jobpack", "structure", "sow_report"] },
        { id: "findings-report", name: "Findings Report", icon: FileCheck, description: "Detailed findings report with images", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diver-log-report", name: "Diver Log Report", icon: FileText, description: "Chronological diver log grouped by dive number with inspection findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "video-log-report", name: "Video Log Report", icon: FileText, description: "Video log entries grouped by tape number with timecodes and dive references", requires: ["jobpack", "structure", "sow_report"] },
        { id: "seabed-survey-debris", name: "Seabed Survey Debris Sketch Report (ROV)", icon: FileCheck, description: "Filtered Seabed GUI maps with debris items marked", requires: ["jobpack", "structure", "sow_report"] },
        { id: "seabed-survey-gas", name: "Seabed Survey Gas Seepage Sketch Report (ROV)", icon: FileCheck, description: "Filtered Seabed GUI maps with gas seepages marked", requires: ["jobpack", "structure", "sow_report"] },
        { id: "seabed-survey-crater", name: "Seabed Survey Crater Sketch Report (ROV)", icon: FileCheck, description: "Filtered Seabed GUI maps with craters marked", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-seabed-report", name: "Seabed Survey Inspection Sketch Report (ROV)", icon: FileCheck, description: "Unfiltered Seabed GUI maps showing all debris, craters and gas seepages", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rseab-detail-report", name: "Seabed Survey Debris Inspection Report (ROV)", icon: FileCheck, description: "Detailed portrait tabular Seabed Survey Debris inspection report with anomalies and findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rseab-gas-detail-report", name: "Seabed Survey Gas Seepage Inspection Report (ROV)", icon: FileCheck, description: "Detailed portrait tabular Seabed Survey Gas Seepage inspection report with anomalies and findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rseab-crater-detail-report", name: "Seabed Survey Crater Inspection Report (ROV)", icon: FileCheck, description: "Detailed portrait tabular Seabed Survey Crater inspection report with anomalies and findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "mgi-report", name: "Marine Growth Graph Report (ROV)", icon: FileBarChart, description: "Marine Growth Graph Report (ROV) RMGI with Graph", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rmgi-report", name: "Marine Growth Inspection Report (ROV)", icon: FileBarChart, description: "Marine Growth Inspection Report (ROV) RMGI Standard Table", requires: ["jobpack", "structure", "sow_report"] },
        { id: "fmd-report", name: "FMD Survey Report (ROV)", icon: FileText, description: "Flooded Member Detection summary report with QID, Elevation, Dive and Tape details", requires: ["jobpack", "structure", "sow_report"] },
        { id: "szci-report", name: "Splash Zone Inspection Report (ROV)", icon: FileBarChart, description: "Splash zone wall thickness and CP inspection summary with clock positions", requires: ["jobpack", "structure", "sow_report"] },
        { id: "utwt-report", name: "UT Thickness Report (ROV)", icon: FileText, description: "Detailed ROV UT wall thickness report with 4 clock positions and elevation reference", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rrisi-report", name: "Riser Survey Inspection Sketch Report (ROV)", icon: FileBarChart, description: "Detailed ROV riser structural integrity inspection with graphical elevation profiles", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rrisi-detail-report", name: "Riser Inspection Report (ROV)", icon: FileBarChart, description: "Detailed ROV riser structural integrity inspection with tabular data, anomaly logs and CP readings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-jtisi-report", name: "J-Tube Survey Inspection Sketch Report (ROV)", icon: FileBarChart, description: "Detailed ROV J-Tube structural integrity inspection with graphical elevation profiles", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-jtisi-detail-report", name: "J-Tube Inspection Report (ROV)", icon: FileBarChart, description: "Detailed ROV J-Tube structural integrity inspection with tabular data, anomaly logs and CP readings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-itisi-report", name: "I-Tube Survey Inspection Sketch Report (ROV)", icon: FileBarChart, description: "Detailed ROV I-Tube structural integrity inspection with graphical elevation profiles", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-itisi-detail-report", name: "I-Tube Inspection Report (ROV)", icon: FileBarChart, description: "Detailed ROV I-Tube structural integrity inspection with tabular data, anomaly logs and CP readings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rscor-survey-report", name: "Scour Survey Report (ROV)", icon: FileBarChart, description: "Standard portrait tabular ROV Scour Survey report (RSCOUR/RSCOR) with Item No., QID, Elevation, Dive No., Tape No., and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-scour-report", name: "Scour Survey Sketch Report (ROV)", icon: FileBarChart, description: "Detailed landscape graphical ROV scour survey of horizontal members with graphical mudline profiles.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-anode-report", name: "Anode Inspection Report (ROV)", icon: FileBarChart, description: "Detailed ROV anode inspection summary with CP, depletion, and structural references (excluding RSANI)", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-anode-rsani-report", name: "Selected Anode Report (ROV)", icon: FileBarChart, description: "Detailed ROV Selected Anode Close Visual Inspection (CVI) summary (SANI) with CP, depletion, and structural references", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-cp-report",    name: "CP Survey Report (ROV)",         icon: FileBarChart, description: "Portrait CP survey report with primary + additional CP readings, anomaly refs and rectification remarks", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-ricmi-report", name: "Inclinometer Survey Report (ROV)", icon: FileBarChart, description: "Portrait Inclinometer Survey Report (RICMI) with QID, Elevation, Dive No., Angle readings, additional readings, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-selected-node-report", name: "Selected Node Report (ROV)", icon: FileText, description: "Portrait Selected Node Report (RSWNI) with QID, Elevation, CP, Component/Coating Condition, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rgvi-report",  name: "General Visual Inspection Report (ROV)",        icon: FileBarChart, description: "Portrait General Visual Inspection report — marine growth, condition, CP, debris and anomaly findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rcasn-report", name: "Caisson Survey Report (ROV)",    icon: FileBarChart, description: "Portrait Caisson Survey report — grouped by Caisson with CP, condition, and findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rcond-report", name: "Conductor Survey Report (ROV)",  icon: FileBarChart, description: "Portrait Conductor Survey report — grouped by Conductor (CD) with CP, condition, and findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rcasn-sketch-report", name: "Caisson Survey (Sketch) Report (ROV)", icon: FileBarChart, description: "Detailed ROV Caisson inspection with graphical elevation profiles and terminator sketch", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rcond-sketch-report", name: "Conductor Survey (Sketch) Report (ROV)", icon: FileBarChart, description: "Detailed ROV Conductor inspection with graphical elevation profiles", requires: ["jobpack", "structure", "sow_report"] },
        { id: "pipeline-event-sketch-report", name: "Pipeline Event List Sketch Report", icon: Compass, description: "Landscape Pipeline Navigation event list sketch report with graphical KP pipeline elevation profile, span/burial profiles, geodetic header, and matched event table", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-navig-report", name: "Pipeline Visual Inspection Report", icon: FileBarChart, description: "Landscape Pipeline Visual Inspection Report for inspection type NAVIG — Item No., Date, Time, Easting, Northing, KP, Depth, CP Reading, Event Name, Finding & Anomaly Priority", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-bl-report", name: "Boatlanding Survey Report (ROV)", icon: FileBarChart, description: "Portrait Boatlanding Survey report — grouped by Boatlanding (BL) with associated components clubbed", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rg-report", name: "Riser Guard Survey Report (ROV)", icon: FileBarChart, description: "Portrait Riser Guard Survey report — grouped by Riser Guard (RG) with associated components clubbed", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-sg-report", name: "Caisson Guard Survey Report (ROV)", icon: FileBarChart, description: "Portrait Caisson Guard Survey report — grouped by Caisson Guard (SG) with associated components clubbed", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-cu-report", name: "Conductor Guard Survey Report (ROV)", icon: FileBarChart, description: "Portrait Conductor Guard Survey report — grouped by Conductor Guard (CU) with associated components clubbed", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-photo-report", name: "Photography Report (ROV)", icon: Eye, description: "Portrait report displaying all photos attached to inspections in a 2x3 grid with descriptions", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-photo-log-report", name: "Photography Log Report (ROV)", icon: Eye, description: "Portrait report displaying a tabular log of all photos attached to inspections", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-gvins-report", name: "General Visual Inspection Report (Diving)", icon: FileBarChart, description: "Portrait Diving General Visual Inspection report — marine growth, condition, debris and anomaly findings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-bsins-report", name: "Bolted Support Inspection (Diving)", icon: FileBarChart, description: "Detailed bolted support inspection (BSINS) report with Member, Brace, and Appurtenance specifics.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-cvins-report", name: "Close Visual Inspection (Diving)", icon: FileBarChart, description: "Close visual inspection (CVINS) report with detailed findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-clean-report", name: "Cleaning Inspection (Diving)", icon: FileBarChart, description: "Cleaning inspection (CLEAN) report with surface condition and methods.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-mpins-report", name: "Magnetic Particle Inspection (Diving)", icon: FileBarChart, description: "Detailed magnetic particle inspection (MPINS) report with clock readings and segmentation.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-utwtk-report", name: "UT Wall Thickness Inspection (Diving)", icon: FileBarChart, description: "UT Wall Thickness Inspection (UTWTK) report with clock readings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-szone-report", name: "Splash Zone Inspection (Diving)", icon: FileBarChart, description: "Splash zone wall thickness and CP inspection summary with grouped clock positions", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-cpsurv-report", name: "CP Survey Report (Diving)", icon: FileBarChart, description: "Landscape CP survey report (Diving) with pre/post dive calibration and CP potential readings", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-cpclb-report", name: "CP Calibration Report (Diving)", icon: FileBarChart, description: "CP calibration in water survey data and validation", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-utclb-report", name: "UT Calibration Report (Diving)", icon: FileBarChart, description: "UT calibration survey data and validation", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-mgi-report", name: "Marine Growth Inspection Graph Report (Diving)", icon: FileBarChart, description: "Diving marine growth thickness vs allowable thresholds with graphical elevation profile", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-acfmc-report", name: "ACFM Inspection (Diving)", icon: FileBarChart, description: "Landscape Diving ACFM Survey report — Chord/Weld/Brace, direction of travel, clock position, page, probe number, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-plco-report", name: "Coating Damage Inspection (Diving)", icon: FileBarChart, description: "Landscape Diving Coating Damage Survey report — Surface Condition, CP Reading, Length, Width, Assessment, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-anmain-report", name: "Anode Maintenance Inspection Report (Diving)", icon: FileBarChart, description: "Landscape Anode Maintenance Inspection Report (ANMAIN) with QID, Elevation, Dive No., Anode Type, Installed Date, Replaced/Installed, Position, Life, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "rov-rwdi-report", name: "Water Depth Measurement Survey Report (ROV)", icon: FileBarChart, description: "Portrait ROV Water Depth Measurement Survey report — QID, elevation, dive number, water depth, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-dcasn-uw-report", name: "Caisson Inspection Underwater (Diving)", icon: FileBarChart, description: "Portrait Caisson underwater inspection report (< 0 elevation) combining GVINS, CVINS, CPSURV, UTWTK.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-dcasn-ts-report", name: "Caisson Inspection Above Water (Diving)", icon: FileBarChart, description: "Portrait Caisson topside inspection report (>= 0 elevation) combining GVINS, CVINS, CPSURV, UTWTK.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-dcasn-report", name: "Caisson Inspection (Diving)", icon: FileBarChart, description: "Portrait combined Caisson inspection report (Above & Underwater) combining GVINS, CVINS, CPSURV, UTWTK.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-dcond-uw-report", name: "Conductor Inspection Underwater (Diving)", icon: FileBarChart, description: "Portrait Conductor underwater inspection report (< 0 elevation) combining GVINS, CVINS, CPSURV, UTWTK.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-dcond-ts-report", name: "Conductor Inspection Above Water (Diving)", icon: FileBarChart, description: "Portrait Conductor topside inspection report (>= 0 elevation) combining GVINS, CVINS, CPSURV, UTWTK.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-dcond-report", name: "Conductor Inspection (Diving)", icon: FileBarChart, description: "Portrait combined Conductor inspection report (Above & Underwater) combining GVINS, CVINS, CPSURV, UTWTK.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-fmd-report", name: "Flooded Member Inspection Report (Diving)", icon: FileText, description: "Portrait Flooded Member Inspection report (Diving) — QID, Elevation, Dive No., Flooded, Grouted, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-measu-report", name: "Measurement Dimensional Survey Report (Diving)", icon: FileText, description: "Portrait Measurement Dimensional Survey report (Diving) — QID, Elevation, Dive No., Type, Unit, Result, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-rrisi-report", name: "Riser Inspection Report with Sketch (Diving)", icon: FileText, description: "Portrait Riser Survey report (Diving) with Sketch — QID, Elevation, Dive No., CP, UT, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-rrisi-detail-report", name: "Riser Inspection Summary Report without Sketch (Diving)", icon: FileText, description: "Portrait Riser Survey summary report (Diving) without Sketch — QID, Elevation, Dive No., CP, UT, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-jtisi-report", name: "J-Tube Inspection Report with Sketch (Diving)", icon: FileText, description: "Portrait J-Tube Survey report (Diving) with Sketch — QID, Elevation, Dive No., CP, UT, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-jtisi-detail-report", name: "J-Tube Inspection Summary Report without Sketch (Diving)", icon: FileText, description: "Portrait J-Tube Survey summary report (Diving) without Sketch — QID, Elevation, Dive No., CP, UT, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-itisi-report", name: "I-Tube Inspection Report with Sketch (Diving)", icon: FileText, description: "Portrait I-Tube Survey report (Diving) with Sketch — QID, Elevation, Dive No., CP, UT, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-itisi-detail-report", name: "I-Tube Inspection Summary Report without Sketch (Diving)", icon: FileText, description: "Portrait I-Tube Survey summary report (Diving) without Sketch — QID, Elevation, Dive No., CP, UT, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-item-report", name: "Item Inspection Report (Diving)", icon: FileBarChart, description: "Portrait Item Inspection report (Diving) — QID, Elevation, Dive No., CP, Item Type, Description, and findings.", requires: ["jobpack", "structure", "sow_report"] },
        { id: "diving-itmain-report", name: "Item Maintenance Inspection Report (Diving)", icon: FileBarChart, description: "Portrait Item Maintenance report (Diving) — QID, Elevation, Dive No., Angle, Dim 1, Dim 2, Dim 3, and findings.", requires: ["jobpack", "structure", "sow_report"] },
    ],

    final_report: [
        { id: "final-inspection-datasheet", name: "Final Inspection Datasheet", icon: FileCheck, description: "Generate comprehensive technical inspection datasheet compilation packages", requires: ["jobpack", "structure", "sow_report"] },
    ],
    others: [
        { id: "defect-criteria-report", name: "Defect Criteria Report", icon: FileCheck, description: "Complete specification of all defect criteria rules by procedure", requires: ["procedure"] },
    ],
};

export const TOC_SECTIONS = [
  { id: 1, name: "Structure Configuration", templates: [
      { id: "structure-summary", name: "Structure Summary Report", mode: "General" },
      { id: "defect-criteria-report", name: "Defect Criteria Report", mode: "General" }
  ]},
  { id: 2, name: "General Visual Inspection", templates: [
      { id: "rov-rgvi-report", name: "General Visual Inspection Report (ROV)", mode: "ROV" },
      { id: "diving-gvins-report", name: "General Visual Inspection Report (Diving)", mode: "Diving" }
  ]},
  { id: 3, name: "Cathodic Protection Potential Survey", templates: [
      { id: "rov-cp-report", name: "CP Survey Report (ROV)", mode: "ROV" },
      { id: "diving-cpsurv-report", name: "CP Survey Report (Diving)", mode: "Diving" },
      { id: "diving-cpclb-report", name: "CP Calibration Report (Diving)", mode: "Diving" }
  ]},
  { id: 4, name: "Flooded Member Detection Survey", templates: [
      { id: "fmd-report", name: "FMD Survey Report (ROV)", mode: "ROV" },
      { id: "diving-fmd-report", name: "FMD Survey Report (Diving)", mode: "Diving" }
  ]},
  { id: 5, name: "Attachment Inspection", templates: [
      { id: "rov-rcond-report", name: "Conductor Survey Report (ROV)", mode: "ROV" },
      { id: "rov-rcasn-report", name: "Caisson Survey Report (ROV)", mode: "ROV" },
      { id: "rov-bl-report", name: "Boatlanding Survey Report (ROV)", mode: "ROV" },
      { id: "rov-rg-report", name: "Riser Guard Survey Report (ROV)", mode: "ROV" },
      { id: "rov-sg-report", name: "Caisson Guard Survey Report (ROV)", mode: "ROV" },
      { id: "rov-cu-report", name: "Conductor Guard Survey Report (ROV)", mode: "ROV" },
      { id: "rov-rcond-sketch-report", name: "Conductor Survey (Sketch) Report (ROV)", mode: "ROV" },
      { id: "rov-rcasn-sketch-report", name: "Caisson Survey (Sketch) Report (ROV)", mode: "ROV" },
      { id: "diving-dcasn-uw-report", name: "Caisson Inspection Underwater (Diving)", mode: "Diving" },
      { id: "diving-dcasn-ts-report", name: "Caisson Inspection Above Water (Diving)", mode: "Diving" },
      { id: "diving-dcond-uw-report", name: "Conductor Inspection Underwater (Diving)", mode: "Diving" },
      { id: "diving-dcond-ts-report", name: "Conductor Inspection Above Water (Diving)", mode: "Diving" },
      { id: "diving-item-report", name: "Item Inspection Report (Diving)", mode: "Diving" },
      { id: "diving-bsins-report", name: "Bolted Support Inspection (Diving)", mode: "Diving" }
  ]},
  { id: 6, name: "Riser Inspection", templates: [
      { id: "rrisi-report", name: "Riser Survey Inspection Sketch Report (ROV)", mode: "ROV" },
      { id: "rrisi-detail-report", name: "Riser Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-jtisi-report", name: "J-Tube Survey Inspection Sketch Report (ROV)", mode: "ROV" },
      { id: "rov-jtisi-detail-report", name: "J-Tube Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-itisi-report", name: "I-Tube Survey Inspection Sketch Report (ROV)", mode: "ROV" },
      { id: "rov-itisi-detail-report", name: "I-Tube Inspection Report (ROV)", mode: "ROV" },
      { id: "diving-rrisi-report", name: "Riser Inspection (Sketch) Report (Diving)", mode: "Diving" },
      { id: "diving-rrisi-detail-report", name: "Riser Inspection Report (Diving)", mode: "Diving" }
  ]},
  { id: 7, name: "Splash Zone Inspection", templates: [
      { id: "szci-report", name: "Splash Zone Inspection Report (ROV)", mode: "ROV" },
      { id: "diving-szone-report", name: "Splash Zone Inspection (Diving)", mode: "Diving" },
      { id: "diving-plco-report", name: "Coating Damage Inspection (Diving)", mode: "Diving" }
  ]},
  { id: 8, name: "Anode Inspection", templates: [
      { id: "rov-anode-report", name: "Anode Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-anode-rsani-report", name: "Selected Anode Report (ROV)", mode: "ROV" },
      { id: "diving-anode-report", name: "Selected Anode Report (Diving)", mode: "Diving" }
  ]},
  { id: 9, name: "Marine Growth Survey", templates: [
      { id: "mgi-report", name: "Marine Growth Graph Report (ROV)", mode: "ROV" },
      { id: "rov-rmgi-report", name: "Marine Growth Inspection Report (ROV)", mode: "ROV" },
      { id: "diving-mgi-report", name: "Marine Growth Inspection Graph Report (Diving)", mode: "Diving" }
  ]},
  { id: 10, name: "Base Level Survey", templates: [
      { id: "rov-rscor-survey-report", name: "Scour Survey Report (ROV)", mode: "ROV" },
      { id: "rov-scour-report", name: "Scour Survey Sketch Report (ROV)", mode: "ROV" },
      { id: "rov-rwdi-report", name: "Water Depth Measurement Survey Report (ROV)", mode: "ROV" },
      { id: "rov-ricmi-report", name: "Inclinometer Reading Inspection Report (ROV)", mode: "ROV" }
  ]},
  { id: 11, name: "Seabed Survey", templates: [
      { id: "seabed-survey-debris", name: "Seabed Survey Debris Sketch Report (ROV)", mode: "General" },
      { id: "seabed-survey-gas", name: "Seabed Survey Gas Seepage Sketch Report (ROV)", mode: "General" },
      { id: "seabed-survey-crater", name: "Seabed Survey Crater Sketch Report (ROV)", mode: "General" },
      { id: "rov-seabed-report", name: "Seabed Survey Inspection Sketch Report (ROV)", mode: "ROV" },
      { id: "rov-rseab-detail-report", name: "Seabed Survey Debris Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-rseab-gas-detail-report", name: "Seabed Survey Gas Seepage Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-rseab-crater-detail-report", name: "Seabed Survey Crater Inspection Report (ROV)", mode: "ROV" }
  ]},
  { id: 12, name: "Specified Node Inspection", templates: [
      { id: "rov-selected-node-report", name: "Selected Node Report (ROV)", mode: "ROV" },
      { id: "diving-cvins-report", name: "Close Visual Inspection (Diving)", mode: "Diving" },
      { id: "diving-mpins-report", name: "Magnetic Particle Inspection (Diving)", mode: "Diving" },
      { id: "diving-acfmc-report", name: "ACFM Inspection (Diving)", mode: "Diving" }
  ] },
  { id: 13, name: "Additional Wall Thickness Inspection", templates: [
      { id: "utwt-report", name: "UT Thickness Report (ROV)", mode: "ROV" },
      { id: "diving-utwtk-report", name: "UT Wall Thickness Inspection (Diving)", mode: "Diving" },
      { id: "diving-utclb-report", name: "UT Calibration Report (Diving)", mode: "Diving" }
  ]},
  { id: 14, name: "Maintenance", templates: [
      { id: "diving-itmain-report", name: "Item Maintenance Inspection Report (Diving)", mode: "Diving" },
      { id: "diving-anmain-report", name: "Anode Maintenance Inspection Report (Diving)", mode: "Diving" }
  ]},
  { id: 15, name: "Cleaning Inspection", templates: [
      { id: "diving-clean-report", name: "Cleaning Inspection (Diving)", mode: "Diving" }
  ]},
  { id: 16, name: "Photography", templates: [
      { id: "rov-photo-report", name: "Photography Report (ROV)", mode: "ROV" },
      { id: "rov-photo-log-report", name: "Photography Log Report (ROV)", mode: "ROV" }
  ]},
  { id: 17, name: "Video", templates: [
      { id: "video-log-report", name: "Video Log Report (ROV)", mode: "General" },
      { id: "diver-log-report", name: "Diver Log Report", mode: "Diving" }
  ]},
  { id: 18, name: "Anomaly", templates: [
      { id: "defect-summary", name: "Defect Summary Report", mode: "General" },
      { id: "findings-summary", name: "Findings Summary Report", mode: "General" },
      { id: "defect-anomaly-report", name: "Defect / Anomaly Report", mode: "General" },
      { id: "findings-report", name: "Findings Report", mode: "General" }
  ]}
];
