# Final Document & Executive Summary Template Reference Guide

A complete, persistent reference guide for building and updating Microsoft Word (`.docx`) report templates for **Final Documentation**, **Executive Summaries**, **Section Inspection Reports**, **Anomaly / Rectification Registers**, and **Incomplete Scope Breakdown**.

---

## 1. Quick Syntax Overview

Templates use standard **docxtemplater** formatting:

| Syntax Type | Syntax Example | Description |
|---|---|---|
| **Simple Value** | `{PLATFORM_NAME}` | Replaces tag with text/number string |
| **Image Tag** | `{%CLIENT_LOGO}` | Embeds an image (PNG/JPEG) into template |
| **Section Loop** | `{#ANOMALIES_ROV}` ... `{/ANOMALIES_ROV}` | Repeats a paragraph or table row for each item in the list |
| **Conditional Section** | `{#HAS_ANOMALIES}` ... `{/HAS_ANOMALIES}` | Displays the block only when items exist (`true` / non-empty array) |
| **Inverted Section** | `{^HAS_ANOMALIES}` ... `{/HAS_ANOMALIES}` | Displays when empty or `false` (e.g. "No anomalies observed") |
| **Raw XML Shading** | `{@color_xml}` or `{@COLOR_XML}` | Inserts raw Word OpenXML for cell background fill |

> **Tip:** To repeat a table row for each item, place `{#LOOP_NAME}` in the **first column** of the table row, and `{/LOOP_NAME}` in the **last column** of that same row. Word will automatically duplicate the row for every item.

---

## 2. Project & Metadata Tags

These global tags are available throughout the document:

| Tag Name | Example Value | Description |
|---|---|---|
| `{PLATFORM_NAME}` | `BARONIA-A (BN-A)` | Platform / Structure name |
| `{PLATFORM_TITLE}` | `BARONIA-A (BN-A)` | Alias for platform name |
| `{FIELD_NAME}` | `Baronia Field` | Offshore field location |
| `{JOB_PACK_NAME}` | `JP-2024-BNA-001` | Active Job Pack name |
| `{REPORT_NO}` | `SR-BNA-01` | Scope of Work Report Number |
| `{SOW_REPORT_NO}` | `SR-BNA-01` | SOW Report Number |
| `{REPORT_TYPE}` | `FINAL` | Report type (`FINAL` / `DRAFT`) |
| `{DATE}` | `05/10/2026` | Generation date (DD/MM/YYYY) |
| `{SHORT_DATE}` | `Oct 2026` | Month & Year of inspection |
| `{TODAY_SHORT}` | `05-Oct-2026` | Formatted day string |
| `{INSPECTION_YEAR}` | `2026` | Year of campaign |
| `{CLIENT_NAME}` | `PETRONAS CARIGALI SDN BHD` | Client organization |
| `{CLIENT_SHORT}` | `PCSB` | Contractor / Client short code |
| `{DEPARTMENT}` | `Structural Integrity` | Department name |
| `{PROJECT_NAME}` | `Offshore Underwater Campaign` | Project title |
| `{VESSEL_NAME}` | `SK LINE 808` | Primary inspection vessel |
| `{VESSELS_INVOLVED}`| `SK LINE 808, CREST MERCURY` | All vessels utilized |
| `{PROJECT_NO}` | `PRJ-OFF-2026-09` | Client project number |
| `{CONTRACTOR}` | `OCEANIC OFFSHORE` | Inspection contractor |
| `{START_DATE}` | `12/08/2026` | Campaign start date |
| `{END_DATE}` | `28/08/2026` | Campaign finish date |
| `{INSPECTION_MODE}` | `ROV & AIR DIVING` | Methods used |
| `{%CLIENT_LOGO}` | *(Image)* | Client company logo |

---

## 3. Executive Summary Sections Table

The table of content sections available in the template:

