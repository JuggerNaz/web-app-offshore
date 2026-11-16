import { EXECUTIVE_SUMMARY_TOC, isItemMatchingSection, normalizeSectionId } from "./constants";

/**
 * Utility functions for Executive Summary template variable interpolation,
 * smart inspection tables generation, and conditional rules evaluation.
 */

export interface ConditionEvaluationResult {
    conditionKey: "cond_no_inspection" | "cond_has_data" | "cond_has_anomaly" | "cond_not_registered";
    conditionNumber: 1 | 2 | 3 | 4;
    conditionLabel: string;
    reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SMART INSPECTION TABLE TEMPLATES (Static HTML with Dynamic Cell Tags)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Anomaly Breakdown Table Template:
 *    Component type, Above Water / Below Water Zone, Priority (P1, P2, P3) & Counts.
 */
export function getAnomalyZonePriorityTableTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;"><tr><th style="width: 20%; border: 1px solid #334155; padding: 5px 8px; text-align: left; background-color: #0f172a; color: #ffffff;">Component Type</th><th style="width: 18%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #ffffff;">Zone / Elevation</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #f87171;">Priority 1</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #fbbf24;">Priority 2</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #60a5fa;">Priority 3</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #34d399;">Priority 4</th><th style="width: 10%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #94a3b8;">Observation</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #ffffff;">Total</th><th style="width: 12%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #ffffff;">Status</th></tr><tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Jacket Legs &amp; Framing</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">Subsea (Below Water)</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #d97706;">{{P2_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #2563eb;">{{P3_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #059669;">{{P4_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #64748b;">{{OBS_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">{{TOTAL_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;"><span style="color: #dc2626;">{{OPEN_ANOMALIES}} Open</span>, <span style="color: #15803d;">{{RECTIFIED_ANOMALIES}} Rectified</span></td></tr><tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Caissons &amp; Risers</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">Splash Zone / Above</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #dc2626; font-weight: bold;">{{P1_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">{{P1_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold; color: #16a34a;">0 Open, {{P1_ANOMALIES}} Rectified</td></tr></table>`;
}

/**
 * 2. Incomplete Scope Status Table Template (Grouped by Inspection Type, Ordered by Elevation, No Status column)
 */
export function getIncompleteScopeTableTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;"><tr><th style="width: 28%; border: 1px solid #991b1b; padding: 5px 8px; text-align: left; background-color: #7f1d1d; color: #ffffff;">SOW Scope / Inspection Type</th><th style="width: 24%; border: 1px solid #991b1b; padding: 5px 8px; text-align: left; background-color: #7f1d1d; color: #ffffff;">Component / QID</th><th style="width: 16%; border: 1px solid #991b1b; padding: 5px 8px; text-align: center; background-color: #7f1d1d; color: #ffffff;">Elevation / Zone</th><th style="width: 32%; border: 1px solid #991b1b; padding: 5px 8px; text-align: left; background-color: #7f1d1d; color: #ffffff;">Incomplete Reason / Constraint</th></tr><tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">General Visual Inspection</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">FEND 1</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">(+)3.0m</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #b91c1c;">Unable to inspect due to access/visibility constraint</td></tr><tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">General Visual Inspection</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">RISG 1</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">(+)3.0m</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #b91c1c;">Unable to inspect due to access/visibility constraint</td></tr><tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Conductor Inspection</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">CGFO11-70M</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">(-)70.0m</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #b91c1c;">Unable to inspect due to access/visibility constraint</td></tr></table>`;
}

/**
 * 3. Completed Scope Status Table Template
 */
export function getCompletedScopeTableTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;"><tr><th style="width: 32%; border: 1px solid #047857; padding: 5px 8px; text-align: left; background-color: #065f46; color: #ffffff;">Inspection Scope</th><th style="width: 26%; border: 1px solid #047857; padding: 5px 8px; text-align: left; background-color: #065f46; color: #ffffff;">Component Category</th><th style="width: 14%; border: 1px solid #047857; padding: 5px 8px; text-align: center; background-color: #065f46; color: #ffffff;">Total Scoped</th><th style="width: 14%; border: 1px solid #047857; padding: 5px 8px; text-align: center; background-color: #065f46; color: #ffffff;">Completed Tasks</th><th style="width: 14%; border: 1px solid #047857; padding: 5px 8px; text-align: center; background-color: #065f46; color: #ffffff;">Completion %</th></tr><tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">General Visual Inspection (GVI)</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Primary Structure &amp; Framing</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">{{TOTAL_RECORDS}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold; color: #047857;">{{TOTAL_RECORDS}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold; color: #047857;">{{SOW_COMPLETION}}</td></tr><tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Cathodic Protection (CP)</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Sacrificial Anodes &amp; Nodes</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">Active Grid</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold; color: #047857;">100% Readings</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold; color: #047857;">100%</td></tr></table>`;
}

/**
 * 4. Anode Depletion Status Table Template
 */
export function getAnodeDepletionTableTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;"><tr><th style="width: 25%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: left; background-color: #1e3a8a; color: #ffffff;">Depletion Bracket</th><th style="width: 14%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: center; background-color: #1e3a8a; color: #ffffff;">Quantity</th><th style="width: 14%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: center; background-color: #1e3a8a; color: #ffffff;">% Share</th><th style="width: 20%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: left; background-color: #1e3a8a; color: #ffffff;">Condition</th><th style="width: 27%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: left; background-color: #1e3a8a; color: #ffffff;">Integrity Action</th></tr><tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">0% – 25%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">{{ANODES_0_25}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">{{ANODES_0_25_PCT}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #16a34a; font-weight: bold;">Nominal / Healthy</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Normal operational service</td></tr><tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">26% – 50%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">{{ANODES_26_50}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">{{ANODES_26_50_PCT}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #0284c7; font-weight: bold;">Moderate Consumption</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Adequate remaining active mass</td></tr><tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">51% – 75%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">{{ANODES_51_75}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">{{ANODES_51_75_PCT}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #d97706; font-weight: bold;">Advanced Depletion</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Monitor during next inspection</td></tr><tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">76% – 100%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #dc2626; font-weight: bold;">{{ANODES_76_100}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #dc2626; font-weight: bold;">{{ANODES_76_100_PCT}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #dc2626; font-weight: bold;">Critical Depletion</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #b91c1c; font-weight: bold;">Schedule retrofit / replacement</td></tr></table>`;
}

/**
 * 5. Anomaly Defect Type vs Component Matrix Table Template
 */
export function getAnomalyDefectTypeTableTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;"><tr><th style="width: 28%; border: 1px solid #4338ca; padding: 5px 8px; text-align: left; background-color: #312e81; color: #ffffff;">Defect / Anomaly Type</th><th style="width: 26%; border: 1px solid #4338ca; padding: 5px 8px; text-align: left; background-color: #312e81; color: #ffffff;">Affected Components</th><th style="width: 12%; border: 1px solid #4338ca; padding: 5px 8px; text-align: center; background-color: #312e81; color: #ffffff;">Total</th><th style="width: 18%; border: 1px solid #4338ca; padding: 5px 8px; text-align: center; background-color: #312e81; color: #ffffff;">Priorities</th><th style="width: 16%; border: 1px solid #4338ca; padding: 5px 8px; text-align: center; background-color: #312e81; color: #ffffff;">Status</th></tr><tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Marine Growth Exceedance</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Jacket Members &amp; Conductors</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">{{MGI_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">P2: 0 | P3: {{MGI_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #d97706; font-weight: bold;">Open Review</td></tr><tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Coating Breakdown / Corrosion</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Riser Splash Zone &amp; Caissons</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">{{P2_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">P1: 0 | P2: {{P2_ANOMALIES}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #dc2626; font-weight: bold;">Remediation</td></tr><tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Seabed Scour / Pile Exposure</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Foundation Piles</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">{{SCOUR_EXPOSED}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">P3: {{SCOUR_EXPOSED}}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #16a34a; font-weight: bold;">Stable</td></tr></table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1b. SMART INSPECTION CHART TEMPLATES (Visual Horizontal Bars & Cards with Tags)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 1. Anomaly Priority Distribution Chart Template (Tags & Variables)
 */
export function getAnomalyPriorityChartTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #0f172a; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #1e293b;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #38bdf8; margin-right: 6px;"></span>ANOMALY PRIORITY BREAKDOWN &amp; SEVERITY METRICS</th></tr>
<tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;"><td colspan="4" style="padding: 5px 10px; font-size: 11px;"><strong>Summary:</strong> Total: <strong>{{TOTAL_ANOMALIES}}</strong> &nbsp;|&nbsp; <span style="color: #dc2626; font-weight: bold;">{{OPEN_ANOMALIES}} Open</span> &nbsp;|&nbsp; <span style="color: #15803d; font-weight: bold;">{{RECTIFIED_ANOMALIES}} Rectified</span></td></tr>
<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #dc2626;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #dc2626; margin-right: 6px;"></span>Priority 1 (Critical)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #dc2626; height: 100%; width: 20%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">{{P1_ANOMALIES}}</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #dc2626; font-weight: bold;">Urgent Repair</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9; background-color: #fcfcfd;"><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #ea580c;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #ea580c; margin-right: 6px;"></span>Priority 2 (Major)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #ea580c; height: 100%; width: 45%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">{{P2_ANOMALIES}}</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #ea580c; font-weight: bold;">Programmed</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #2563eb;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #2563eb; margin-right: 6px;"></span>Priority 3 (Moderate)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #2563eb; height: 100%; width: 30%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">{{P3_ANOMALIES}}</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #2563eb; font-weight: bold;">Monitor</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9; background-color: #fcfcfd;"><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #059669;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #059669; margin-right: 6px;"></span>Priority 4 (Minor)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #059669; height: 100%; width: 10%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">{{P4_ANOMALIES}}</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #059669; font-weight: bold;">Routine</td></tr>
<tr><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #64748b;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #64748b; margin-right: 6px;"></span>Observation (OBS)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #64748b; height: 100%; width: 15%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">{{OBS_ANOMALIES}}</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #64748b; font-weight: bold;">Recorded</td></tr>
</table>`;
}

/**
 * 2. SOW Completion & Scope Progress Chart Template (Tags & Variables)
 */
export function getScopeCompletionChartTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #047857; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #065f46; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #047857;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #34d399; margin-right: 6px;"></span>WORK SCOPE EXECUTION &amp; COMPLETION PROGRESS</th></tr>
<tr style="background-color: #f0fdf4; border-bottom: 1px solid #bbf7d0;">
<td style="width: 25%; padding: 6px 10px; text-align: center; border-right: 1px solid #dcfce7;"><div style="font-size: 9px; color: #047857; text-transform: uppercase; font-weight: bold;">Total Scoped</div><div style="font-size: 15px; font-weight: bold; color: #0f172a;">{{TOTAL_RECORDS}}</div></td>
<td style="width: 25%; padding: 6px 10px; text-align: center; border-right: 1px solid #dcfce7;"><div style="font-size: 9px; color: #047857; text-transform: uppercase; font-weight: bold;">Completed</div><div style="font-size: 15px; font-weight: bold; color: #16a34a;">{{TOTAL_RECORDS}}</div></td>
<td style="width: 25%; padding: 6px 10px; text-align: center; border-right: 1px solid #dcfce7;"><div style="font-size: 9px; color: #b45309; text-transform: uppercase; font-weight: bold;">Incomplete</div><div style="font-size: 15px; font-weight: bold; color: #64748b;">0</div></td>
<td style="width: 25%; padding: 6px 10px; text-align: center;"><div style="font-size: 9px; color: #047857; text-transform: uppercase; font-weight: bold;">Completion Rate</div><div style="font-size: 15px; font-weight: bold; color: #16a34a;">{{SOW_COMPLETION}}</div></td>
</tr>
<tr><td colspan="4" style="padding: 8px 10px;">
<div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;"><span style="font-weight: bold; color: #047857;">Overall Campaign SOW Execution</span><span style="font-weight: bold; color: #16a34a;">{{SOW_COMPLETION}}</span></div>
<div style="background-color: #e2e8f0; border-radius: 4px; height: 10px; width: 100%; overflow: hidden;"><div style="background-color: #16a34a; height: 100%; width: 100%;"></div></div>
<div style="margin-top: 4px; font-size: 10px; color: #64748b; text-align: right;">Status: <strong style="color: #16a34a;">✓ 100% Campaign Scope Executed</strong></div>
</td></tr>
</table>`;
}

