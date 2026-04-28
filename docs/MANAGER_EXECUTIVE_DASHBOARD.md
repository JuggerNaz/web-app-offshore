# Manager Executive Dashboard - Concept & Implementation Plan

## Executive Summary
The Manager Executive Dashboard serves as a "Command Centre" for offshore structure management. It abstracts away the complex, module-heavy operational data entry forms (like individual SOWs, daily logs, and anomaly reporting) and instead provides management with a **read-only, high-level, multi-jobpack comparative analysis** and **predictive advisory engine**.

## 1. Core Architecture & Scope Navigation

The dashboard is built on a 4-level cascading hierarchical scope. Every metric, chart, and prediction dynamically scales based on the selected scope.

```text
Global (All Assets) → Oil Field → Structure → Jobpack (Campaign)
```

1. **Global Scope (Region View):** Aggregates data across the entire database. Identifies which fields have the highest density of anomalies or the lowest structural health scores.
2. **Oil Field Scope:** Aggregates all structures within a selected field. Used to identify "hotspot" structures requiring intervention.
3. **Structure Scope:** The most critical view for trending. Displays all historical jobpacks/campaigns for a single structure side-by-side. Provides **Historical Analysis** from baseline to current.
4. **Jobpack Scope:** Deep-dive into a single campaign, showing specific SOW progress, FMD status, and **Execution Progress** breakdown.

## 2. Feature Modules

The dashboard content dynamically adjusts its tabs and visualizations based on the active scope:

### 📊 Overview (All Scopes)
- **KPI Hero Cards:** SOW Progress (ring chart), Total Inspections, Anomaly counts (Open vs Rectified), CP Averages, Anode Health averages, and flooded FMD counts.
- **Context Bar:** Scope-aware header displaying "Global Overview", "Field Insights", "Historical Analysis", or "Jobpack Details" depending on selection.

### ⚠️ Anomalies & Findings (All Scopes)
- **Priority Breakdown:** Bar chart distributing anomalies by severity (P1-P5).
- **Status Donut:** Visualizes Open vs Rectified defects.
- **Defect Distribution:** Ranks the most common defect types (e.g., severe corrosion, missing coating).

### 🔋 Anode & CP (All Scopes)
- **Anode Depletion Buckets:** Categorizes anodes into 0-25%, 25-50%, 50-75%, and 75-100% depletion ranges.
- **CP Health Gauge:** Visualizes the Min, Max, and Average CP readings against the -800mV protection threshold.

### 📈 Trends & Analysis (Scope-Specific)
The behavior of this tab changes significantly based on your navigation level:
- **Global/Field Scope:** Named "Trends & Compare". Compares aggregate metrics across different fields or structures.
- **Structure Scope:** Named **"Historical Analysis"**. Plots structural health, CP degradation, and anomaly counts chronologically across all historical jobpacks for the specific structure.
- **Jobpack Scope:** Named "Compare". Allows side-by-side comparison with other selected campaigns (up to 4).

### ⚙️ Execution Progress (Jobpack Scope only)
- **Overall Completion:** Visualizes the total jobpack scope completion percentage.
- **Structure Breakdown:** If a jobpack involves multiple structures, this provides an individual progress bar for each, allowing managers to identify which structure's scope is lagging.

### 🔮 Advisory & Predictions (All Scopes)
- **Predictive Engine:** Analyzes current data and historical trends to forecast structural risks and maintenance needs.

---

## 3. Predictive Analytics & Advisory Engine

The dashboard features a server-side calculation engine (`/api/manager-summary`) that compares historical campaigns to project future risks.

### A. Structural Integrity Score
A 0–100 overall health score (Grades A through F).
- Deducts points for P1/P2 anomalies.
- Deducts points if CP < -850mV.
- Deducts points if Anode Depletion > 60%.
- Deducts points for flooded members.

### B. Corrosion Risk Assessment
Calculates a **CRITICAL / HIGH / MODERATE / LOW** risk factor.
- Weighted heavily by the presence of active P1/P2 anomalies.
- Factored by CP degradation towards the -800mV threshold.

### C. Anode Remaining Life Projection
- **Logic:** `(Current Campaign Avg Depletion - Previous Campaign Avg Depletion) / Years Elapsed = Depletion Rate per Year`
- **Projection:** `(100 - Current Depletion) / Depletion Rate per Year = Estimated Years Remaining`

### D. CP Degradation Forecast
- **Logic:** Plots historical CP averages on a timeline to determine the slope (mV lost per year).
- **Projection:** Calculates exactly how many years until the average CP hits the `-800mV` protection barrier.

### E. Next Inspection Priority Ranking
- **Urgency Score (0-100)** calculated by combining: Time since last inspection + Anomaly severity + CP trend + Anode alerts.
- Categorizes structures into: **INSPECT FIRST**, **MONITOR**, or **LOW PRIORITY**.

---

## 4. Technical Implementation details
- **Page Route:** `app/dashboard/manager-overview/page.tsx`
- **API Endpoint:** `app/api/manager-summary/route.ts`
- **Scope State:** Managed via `ScopeSelector.tsx`, propagating filters through `summaryData` URL parameters.
- **Aggregations:** The API dynamically adjusts processing limits (up to 30 jobpacks) for global/field aggregations to ensure performance while maintaining accuracy.
- **Terminology:** Consistently uses **Structure** instead of "Platform" to accommodate various offshore asset types (Jacket, Pipeline, SBM, etc.).

---
**Maintained by**: AI Engineering Team
**Last Updated**: 2026-04-25 (Implemented Scope-Specific Analysis & Execution Tracking)