| Section ID | Section Title | Description & Scope |
|---|---|---|
| `intro` | **Introduction** | Background, campaign scope & vessel overview |
| `gvi` | **General Visual Inspection (GVI)** | Main structural jacket & framing members |
| `cp` | **Cathodic Potential (CP) Survey** | CP probe readings and protection levels |
| `fmd` | **Flooded Member Detection** | Ultrasonic or gamma-ray flooded checks |
| `caisson_top` | **Caisson Survey Topside** | Pump caissons, drain caissons (above water) |
| `caisson_sub` | **Caisson Survey Subsea** | Caissons, clamps, and guides (underwater) |
| `boatlanding_top` | **Boat Landing Topside** | Landing decks, steps, rubbing strips (+Elv) |
| `boatlanding_sub` | **Boat Landing Subsea** | Subsea bracing, landing supports (-Elv) |
| `riserguard_top` | **Riser Guard Topside** | Topside framework & fenders |
| `riserguard_sub` | **Riser Guard Subsea** | Subsea protection frames & guides |
| `conductor_top` | **Conductors Topside** | Conductor slots, wellhead trays (+Elv) |
| `conductor_sub` | **Conductors Subsea** | Conductor guides, framing levels (-Elv) |
| `riser` | **Riser Inspection** | Production/injection risers, clamps, flanges |
| `splashzone` | **Splash Zone Coating** | Splash zone wrapper, epoxy, and corrosion |
| `anode_gen` | **General Anode Inspection** | Jacket anode depletion & attachment |
| `anode_sel` | **Selected Anode Inspection** | Detailed anode dimensions & measurements |
| `mgi` | **Marine Growth Inspection** | Soft & hard marine growth thicknesses |
| `scour` | **Base Level / Scour Survey** | Mudline survey, seabed penetration & scour |
| `seabed` | **Seabed Survey** | Debris, seafloor topography, crater survey |
| `anode_maint` | **Anode Maintenance Work** | Retrofit anode clamping & maintenance |
| `node_cvi` | **Selected Node - CVI** | Close visual inspection of welded nodes |
| `node_mpi` | **Selected Node - MPI** | Magnetic particle inspection on welds |
| `boatbumper_top` | **Boat Bumper Topside** | Bumper shock cells, guides (+Elv) |
| `boatbumper_sub` | **Boat Bumper Subsea** | Subsea bumper supports (-Elv) |
| `anomaly_finding` | **Anomaly & Findings Summary** | Overall statistical register |
| `incomplete` | **Incomplete Scope Summary** | Scope items omitted/deferred |

---

## 4. Anomalies & Findings: ROV, Diving, Above Water & Underwater

### 4.1 Global Scope Collections

| Loop Collection | Condition Flag | Inverted Flag | Description |
|---|---|---|---|
| `{#ANOMALIES}` | `{#HAS_ANOMALIES}` | `{^HAS_ANOMALIES}` | All platform anomalies |
| `{#ANOMALIES_ROV}` | `{#HAS_ANOMALIES_ROV}` | `{^HAS_ANOMALIES_ROV}` | ROV inspection anomalies |
| `{#ANOMALIES_DIVE}` | `{#HAS_ANOMALIES_DIVE}` | `{^HAS_ANOMALIES_DIVE}` | Diver inspection anomalies |
| `{#FINDINGS}` | `{#HAS_FINDINGS}` | `{^HAS_FINDINGS}` | All general findings |
| `{#FINDINGS_ROV}` | `{#HAS_FINDINGS_ROV}` | `{^HAS_FINDINGS_ROV}` | ROV findings |
| `{#FINDINGS_DIVE}` | `{#HAS_FINDINGS_DIVE}` | `{^HAS_FINDINGS_DIVE}` | Diver findings |

---

### 4.2 Rectified vs. Not Rectified Anomalies & Remarks

Dedicated loops for anomaly rectification tracking:

| Loop Collection | Condition Flag | Description |
|---|---|---|
| `{#RECTIFIED_ANOMALIES}` | `{#HAS_RECTIFIED_ANOMALIES}` | Anomalies resolved / rectified during or after the campaign |
| `{#NOT_RECTIFIED_ANOMALIES}` | `{#HAS_NOT_RECTIFIED_ANOMALIES}` | Open / outstanding anomalies requiring future remedial action |

#### Rectification Fields Available Inside Loops:
- `{rectified}` : `"Yes"` / `"No"`
- `{rectified_status}` : `"Rectified"` / `"Not Rectified"`
- `{is_rectified}` : Boolean (`true`/`false`)
- `{rectified_remarks}` : Description of remedial work performed (e.g. *“Marine growth cleared and member re-inspected; pitting depth measured within allowable tolerance”*)
- `{rectification_remarks}` : Alias for `{rectified_remarks}`
- `{rectified_action}` : Remedial action description
- `{rectification_date}` : Date rectification was completed (e.g. `20/08/2026`)
- `{rectified_date}` : Alias for `{rectification_date}`