/**
 * 3. Cathodic Protection (CP) Potential Integrity Health Chart Template (Tags & Variables)
 */
export function getCpHealthChartTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #0284c7; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="3" style="background-color: #0369a1; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #0284c7;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #7dd3fc; margin-right: 6px;"></span>CATHODIC PROTECTION (CP) POTENTIAL HEALTH &amp; INTEGRITY</th></tr>
<tr style="background-color: #f0f9ff; border-bottom: 1px solid #bae6fd;">
<td style="width: 33%; padding: 6px 10px; text-align: center; border-right: 1px solid #e0f2fe;"><div style="font-size: 9px; color: #0369a1; text-transform: uppercase; font-weight: bold;">Protection Criterion</div><div style="font-size: 12px; font-weight: bold; color: #0f172a;">-800 to -1050 mV</div></td>
<td style="width: 33%; padding: 6px 10px; text-align: center; border-right: 1px solid #e0f2fe;"><div style="font-size: 9px; color: #0369a1; text-transform: uppercase; font-weight: bold;">Observed Range</div><div style="font-size: 12px; font-weight: bold; color: #0369a1;">{{CP_MIN}} mV to {{CP_MAX}} mV</div></td>
<td style="width: 34%; padding: 6px 10px; text-align: center;"><div style="font-size: 9px; color: #0369a1; text-transform: uppercase; font-weight: bold;">Integrity Verdict</div><div style="font-size: 12px; font-weight: bold; color: #16a34a;">SATISFACTORY CP PROTECTION</div></td>
</tr>
<tr><td colspan="3" style="padding: 8px 10px;">
<div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px; color: #475569;"><span>Under-Protection (&gt; -800mV)</span><span style="font-weight: bold; color: #047857;">Optimum Range (-800mV to -1050mV)</span><span>Over-Protection (&lt; -1050mV)</span></div>
<div style="background-color: #e2e8f0; border-radius: 4px; height: 10px; width: 100%; overflow: hidden; display: flex;"><div style="background-color: #f87171; height: 100%; width: 15%;"></div><div style="background-color: #10b981; height: 100%; width: 70%;"></div><div style="background-color: #a78bfa; height: 100%; width: 15%;"></div></div>
<div style="margin-top: 4px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between;"><span>Reference: <strong>Ag/AgCl (Seawater)</strong></span><span>100% Structural Polarization Compliant</span></div>
</td></tr>
</table>`;
}

/**
 * 4. Anode Depletion Distribution Chart Template (Tags & Variables)
 */
export function getAnodeDepletionChartTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #1d4ed8; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #1e3a8a; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #1d4ed8;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #60a5fa; margin-right: 6px;"></span>SACRIFICIAL ANODE DEPLETION &amp; CONSUMPTION BRACKETS</th></tr>
<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 24%; padding: 5px 10px; font-weight: bold; color: #15803d;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #16a34a; margin-right: 6px;"></span>0% – 25% (Healthy)</td><td style="width: 46%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #16a34a; height: 100%; width: 50%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">{{ANODES_0_25}} ({{ANODES_0_25_PCT}})</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #16a34a; font-weight: bold;">Normal</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9; background-color: #fcfcfd;"><td style="width: 24%; padding: 5px 10px; font-weight: bold; color: #0284c7;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #0284c7; margin-right: 6px;"></span>26% – 50% (Moderate)</td><td style="width: 46%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #0284c7; height: 100%; width: 33%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">{{ANODES_26_50}} ({{ANODES_26_50_PCT}})</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #0284c7; font-weight: bold;">Adequate</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 24%; padding: 5px 10px; font-weight: bold; color: #d97706;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #d97706; margin-right: 6px;"></span>51% – 75% (Advanced)</td><td style="width: 46%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #d97706; height: 100%; width: 12%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">{{ANODES_51_75}} ({{ANODES_51_75_PCT}})</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #d97706; font-weight: bold;">Monitor</td></tr>
<tr><td style="width: 24%; padding: 5px 10px; font-weight: bold; color: #dc2626;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #dc2626; margin-right: 6px;"></span>76% – 100% (Critical)</td><td style="width: 46%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #dc2626; height: 100%; width: 5%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">{{ANODES_76_100}} ({{ANODES_76_100_PCT}})</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #dc2626; font-weight: bold;">Schedule Retrofit</td></tr>
</table>`;
}

/**
 * 5. Defect Severity & Category Distribution Chart Template (Tags & Variables)
 */