---

### 4.3 Section-Specific Loops (ROV / Diving / Above / Underwater)

| Component / Section | All Anomalies | ROV Specific | Diving Specific | Above Water (Topside) | Underwater (Subsea) |
|---|---|---|---|---|---|
| **GVI (Structure)** | `{#ANOMALIES_GVI}` | `{#ANOMALIES_GVI_ROV}` | `{#ANOMALIES_GVI_DIVE}` | `{#ANOMALIES_GVI_ABOVE}` | `{#ANOMALIES_GVI_UNDER}` |
| **Caissons** | `{#ANOMALIES_CAISSON}` | `{#ANOMALIES_CAISSON_ROV}` | `{#ANOMALIES_CAISSON_DIVE}` | `{#ANOMALIES_CAISSON_TOP}` | `{#ANOMALIES_CAISSON_SUB}` |
| **Conductors** | `{#ANOMALIES_CONDUCTOR}` | `{#ANOMALIES_CONDUCTOR_ROV}` | `{#ANOMALIES_CONDUCTOR_DIVE}` | `{#ANOMALIES_CONDUCTOR_TOP}` | `{#ANOMALIES_CONDUCTOR_SUB}` |
| **Risers** | `{#ANOMALIES_RISER}` | `{#ANOMALIES_RISER_ROV}` | `{#ANOMALIES_RISER_DIVE}` | `{#ANOMALIES_RISER_TOP}` | `{#ANOMALIES_RISER_SUB}` |
| **Boat Landing** | `{#ANOMALIES_BL}` | `{#ANOMALIES_BL_ROV}` | `{#ANOMALIES_BL_DIVE}` | `{#ANOMALIES_BL_TOP}` | `{#ANOMALIES_BL_SUB}` |
| **Boat Bumper** | `{#ANOMALIES_BOATBUMPER}` | `{#ANOMALIES_BOATBUMPER_ROV}` | `{#ANOMALIES_BOATBUMPER_DIVE}` | `{#ANOMALIES_BOATBUMPER_TOP}` | `{#ANOMALIES_BOATBUMPER_SUB}` |
| **Riser Guard** | `{#ANOMALIES_RISERGUARD}` | `{#ANOMALIES_RISERGUARD_ROV}` | `{#ANOMALIES_RISERGUARD_DIVE}` | `{#ANOMALIES_RISERGUARD_TOP}` | `{#ANOMALIES_RISERGUARD_SUB}` |
| **CP Survey** | `{#ANOMALIES_CP}` | `{#ANOMALIES_CP_ROV}` | `{#ANOMALIES_CP_DIVE}` | — | `{#ANOMALIES_CP}` |
| **FMD Survey** | `{#ANOMALIES_FMD}` | `{#ANOMALIES_FMD_ROV}` | `{#ANOMALIES_FMD_DIVE}` | — | `{#ANOMALIES_FMD}` |
| **Marine Growth** | `{#ANOMALIES_MGI}` | `{#ANOMALIES_MGI_ROV}` | `{#ANOMALIES_MGI_DIVE}` | — | `{#ANOMALIES_MGI}` |
| **Scour / Mudline** | `{#ANOMALIES_SCOUR}` | `{#ANOMALIES_SCOUR}` | `{#ANOMALIES_SCOUR}` | — | `{#ANOMALIES_SCOUR}` |
| **Seabed** | `{#ANOMALIES_SEABED}` | `{#ANOMALIES_SEABED}` | `{#ANOMALIES_SEABED}` | — | `{#ANOMALIES_SEABED}` |
| **Splash Zone** | `{#ANOMALIES_SPLASHZONE}`| — | `{#ANOMALIES_SPLASHZONE}`| `{#ANOMALIES_SPLASHZONE}` | — |
| **Anodes** | `{#ANOMALIES_ANODE}` | `{#ANOMALIES_ANODE}` | `{#ANOMALIES_ANODE}` | — | `{#ANOMALIES_ANODE}` |
| **Nodes (CVI/MPI)** | `{#ANOMALIES_NODE}` | `{#ANOMALIES_NODE}` | `{#ANOMALIES_NODE}` | — | `{#ANOMALIES_NODE}` |