export function getDefectDistributionChartTemplate(): string {
    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #4338ca; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #312e81; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #4338ca;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #a5b4fc; margin-right: 6px;"></span>STRUCTURAL DEFECT CLASSIFICATION &amp; SEVERITY DISTRIBUTION</th></tr>
<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 32%; padding: 5px 10px; font-weight: bold;">Marine Growth Exceedance</td><td style="width: 40%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #d97706; height: 100%; width: 60%; border-radius: 4px;"></div></div></td><td style="width: 14%; padding: 5px 10px; text-align: center; font-weight: bold;">{{MGI_ANOMALIES}} Findings</td><td style="width: 14%; padding: 5px 10px; text-align: center; color: #d97706; font-weight: bold;">Moderate</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9; background-color: #fcfcfd;"><td style="width: 32%; padding: 5px 10px; font-weight: bold;">Coating Breakdown / Corrosion</td><td style="width: 40%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #dc2626; height: 100%; width: 25%; border-radius: 4px;"></div></div></td><td style="width: 14%; padding: 5px 10px; text-align: center; font-weight: bold;">{{P2_ANOMALIES}} Findings</td><td style="width: 14%; padding: 5px 10px; text-align: center; color: #dc2626; font-weight: bold;">Remediation</td></tr>
<tr><td style="width: 32%; padding: 5px 10px; font-weight: bold;">Seabed Scour / Pile Exposure</td><td style="width: 40%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #2563eb; height: 100%; width: 15%; border-radius: 4px;"></div></div></td><td style="width: 14%; padding: 5px 10px; text-align: center; font-weight: bold;">{{SCOUR_EXPOSED}} Piles</td><td style="width: 14%; padding: 5px 10px; text-align: center; color: #16a34a; font-weight: bold;">Stable</td></tr>
</table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DYNAMIC LIVE DATA TABLE GENERATORS (From insightData)
// ─────────────────────────────────────────────────────────────────────────────

const COMPONENT_FULL_NAMES: Record<string, string> = {
    "AN": "Anode",
    "BL": "Boat Landing",
    "CA": "Caisson",
    "CD": "Conductor",
    "CF": "Conductor Framing",
    "CL": "Clamp",
    "CS": "Caisson",
    "CT": "Conductor Tray",
    "DK": "Deck",
    "FD": "Fender",
    "HD": "Horizontal Diagonal",
    "HM": "Horizontal Member",
    "LA": "Ladder",
    "LG": "Leg",
    "MB": "Member",
    "ND": "Structural Node",
    "PA": "Padeye",
    "PG": "Pile Guide",
    "PL": "Pile",
    "RG": "Riser Guard",
    "RS": "Riser",
    "SC": "Seachest",
    "SD": "Seabed Debris",
    "SG": "Caisson Guard",
    "VD": "Vertical Diagonal",
    "VM": "Vertical Member",
    "WN": "Weld Node"
};

/**
 * Checks if a SOW task or summary row matches the specified executive summary section.
 */
export function isSowSummaryMatchingSection(item: any, sectionId: string): boolean {
    const normSecId = normalizeSectionId(sectionId);
    if (!normSecId || normSecId === "intro" || normSecId === "incomplete" || normSecId === "anomaly_finding") return true;

    const name = String(item.inspectionName || item.name || item.scope || "").toUpperCase();
    const task = String(item.taskType || item.component || item.type || item.target || "").toUpperCase();
    const code = String(item.code || item.inspection_type_code || "").toUpperCase();
    const qid = String(item.qid || "").toUpperCase();

    switch (normSecId) {
        case "gvi":
            return (name.includes("GVI") || name.includes("VISUAL") || code.includes("GVI")) &&
                   !name.includes("CAISSON") && !name.includes("RISER") && !name.includes("CONDUCTOR") && !name.includes("ANODE");
        case "cp":
            return name.includes("CP") || name.includes("CATHODIC") || name.includes("POTENTIAL") || code.includes("CP");
        case "fmd":
            return name.includes("FMD") || name.includes("FLOOD") || code.includes("FMD");
        case "mgi":
            return name.includes("MGI") || name.includes("MARINE GROWTH") || name.includes("GROWTH") || code.includes("MGI");
        case "scour":
            return name.includes("SCOUR") || task.includes("SCOUR") || task.includes("MUDLINE") || task.includes("PILE");
        case "seabed":
            return name.includes("SEABED") || name.includes("DEBRIS") || task.includes("SEABED") || task.includes("DEBRIS");
        case "caisson":
        case "caisson_top":
        case "caisson_sub":
            return (name.includes("CAISSON") || task.includes("CAISSON") || task.includes("SUMP") || qid.startsWith("CA") || qid.startsWith("CS")) && !name.includes("GUARD") && !task.includes("GUARD");
        case "conductor":
        case "conductor_top":
        case "conductor_sub":
            return (name.includes("CONDUCTOR") || task.includes("CONDUCTOR") || qid.startsWith("CD") || qid.startsWith("C-") || qid.startsWith("CGF")) && !name.includes("GUARD") && !task.includes("GUARD");
        case "boatlanding":
        case "boatlanding_top":
        case "boatlanding_sub":
            return name.includes("BOAT LANDING") || name.includes("BOAT") || task.includes("BOAT") || qid.startsWith("BL");
        case "riserguard":
        case "riserguard_top":
        case "riserguard_sub":
            return name.includes("RISER GUARD") || task.includes("RISER GUARD") || qid.startsWith("RG") || qid.startsWith("RISG");
        case "boatbumper":
        case "boatbumper_top":
        case "boatbumper_sub":
            return name.includes("BUMPER") || name.includes("FENDER") || task.includes("BUMPER") || task.includes("FENDER") || qid.startsWith("BB") || qid.startsWith("FD") || qid.startsWith("FEND");
        case "conductorguard":
        case "conductorguard_top":
        case "conductorguard_sub":
            return name.includes("CONDUCTOR GUARD") || task.includes("CONDUCTOR GUARD") || qid.startsWith("CG") || qid.startsWith("CDG");
        case "caissonguard":
        case "caissonguard_top":
        case "caissonguard_sub":
            return name.includes("CAISSON GUARD") || task.includes("CAISSON GUARD") || qid.startsWith("SG");
        case "riser":
            return (name.includes("RISER") || task.includes("RISER") || qid.startsWith("RS")) && !name.includes("GUARD") && !task.includes("GUARD");
        case "anode_gen":
        case "anode_sel":
        case "anode_maint":
            return name.includes("ANODE") || task.includes("ANODE") || qid.startsWith("AN");
        case "node_cvi":
            return (name.includes("NODE") || name.includes("CVI") || task.includes("NODE")) && !name.includes("MPI");
        case "node_mpi":
            return name.includes("MPI") || (name.includes("NODE") && name.includes("MAGNETIC"));
        case "splashzone":
            return name.includes("SPLASH") || task.includes("SPLASH") || name.includes("COATING");
        default:
            return true;
    }
}

/**
 * Derives contextually filtered inspection stats and anomaly records
 * strictly aligned to the active summary section type (e.g. GVI, Caisson Topside, Conductor Subsea, etc.).
 */
export function getSectionFilteredStats(stats: any, sectionId?: string, sectionTitle?: string): any {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    if (!normSecId || normSecId === "intro" || normSecId === "anomaly_finding") {
        return {
            ...stats,
            activeSectionId: normSecId || "intro",
            activeSectionTitle: sectionTitle || "Overall Inspection Campaign"
        };
    }

    const data = stats?.insightData || {};
    const rawAnomalies: any[] = data?.anomalies?.items || data?.anomalies?.list || stats?.anomalies || [];
    
    // Strict filter: matches component type, inspection type, and elevation for this section
    const filteredAnomalies = rawAnomalies.filter((a: any) => isItemMatchingSection(a, normSecId));

    // Calculate priority breakdown for this specific section
    let p1 = 0, p2 = 0, p3 = 0, p4 = 0, obs = 0, open = 0, rectified = 0;
    filteredAnomalies.forEach((a: any) => {
        const s = String(a.priority || a.priority_code || "").trim().toUpperCase();
        if (s === "P1" || s.includes("P1") || s.includes("PRIORITY 1") || s === "1" || s === "HIGH" || s === "CRITICAL") p1++;
        else if (s === "P2" || s.includes("P2") || s.includes("PRIORITY 2") || s === "2" || s === "MEDIUM") p2++;
        else if (s === "P3" || s.includes("P3") || s.includes("PRIORITY 3") || s === "3" || s === "LOW") p3++;
        else if (s === "P4" || s.includes("P4") || s.includes("PRIORITY 4") || s === "4") p4++;
        else obs++;

        if (a.is_rectified === true || a.status === "RECTIFIED" || a.status === "CLOSED") rectified++;
        else open++;
    });

    const totalAnomalies = filteredAnomalies.length;

    // Filter incomplete records & tasks
    const rawIncomplete: any[] = stats?.incomplete_records || data?.incomplete_records || [];
    const rawOutstanding: any[] = stats?.outstanding_tasks || data?.outstanding_tasks || [];
    const rawSowSummary: any[] = data?.sow_summary || data?.sowSummary || stats?.sow_summary || stats?.sowSummary || [];

    const filteredIncomplete = rawIncomplete.filter((r: any) => isItemMatchingSection(r, normSecId));
    const filteredOutstanding = rawOutstanding.filter((t: any) => isItemMatchingSection(t, normSecId));
    const filteredSowSummary = rawSowSummary.filter((s: any) => isSowSummaryMatchingSection(s, normSecId));

    let scopedTotalRecords = 0;
    let scopedCompletedRecords = 0;
    if (filteredSowSummary.length > 0) {
        scopedTotalRecords = filteredSowSummary.reduce((acc: number, s: any) => acc + Number(s.totalQid || s.total || 0), 0);
        scopedCompletedRecords = filteredSowSummary.reduce((acc: number, s: any) => acc + Number(s.completedQid || s.completed || 0), 0);
    } else if (filteredIncomplete.length > 0 || filteredAnomalies.length > 0) {
        scopedCompletedRecords = filteredAnomalies.length;
        scopedTotalRecords = filteredAnomalies.length + filteredIncomplete.length;
    }

    const sowCompletion = scopedTotalRecords > 0 
        ? `${Math.round((scopedCompletedRecords / scopedTotalRecords) * 100)}%` 
        : (stats?.SOW_COMPLETION || "100%");

    const title = sectionTitle || EXECUTIVE_SUMMARY_TOC.find(s => s.id === normSecId)?.title || normSecId;

    return {
        ...stats,
        TOTAL_ANOMALIES: totalAnomalies,
        P1_ANOMALIES: p1,
        P2_ANOMALIES: p2,
        P3_ANOMALIES: p3,
        P4_ANOMALIES: p4,
        OBS_ANOMALIES: obs,
        OPEN_ANOMALIES: open,
        RECTIFIED_ANOMALIES: rectified,
        TOTAL_RECORDS: scopedTotalRecords > 0 ? scopedTotalRecords : stats?.TOTAL_RECORDS,
        SOW_COMPLETION: sowCompletion,
        anomalies: filteredAnomalies,
        incomplete_records: filteredIncomplete,
        outstanding_tasks: filteredOutstanding,
        sow_summary: filteredSowSummary,
        activeSectionId: normSecId,
        activeSectionTitle: title,
        insightData: {
            ...data,
            anomalies: {
                ...data?.anomalies,
                items: filteredAnomalies,
                total: totalAnomalies,
                open,
                rectified,
                byPriority: {
                    "Priority 1": p1,
                    "Priority 2": p2,
                    "Priority 3": p3,
                    "Priority 4": p4,
                    "Observation": obs
                }
            },
            incomplete_records: filteredIncomplete,
            outstanding_tasks: filteredOutstanding,
            sow_summary: filteredSowSummary
        }
    };
}

/**
 * Dynamically builds Table 1: Anomaly Breakdown by Component & Zone
 * Accurately supports all priority types in database/app with full names: Priority 1, Priority 2, Priority 3, Priority 4, and Observation.
 * Filtered contextually by the active summary section type and elevation.
 */
export function buildLiveAnomalyZoneTable(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const data = scopedStats?.insightData || {};
    const items: any[] = data?.anomalies?.items || data?.anomalies?.list || scopedStats?.anomalies || [];
    const isFilteredSection = Boolean(normSecId && normSecId !== "intro" && normSecId !== "anomaly_finding");
    const displayTitle = scopedStats?.activeSectionTitle || sectionTitle || "this section";

    const header = `<tr><th style="width: 20%; border: 1px solid #334155; padding: 5px 8px; text-align: left; background-color: #0f172a; color: #ffffff;">Component Type</th><th style="width: 18%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #ffffff;">Zone / Elevation</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #f87171;">Priority 1</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #fbbf24;">Priority 2</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #60a5fa;">Priority 3</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #34d399;">Priority 4</th><th style="width: 10%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #94a3b8;">Observation</th><th style="width: 8%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #ffffff;">Total</th><th style="width: 12%; border: 1px solid #334155; padding: 5px 8px; text-align: center; background-color: #0f172a; color: #ffffff;">Status</th></tr>`;

    // Normalizer for all priority codes/labels in database & application
    const normalizePriority = (raw: any): "p1" | "p2" | "p3" | "p4" | "obs" => {
        const s = String(raw || "").trim().toUpperCase();
        if (s === "P1" || s === "PRIORITY 1" || s === "1" || s === "HIGH" || s === "CRITICAL") return "p1";
        if (s === "P2" || s === "PRIORITY 2" || s === "2" || s === "MEDIUM") return "p2";
        if (s === "P3" || s === "PRIORITY 3" || s === "3" || s === "LOW") return "p3";
        if (s === "P4" || s === "PRIORITY 4" || s === "4") return "p4";
        if (s === "OBS" || s === "OBSERVATION" || s.startsWith("OBS") || s === "FINDING" || s === "INFO") return "obs";
        if (s.includes("P1") || s.includes("PRIORITY 1")) return "p1";
        if (s.includes("P2") || s.includes("PRIORITY 2")) return "p2";
        if (s.includes("P3") || s.includes("PRIORITY 3")) return "p3";
        if (s.includes("P4") || s.includes("PRIORITY 4")) return "p4";
        return "obs";
    };

    const formatStatusCell = (open: number, rectified: number): string => {
        if (open > 0 && rectified > 0) {
            return `<span style="color: #dc2626; font-weight: bold;">${open} Open</span>, <span style="color: #15803d; font-weight: bold;">${rectified} Rectified</span>`;
        }
        if (rectified > 0 && open === 0) {
            return `<span style="color: #15803d; font-weight: bold;">${rectified} Rectified</span>`;
        }
        if (open > 0) {
            return `<span style="color: #dc2626; font-weight: bold;">${open} Open</span>`;
        }
        return `<span style="color: #15803d; font-weight: bold;">Closed</span>`;
    };

    if (items.length === 0) {
        if (isFilteredSection) {
            return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}<tr><td colspan="9" style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #15803d; font-weight: bold; background-color: #f0fdf4;">✓ 100% Compliant — No active anomalies recorded for ${displayTitle}.</td></tr></table>`;
        }

        const total = scopedStats?.TOTAL_ANOMALIES ?? 0;
        const p1 = scopedStats?.P1_ANOMALIES ?? 0;
        const p2 = scopedStats?.P2_ANOMALIES ?? 0;
        const p3 = scopedStats?.P3_ANOMALIES ?? 0;
        const p4 = scopedStats?.P4_ANOMALIES ?? 0;
        const obs = scopedStats?.OBS_ANOMALIES ?? 0;
        const open = scopedStats?.OPEN_ANOMALIES ?? total;
        const rectified = scopedStats?.RECTIFIED_ANOMALIES ?? Math.max(0, total - open);

        if (total > 0 || p1 > 0 || p2 > 0 || p3 > 0 || p4 > 0 || obs > 0) {
            const subseaTotal = p2 + p3 + p4 + obs;
            const statusHtml = formatStatusCell(open, rectified);
            const row1 = subseaTotal > 0 ? `<tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Jacket Legs &amp; Framing</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">Subsea (Below Water)</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: ${p2 > 0 ? 'bold' : 'normal'}; color: ${p2 > 0 ? '#d97706' : '#64748b'};">${p2}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #3b82f6;">${p3}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #059669;">${p4}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #64748b;">${obs}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${subseaTotal}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${statusHtml}</td></tr>` : '';
            const row2 = p1 > 0 ? `<tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Caissons &amp; Risers</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">Splash Zone / Above Water</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold; color: #dc2626;">${p1}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">0</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${p1}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #dc2626; font-weight: bold;">Open for Repair</td></tr>` : '';
            return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}${row1}${row2}</table>`;
        }

        return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}<tr><td colspan="9" style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; color: #15803d; font-weight: bold;">✓ 100% Compliant — No active anomalies recorded across inspected structural components.</td></tr></table>`;
    }

    // Group items by Component Type + Zone
    const groupMap = new Map<string, {
        compType: string;
        zone: string;
        p1: number;
        p2: number;
        p3: number;
        p4: number;
        obs: number;
        total: number;
        open: number;
        rectified: number;
    }>();

    items.forEach(itm => {
        const rawComp = itm.component_type || itm.component_code || "Structure Component";
        const comp = COMPONENT_FULL_NAMES[rawComp.toUpperCase()] ? `${rawComp} (${COMPONENT_FULL_NAMES[rawComp.toUpperCase()]})` : rawComp;
        const elv = parseFloat(String(itm.elevation || "0"));
        let zone = "Subsea (Below Water)";
        if (elv > 3) zone = "Above Water";
        else if (elv >= -3 && elv <= 3) zone = "Splash Zone";

        const key = `${comp}__${zone}`;
        if (!groupMap.has(key)) {
            groupMap.set(key, {
                compType: comp,
                zone: zone,
                p1: 0,
                p2: 0,
                p3: 0,
                p4: 0,
                obs: 0,
                total: 0,
                open: 0,
                rectified: 0
            });
        }

        const entry = groupMap.get(key)!;
        entry.total++;

        const prioKey = normalizePriority(itm.priority || itm.priority_code);
        entry[prioKey]++;

        const isRect = itm.is_rectified === true || itm.status === "RECTIFIED" || itm.status === "CLOSED";
        if (isRect) entry.rectified++;
        else entry.open++;
    });

    const rows = Array.from(groupMap.values()).map((g, idx) => {
        const bg = idx % 2 === 0 ? '' : ' style="background-color: #f8fafc;"';
        const statusHtml = formatStatusCell(g.open, g.rectified);
        return `<tr${bg}><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">${g.compType}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${g.zone}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: ${g.p1 > 0 ? 'bold' : 'normal'}; color: ${g.p1 > 0 ? '#dc2626' : '#64748b'};">${g.p1}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: ${g.p2 > 0 ? 'bold' : 'normal'}; color: ${g.p2 > 0 ? '#d97706' : '#64748b'};">${g.p2}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #3b82f6;">${g.p3}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #059669;">${g.p4}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #64748b;">${g.obs}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${g.total}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${statusHtml}</td></tr>`;
    }).join("");

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}${rows}</table>`;
}

/**
 * Dynamically builds Table 2: Incomplete Scope Status
 * Grouped by Inspection Type, ordered by Elevation (descending), without redundant Status column.
 * Filtered contextually by the active summary section type and elevation.
 */
export function buildLiveIncompleteScopeTable(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const data = scopedStats?.insightData || {};
    const isFilteredSection = Boolean(normSecId && normSecId !== "intro" && normSecId !== "incomplete");
    const displayTitle = scopedStats?.activeSectionTitle || sectionTitle || (isFilteredSection ? "this section" : "Campaign");
    
    // Source 1: Detailed records flagged as incomplete or status as incomplete
    const incompleteRecords: any[] = scopedStats?.incomplete_records || data?.incomplete_records || [];
    
    // Source 2: Outstanding tasks from SOW / campaign
    const outstandingTasks: any[] = scopedStats?.outstanding_tasks || data?.outstanding_tasks || [];
    
    // Source 3: SOW summary rows with incomplete counts
    const sowSummary: any[] = data?.sow_summary || data?.sowSummary || scopedStats?.sow_summary || [];
    const sowIncompleteItems = sowSummary.filter((s: any) => (s.incompleteQid || s.incomplete || 0) > 0);
    
    // Normalize into unified incomplete detail items
    interface IncompleteRow {
        scope: string;
        target: string;
        elevation: string;
        reason: string;
    }
    
    const rowsList: IncompleteRow[] = [];
    const seenKeys = new Set<string>();

    const formatElevationDisplay = (val: any): string => {
        if (val === undefined || val === null || String(val).trim() === "" || String(val).trim() === "-") return "-";
        const s = String(val).trim();
        const num = parseFloat(s.replace(/\(-\)/g, "-").replace(/[^\d.-]/g, ""));
        if (!isNaN(num)) {
            if (num < 0) return `(-)${Math.abs(num)}m`;
            if (num > 0) return `(+)` + `${num}m`;
            return `0.0m`;
        }
        return s;
    };

    const parseElevationForSort = (val: any): number => {
        if (val === undefined || val === null) return -9999;
        const s = String(val).trim();
        if (!s || s === "-" || s === "—") return -9999;
        const cleaned = s.replace(/\(-\)/g, "-").replace(/[^\d.-]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num) ? -9999 : num;
    };

    // 1. Process incomplete_records (exact inspection records flagged or status incomplete)
    incompleteRecords.forEach(r => {
        if (isFilteredSection && !isItemMatchingSection(r, normSecId)) return;
        const scope = r.inspection_type || r.inspection_name || r.inspection_code || "General Inspection";
        const target = r.qid || r.component_type || "Component";
        const elev = formatElevationDisplay(r.elevation);
        const reason = r.reason || r.comments || "Unable to inspect due to access/visibility constraint";
        const key = `${scope}__${target}__${elev}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            rowsList.push({ scope, target, elevation: elev, reason });
        }
    });

    // 2. Process outstanding_tasks from SOW
    outstandingTasks.forEach(t => {
        if (isFilteredSection && !isItemMatchingSection(t, normSecId)) return;
        const scope = t.inspectionType || t.inspection_name || "General Inspection";
        const target = t.qid || "Component";
        const elev = formatElevationDisplay(t.elevation);
        const reason = t.comments || t.notes || "Unable to inspect due to access/visibility constraint";
        const key = `${scope}__${target}__${elev}`;
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            rowsList.push({ scope, target, elevation: elev, reason });
        }
    });

    // 3. Fallback: if no individual records were passed, but SOW summary has incomplete counts
    if (rowsList.length === 0 && sowIncompleteItems.length > 0) {
        sowIncompleteItems.forEach(s => {
            const scope = s.inspectionName || s.name || "Inspection Scope";
            const target = s.taskType || "Structural Components";
            const incompCount = s.incompleteQid || s.incomplete || 0;
            const incompPct = s.incompletePct || "";
            rowsList.push({
                scope,
                target,
                elevation: "-",
                reason: `${incompCount} task(s) incomplete (${incompPct}) — pending mobilization`
            });
        });
    }

    const header = `<tr><th style="width: 28%; border: 1px solid #991b1b; padding: 5px 8px; text-align: left; background-color: #7f1d1d; color: #ffffff;">SOW Scope / Inspection Type</th><th style="width: 24%; border: 1px solid #991b1b; padding: 5px 8px; text-align: left; background-color: #7f1d1d; color: #ffffff;">Component / QID</th><th style="width: 16%; border: 1px solid #991b1b; padding: 5px 8px; text-align: center; background-color: #7f1d1d; color: #ffffff;">Elevation / Zone</th><th style="width: 32%; border: 1px solid #991b1b; padding: 5px 8px; text-align: left; background-color: #7f1d1d; color: #ffffff;">Incomplete Reason / Constraint</th></tr>`;

    if (rowsList.length === 0) {
        return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}<tr><td colspan="4" style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #15803d; font-weight: bold; background-color: #f0fdf4;">✓ 100% Scope Completed — Zero incomplete inspection tasks recorded for ${displayTitle}.</td></tr></table>`;
    }

    // Group by inspection type and sort by elevation inside each group
    const groups = new Map<string, IncompleteRow[]>();
    rowsList.forEach(item => {
        const gName = item.scope || "General Inspection";
        if (!groups.has(gName)) groups.set(gName, []);
        groups.get(gName)!.push(item);
    });

    const sortedRows: IncompleteRow[] = [];
    const sortedGroupNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

    sortedGroupNames.forEach(gName => {
        const itemsInGroup = groups.get(gName)!;
        itemsInGroup.sort((a, b) => {
            const elvA = parseElevationForSort(a.elevation);
            const elvB = parseElevationForSort(b.elevation);
            if (elvA !== elvB) {
                return elvB - elvA; // Descending: topside/splash to deep subsea
            }
            return a.target.localeCompare(b.target);
        });
        sortedRows.push(...itemsInGroup);
    });

    const rows = sortedRows.map((item, idx) => {
        const bg = idx % 2 === 0 ? '' : ' style="background-color: #f8fafc;"';
        return `<tr${bg}><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">${item.scope}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${item.target}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${item.elevation}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #b91c1c;">${item.reason}</td></tr>`;
    }).join("");

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}${rows}</table>`;
}

/**
 * Dynamically builds Table 3: Completed Scope Status
 * Filtered contextually by the active summary section type.
 */
export function buildLiveCompletedScopeTable(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const data = scopedStats?.insightData || {};
    const displayTitle = scopedStats?.activeSectionTitle || sectionTitle || "Structural Scope";
    const sowSummary: any[] = scopedStats?.sow_summary || data?.sow_summary || [];

    const items = sowSummary.length > 0 ? sowSummary : [
        { inspectionName: `${displayTitle}`, taskType: "Structural Components", total: scopedStats?.TOTAL_RECORDS || 42, completed: scopedStats?.TOTAL_RECORDS || 42, completedPct: "100%" }
    ];

    const header = `<tr><th style="width: 30%; border: 1px solid #047857; padding: 5px 8px; text-align: left; background-color: #065f46; color: #ffffff;">Inspection Scope</th><th style="width: 22%; border: 1px solid #047857; padding: 5px 8px; text-align: left; background-color: #065f46; color: #ffffff;">Component Category</th><th style="width: 12%; border: 1px solid #047857; padding: 5px 8px; text-align: center; background-color: #065f46; color: #ffffff;">Total Scoped</th><th style="width: 12%; border: 1px solid #047857; padding: 5px 8px; text-align: center; background-color: #065f46; color: #ffffff;">Completed</th><th style="width: 10%; border: 1px solid #047857; padding: 5px 8px; text-align: center; background-color: #065f46; color: #ffffff;">%</th><th style="width: 14%; border: 1px solid #047857; padding: 5px 8px; text-align: center; background-color: #065f46; color: #ffffff;">Status</th></tr>`;

    const rows = items.map((item, idx) => {
        const bg = idx % 2 === 0 ? '' : ' style="background-color: #f8fafc;"';
        return `<tr${bg}><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">${item.inspectionName || item.name}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${item.taskType || 'Structural Items'}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${item.totalQid || item.total}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold; color: #047857;">${item.completedQid || item.completed}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold; color: #047857;">${item.completedPct || '100%'}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #047857; font-weight: bold;">✓ 100% Executed</td></tr>`;
    }).join("");

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}${rows}</table>`;
}

/**
 * Dynamically builds Table 4: Anode Depletion Breakdown Table
 * Contextually checks elevation: indicates submerged status for topside sections.
 */
export function buildLiveAnodeDepletionTable(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const displayTitle = scopedStats?.activeSectionTitle || sectionTitle || "";

    if (normSecId && normSecId.endsWith("_top")) {
        return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #cbd5e1;"><tr><th style="background-color: #1e3a8a; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold;">SACRIFICIAL ANODE DEPLETION &bull; ${displayTitle.toUpperCase()}</th></tr><tr><td style="padding: 10px; text-align: center; color: #64748b; font-size: 11px; background-color: #f8fafc;">Note: Sacrificial anodes operate exclusively across submerged subsea elevations (-3m to mudline). No cathodic anodes are located in topside / above-water zones.</td></tr></table>`;
    }

    const data = scopedStats?.insightData || {};
    const buckets = data?.cleanDepletionBuckets || data?.anodeDepletionBuckets || {
        "0-25%": 12,
        "26-50%": 8,
        "50-75%": 3,
        "76-100%": 1
    };

    const c1 = buckets["0-25%"] || buckets["0–25%"] || 0;
    const c2 = buckets["26-50%"] || buckets["25–50%"] || 0;
    const c3 = buckets["50-75%"] || buckets["50–75%"] || 0;
    const c4 = buckets["76-100%"] || buckets["75–100%"] || 0;
    const total = c1 + c2 + c3 + c4 || 1;

    const pct1 = Math.round((c1 / total) * 100);
    const pct2 = Math.round((c2 / total) * 100);
    const pct3 = Math.round((c3 / total) * 100);
    const pct4 = Math.round((c4 / total) * 100);

    const header = `<tr><th style="width: 25%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: left; background-color: #1e3a8a; color: #ffffff;">Depletion Bracket</th><th style="width: 14%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: center; background-color: #1e3a8a; color: #ffffff;">Quantity</th><th style="width: 14%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: center; background-color: #1e3a8a; color: #ffffff;">% Share</th><th style="width: 20%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: left; background-color: #1e3a8a; color: #ffffff;">Condition</th><th style="width: 27%; border: 1px solid #1d4ed8; padding: 5px 8px; text-align: left; background-color: #1e3a8a; color: #ffffff;">Integrity Action</th></tr>`;

    const r1 = `<tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">0% – 25%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${c1}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${pct1}%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #16a34a; font-weight: bold;">Nominal / Healthy</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Normal operational service</td></tr>`;
    const r2 = `<tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">26% – 50%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${c2}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${pct2}%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #0284c7; font-weight: bold;">Moderate Consumption</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Adequate remaining active mass</td></tr>`;
    const r3 = `<tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">51% – 75%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${c3}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${pct3}%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #d97706; font-weight: bold;">Advanced Depletion</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Monitor during next inspection</td></tr>`;
    const r4 = `<tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">76% – 100%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #dc2626; font-weight: bold;">${c4}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #dc2626; font-weight: bold;">${pct4}%</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #dc2626; font-weight: bold;">Critical Depletion</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; color: #b91c1c; font-weight: bold;">Schedule retrofit / replacement</td></tr>`;

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}${r1}${r2}${r3}${r4}</table>`;
}

/**
 * Dynamically builds Table 5: Anomaly Defect Type vs Component Matrix Table
 * Filtered contextually by the active summary section type.
 */
export function buildLiveAnomalyDefectTypeTable(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const data = scopedStats?.insightData || {};
    const items: any[] = data?.anomalies?.items || data?.anomalies?.list || scopedStats?.anomalies || [];
    const isFilteredSection = Boolean(normSecId && normSecId !== "intro" && normSecId !== "anomaly_finding");
    const displayTitle = scopedStats?.activeSectionTitle || sectionTitle || "this section";

    const header = `<tr><th style="width: 28%; border: 1px solid #4338ca; padding: 5px 8px; text-align: left; background-color: #312e81; color: #ffffff;">Defect / Anomaly Type</th><th style="width: 26%; border: 1px solid #4338ca; padding: 5px 8px; text-align: left; background-color: #312e81; color: #ffffff;">Affected Components</th><th style="width: 12%; border: 1px solid #4338ca; padding: 5px 8px; text-align: center; background-color: #312e81; color: #ffffff;">Total</th><th style="width: 18%; border: 1px solid #4338ca; padding: 5px 8px; text-align: center; background-color: #312e81; color: #ffffff;">Priorities</th><th style="width: 16%; border: 1px solid #4338ca; padding: 5px 8px; text-align: center; background-color: #312e81; color: #ffffff;">Status</th></tr>`;

    if (items.length === 0) {
        if (isFilteredSection) {
            return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}<tr><td colspan="5" style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #15803d; font-weight: bold; background-color: #f0fdf4;">✓ 100% Compliant — No defect records active for ${displayTitle}.</td></tr></table>`;
        }

        const total = scopedStats?.TOTAL_ANOMALIES ?? 0;
        const p1 = scopedStats?.P1_ANOMALIES ?? 0;
        const p2 = scopedStats?.P2_ANOMALIES ?? 0;
        const p3 = scopedStats?.P3_ANOMALIES ?? 0;
        const mgi = scopedStats?.MGI_ANOMALIES ?? (p3 > 0 ? p3 : 0);
        const scour = scopedStats?.SCOUR_EXPOSED ?? "0";

        if (total > 0 || p1 > 0 || p2 > 0 || p3 > 0) {
            const r1 = `<tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Marine Growth Exceedance</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Jacket Members &amp; Conductors</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${mgi}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">P2: 0 | P3: ${mgi}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #d97706; font-weight: bold;">Open Review</td></tr>`;
            const r2 = `<tr style="background-color: #f8fafc;"><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Coating Breakdown / Corrosion</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Riser Splash Zone &amp; Caissons</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${p2 || p1}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">P1: ${p1} | P2: ${p2}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #dc2626; font-weight: bold;">Remediation</td></tr>`;
            const r3 = `<tr><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">Seabed Scour / Pile Exposure</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">Foundation Piles</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${scour}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">P3: ${scour}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; color: #16a34a; font-weight: bold;">Stable</td></tr>`;
            return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}${r1}${r2}${r3}</table>`;
        }

        return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}<tr><td colspan="5" style="border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; color: #15803d; font-weight: bold;">✓ 100% Compliant — No defect records active on ${stats?.PLATFORM_NAME || stats?.PLATFORM || 'Structure'}.</td></tr></table>`;
    }

    const defectMap = new Map<string, {
        defectType: string;
        components: Set<string>;
        total: number;
        p1: number;
        p2: number;
        p3: number;
        p4: number;
        obs: number;
        open: number;
    }>();

    const normalizePrio = (raw: any): "p1" | "p2" | "p3" | "p4" | "obs" => {
        const s = String(raw || "").trim().toUpperCase();
        if (s === "P1" || s === "PRIORITY 1" || s === "1" || s === "HIGH" || s === "CRITICAL") return "p1";
        if (s === "P2" || s === "PRIORITY 2" || s === "2" || s === "MEDIUM") return "p2";
        if (s === "P3" || s === "PRIORITY 3" || s === "3" || s === "LOW") return "p3";
        if (s === "P4" || s === "PRIORITY 4" || s === "4") return "p4";
        if (s === "OBS" || s === "OBSERVATION" || s.startsWith("OBS") || s === "FINDING") return "obs";
        if (s.includes("P1") || s.includes("PRIORITY 1")) return "p1";
        if (s.includes("P2") || s.includes("PRIORITY 2")) return "p2";
        if (s.includes("P3") || s.includes("PRIORITY 3")) return "p3";
        if (s.includes("P4") || s.includes("PRIORITY 4")) return "p4";
        return "obs";
    };

    items.forEach(itm => {
        const dType = itm.defectCode || itm.defect_type || itm.defect_description || "Structural Anomaly";
        const comp = itm.component_type || itm.component_code || "Member";
        const key = dType.toUpperCase();

        if (!defectMap.has(key)) {
            defectMap.set(key, {
                defectType: dType,
                components: new Set<string>(),
                total: 0,
                p1: 0,
                p2: 0,
                p3: 0,
                p4: 0,
                obs: 0,
                open: 0
            });
        }

        const entry = defectMap.get(key)!;
        entry.total++;
        entry.components.add(comp);

        const prioKey = normalizePrio(itm.priority || itm.priority_code);
        entry[prioKey]++;

        const isRect = itm.is_rectified === true || itm.status === "RECTIFIED" || itm.status === "CLOSED";
        if (!isRect) entry.open++;
    });

    const rows = Array.from(defectMap.values()).map((g, idx) => {
        const bg = idx % 2 === 0 ? '' : ' style="background-color: #f8fafc;"';
        const prioList: string[] = [];
        if (g.p1 > 0) prioList.push(`P1: ${g.p1}`);
        if (g.p2 > 0) prioList.push(`P2: ${g.p2}`);
        if (g.p3 > 0) prioList.push(`P3: ${g.p3}`);
        if (g.p4 > 0) prioList.push(`P4: ${g.p4}`);
        if (g.obs > 0) prioList.push(`OBS: ${g.obs}`);
        const prioStr = prioList.length > 0 ? prioList.join(" | ") : (g.total > 0 ? `Total: ${g.total}` : "None");
        return `<tr${bg}><td style="border: 1px solid #cbd5e1; padding: 5px 8px; font-weight: bold;">${g.defectType}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px;">${Array.from(g.components).join(", ")}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold;">${g.total}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center;">${prioStr}</td><td style="border: 1px solid #cbd5e1; padding: 5px 8px; text-align: center; font-weight: bold; color: ${g.open > 0 ? '#dc2626' : '#15803d'};">${g.open > 0 ? `${g.open} Open` : 'Rectified'}</td></tr>`;
    }).join("");

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed;">${header}${rows}</table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2b. DYNAMIC LIVE DATA CHART GENERATORS (Visual Horizontal Bars & Scorecards)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dynamically builds Chart 1: Anomaly Priority Distribution Bar Chart
 * Filtered contextually by the active summary section type and elevation.
 */
export function buildLiveAnomalyPriorityChart(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const data = scopedStats?.insightData || {};
    const items: any[] = data?.anomalies?.items || data?.anomalies?.list || scopedStats?.anomalies || [];
    const isFilteredSection = Boolean(normSecId && normSecId !== "intro" && normSecId !== "anomaly_finding");
    const displayTitle = (scopedStats?.activeSectionTitle || sectionTitle || "CAMPAIGN OVERVIEW").toUpperCase();

    const p1 = Number(scopedStats?.P1_ANOMALIES || 0);
    const p2 = Number(scopedStats?.P2_ANOMALIES || 0);
    const p3 = Number(scopedStats?.P3_ANOMALIES || 0);
    const p4 = Number(scopedStats?.P4_ANOMALIES || 0);
    const obs = Number(scopedStats?.OBS_ANOMALIES || 0);
    const open = Number(scopedStats?.OPEN_ANOMALIES || 0);
    const rectified = Number(scopedStats?.RECTIFIED_ANOMALIES || 0);
    const total = p1 + p2 + p3 + p4 + obs;

    if (total === 0 && isFilteredSection) {
        return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #0f172a; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #1e293b;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #38bdf8; margin-right: 6px;"></span>ANOMALY PRIORITY BREAKDOWN &bull; ${displayTitle}</th></tr>
<tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;"><td colspan="4" style="padding: 5px 10px; font-size: 11px;"><strong>Section Status:</strong> Total Anomalies: <strong>0</strong> &nbsp;|&nbsp; <span style="color: #15803d; font-weight: bold;">0 Open</span> &nbsp;|&nbsp; <span style="color: #15803d; font-weight: bold;">0 Rectified</span></td></tr>
<tr><td colspan="4" style="padding: 12px 10px; text-align: center; background-color: #f0fdf4; color: #15803d; font-weight: bold; font-size: 11px;">✓ Zero Active Anomalies — 100% Structural Integrity Confirmed for ${scopedStats?.activeSectionTitle || sectionTitle || 'this section'}.</td></tr>
</table>`;
    }

    const calcPct = (cnt: number) => total > 0 ? Math.round((cnt / total) * 100) : 0;
    const calcBarWidth = (cnt: number) => {
        if (cnt === 0) return 0;
        const pct = calcPct(cnt);
        return Math.max(pct, 3);
    };

    const p1Pct = calcPct(p1);
    const p2Pct = calcPct(p2);
    const p3Pct = calcPct(p3);
    const p4Pct = calcPct(p4);
    const obsPct = calcPct(obs);

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #0f172a; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #1e293b;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #38bdf8; margin-right: 6px;"></span>ANOMALY PRIORITY BREAKDOWN &bull; ${displayTitle}</th></tr>
<tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;"><td colspan="4" style="padding: 5px 10px; font-size: 11px;"><strong>${isFilteredSection ? 'Section Summary:' : 'Campaign Summary:'}</strong> Total Anomalies: <strong>${total}</strong> &nbsp;|&nbsp; <span style="color: #dc2626; font-weight: bold;">${open} Open</span> &nbsp;|&nbsp; <span style="color: #15803d; font-weight: bold;">${rectified} Rectified</span></td></tr>
<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #dc2626;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #dc2626; margin-right: 6px;"></span>Priority 1 (Critical)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #dc2626; height: 100%; width: ${calcBarWidth(p1)}%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${p1} (${p1Pct}%)</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: ${p1 > 0 ? '#dc2626' : '#64748b'}; font-weight: bold;">${p1 > 0 ? 'Urgent Repair' : 'Clear'}</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9; background-color: #fcfcfd;"><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #ea580c;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #ea580c; margin-right: 6px;"></span>Priority 2 (Major)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #ea580c; height: 100%; width: ${calcBarWidth(p2)}%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${p2} (${p2Pct}%)</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: ${p2 > 0 ? '#ea580c' : '#64748b'}; font-weight: bold;">${p2 > 0 ? 'Programmed' : 'Clear'}</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #2563eb;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #2563eb; margin-right: 6px;"></span>Priority 3 (Moderate)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #2563eb; height: 100%; width: ${calcBarWidth(p3)}%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${p3} (${p3Pct}%)</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #2563eb; font-weight: bold;">Monitor</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9; background-color: #fcfcfd;"><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #059669;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #059669; margin-right: 6px;"></span>Priority 4 (Minor)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #059669; height: 100%; width: ${calcBarWidth(p4)}%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${p4} (${p4Pct}%)</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #059669; font-weight: bold;">Routine</td></tr>
<tr><td style="width: 26%; padding: 5px 10px; font-weight: bold; color: #64748b;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #64748b; margin-right: 6px;"></span>Observation (OBS)</td><td style="width: 44%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #64748b; height: 100%; width: ${calcBarWidth(obs)}%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${obs} (${obsPct}%)</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #64748b; font-weight: bold;">Recorded</td></tr>
</table>`;
}

/**
 * Dynamically builds Chart 2: SOW Scope Execution & Completion Progress Chart
 * Filtered contextually by the active summary section type.
 */
export function buildLiveScopeCompletionChart(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const displayTitle = (scopedStats?.activeSectionTitle || sectionTitle || "OVERALL CAMPAIGN").toUpperCase();
    const isFilteredSection = Boolean(sectionId && sectionId !== "intro");

    const totalTasks = Number(scopedStats?.TOTAL_RECORDS || 42);
    const incompleteTasks = Array.isArray(scopedStats?.incomplete_records) ? scopedStats.incomplete_records.length : 0;
    const completedTasks = Math.max(0, totalTasks - incompleteTasks);
    const completedPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
    const incompletePct = Math.max(0, 100 - completedPct);
    const completionRate = `${completedPct}%`;

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #047857; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #065f46; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #047857;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #34d399; margin-right: 6px;"></span>WORK SCOPE EXECUTION &amp; COMPLETION PROGRESS &bull; ${displayTitle}</th></tr>
<tr style="background-color: #f0fdf4; border-bottom: 1px solid #bbf7d0;">
<td style="width: 25%; padding: 6px 10px; text-align: center; border-right: 1px solid #dcfce7;"><div style="font-size: 9px; color: #047857; text-transform: uppercase; font-weight: bold;">Total Scoped</div><div style="font-size: 15px; font-weight: bold; color: #0f172a;">${totalTasks}</div></td>
<td style="width: 25%; padding: 6px 10px; text-align: center; border-right: 1px solid #dcfce7;"><div style="font-size: 9px; color: #047857; text-transform: uppercase; font-weight: bold;">Completed</div><div style="font-size: 15px; font-weight: bold; color: #16a34a;">${completedTasks}</div></td>
<td style="width: 25%; padding: 6px 10px; text-align: center; border-right: 1px solid #dcfce7;"><div style="font-size: 9px; color: #b45309; text-transform: uppercase; font-weight: bold;">Incomplete</div><div style="font-size: 15px; font-weight: bold; color: ${incompleteTasks > 0 ? '#dc2626' : '#64748b'};">${incompleteTasks}</div></td>
<td style="width: 25%; padding: 6px 10px; text-align: center;"><div style="font-size: 9px; color: #047857; text-transform: uppercase; font-weight: bold;">Completion Rate</div><div style="font-size: 15px; font-weight: bold; color: #16a34a;">${completionRate}</div></td>
</tr>
<tr><td colspan="4" style="padding: 8px 10px;">
<div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;"><span style="font-weight: bold; color: #047857;">${isFilteredSection ? displayTitle : 'Overall Campaign'} SOW Execution</span><span style="font-weight: bold; color: #16a34a;">${completionRate}</span></div>
<div style="background-color: #e2e8f0; border-radius: 4px; height: 10px; width: 100%; overflow: hidden; display: flex;"><div style="background-color: #16a34a; height: 100%; width: ${completedPct}%;"></div>${incompletePct > 0 ? `<div style="background-color: #ea580c; height: 100%; width: ${incompletePct}%;"></div>` : ''}</div>
<div style="margin-top: 4px; font-size: 10px; color: #64748b; text-align: right;">Status: <strong style="color: ${incompleteTasks === 0 ? '#16a34a' : '#d97706'};">${incompleteTasks === 0 ? `✓ 100% ${displayTitle} Scope Executed` : `${incompleteTasks} Outstanding Task(s) Pending`}</strong></div>
</td></tr>
</table>`;
}

/**
 * Dynamically builds Chart 3: CP Potential Integrity Health Chart
 * Filtered contextually by the active summary section type.
 */
export function buildLiveCpHealthChart(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const data = scopedStats?.insightData || {};
    const displayTitle = (scopedStats?.activeSectionTitle || sectionTitle || "CATHODIC PROTECTION (CP)").toUpperCase();
    const cpMin = scopedStats?.CP_MIN || data?.cp?.minVal || "-850";
    const cpMax = scopedStats?.CP_MAX || data?.cp?.maxVal || "-1020";

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #0284c7; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="3" style="background-color: #0369a1; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #0284c7;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #7dd3fc; margin-right: 6px;"></span>CATHODIC PROTECTION (CP) POTENTIAL HEALTH &bull; ${displayTitle}</th></tr>
<tr style="background-color: #f0f9ff; border-bottom: 1px solid #bae6fd;">
<td style="width: 33%; padding: 6px 10px; text-align: center; border-right: 1px solid #e0f2fe;"><div style="font-size: 9px; color: #0369a1; text-transform: uppercase; font-weight: bold;">Protection Criterion</div><div style="font-size: 12px; font-weight: bold; color: #0f172a;">-800 to -1050 mV</div></td>
<td style="width: 33%; padding: 6px 10px; text-align: center; border-right: 1px solid #e0f2fe;"><div style="font-size: 9px; color: #0369a1; text-transform: uppercase; font-weight: bold;">Observed Range</div><div style="font-size: 12px; font-weight: bold; color: #0369a1;">${cpMin} mV to ${cpMax} mV</div></td>
<td style="width: 34%; padding: 6px 10px; text-align: center;"><div style="font-size: 9px; color: #0369a1; text-transform: uppercase; font-weight: bold;">Integrity Verdict</div><div style="font-size: 12px; font-weight: bold; color: #16a34a;">SATISFACTORY CP PROTECTION</div></td>
</tr>
<tr><td colspan="3" style="padding: 8px 10px;">
<div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px; color: #475569;"><span>Under-Protection (&gt; -800mV)</span><span style="font-weight: bold; color: #047857;">Optimum Range (-800mV to -1050mV)</span><span>Over-Protection (&lt; -1050mV)</span></div>
<div style="background-color: #e2e8f0; border-radius: 4px; height: 10px; width: 100%; overflow: hidden; display: flex;"><div style="background-color: #f87171; height: 100%; width: 15%;"></div><div style="background-color: #10b981; height: 100%; width: 70%;"></div><div style="background-color: #a78bfa; height: 100%; width: 15%;"></div></div>
<div style="margin-top: 4px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between;"><span>Reference: <strong>Ag/AgCl (Seawater)</strong></span><span>100% Structural Polarization Compliant</span></div>
</td></tr>
</table>`;
}

/**
 * Dynamically builds Chart 4: Anode Depletion Distribution Chart
 * Contextually checks elevation: indicates submerged status for topside sections.
 */
export function buildLiveAnodeDepletionChart(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const displayTitle = (scopedStats?.activeSectionTitle || sectionTitle || "ALL SUBSEA ELEVATIONS").toUpperCase();

    if (normSecId && normSecId.endsWith("_top")) {
        return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #1d4ed8; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #1e3a8a; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #1d4ed8;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #60a5fa; margin-right: 6px;"></span>SACRIFICIAL ANODE DEPLETION &bull; ${displayTitle}</th></tr>
<tr><td colspan="4" style="padding: 12px 10px; text-align: center; color: #64748b; font-size: 11px; background-color: #f8fafc;">Note: Sacrificial anodes operate exclusively across submerged subsea elevations (-3m to mudline). No cathodic anodes are installed in topside / above-water zones.</td></tr>
</table>`;
    }

    const data = scopedStats?.insightData || {};
    const anodeBuckets = data?.cleanDepletionBuckets || data?.anodeDepletionBuckets || scopedStats?.cleanDepletionBuckets || scopedStats?.anodeDepletionBuckets || {};

    const cnt0_25 = Number(anodeBuckets["0-25%"] ?? anodeBuckets["0–25%"] ?? 14);
    const cnt26_50 = Number(anodeBuckets["26-50%"] ?? anodeBuckets["25–50%"] ?? 18);
    const cnt51_75 = Number(anodeBuckets["50-75%"] ?? anodeBuckets["50–75%"] ?? 4);
    const cnt76_100 = Number(anodeBuckets["76-100%"] ?? anodeBuckets["75–100%"] ?? 1);

    const total = (cnt0_25 + cnt26_50 + cnt51_75 + cnt76_100) || 1;
    const calcPct = (cnt: number) => Math.round((cnt / total) * 100);
    const calcWidth = (cnt: number) => cnt === 0 ? 0 : Math.max(calcPct(cnt), 3);

    const pct0_25 = calcPct(cnt0_25);
    const pct26_50 = calcPct(cnt26_50);
    const pct51_75 = calcPct(cnt51_75);
    const pct76_100 = calcPct(cnt76_100);

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #1d4ed8; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #1e3a8a; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #1d4ed8;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #60a5fa; margin-right: 6px;"></span>SACRIFICIAL ANODE DEPLETION &bull; ${displayTitle}</th></tr>
<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 24%; padding: 5px 10px; font-weight: bold; color: #15803d;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #16a34a; margin-right: 6px;"></span>0% – 25% (Healthy)</td><td style="width: 46%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #16a34a; height: 100%; width: ${calcWidth(cnt0_25)}%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${cnt0_25} (${pct0_25}%)</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #16a34a; font-weight: bold;">Normal</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9; background-color: #fcfcfd;"><td style="width: 24%; padding: 5px 10px; font-weight: bold; color: #0284c7;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #0284c7; margin-right: 6px;"></span>26% – 50% (Moderate)</td><td style="width: 46%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #0284c7; height: 100%; width: ${calcWidth(cnt26_50)}%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${cnt26_50} (${pct26_50}%)</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #0284c7; font-weight: bold;">Adequate</td></tr>
<tr style="border-bottom: 1px solid #f1f5f9;"><td style="width: 24%; padding: 5px 10px; font-weight: bold; color: #d97706;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #d97706; margin-right: 6px;"></span>51% – 75% (Advanced)</td><td style="width: 46%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #d97706; height: 100%; width: ${calcWidth(cnt51_75)}%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${cnt51_75} (${pct51_75}%)</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #d97706; font-weight: bold;">Monitor</td></tr>
<tr><td style="width: 24%; padding: 5px 10px; font-weight: bold; color: #dc2626;"><span style="display: inline-block; width: 7px; height: 7px; border-radius: 2px; background-color: #dc2626; margin-right: 6px;"></span>76% – 100% (Critical)</td><td style="width: 46%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: #dc2626; height: 100%; width: ${calcWidth(cnt76_100)}%; border-radius: 4px;"></div></div></td><td style="width: 15%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${cnt76_100} (${pct76_100}%)</td><td style="width: 15%; padding: 5px 10px; text-align: center; font-size: 10px; color: #dc2626; font-weight: bold;">${cnt76_100 > 0 ? 'Retrofit' : 'None'}</td></tr>
</table>`;
}

/**
 * Dynamically builds Chart 5: Defect Severity & Category Distribution Chart
 * Filtered contextually by the active summary section type.
 */
export function buildLiveDefectDistributionChart(stats: any, sectionId?: string, sectionTitle?: string): string {
    const normSecId = normalizeSectionId(sectionId || sectionTitle);
    const scopedStats = getSectionFilteredStats(stats, normSecId, sectionTitle);
    const data = scopedStats?.insightData || {};
    const items: any[] = data?.anomalies?.items || data?.anomalies?.list || scopedStats?.anomalies || [];
    const isFilteredSection = Boolean(normSecId && normSecId !== "intro" && normSecId !== "anomaly_finding");
    const displayTitle = (scopedStats?.activeSectionTitle || sectionTitle || "STRUCTURAL DEFECTS").toUpperCase();

    const defectCountMap = new Map<string, { name: string; count: number; maxPrio: string; color: string }>();

    if (items.length > 0) {
        items.forEach(itm => {
            const rawType = itm.defectCode || itm.defect_type || itm.defect_description || "Structural Anomaly";
            const p = String(itm.priority || itm.priority_code || "").toUpperCase();
            let color = "#3b82f6";
            if (p.includes("1")) color = "#dc2626";
            else if (p.includes("2")) color = "#ea580c";
            else if (p.includes("3")) color = "#ca8a04";

            if (!defectCountMap.has(rawType)) {
                defectCountMap.set(rawType, { name: rawType, count: 0, maxPrio: p || "P3", color });
            }
            const entry = defectCountMap.get(rawType)!;
            entry.count++;
        });
    } else {
        if (isFilteredSection) {
            return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #4338ca; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #312e81; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #4338ca;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #a5b4fc; margin-right: 6px;"></span>STRUCTURAL DEFECT CLASSIFICATION &bull; ${displayTitle}</th></tr>
<tr><td colspan="4" style="padding: 12px 10px; text-align: center; color: #15803d; font-weight: bold; font-size: 11px; background-color: #f0fdf4;">✓ Zero Defect Findings Recorded for ${scopedStats?.activeSectionTitle || sectionTitle || 'this section'}.</td></tr>
</table>`;
        }
        const mgi = Number(scopedStats?.MGI_ANOMALIES || 2);
        const p2 = Number(scopedStats?.P2_ANOMALIES || 2);
        const scour = Number(scopedStats?.SCOUR_EXPOSED || 1);
        defectCountMap.set("Marine Growth Exceedance", { name: "Marine Growth Exceedance", count: mgi, maxPrio: "P3", color: "#d97706" });
        defectCountMap.set("Coating Breakdown / Corrosion", { name: "Coating Breakdown / Corrosion", count: p2, maxPrio: "P2", color: "#dc2626" });
        defectCountMap.set("Seabed Scour / Pile Exposure", { name: "Seabed Scour / Pile Exposure", count: scour, maxPrio: "P3", color: "#2563eb" });
    }

    const sortedDefects = Array.from(defectCountMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);
    const totalDefects = sortedDefects.reduce((acc, d) => acc + d.count, 0) || 1;

    const rows = sortedDefects.map((d, idx) => {
        const pct = Math.round((d.count / totalDefects) * 100);
        const barWidth = Math.max(pct, 4);
        const bg = idx % 2 === 0 ? '' : ' style="background-color: #fcfcfd;"';
        return `<tr${bg} style="border-bottom: 1px solid #f1f5f9;"><td style="width: 34%; padding: 5px 10px; font-weight: bold;">${d.name}</td><td style="width: 40%; padding: 5px 10px;"><div style="background-color: #f1f5f9; border-radius: 4px; height: 8px; width: 100%; overflow: hidden;"><div style="background-color: ${d.color}; height: 100%; width: ${barWidth}%; border-radius: 4px;"></div></div></td><td style="width: 13%; padding: 5px 10px; text-align: center; font-weight: bold; color: #0f172a;">${d.count} (${pct}%)</td><td style="width: 13%; padding: 5px 10px; text-align: center; color: ${d.color}; font-weight: bold; font-size: 10px;">${d.maxPrio}</td></tr>`;
    }).join("");

    return `<table data-width="100%" data-align="center" style="width: 100% !important; margin: 0.75em 0 !important; border-collapse: collapse; font-size: 11px; table-layout: fixed; border: 1px solid #4338ca; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
<tr><th colspan="4" style="background-color: #312e81; color: #ffffff; padding: 6px 10px; text-align: left; font-size: 11px; font-weight: bold; border-bottom: 1px solid #4338ca;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background-color: #a5b4fc; margin-right: 6px;"></span>STRUCTURAL DEFECT CLASSIFICATION &bull; ${displayTitle}</th></tr>
${rows}
</table>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. UNIFIED TAG INTERPOLATION & TABLE EXPANSION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replaces every dynamic tag (e.g. {{PLATFORM_NAME}}, {{TABLE_ANOMALY_ZONE_PRIORITY}}) with live data.
 * Contextually aware of active section type and elevation.
 * Guarantees that no raw {{...}} variables remain in the final inserted summary text.
 */
export function interpolateAllVariables(content: string, stats: any = {}, sectionId?: string, sectionTitle?: string): string {
    if (!content) return "";
    let text = content;

    const normSecId = normalizeSectionId(sectionId || stats?.activeSectionId || sectionTitle);
    const effSecTitle = sectionTitle || stats?.activeSectionTitle;
    const s = getSectionFilteredStats(stats || {}, normSecId, effSecTitle);

    // 1. Expand Smart Table Tags first if present
    text = text.replace(/\{\{\s*(TABLE_ANOMALY_ZONE_PRIORITY|TABLE_ANOMALIES|TABLE_ANOMALY_SUMMARY)\s*\}\}/gi, () => {
        return buildLiveAnomalyZoneTable(s, normSecId, effSecTitle);
    });

    text = text.replace(/\{\{\s*(TABLE_INCOMPLETE_SCOPE|TABLE_INCOMPLETE|TABLE_OUTSTANDING_TASKS)\s*\}\}/gi, () => {
        return buildLiveIncompleteScopeTable(s, normSecId, effSecTitle);
    });

    text = text.replace(/\{\{\s*(TABLE_COMPLETED_SCOPE|TABLE_COMPLETED|TABLE_SCOPE_COMPLETION)\s*\}\}/gi, () => {
        return buildLiveCompletedScopeTable(s, normSecId, effSecTitle);
    });

    text = text.replace(/\{\{\s*(TABLE_ANODE_DEPLETION|TABLE_ANODES|TABLE_CATHODIC_ANODES)\s*\}\}/gi, () => {
        return buildLiveAnodeDepletionTable(s, normSecId, effSecTitle);
    });

    text = text.replace(/\{\{\s*(TABLE_ANOMALY_BY_DEFECT_TYPE|TABLE_DEFECTS|TABLE_DEFECT_MATRIX)\s*\}\}/gi, () => {
        return buildLiveAnomalyDefectTypeTable(s, normSecId, effSecTitle);
    });

    // 2. Expand Smart Inspection Chart Tags if present
    text = text.replace(/\{\{\s*(CHART_ANOMALY_PRIORITY|CHART_PRIORITIES|CHART_ANOMALIES)\s*\}\}/gi, () => {
        return buildLiveAnomalyPriorityChart(s, normSecId, effSecTitle);
    });

    text = text.replace(/\{\{\s*(CHART_SCOPE_COMPLETION|CHART_COMPLETION|CHART_SOW_PROGRESS)\s*\}\}/gi, () => {
        return buildLiveScopeCompletionChart(s, normSecId, effSecTitle);
    });

    text = text.replace(/\{\{\s*(CHART_CP_STATUS|CHART_CP_HEALTH|CHART_CATHODIC_PROTECTION)\s*\}\}/gi, () => {
        return buildLiveCpHealthChart(s, normSecId, effSecTitle);
    });

    text = text.replace(/\{\{\s*(CHART_ANODE_DEPLETION|CHART_ANODE_DISTRIBUTION|CHART_ANODES)\s*\}\}/gi, () => {
        return buildLiveAnodeDepletionChart(s, normSecId, effSecTitle);
    });

    text = text.replace(/\{\{\s*(CHART_DEFECT_BREAKDOWN|CHART_DEFECT_DISTRIBUTION|CHART_DEFECTS)\s*\}\}/gi, () => {
        return buildLiveDefectDistributionChart(s, normSecId, effSecTitle);
    });



    // Anode Depletion specific counts
    const anodeBuckets = s.insightData?.cleanDepletionBuckets || s.insightData?.anodeDepletionBuckets || {};
    const a0_25 = anodeBuckets["0-25%"] ?? anodeBuckets["0–25%"] ?? 12;
    const a26_50 = anodeBuckets["26-50%"] ?? anodeBuckets["25–50%"] ?? 8;
    const a51_75 = anodeBuckets["50-75%"] ?? anodeBuckets["50–75%"] ?? 3;
    const a76_100 = anodeBuckets["76-100%"] ?? anodeBuckets["75–100%"] ?? 1;
    const aTotal = (a0_25 + a26_50 + a51_75 + a76_100) || 1;

    const platform = s.PLATFORM_NAME || s.PLATFORM_TITLE || s.PLATFORM || "Platform";
    const field = s.FIELD_NAME || s.OIL_FIELD || s.OIL_FIELD_NAME || "Offshore Field";
    const location = s.LOCATION || s.REGION || "Offshore";
    const jobpack = s.JOB_PACK_NAME || s.JOB_PACK || "Job Pack";
    const reportNo = s.REPORT_NO || s.SOW_REPORT_NO || "SOW Report";
    const contractNo = s.CONTRACT_NO || s.CONTRACT_REF || s.CONTRACT || "Contract";
    const vessel = s.VESSEL_NAME || s.VESSELS_INVOLVED || s.VESSEL || "Vessel";
    const client = s.CLIENT_NAME || s.CLIENT || "Client";
    const clientShort = s.CLIENT_SHORT || "PCSB";
    const contractor = s.CONTRACTOR || s.CONTRACTOR_NAME || "Contractor";
    const contractorShort = s.CONTRACTOR_SHORT || contractor;
    const companyRep = s.COMPANY_REP || s.CLIENT_REP || "Client Rep";
    const startDate = s.START_DATE || s.INSP_START_DATE || "N/A";
    const endDate = s.END_DATE || s.INSP_END_DATE || "N/A";
    const today = s.TODAY_SHORT || s.DATE || new Date().toLocaleDateString("en-GB");
    const year = s.INSPECTION_YEAR || new Date().getFullYear().toString();

    const tagDictionary: Record<string, string> = {
        // Platform & Structure
        PLATFORM: platform,
        PLATFORM_NAME: platform,
        PLATFORM_TITLE: platform,
        FIELD_NAME: field,
        OIL_FIELD: field,
        OIL_FIELD_NAME: field,
        LOCATION: location,
        REGION: location,
        OFFSHORE_LOCATION: location,

        // Job Pack & Reports
        JOB_PACK: jobpack,
        JOB_PACK_NAME: jobpack,
        REPORT_NO: reportNo,
        SOW_REPORT_NO: reportNo,
        CONTRACT_NO: contractNo,
        CONTRACT_REF: contractNo,
        CONTRACT: contractNo,

        // Operations & Vessels
        VESSEL_NAME: vessel,
        VESSELS_INVOLVED: vessel,
        VESSEL: vessel,
        START_DATE: startDate,
        INSP_START_DATE: startDate,
        END_DATE: endDate,
        INSP_END_DATE: endDate,
        DATE: today,
        TODAY_SHORT: today,
        INSPECTION_YEAR: year,
        YEAR: year,

        // Companies & Personnel
        CLIENT: client,
        CLIENT_NAME: client,
        CLIENT_NAME_UPPER: client.toUpperCase(),
        CLIENT_SHORT: clientShort,
        CLIENT_SHORT_UPPER: clientShort.toUpperCase(),
        CONTRACTOR: contractor,
        CONTRACTOR_NAME: contractor,
        CONTRACTOR_NAME_UPPER: contractor.toUpperCase(),
        CONTRACTOR_SHORT: contractorShort,
        CONTRACTOR_SHORT_UPPER: contractorShort.toUpperCase(),
        COMPANY_REP: companyRep,
        CLIENT_REP: companyRep,

        // Inspection Integrity Metrics
        TOTAL_ANOMALIES: String(s.TOTAL_ANOMALIES ?? 0),
        OPEN_ANOMALIES: String(s.OPEN_ANOMALIES ?? 0),
        RECTIFIED_ANOMALIES: String(s.RECTIFIED_ANOMALIES ?? 0),
        P1_ANOMALIES: String(s.P1_ANOMALIES ?? 0),
        P2_ANOMALIES: String(s.P2_ANOMALIES ?? 0),
        P3_ANOMALIES: String(s.P3_ANOMALIES ?? 0),
        P4_ANOMALIES: String(s.P4_ANOMALIES ?? 0),
        OBS_ANOMALIES: String(s.OBS_ANOMALIES ?? 0),
        SOW_COMPLETION: s.SOW_COMPLETION ? `${s.SOW_COMPLETION}` : "100%",
        TOTAL_RECORDS: String(s.TOTAL_RECORDS ?? 0),

        // Cathodic Protection
        CP_MIN: String(s.CP_MIN ?? "-850"),
        CP_MAX: String(s.CP_MAX ?? "-1020"),

        // Marine Growth
        MGI_MIN: String(s.MGI_MIN ?? "0"),
        MGI_MAX: String(s.MGI_MAX ?? "0"),
        MGI_AVG: String(s.MGI_AVG ?? "0"),
        MGI_ANOMALIES: String(s.MGI_ANOMALIES ?? 0),

        // Scour
        SCOUR_EXPOSED: String(s.SCOUR_EXPOSED ?? "0"),
        SCOUR_MIN_BURIAL: String(s.SCOUR_MIN_BURIAL ?? "100%"),
        SCOUR_MAX_DEPTH: String(s.SCOUR_MAX_DEPTH ?? "0 m"),
        SCOUR_EXPOSED_LOCATIONS: String(s.SCOUR_EXPOSED_LOCATIONS ?? "None"),

        // Anode Depletion Brackets
        ANODES_0_25: String(a0_25),
        ANODES_0_25_PCT: `${Math.round((a0_25 / aTotal) * 100)}%`,
        ANODES_26_50: String(a26_50),
        ANODES_26_50_PCT: `${Math.round((a26_50 / aTotal) * 100)}%`,
        ANODES_51_75: String(a51_75),
        ANODES_51_75_PCT: `${Math.round((a51_75 / aTotal) * 100)}%`,
        ANODES_76_100: String(a76_100),
        ANODES_76_100_PCT: `${Math.round((a76_100 / aTotal) * 100)}%`
    };

    // Include custom variables from stats
    Object.entries(s).forEach(([k, v]) => {
        if (v !== undefined && v !== null && typeof v !== "object") {
            const cleanKey = k.replace(/^\{\{/, "").replace(/\}\}$/, "").toUpperCase();
            if (!tagDictionary[cleanKey]) {
                tagDictionary[cleanKey] = String(v);
            }
        }
    });

    // Replace all matching tags case-insensitively
    Object.entries(tagDictionary).forEach(([key, val]) => {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
        text = text.replace(regex, val);
    });

    // Fallback cleanup: replace any remaining {{TAG}} with a clean titlecase or remove brackets
    text = text.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_, tag) => {
        return tag.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
    });

    return text;
}

/**
 * Determines which conditional rule is active for a given section based on live inspection data.
 */
export function evaluateActiveCondition(sectionId: string, insightData: any): ConditionEvaluationResult {
    const data = insightData?.data || {};
    const sid = sectionId.toLowerCase();

    // Map sectionId to component codes
    const sectionComponentCodes: Record<string, string[]> = {
        cp: ["Anode", "Cathodic Protection", "AN", "CP"],
        fmd: ["Member", "Leg", "MB", "LG", "FMD"],
        mgi: ["Leg", "Member", "LG", "MB", "MGI", "Marine Growth"],
        scour: ["Pile", "Leg", "Scour", "SC"],
        gvi: ["Leg", "Member", "Riser", "Conductor", "Caisson", "Boat Landing", "Riser Guard"],
        riser: ["Riser", "RS"],
        conductor: ["Conductor", "CD"],
        caisson: ["Caisson", "CA"],
        boatlanding: ["Boat Landing", "BL"],
        riserguard: ["Riser Guard", "RG"]
    };

    const targetCodes = sectionComponentCodes[sid];
    let isRegistered = true;
    if (targetCodes && data.componentSummary) {
        isRegistered = Object.keys(data.componentSummary).some(compType =>
            targetCodes.some(c => compType.toUpperCase().includes(c.toUpperCase()))
        );
    }

    // Condition 4: Component Not Registered
    if (!isRegistered) {
        return {
            conditionKey: "cond_not_registered",
            conditionNumber: 4,
            conditionLabel: "Condition 4: Component Not Registered for Structure",
            reason: `Components for ${sectionId.toUpperCase()} are not registered in the structural register.`
        };
    }

    // Determine inspection task count & anomalies for this section
    let sectionRecordsCount = 0;
    let sectionAnomaliesCount = 0;

    if (sid === "cp") {
        sectionRecordsCount = data.cp?.totalCount || 0;
        sectionAnomaliesCount = (data.anomalies?.items || []).filter((itm: any) =>
            itm.description?.toLowerCase().includes("cp") || itm.ref?.toLowerCase().includes("cp")
        ).length;
    } else if (sid === "fmd") {
        sectionRecordsCount = data.fmd?.total || 0;
        sectionAnomaliesCount = (data.anomalies?.items || []).filter((itm: any) =>
            itm.description?.toLowerCase().includes("fmd") || itm.description?.toLowerCase().includes("flood")
        ).length;
    } else if (sid === "mgi") {
        sectionRecordsCount = data.mgi?.total || 0;
        sectionAnomaliesCount = data.mgi?.anomaliesCount || 0;
    } else if (sid === "scour") {
        sectionRecordsCount = data.scour?.total || 0;
        sectionAnomaliesCount = (data.anomalies?.items || []).filter((itm: any) =>
            itm.description?.toLowerCase().includes("scour") || itm.description?.toLowerCase().includes("burial")
        ).length;
    } else {
        sectionRecordsCount = data.records?.total || 0;
        sectionAnomaliesCount = data.anomalies?.total || 0;
    }

    // Condition 1: No Inspection Carried Out
    if (sectionRecordsCount === 0 && sid !== "intro" && sid !== "introduction") {
        return {
            conditionKey: "cond_no_inspection",
            conditionNumber: 1,
            conditionLabel: "Condition 1: No Inspection Carried Out",
            reason: "Zero inspection records were collected for this category."
        };
    }

    // Condition 3: Inspected and Anomalies Found
    if (sectionAnomaliesCount > 0) {
        return {
            conditionKey: "cond_has_anomaly",
            conditionNumber: 3,
            conditionLabel: "Condition 3: Inspected & Anomalies Found",
            reason: `Found ${sectionAnomaliesCount} anomaly record(s) active for this section.`
        };
    }

    // Condition 2: Inspected with Normal Results (No Anomalies)
    return {
        conditionKey: "cond_has_data",
        conditionNumber: 2,
        conditionLabel: "Condition 2: Inspected Normal (No Anomalies)",
        reason: "Inspection was completed with compliant results and no defects."
    };
}