---

### 4.4 Anomaly & Finding Record Fields (Inside Loops)

| Tag Inside Loop | Example Value | Description |
|---|---|---|
| `{no}` or `{id}` | `1`, `2`, `3` | Sequential row number |
| `{qid}` | `M-L1-L2` | Unique Component Quick ID |
| `{component_type}` | `MAIN MEMBER` | Component type description |
| `{elevation}` | `(-)15.5m` | Elevation or water depth |
| `{defect_code}` | `CORR` | Defect classification code |
| `{defect_description}`| `Severe pitting corrosion on brace face` | Anomaly description |
| `{findings}` | `Heavy barnacle accumulation with coating breakdown` | Inspection observation |
| `{priority}` | `P1`, `P2`, `P3`, `OBS` | Anomaly priority rating |
| `{status}` | `Open` / `Rectified` | Remediation status |
| `{rectified}` | `Yes` / `No` | Boolean rectified flag |
| `{rectified_remarks}` | `Repaired and recoated on site` | Remedial action remarks |
| `{rectification_date}`| `18/08/2026` | Date rectified |
| `{anom_no}` | `ANM-001` | Anomaly reference identifier |
| `{dive_no}` | `DIVE-04` or `ROV-02` | Dive or ROV run number |
| `{date}` | `15/08/2026` | Date defect recorded |
| `{@color_xml}` | `<w:tcPr><w:shd w:fill="FF0000"/></w:tcPr>` | Cell background shading XML |

---

## 5. Incomplete Scope & Outstanding Tasks Register

When tasks cannot be completed due to environmental conditions, access limitations, permit delays, or operational constraints, use the Incomplete Scope collections.

### 5.1 Incomplete Scope Collections

| Loop Collection | Condition Flag | Inverted Flag | Description |
|---|---|---|---|
| `{#INCOMPLETE_RECORDS}` | `{#HAS_INCOMPLETE_RECORDS}` | `{^HAS_INCOMPLETE_RECORDS}` | All incomplete inspection records |
| `{#INCOMPLETE_ROV}` | `{#HAS_INCOMPLETE_ROV}` | `{^HAS_INCOMPLETE_ROV}` | ROV incomplete scope items |
| `{#INCOMPLETE_DIVE}` | `{#HAS_INCOMPLETE_DIVE}` | `{^HAS_INCOMPLETE_DIVE}` | Diver incomplete scope items |
| `{#OUTSTANDING_TASKS}` | `{#HAS_OUTSTANDING_TASKS}` | `{^HAS_OUTSTANDING_TASKS}` | Scope of work outstanding task items |

### 5.2 Available Incomplete Fields Inside Loops

| Tag Inside Loop | Example Value | Description |
|---|---|---|
| `{no}` or `{id}` | `1`, `2`, `3` | Sequential row number |
| `{qid}` | `K-BRACE-ELV-24` | Component Quick ID |
| `{component_type}` | `HORIZONTAL BRACE` | Component type |
| `{elevation}` | `(-)24.0m` | Elevation or water depth |
| `{inspection_type}` | `FMD` or `CLOSE VISUAL` | Type of inspection |
| `{task_name}` | `FMD - K-BRACE-ELV-24` | Inspection task name |
| `{status}` | `INCOMPLETE` | Status identifier |
| `{incomplete_reason}` | `Heavy sea state & current (>3.5 knots)` | Primary reason task was not completed |
| `{reason}` | `Heavy sea state & current (>3.5 knots)` | Alias for `{incomplete_reason}` |
| `{remarks}` | `Diver attempted twice; visibility <0.3m` | Detailed field remarks from dive supervisor |
| `{action_plan}` | `To be deferred to next campaign (Q2 2027)` | Recommended remedial/deferred action |
| `{dive_no}` | `DIVE-12` | Dive or ROV run number |

---

## 6. Detailed Inspection Records Loops (Table of Results)

To print full tabular inspection registers:

| Section | Loop Tag | Condition Tag | Typical Columns |
|---|---|---|---|
| **GVI (All)** | `{#RECORDS_GVI}` | `{#HAS_RECORDS_GVI}` | `{no}`, `{qid}`, `{elevation}`, `{description}` |
| **GVI (ROV)** | `{#RECORDS_GVI_ROV}` | `{#HAS_RECORDS_GVI_ROV}` | `{no}`, `{qid}`, `{elevation}`, `{description}` |
| **GVI (Diver)** | `{#RECORDS_GVI_DIVE}` | `{#HAS_RECORDS_GVI_DIVE}` | `{no}`, `{qid}`, `{elevation}`, `{description}` |
| **CP (ROV)** | `{#RECORDS_CP_ROV}` | `{#HAS_RECORDS_CP_ROV}` | `{no}`, `{qid}`, `{elevation}`, `{cp_reading}`, `{status}` |
| **CP (Diver)** | `{#RECORDS_CP_DIVE}` | `{#HAS_RECORDS_CP_DIVE}` | `{no}`, `{qid}`, `{elevation}`, `{cp_reading}`, `{status}` |
| **FMD (General)**| `{#RECORDS_FMD}` | `{#HAS_RECORDS_FMD}` | `{no}`, `{qid}`, `{elevation}`, `{fmd_result}`, `{signal}` |
| **MGI (Marine)** | `{#RECORDS_MGI}` | `{#HAS_RECORDS_MGI}` | `{no}`, `{elevation}`, `{hard_thickness}`, `{soft_thickness}` |
| **Scour Survey** | `{#RECORDS_SCOUR}` | `{#HAS_RECORDS_SCOUR}` | `{no}`, `{leg_id}`, `{scour_depth}`, `{scour_width}` |
| **Seabed** | `{#RECORDS_SEABED}` | `{#HAS_RECORDS_SEABED}` | `{no}`, `{item_desc}`, `{location}`, `{debris_size}` |

---

## 7. Statistical Summary Tables & Priority Shading

### 7.1 Anomaly Statistical Table (`{#ANOMALY_SUMMARY_TABLE}`)

Loop across `{#ANOMALY_SUMMARY_TABLE}` to generate the standard matrix:

```
+------------------+-----------------+---------------+-------------+
| Category         | Not Rectified   | Rectified     | Total       |
+------------------+-----------------+---------------+-------------+
| {#ANOMALY_SUMMARY_TABLE}{name} | {not_rectified} | {rectified} | {total}{/ANOMALY_SUMMARY_TABLE} |
+------------------+-----------------+---------------+-------------+
| TOTAL            | {ANOMALY_SUMMARY_TOTAL_NOT_RECTIFIED} | {ANOMALY_SUMMARY_TOTAL_RECTIFIED} | {ANOMALY_SUMMARY_TOTAL} |
+------------------+-----------------+---------------+-------------+
```

Individual summary count tags:
- Observation: `{OBS_TOTAL}`, `{OBS_RECTIFIED}`, `{OBS_NOT_RECTIFIED}`
- Priority 1: `{P1_TOTAL}`, `{P1_RECTIFIED}`, `{P1_NOT_RECTIFIED}`
- Priority 2: `{P2_TOTAL}`, `{P2_RECTIFIED}`, `{P2_NOT_RECTIFIED}`
- Priority 3: `{P3_TOTAL}`, `{P3_RECTIFIED}`, `{P3_NOT_RECTIFIED}`

---

## 8. Structure Visuals & Graphical Charts

### 8.1 Engineering Drawings / Platform Visuals

Platform layout sketches, elevation drawings, and structural visuals:

| Block Tag | Condition Tag | Fields Available Inside Loop |
|---|---|---|
| `{#STRUCTURE_VISUALS}` | `{#HAS_VISUALS}` | `{%photo}`, `{title}`, `{description}` |

**Template Example:**
```
{#HAS_VISUALS}
{#STRUCTURE_VISUALS}
Figure: {title}
{%photo}
Description: {description}
{/STRUCTURE_VISUALS}
{/HAS_VISUALS}
```

### 8.2 Graphical Charts

Insert these image placeholders into your template:
- `{%MGI_GRAPH}` : Marine Growth Profile Chart vs Water Depth
- `{%SEABED_GRAPH}` : Seabed Bathymetry & Seabed Survey Map

---

## 9. Ready-to-Copy DOCX Table Templates

### Copy-Paste Template 1: Rectified Anomalies Register

```
{#HAS_RECTIFIED_ANOMALIES}
Summary of Rectified Anomalies
+----+---------+-----------+----------------------+----------+-----------------------+------------+
| No | QID     | Elevation | Anomaly Description  | Priority | Rectification Remarks | Date       |
+----+---------+-----------+----------------------+----------+-----------------------+------------+
| {#RECTIFIED_ANOMALIES}{no} | {qid} | {elevation} | {defect_description} | {priority} | {rectified_remarks} | {rectification_date}{/RECTIFIED_ANOMALIES} |
+----+---------+-----------+----------------------+----------+-----------------------+------------+
{/HAS_RECTIFIED_ANOMALIES}
```

### Copy-Paste Template 2: Incomplete Scope & Reasons Register

```
{#HAS_INCOMPLETE_RECORDS}
Incomplete Inspection Scope Summary
+----+---------+-----------+------------------+--------------------------------+-----------------------+--------------------+
| No | QID     | Elevation | Inspection Type  | Incomplete Reason              | Field Remarks         | Proposed Action    |
+----+---------+-----------+------------------+--------------------------------+-----------------------+--------------------+
| {#INCOMPLETE_RECORDS}{no} | {qid} | {elevation} | {inspection_type} | {incomplete_reason} | {remarks} | {action_plan}{/INCOMPLETE_RECORDS} |
+----+---------+-----------+------------------+--------------------------------+-----------------------+--------------------+
{/HAS_INCOMPLETE_RECORDS}
```

### Copy-Paste Template 3: ROV vs Diver Anomaly Register

```
{#HAS_ANOMALIES_ROV}
ROV Anomalies
+----+---------+-----------+--------------------+----------+--------+-----------------------+
| No | QID     | Elevation | Defect Description | Priority | Status | Remedial Remarks      |
+----+---------+-----------+--------------------+----------+--------+-----------------------+
| {#ANOMALIES_ROV}{no} | {qid} | {elevation} | {defect_description} | {priority} | {status} | {rectified_remarks}{/ANOMALIES_ROV} |
+----+---------+-----------+--------------------+----------+--------+-----------------------+
{/HAS_ANOMALIES_ROV}

{#HAS_ANOMALIES_DIVE}
Diver Anomalies
+----+---------+-----------+--------------------+----------+--------+-----------------------+
| No | QID     | Elevation | Defect Description | Priority | Status | Remedial Remarks      |
+----+---------+-----------+--------------------+----------+--------+-----------------------+
| {#ANOMALIES_DIVE}{no} | {qid} | {elevation} | {defect_description} | {priority} | {status} | {rectified_remarks}{/ANOMALIES_DIVE} |
+----+---------+-----------+--------------------+----------+--------+-----------------------+
{/HAS_ANOMALIES_DIVE}
```

### Copy-Paste Template 4: Above Water vs Subsea Component Details

```
{#HAS_ANOMALIES_CAISSON_TOP}
Topside Caisson Anomalies
+----+---------+-----------+----------------------+----------+-----------------------+
| No | QID     | Elevation | Finding / Defect     | Priority | Rectification Remarks |
+----+---------+-----------+----------------------+----------+-----------------------+
| {#ANOMALIES_CAISSON_TOP}{no} | {qid} | {elevation} | {defect_description} | {priority} | {rectified_remarks}{/ANOMALIES_CAISSON_TOP} |
+----+---------+-----------+----------------------+----------+-----------------------+
{/HAS_ANOMALIES_CAISSON_TOP}

{#HAS_ANOMALIES_CAISSON_SUB}
Subsea Caisson Anomalies
+----+---------+-----------+----------------------+----------+-----------------------+
| No | QID     | Elevation | Finding / Defect     | Priority | Rectification Remarks |
+----+---------+-----------+----------------------+----------+-----------------------+
| {#ANOMALIES_CAISSON_SUB}{no} | {qid} | {elevation} | {defect_description} | {priority} | {rectified_remarks}{/ANOMALIES_CAISSON_SUB} |
+----+---------+-----------+----------------------+----------+-----------------------+
{/HAS_ANOMALIES_CAISSON_SUB}
```

---

## 10. Future Additions & Custom Variables

To add new custom fields:
1. Define custom variables under **Executive Summary Settings > Custom Variables** (e.g. `SURVEYOR_NAME`, `CLIENT_REP`, `DIVING_SUPERINTENDENT`).
2. Use uppercase `{VARIABLE_NAME}` directly in your template.
3. For additional section rules or custom components, update `constants.ts` or add rules in the **Summary Templates Dialog**.
